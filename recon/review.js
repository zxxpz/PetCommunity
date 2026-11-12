/*
 * Stage 4 —— Review：参考图 vs 渲染的并排评审 + 有界自纠正 + 产物导出
 *
 * 模型不负责打分，确定性脚本负责：打包一张对比图、算逐区域 CIEDE2000 色差、
 * 算轮廓覆盖率、按阈值给 pass/fail，并给出「只允许改多少」的修正建议。
 * 对应 img2threejs 的 make_comparison_sheet / material_comparator / material_feedback。
 */

import * as THREE from 'three';
import { specForExport } from './spec.js';

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function mean(list) { return list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0; }

/* ---------- CIEDE2000 ---------- */
function rgbToLab(c) {
  const f = (v) => {
    const x = v / 255;
    return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  const R = f(c.r), G = f(c.g), B = f(c.b);
  const X = (R * 0.4124564 + G * 0.3575761 + B * 0.1804375) / 0.95047;
  const Y = (R * 0.2126729 + G * 0.7151522 + B * 0.0721750);
  const Z = (R * 0.0193339 + G * 0.1191920 + B * 0.9503041) / 1.08883;
  const eps = 216 / 24389, kappa = 24389 / 27;
  const g = (t) => (t > eps ? Math.cbrt(t) : (kappa * t + 16) / 116);
  const fx = g(X), fy = g(Y), fz = g(Z);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

export function deltaE00(c1, c2) {
  const L1 = rgbToLab(c1), L2 = rgbToLab(c2);
  const rad = Math.PI / 180;
  const C1 = Math.hypot(L1.a, L1.b), C2 = Math.hypot(L2.a, L2.b);
  const Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Math.pow(Cb, 7) / (Math.pow(Cb, 7) + Math.pow(25, 7))));
  const a1p = (1 + G) * L1.a, a2p = (1 + G) * L2.a;
  const C1p = Math.hypot(a1p, L1.b), C2p = Math.hypot(a2p, L2.b);
  const hp = (a, b) => {
    if (a === 0 && b === 0) return 0;
    const h = Math.atan2(b, a) / rad;
    return h >= 0 ? h : h + 360;
  };
  const h1p = hp(a1p, L1.b), h2p = hp(a2p, L2.b);
  const dLp = L2.L - L1.L;
  const dCp = C2p - C1p;
  let dhp = h2p - h1p;
  if (C1p * C2p === 0) dhp = 0;
  else if (dhp > 180) dhp -= 360;
  else if (dhp < -180) dhp += 360;
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(dhp * rad / 2);
  const Lbp = (L1.L + L2.L) / 2;
  const Cbp = (C1p + C2p) / 2;
  let hbp;
  if (C1p * C2p === 0) hbp = h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) hbp = (h1p + h2p) / 2;
  else if (h1p + h2p < 360) hbp = (h1p + h2p + 360) / 2;
  else hbp = (h1p + h2p - 360) / 2;
  const T = 1 - 0.17 * Math.cos((hbp - 30) * rad)
    + 0.24 * Math.cos(2 * hbp * rad)
    + 0.32 * Math.cos((3 * hbp + 6) * rad)
    - 0.20 * Math.cos((4 * hbp - 63) * rad);
  const dTheta = 30 * Math.exp(-Math.pow((hbp - 275) / 25, 2));
  const Rc = 2 * Math.sqrt(Math.pow(Cbp, 7) / (Math.pow(Cbp, 7) + Math.pow(25, 7)));
  const Sl = 1 + (0.015 * Math.pow(Lbp - 50, 2)) / Math.sqrt(20 + Math.pow(Lbp - 50, 2));
  const Sc = 1 + 0.045 * Cbp;
  const Sh = 1 + 0.015 * Cbp * T;
  const Rt = -Math.sin(2 * dTheta * rad) * Rc;
  return Math.sqrt(
    Math.pow(dLp / Sl, 2) + Math.pow(dCp / Sc, 2) + Math.pow(dHp / Sh, 2)
    + Rt * (dCp / Sc) * (dHp / Sh)
  );
}

/* ---------- 渲染图采样 ---------- */
export function sampleRenderRegions(sourceCanvas, grid = 3) {
  const S = 96;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.clearRect(0, 0, S, S);
  ctx.drawImage(sourceCanvas, 0, 0, S, S);
  const data = ctx.getImageData(0, 0, S, S).data;
  const out = [];
  const cell = S / grid;
  for (let gy = 0; gy < grid; gy += 1) {
    for (let gx = 0; gx < grid; gx += 1) {
      let r = 0, g = 0, b = 0, n = 0, cells = 0;
      for (let y = Math.floor(gy * cell); y < Math.floor((gy + 1) * cell); y += 1) {
        for (let x = Math.floor(gx * cell); x < Math.floor((gx + 1) * cell); x += 1) {
          const i = (y * S + x) * 4;
          cells += 1;
          if (data[i + 3] < 128) continue;   // 透明背景不参与色差
          r += data[i]; g += data[i + 1]; b += data[i + 2]; n += 1;
        }
      }
      out.push({
        id: `r${gy}${gx}`,
        color: n ? { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) } : null,
        coverage: Number((n / (cells || 1)).toFixed(3))
      });
    }
  }
  return out;
}

/* ---------- 评审 ---------- */
const COLOR_PASSES = new Set(['material', 'surface', 'lighting']);

/* 每个 pass 只评审「本阶段该负责的东西」：
   blockout / structural / form 不该因为灰模没有颜色就被判失败；
   material 之后才把逐区域色差计入判定。对应 img2threejs 的 per-pass gates。 */
export function evaluate(spec, renderCanvas, gateResult, passId = 'blockout') {
  const colorActive = COLOR_PASSES.has(passId);
  const refRegions = (spec.evidence && spec.evidence.regions) || [];
  const renRegions = sampleRenderRegions(renderCanvas);
  const rows = refRegions.map((ref, i) => {
    const ren = renRegions[i] || { color: null, coverage: 0 };
    const usable = !!(ref.color && ren.color && ref.coverage > 0.12 && ren.coverage > 0.12);
    return {
      id: ref.id,
      ref: ref.color,
      render: ren.color,
      refCoverage: ref.coverage,
      renderCoverage: ren.coverage,
      deltaE: usable ? Number(deltaE00(ref.color, ren.color).toFixed(2)) : null,
      usable
    };
  });
  const usable = rows.filter((r) => r.usable);
  const meanDE = usable.length ? Number(mean(usable.map((r) => r.deltaE)).toFixed(2)) : 32;
  const color = colorActive ? clamp(1 - meanDE / 45, 0, 1) : null;
  const refCov = mean(refRegions.map((r) => r.coverage));
  const renCov = mean(renRegions.map((r) => r.coverage));
  // 参考图与渲染的构图不同，覆盖率只做宽松的轮廓一致性检查
  const silhouette = clamp(1 - Math.abs(refCov - renCov) / Math.max(refCov, renCov, 0.2) * 0.55, 0.35, 1);
  const detail = gateResult && gateResult.metrics ? gateResult.metrics.detailCoverage : 0;
  const overall = colorActive
    ? 0.40 * color + 0.25 * silhouette + 0.35 * detail
    : 0.55 * silhouette + 0.45 * detail;
  const scores = {
    color: color === null ? null : Number(color.toFixed(3)),
    silhouette: Number(silhouette.toFixed(3)),
    detail: Number(detail.toFixed(3)),
    overall: Number(overall.toFixed(3))
  };
  const decision = (overall >= 0.62 && detail >= 0.9 && (!colorActive || color >= 0.35)) ? 'pass' : 'fail';

  // 有界、材质范围的自纠正：只允许把主体毛色朝参考图挪一小步，不改动几何与结构
  const feedback = [];
  if (decision === 'fail' && colorActive && usable.length) {
    const avgRef = ['r', 'g', 'b'].map((ch) => mean(usable.map((r) => r.ref[ch])));
    const avgRen = ['r', 'g', 'b'].map((ch) => mean(usable.map((r) => r.render[ch])));
    const delta = {
      r: Math.round(clamp((avgRef[0] - avgRen[0]) * 0.30, -10, 10)),
      g: Math.round(clamp((avgRef[1] - avgRen[1]) * 0.30, -10, 10)),
      b: Math.round(clamp((avgRef[2] - avgRen[2]) * 0.30, -10, 10))
    };
    if (Math.abs(delta.r) + Math.abs(delta.g) + Math.abs(delta.b) > 0) {
      feedback.push({
        target: 'materials:coat:color',
        delta,
        reason: `逐区域平均 ΔE00=${meanDE}，主体毛色朝参考图有界靠拢`
      });
    }
  }
  return {
    rows, scores, meanDE, decision, feedback,
    focus: colorActive ? 'color + silhouette + detail' : 'silhouette + detail',
    at: new Date().toISOString()
  };
}

/* ---------- 对比图（一张图判定，不靠一堆截图） ---------- */
export function renderComparisonSheet(referenceImage, renderCanvas, meta = {}) {
  const W = 960, H = 540, HEADER = 46, FOOTER = 62;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f4f6fa';
  ctx.fillRect(0, 0, W, H);

  const drawContain = (src, x, y, w, h) => {
    const sw = src.naturalWidth || src.width || w;
    const sh = src.naturalHeight || src.height || h;
    const scale = Math.min(w / sw, h / sh);
    const dw = sw * scale, dh = sh * scale;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, w, h);
    ctx.drawImage(src, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    return { x: x + (w - dw) / 2, y: y + (h - dh) / 2, w: dw, h: dh };
  };

  const bodyH = H - HEADER - FOOTER;
  const half = W / 2;
  const left = drawContain(referenceImage, 0, HEADER, half, bodyH);
  const right = drawContain(renderCanvas, half, HEADER, half, bodyH);

  // 3x3 分区网格：与评审的逐区域色差一一对应
  ctx.strokeStyle = 'rgba(88,104,140,0.30)';
  ctx.lineWidth = 1;
  [left, right].forEach((box) => {
    for (let i = 1; i < 3; i += 1) {
      ctx.beginPath(); ctx.moveTo(box.x + box.w * i / 3, box.y); ctx.lineTo(box.x + box.w * i / 3, box.y + box.h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(box.x, box.y + box.h * i / 3); ctx.lineTo(box.x + box.w, box.y + box.h * i / 3); ctx.stroke();
    }
  });
  ctx.strokeStyle = 'rgba(88,104,140,0.55)';
  ctx.beginPath(); ctx.moveTo(half, HEADER); ctx.lineTo(half, H - FOOTER); ctx.stroke();

  ctx.fillStyle = '#eef1f7';
  ctx.fillRect(0, 0, W, HEADER);
  ctx.fillRect(0, H - FOOTER, W, FOOTER);
  ctx.fillStyle = '#1f2937';
  ctx.font = '600 16px system-ui, "Microsoft YaHei", sans-serif';
  ctx.fillText(`参考图 · ${meta.angle || 'front'}`, 18, 30);
  ctx.fillText(`3D 渲染 · ${meta.pass || 'blockout'}`, half + 18, 30);
  ctx.font = '14px system-ui, "Microsoft YaHei", sans-serif';
  const s = meta.scores || {};
  ctx.fillStyle = meta.decision === 'pass' ? '#137a4b' : '#b4453c';
  ctx.fillText(meta.decision === 'pass' ? 'PASS' : 'FAIL', 18, H - 22);
  ctx.fillStyle = '#374151';
  ctx.fillText(
    `色差 ΔE00 ${meta.meanDE ?? '-'}  ·  色彩 ${s.color ?? '-'}  ·  轮廓 ${s.silhouette ?? '-'}  ·  细节 ${s.detail ?? '-'}  ·  综合 ${s.overall ?? '-'}`,
    90, H - 22
  );
  ctx.fillStyle = '#6b7280';
  ctx.font = '12px system-ui, "Microsoft YaHei", sans-serif';
  ctx.fillText(`判定重点：${meta.focus || 'silhouette + detail'} · 阈值 0.62`, half + 18, H - 22);
  return canvas;
}

/* ---------- 导出 ---------- */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function exportSpec(spec) {
  const text = JSON.stringify(specForExport(spec), null, 2);
  downloadBlob(new Blob([text], { type: 'application/json;charset=utf-8' }), `${spec.subject.id}.spec.json`);
}

export function exportCanvas(canvas, filename) {
  canvas.toBlob((blob) => { if (blob) downloadBlob(blob, filename); }, 'image/png');
}

/* GLB 导出的是「spec 驱动的程序化网格」：烘焙世界矩阵、去掉运行时毛丝与
   贴图依赖，可直接进 Blender / 混元 3D 做后续精修。避免 SkinnedMesh +
   CanvasTexture 让 glTF 导出器报错。 */
function buildExportClone(root) {
  const clone = new THREE.Group();
  clone.name = 'CatSculptSpec.export';
  root.updateMatrixWorld(true);
  root.traverse((obj) => {
    if (!obj.isMesh || obj.isInstancedMesh || !obj.visible) return;
    if (!obj.geometry || !obj.geometry.attributes.position) return;
    if (obj.material && obj.material.alphaTest > 0) return;  // 绒毛壳不进导出
    const source = Array.isArray(obj.material) ? obj.material[0] : obj.material;
    const color = source && source.color ? source.color.clone() : new THREE.Color(0xc9ccd2);
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0 });
    const mesh = new THREE.Mesh(obj.geometry.clone(), material);
    mesh.name = obj.name || 'component';
    mesh.applyMatrix4(obj.matrixWorld);
    clone.add(mesh);
  });
  return clone;
}

export async function exportGLB(root, spec) {
  const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
  const exporter = new GLTFExporter();
  const clone = buildExportClone(root);
  const options = { binary: true, onlyVisible: true, includeCustomExtensions: false };
  const result = typeof exporter.parseAsync === 'function'
    ? await exporter.parseAsync(clone, options)
    : await new Promise((resolve, reject) => exporter.parse(clone, (r) => resolve(r), (e) => reject(e), options));
  const blob = result instanceof ArrayBuffer
    ? new Blob([result], { type: 'model/gltf-binary' })
    : new Blob([JSON.stringify(result)], { type: 'model/gltf+json' });
  downloadBlob(blob, `${spec.subject.id}.glb`);
  return { bytes: blob.size, meshes: clone.children.length };
}
