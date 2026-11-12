/*
 * Stage 3 —— spec → THREE.Group 工厂（分阶段增量构建）
 *
 * 复用主站 3d-init.js 里那只 SDF + Surface Nets + 骨骼 + 毛发的程序化猫，
 * 不下载任何网格、不引入第二套模型。这里只负责「按 pass 把 spec 的效果
 * 一层一层施加到同一个 rig 上」：
 *
 *   blockout 只留灰模剪影 → structural 补层级/socket → form 调比例
 *   → material 上照片证据色 → surface 开绒毛 → lighting 打光
 *   → interaction 挂动画钩子 → optimization 冻结与产物校验
 *
 * 与 img2threejs 一致：输出带运行时层级（pivots / sockets / colliders /
 * userData.tick），是「可动画的模型」，不是一坨静止的 mesh。
 */

import * as THREE from 'three';
import { buildCatRig, coatFrom, getShadowTexture } from '../3d-init.js';
import { PASS_IDS } from './spec.js';

const GREY = new THREE.MeshStandardMaterial({ color: 0xb8bac0, roughness: 0.96, metalness: 0 });
GREY.name = 'recon.blockout.grey';

function materialColor(spec, id, fallback) {
  const hit = (spec.materials || []).find((m) => m.id === id);
  return hit && hit.color ? hit.color : fallback;
}

export function createModel(spec, passId = 'blockout') {
  const idx = Math.max(0, PASS_IDS.indexOf(passId));
  const q = spec.quality || { tier: 'standard', cell: 0.018, strands: 5200 };
  const rig = buildCatRig({
    id: spec.subject.id || 'recon-local',
    breed: spec.subject.breed || '',
    avatar: ''
  }, { cell: q.cell, strands: q.strands });
  const root = rig.root;
  root.name = (spec.subject.name || 'cat') + '.recon';

  const meshes = [];
  root.traverse((obj) => {
    if (obj.isMesh || obj.isSkinnedMesh || obj.isInstancedMesh) meshes.push(obj);
  });
  const originalMaterials = new Map(meshes.map((m) => [m, m.material]));
  const originalVisibility = new Map(meshes.map((m) => [m, m.visible]));
  const strandSet = new Set(rig.parts.strandMeshes || []);
  const decorations = meshes.filter((m) =>
    strandSet.has(m) || (m.material && m.material.alphaTest > 0));

  const ctx = {
    spec, rig, root, meshes, originalMaterials, originalVisibility, decorations,
    detailMeshes: [], detailMaterials: new Map(), fluffMeshes: [], detailNodes: {},
    runtime: null, tick: null, stats: null
  };

  // 细节清单里的每一项都要有真实落点：先建组件（隐藏），再由各 pass 逐层点亮
  createDetailParts(ctx);

  // 每个 pass 都从同一个干净的 blockout 基线开始，按顺序叠加效果。
  // 这样「跳阶段」「回退重跑」都不会残留上一次的状态。
  applyBaseline(ctx);
  for (let i = 0; i <= idx; i += 1) applyPass(PASS_IDS[i], ctx);

  return {
    root,
    rig,
    passId: PASS_IDS[idx],
    runtime: ctx.runtime,
    tick: ctx.tick,
    stats: ctx.stats,
    meshCount: meshes.length,
    dispose: () => disposeModel(ctx)
  };
}

/* ------------------------------------------------------------------ *
 * 细节组件：瞳孔 / 花纹锚点 / 尾色簇 / 公猫蛋蛋
 * 全部挂到 rig 已有的骨骼或 Group 上，跟着动画走，不是另摆一组静态装饰。
 * ------------------------------------------------------------------ */
function makeFluff(center, radius, count) {
  const geo = new THREE.ConeGeometry(0.0026, 0.017, 3);
  geo.translate(0, 0.0085, 0);   // 锥底落在原点，整体沿 +y
  const inst = new THREE.InstancedMesh(geo, GREY, count);
  inst.name = 'scrotum.fluff';
  inst.frustumCulled = false;
  const dummy = new THREE.Object3D();
  const up = new THREE.Vector3(0, 1, 0);
  const n = new THREE.Vector3();
  for (let i = 0; i < count; i += 1) {
    const u = (i + 0.5) / count;
    const v = Math.random();
    const theta = 2 * Math.PI * u * 7.3;
    const phi = Math.acos(2 * v - 1);
    n.set(Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta));
    dummy.position.copy(center).addScaledVector(n, radius * 0.98);
    dummy.quaternion.setFromUnitVectors(up, n);
    dummy.scale.setScalar(0.65 + Math.random() * 0.8);
    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);
  }
  inst.instanceMatrix.needsUpdate = true;
  return inst;
}

function createDetailParts(ctx) {
  const { spec, rig } = ctx;
  const t = (spec.evidence && spec.evidence.traits) || {};
  const p = rig.parts;
  const register = (mesh, materialId, opts = {}) => {
    mesh.visible = false;
    mesh.userData.reconDetail = true;
    if (opts.fluff) { mesh.userData.isFluff = true; ctx.fluffMeshes.push(mesh); }
    ctx.meshes.push(mesh);
    ctx.originalMaterials.set(mesh, GREY);
    ctx.originalVisibility.set(mesh, false);
    ctx.detailMeshes.push(mesh);
    ctx.detailMaterials.set(mesh, materialId);
  };

  // 瞳孔：竖瞳是细长胶囊，圆瞳是圆片，贴在眼球弧面前方
  const pupilShape = t.pupilShape || 'slit';
  [['pupilL', p.eyeL], ['pupilR', p.eyeR]].forEach(([name, eye]) => {
    if (!eye) return;
    const geo = pupilShape === 'slit'
      ? new THREE.CapsuleGeometry(0.011, 0.068, 3, 8)
      : new THREE.CircleGeometry(0.027, 20);
    const mesh = new THREE.Mesh(geo, GREY);
    mesh.name = name;
    mesh.position.set(0, 0, 0.052);
    eye.add(mesh);
    register(mesh, 'pupil');
    ctx.detailNodes[name] = mesh;
  });

  // 花纹锚点：花纹本身画进毛色贴图（贴合曲面，不做贴片），这里保留可挂装饰的真实节点
  const faceMark = new THREE.Group();
  faceMark.name = 'faceMark';
  faceMark.position.set(0, 0.14, 0.31);
  if (p.headRig) p.headRig.add(faceMark);
  const bodyMark = new THREE.Group();
  bodyMark.name = 'bodyMark';
  bodyMark.position.set(0, 0.10, -0.16);
  if (p.bodyRig) p.bodyRig.add(bodyMark);
  ctx.detailNodes.faceMark = faceMark;
  ctx.detailNodes.bodyMark = bodyMark;

  // 尾尖毛簇：让「尾巴颜色」在几何上也有可见落点
  const tailBone = (p.tail && p.tail[p.tail.length - 1]) || p.tailRoot;
  if (tailBone) {
    const tailTip = new THREE.Mesh(new THREE.SphereGeometry(0.048, 14, 10), GREY);
    tailTip.name = 'tailCoat';
    tailTip.position.set(0, 0.16, 0.42);   // 落在尾尖 P5（tail3 局部坐标）
    tailTip.scale.set(1, 0.9, 1.25);
    tailBone.add(tailTip);
    register(tailTip, 'tailCoat');
    ctx.detailNodes.tailCoat = tailTip;
  }

  // 公猫才有：尾巴正下方、臀部后方的一对毛茸茸蛋蛋，颜色取周围毛色
  if (spec.subject.gender === 'male' && p.bodyRig) {
    const group = new THREE.Group();
    group.name = 'scrotum';
    group.position.set(0, -0.28, -0.50);   // bodyRig 局部 → 世界约 y=0.34 / z=-0.50，正好在尾巴根正下方
    p.bodyRig.add(group);
    [-1, 1].forEach((side) => {
      const center = new THREE.Vector3(side * 0.066, 0, 0);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.070, 20, 14), GREY);
      ball.name = side < 0 ? 'scrotumL' : 'scrotumR';
      ball.position.copy(center);
      ball.scale.set(1, 1.04, 0.90);
      group.add(ball);
      register(ball, 'furColor');

      // 稍大的半透明绒毛壳，破掉光滑球体的塑料感
      const shell = new THREE.Mesh(new THREE.SphereGeometry(0.078, 16, 12), GREY);
      shell.name = 'scrotum.shell';
      shell.position.copy(center);
      shell.scale.copy(ball.scale);
      shell.userData.fluffShell = true;
      group.add(shell);
      register(shell, 'furColor', { fluff: true });

      // 沿球面法线撒短毛丝
      const fluff = makeFluff(center, 0.070, 150);
      group.add(fluff);
      register(fluff, 'furColor', { fluff: true });
    });
    ctx.detailNodes.scrotum = group;
    ctx.hasScrotum = true;
  }
}

function applyEyeShape(ctx) {
  const t = (ctx.spec.evidence && ctx.spec.evidence.traits) || {};
  const shape = t.eyeShape || 'almond';
  [[ctx.rig.parts.eyeL, -1], [ctx.rig.parts.eyeR, 1]].forEach(([eye, side]) => {
    if (!eye) return;
    if (shape === 'round') {
      eye.scale.set(0.92, 1.08, 1);
      eye.rotation.z = 0;
    } else if (shape === 'oval') {
      eye.scale.set(1.03, 0.96, 1);
      eye.rotation.z = -side * 0.04;
    } else {
      eye.scale.set(1.12, 0.82, 1);
      eye.rotation.z = -side * 0.12;
    }
  });
}

/* 面纹 / 身纹 / 尾色直接画进程序化毛色贴图的对应 UV 带，
   花纹是「长在毛上」而不是浮在表面的一张贴片。 */
function paintCoatTraits(coat, spec) {
  const canvas = coat && coat.tex && coat.tex.coat && coat.tex.coat.image;
  if (!canvas || !canvas.getContext) return;
  const c2d = canvas.getContext('2d');
  if (!c2d) return;
  const W = canvas.width, H = canvas.height;
  const t = (spec.evidence && spec.evidence.traits) || {};
  const css = (c) => `rgb(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)})`;
  const colorOf = (id, fallback) => {
    const m = (spec.materials || []).find((x) => x.id === id);
    return m && m.color ? css(m.color) : css(fallback);
  };
  const dark = { r: 110, g: 86, b: 68 };
  c2d.save();
  c2d.globalAlpha = 0.34;

  const face = t.facePattern || 'solid';
  const faceColor = colorOf('facePattern', dark);
  if (face === 'stripes') {
    c2d.strokeStyle = faceColor;
    c2d.lineWidth = W * 0.022;
    for (let i = 0; i < 7; i += 1) {
      const x = W * (0.18 + i * 0.095);
      c2d.beginPath();
      c2d.moveTo(x, H * 0.14);
      c2d.quadraticCurveTo(x + W * 0.03, H * 0.25, x, H * 0.36);
      c2d.stroke();
    }
  } else if (face === 'patch' || face === 'mask') {
    c2d.fillStyle = faceColor;
    c2d.beginPath();
    c2d.ellipse(W * 0.5, H * 0.25, W * 0.20, H * 0.11, 0, 0, Math.PI * 2);
    c2d.fill();
  }

  const body = t.bodyPattern || 'solid';
  const bodyColor = colorOf('bodyPattern', dark);
  c2d.fillStyle = bodyColor;
  if (body === 'stripes') {
    for (let i = 0; i < 9; i += 1) c2d.fillRect(W * 0.08, H * (0.42 + i * 0.030), W * 0.84, H * 0.012);
  } else if (body === 'patch' || body === 'mask') {
    [[0.30, 0.52, 0.11, 0.07], [0.68, 0.60, 0.13, 0.08], [0.48, 0.68, 0.09, 0.06]]
      .forEach(([x, y, rx, ry]) => {
        c2d.beginPath();
        c2d.ellipse(W * x, H * y, W * rx, H * ry, 0.4, 0, Math.PI * 2);
        c2d.fill();
      });
  }

  c2d.fillStyle = colorOf('tailCoat', dark);
  c2d.globalAlpha = 0.42;
  c2d.fillRect(W * 0.08, H * 0.76, W * 0.32, H * 0.20);
  c2d.restore();
  coat.tex.coat.needsUpdate = true;
}

function applyDetailMaterials(ctx) {
  const { spec } = ctx;
  const fallback = { r: 180, g: 160, b: 140 };
  ctx.detailMeshes.forEach((m) => {
    const id = ctx.detailMaterials.get(m);
    const c = materialColor(spec, id, fallback);
    m.material = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setRGB(c.r / 255, c.g / 255, c.b / 255, THREE.SRGBColorSpace),
      roughness: id === 'pupil' ? 0.30 : 0.96,
      metalness: 0,
      transparent: !!m.userData.fluffShell,
      opacity: m.userData.fluffShell ? 0.55 : 1,
      alphaTest: m.userData.fluffShell ? 0.10 : 0,
      side: THREE.DoubleSide
    });
  });
}

function applyBaseline(ctx) {
  const { meshes, rig } = ctx;
  const main = rig.parts.skinnedMesh;
  meshes.forEach((m) => {
    m.material = GREY;
    m.visible = m === main;
  });
  ctx.runtime = null;
  ctx.tick = null;
  ctx.stats = null;
  delete ctx.root.userData.sculptRuntime;
  delete ctx.root.userData.tick;
  delete ctx.root.userData.lod;
  delete ctx.root.userData.buildStats;
}

function applyPass(id, ctx) {
  switch (id) {
    case 'blockout':
      // 基线即块面：单一灰模 + 主剪影，无任何材质与细节
      break;
    case 'structural':
      applyStructural(ctx);
      break;
    case 'form':
      applyForm(ctx);
      break;
    case 'material':
      applyMaterial(ctx);
      break;
    case 'surface':
      ctx.decorations.forEach((m) => { m.visible = ctx.originalVisibility.get(m) !== false; });
      ctx.fluffMeshes.forEach((m) => { m.visible = true; });
      break;
    case 'lighting':
      // 灯光由 createLights(spec) 返回并挂到 scene，见下方导出
      break;
    case 'interaction':
      applyInteraction(ctx);
      break;
    case 'optimization':
      applyOptimization(ctx);
      break;
    default:
      break;
  }
}

function applyStructural(ctx) {
  const { spec, rig, root, meshes, originalVisibility } = ctx;
  // 结构阶段恢复全部实体组件，但仍保持灰模：先证明「结构是真的」，再谈外观
  meshes.forEach((m) => {
    if (ctx.decorations.includes(m) || ctx.detailMeshes.includes(m)) return;
    m.visible = originalVisibility.get(m) !== false;
  });

  const p = rig.parts;
  const nodes = {
    root,
    body: p.bodyRig,
    head: p.headRig,
    earL: (p.ears && p.ears[0]) || null,
    earR: (p.ears && p.ears[1]) || null,
    eyes: p.eyeL || null,
    eyeL: p.eyeL || null,
    eyeR: p.eyeR || null,
    muzzle: p.features || null,
    nose: p.features || null,
    legFL: p.legs && p.legs.frontL,
    legFR: p.legs && p.legs.frontR,
    legBL: p.legs && p.legs.backL,
    legBR: p.legs && p.legs.backR,
    tail: p.tailRoot || null,
    ...(ctx.detailNodes || {})
  };
  const runtime = {
    nodes,
    skinnedMesh: p.skinnedMesh,
    skeleton: p.skinnedMesh && p.skinnedMesh.skeleton,
    sockets: (spec.sockets || []).map((s) => ({ ...s, object: nodes[s.owner] || null })),
    colliders: (spec.colliders || []).map((c) => ({ ...c, object: nodes[c.owner] || null })),
    destructionGroups: ['tail', 'earL', 'earR']
  };
  root.userData.sculptRuntime = runtime;
  ctx.runtime = runtime;
}

function applyForm(ctx) {
  const p = ctx.spec.proportions || {};
  const parts = ctx.rig.parts;
  if (parts.headRig) parts.headRig.scale.setScalar(p.head || 1);
  if (parts.ears) parts.ears.forEach((e) => { if (e && e.scale) e.scale.setScalar(p.ear || 1); });
  if (parts.tail) parts.tail.forEach((b) => { if (b && b.scale) b.scale.setScalar(p.tail || 1); });
  if (parts.legs) Object.values(parts.legs).forEach((b) => {
    if (b && b.scale) b.scale.set(1, p.leg || 1, 1);
  });
  ctx.root.scale.set(p.chub || 1, 1, p.body || 1);
  // 形体阶段点亮细节组件（绒毛留到 surface 阶段），并按照片证据调整眼形
  ctx.detailMeshes.forEach((m) => { if (!m.userData.isFluff) m.visible = true; });
  applyEyeShape(ctx);
}

function applyMaterial(ctx) {
  const { spec, meshes, originalMaterials, rig } = ctx;
  // 先恢复 rig 自带材质，再把 spec 里由照片证据推导的颜色写进去
  meshes.forEach((m) => { m.material = originalMaterials.get(m); });
  const ev = spec.evidence || {};
  const palette = {
    base: materialColor(spec, 'coat', ev.palette && ev.palette.base) || { r: 180, g: 140, b: 100 },
    accent: materialColor(spec, 'coatPattern', ev.palette && ev.palette.accent) || { r: 90, g: 70, b: 55 },
    light: materialColor(spec, 'bib', ev.palette && ev.palette.light) || { r: 240, g: 232, b: 216 },
    eye: materialColor(spec, 'iris', ev.palette && ev.palette.eye) || { r: 122, g: 174, b: 98 },
    nose: materialColor(spec, 'nose', ev.palette && ev.palette.nose) || { r: 210, g: 150, b: 150 }
  };
  const coat = coatFrom({
    palette,
    pattern: ev.pattern || 'solid',
    bib: ev.bib !== false,
    source: 'recon'
  }, '');
  rig.applyCoat(coat);
  // 面纹 / 身纹 / 尾色画进毛色贴图，细节组件换成 spec 里的材质
  paintCoatTraits(rig.coat(), spec);
  applyDetailMaterials(ctx);
  // 毛发颜色落到全身绒毛光泽上：温和混白，避免与贴图底色叠乘后发暗
  const fur = materialColor(spec, 'furColor', palette.base);
  const furC = new THREE.Color().setRGB(fur.r / 255, fur.g / 255, fur.b / 255, THREE.SRGBColorSpace);
  const sheen = furC.clone().lerp(new THREE.Color(0xffffff), 0.55);
  ['coat', 'light', 'limb'].forEach((key) => {
    const mat = rig.materials[key];
    if (mat && mat.sheenColor) mat.sheenColor.copy(sheen);
  });
}

function applyInteraction(ctx) {
  const { root, rig } = ctx;
  const parts = rig.parts;
  const tick = (time) => {
    const t = Number(time) || 0;
    if (parts.bodyRig) parts.bodyRig.scale.y = 1 + Math.sin(t * 1.8) * 0.008;
    if (parts.headRig) parts.headRig.rotation.y = Math.sin(t * 0.45) * 0.09;
    if (parts.tail) parts.tail.forEach((b, i) => {
      if (b) b.rotation.y = Math.sin(t * 1.25 - i * 0.6) * 0.10;
    });
    root.rotation.y = Math.sin(t * 0.22) * 0.10;
  };
  root.userData.tick = tick;
  ctx.tick = tick;
}

function applyOptimization(ctx) {
  const { root, meshes } = ctx;
  root.updateMatrixWorld(true);
  // 静态件冻结自动矩阵更新；骨骼与 skinnedMesh 保持活动以便动画
  meshes.forEach((m) => {
    if (!m.isSkinnedMesh && !m.isInstancedMesh) m.matrixAutoUpdate = false;
  });
  let triangles = 0;
  meshes.forEach((m) => {
    const g = m.geometry;
    if (!g) return;
    const n = g.index ? g.index.count : (g.attributes.position ? g.attributes.position.count : 0);
    triangles += Math.floor(n / 3) * (m.isInstancedMesh ? (m.count || 1) : 1);
  });
  ctx.stats = {
    meshCount: meshes.length,
    triangles,
    skeletonBound: !!(ctx.runtime && ctx.runtime.skeleton),
    runtimeNodes: ctx.runtime ? Object.keys(ctx.runtime.nodes).length : 0
  };
  root.userData.lod = { levels: [1, 0.6, 0.3], current: 1 };
  root.userData.buildStats = ctx.stats;
}

function disposeModel(ctx) {
  ctx.meshes.forEach((m) => {
    if (m.geometry) m.geometry.dispose();
  });
  ctx.detailMeshes.forEach((m) => {
    if (m.material && m.material !== GREY) m.material.dispose();
  });
  // GREY 与 rig.materials 是共享实例，只清理本轮生成的贴图
  const coat = ctx.rig.coat();
  if (coat && coat.tex) Object.values(coat.tex).forEach((t) => { if (t && t.dispose) t.dispose(); });
  if (ctx.root.parent) ctx.root.parent.remove(ctx.root);
}

export function createLights(spec) {
  const group = new THREE.Group();
  group.name = 'recon.lighting';
  const l = spec.lighting || {};
  group.add(new THREE.HemisphereLight(0xfff6ea, 0xb09a80, l.ambient ?? 0.62));
  const key = new THREE.DirectionalLight(0xfff1de, l.key ?? 1.45);
  key.position.set(2.2, 3.4, 3.2); group.add(key);
  const fill = new THREE.DirectionalLight(0xd6e8ff, l.fill ?? 0.5);
  fill.position.set(-3, 1.2, 2.0); group.add(fill);
  const rim = new THREE.DirectionalLight(0xffd2a8, l.rim ?? 1.0);
  rim.position.set(-0.8, 2.6, -3); group.add(rim);
  const bounce = new THREE.PointLight(0xfff0e0, 0.22, 8);
  bounce.position.set(0, 0.35, 2.0); group.add(bounce);
  return group;
}

export function createShadow() {
  const material = new THREE.MeshBasicMaterial({
    map: getShadowTexture(), transparent: true, opacity: 0.9, depthWrite: false
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 1.15), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, 0.058, -0.04);
  mesh.name = 'recon.contactShadow';
  return mesh;
}

export function lightsEnabled(passId) {
  return PASS_IDS.indexOf(passId) >= PASS_IDS.indexOf('lighting');
}
