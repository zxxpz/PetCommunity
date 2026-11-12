/*
 * Stage 2 —— CatSculptSpec：2D 图到 3D 模型的中间契约
 *
 * 参照 img2threejs 的 ObjectSculptSpec：先把「看到的东西」写成一份可 diff、
 * 可版本控制、可复现的结构化 JSON，再由这份 JSON 生成 Three.js 代码。
 * 照片永远不会直接贴到模型上，它只作为证据（evidence）被消费。
 *
 * 本文件只做确定性工作：结构、校验、门禁、状态推进。不做任何视觉判断。
 */

export const SCHEMA_VERSION = '1.0.0';
export const GENERATOR = 'meow-recon/1.0.0';

/* 与 img2threejs 对齐的八个构建阶段。每个阶段只做增量，不重建整只猫。 */
export const PASS_ORDER = [
  { id: 'blockout',     label: '块面', en: 'Blockout',     detail: '只保留比例与整体剪影：灰模、无材质、无细节' },
  { id: 'structural',   label: '结构', en: 'Structural',   detail: '组件层级、骨骼、socket 与碰撞体；挂 sculptRuntime' },
  { id: 'form',         label: '形体', en: 'Form',         detail: '按 spec 比例调整头、耳、四肢与尾巴' },
  { id: 'material',     label: '材质', en: 'Material',     detail: '照片证据驱动的毛色、花纹、虹膜、鼻色' },
  { id: 'surface',      label: '表面', en: 'Surface',      detail: '绒毛壳、实例化毛丝、法线细节' },
  { id: 'lighting',     label: '光照', en: 'Lighting',     detail: '三点光 + 环境光 + 接触阴影 + 曝光' },
  { id: 'interaction',  label: '交互', en: 'Interaction',  detail: 'pivot 暴露与 userData.tick 循环动画钩子' },
  { id: 'optimization', label: '优化', en: 'Optimization', detail: '冻结静态矩阵、LOD 标记、产物完整性校验' }
];
export const PASS_IDS = PASS_ORDER.map((p) => p.id);

export const PALETTE_KEYS = ['base', 'accent', 'light', 'eye', 'nose'];
export const PATTERNS = ['solid', 'tabby', 'calico', 'tuxedo', 'points'];

/* 网格细分 / 毛丝密度档位。cell 越小、strands 越大，三角面与毛丝越多、
 * 毛色贴图与曲面更细腻，但建模耗时随之上升。主站不传时 buildCatRig 用 standard。 */
export const QUALITY_TIERS = {
  standard: { label: '标准',  cell: 0.018, strands: 5200 },
  fine:     { label: '精细',  cell: 0.013, strands: 11200 },
  extreme:  { label: '极致',  cell: 0.010, strands: 22000 }
};

export function qualityOf(tier) {
  return QUALITY_TIERS[tier] || QUALITY_TIERS.standard;
}

/* 组件树与 3d-init.js 的 BONE_DEFS / SDF 造型块一一对应。
   每个细节都必须映射到这里的真实组件，不允许「用贴图假装结构」。 */
const COMPONENT_DEFS = [
  ['root',   '整体',     '',     'group', '',            ''],
  ['body',   '躯干',     'root', 'sdf',   'spine',       'capsule'],
  ['head',   '头部',     'body', 'sdf',   'neck',        'sphere'],
  ['earL',   '左耳',     'head', 'sdf',   'socket.earL', 'cone'],
  ['earR',   '右耳',     'head', 'sdf',   'socket.earR', 'cone'],
  ['muzzle', '口鼻',     'head', 'sdf',   'socket.muzzle', 'sphere'],
  ['eyes',   '双眼',     'head', 'sdf',   'socket.eyes', ''],
  ['nose',   '鼻头',     'head', 'sdf',   '',            ''],
  ['legFL',  '左前腿',   'body', 'sdf',   'paw.FL',      'capsule'],
  ['legFR',  '右前腿',   'body', 'sdf',   'paw.FR',      'capsule'],
  ['legBL',  '左后腿',   'body', 'sdf',   'paw.BL',      'capsule'],
  ['legBR',  '右后腿',   'body', 'sdf',   'paw.BR',      'capsule'],
  ['tail',   '尾巴',     'body', 'sdf',   'tail.base',   'capsule'],
  ['eyeL',   '左眼',     'eyes', 'sdf',   '',            ''],
  ['eyeR',   '右眼',     'eyes', 'sdf',   '',            ''],
  ['pupilL', '左瞳孔',   'eyes', 'decal', '',            ''],
  ['pupilR', '右瞳孔',   'eyes', 'decal', '',            ''],
  ['faceMark','面部花纹','head', 'pattern','',            ''],
  ['bodyMark','身体花纹','body', 'pattern','',            ''],
  ['tailCoat','尾巴毛色','tail', 'coat',   '',            ''],
  ['scrotum','公猫蛋蛋', 'body', 'anatomy','',            'sphere']
];

/* 只在公猫实例化的组件：spec 里保留定义，运行时按 subject.gender 门控，
   这样切换性别不需要重建整份 spec。 */
export const MALE_ONLY_COMPONENTS = ['scrotum'];

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function roundColor(c) {
  return { r: Math.round(c.r), g: Math.round(c.g), b: Math.round(c.b) };
}
function mix(a, b, t) {
  return roundColor({ r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t });
}
function shade(c, f) {
  return roundColor({ r: clamp(c.r * f, 0, 255), g: clamp(c.g * f, 0, 255), b: clamp(c.b * f, 0, 255) });
}

/* FNV-1a：给参考图一个稳定短指纹，写进 provenance，保证产物可复现 */
export function digest(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return ('00000000' + h.toString(16)).slice(-8);
}

export function createSpec(meta = {}) {
  const now = new Date().toISOString();
  const passes = {};
  PASS_IDS.forEach((id, i) => {
    passes[id] = { status: i === 0 ? 'ready' : 'locked', attempts: 0, at: null };
  });
  return {
    schemaVersion: SCHEMA_VERSION,
    generator: GENERATOR,
    subject: {
      id: meta.id || 'recon-local',
      name: meta.name || '未命名猫咪',
      kind: 'cat',
      profile: 'quadruped',
      breed: meta.breed || '',
      gender: ['male', 'female', 'unknown'].includes(meta.gender) ? meta.gender : 'unknown'
    },
    source: { views: [], primaryViewId: '' },
    evidence: null,
    proportions: { head: 1, body: 1, leg: 1, ear: 1, tail: 1, chub: 1 },
    materials: [],
    components: [],
    sockets: [],
    colliders: [],
    lighting: { key: 1.45, fill: 0.5, rim: 1.0, ambient: 0.62, exposure: 1.0 },
    camera: { fov: 38, position: [0, 1.04, 3.1], target: [0, 0.72, 0] },
    quality: { tier: 'standard', cell: QUALITY_TIERS.standard.cell, strands: QUALITY_TIERS.standard.strands },
    passes,
    reviewHistory: [],
    provenance: {
      createdAt: now,
      updatedAt: now,
      method: 'spec-driven-procedural',
      referenceDigests: []
    }
  };
}

/* 把 Stage 1 的证据编译成组件树 / 材质表 / 比例。
   所有颜色都带 provenance，门禁会拒绝「凭记忆编出来的颜色」。 */
export function buildSpecFromEvidence(spec, evidence, views) {
  const p = evidence.palette;
  const t = evidence.traits || {};
  const materials = [
    { id: 'coat',        role: '主体毛色', color: p.base,   roughness: 0.92, sheen: 0.35, provenance: 'evidence.palette.base' },
    { id: 'coatPattern', role: '花纹暗部', color: p.accent, roughness: 0.90, sheen: 0.30, provenance: 'evidence.palette.accent' },
    { id: 'bib',         role: '浅色区',   color: p.light,  roughness: 0.94, sheen: 0.28, provenance: 'evidence.palette.light' },
    { id: 'iris',        role: '虹膜',     color: p.eye,    roughness: 0.24, sheen: 0.10, provenance: 'evidence.palette.eye' },
    { id: 'nose',        role: '鼻头',     color: p.nose,   roughness: 0.55, sheen: 0.10, provenance: 'evidence.palette.nose' },
    { id: 'earInner',    role: '内耳',     color: mix(shade(p.base, 1.04), { r: 214, g: 166, b: 168 }, 0.55), roughness: 0.88, sheen: 0.20, provenance: 'derived:base+pink' },
    { id: 'furColor',    role: '毛发颜色（绒毛/毛丝）', color: t.coatColor || p.base, roughness: 0.97, sheen: 0.22, provenance: 'evidence.traits.coatColor' },
    { id: 'tailCoat',    role: '尾巴颜色', color: t.tailColor || p.accent, roughness: 0.95, sheen: 0.22, provenance: 'evidence.traits.tailColor' },
    { id: 'facePattern', role: '面部花纹色', color: mix(p.accent, p.base, t.facePattern === 'solid' ? 0.7 : 0.15), roughness: 0.93, sheen: 0.25, provenance: 'derived:facePattern+accent' },
    { id: 'bodyPattern', role: '身体花纹色', color: mix(p.accent, p.base, t.bodyPattern === 'solid' ? 0.7 : 0.15), roughness: 0.93, sheen: 0.25, provenance: 'derived:bodyPattern+accent' },
    { id: 'pupil',       role: '瞳孔',     color: mix(shade(p.eye, 0.20), { r: 16, g: 14, b: 18 }, 0.7), roughness: 0.35, sheen: 0.05, provenance: 'derived:eye.darkened' }
  ];

  const components = COMPONENT_DEFS.map(([id, name, parent, kind, socket, collider]) => ({
    id, name, parent, kind,
    socket: socket || null,
    collider: collider || null,
    provenance: 'template:cat-sdf-v1'
  }));

  const q = evidence.quality || {};
  // 只让照片证据影响有界范围内的比例，避免单张照片把模型拉变形
  const proportions = {
    head: clamp(1 + (q.headRatio ? (q.headRatio - 0.34) * 0.35 : 0), 0.86, 1.14),
    body: clamp(1 + ((q.aspect || 1) - 1) * 0.10, 0.90, 1.12),
    leg: 1,
    ear: clamp(1 + (evidence.pattern === 'points' ? -0.04 : 0.02), 0.88, 1.12),
    tail: 1,
    chub: clamp(1 + ((q.subjectCoverage || 0.3) - 0.3) * 0.22, 0.92, 1.10)
  };

  spec.evidence = evidence;
  spec.materials = materials;
  spec.components = components;
  spec.sockets = components.filter((c) => c.socket).map((c) => ({ id: c.socket, owner: c.id }));
  spec.colliders = components.filter((c) => c.collider).map((c) => ({ id: c.collider, owner: c.id }));
  spec.proportions = proportions;
  spec.source.views = views.map((v) => ({
    id: v.id, angle: v.angle, width: v.width, height: v.height,
    bytes: v.bytes || 0, digest: v.digest || ''
  }));
  spec.source.primaryViewId = (views[0] && views[0].id) || '';
  spec.provenance.referenceDigests = views.map((v) => v.digest).filter(Boolean);
  spec.provenance.updatedAt = new Date().toISOString();
  return spec;
}

/* fail-closed 严格质量门禁：任何一条不过，就不允许生成一行 Three.js。
   返回结构化 BLOCKED 报告（指标 + 原因 + 下一步动作），而不是一句「失败」。 */
export function validateSpec(spec, options = {}) {
  const strict = options.strict !== false;
  const failures = [];
  const warnings = [];
  const push = (code, message, metric, nextAction) => failures.push({ code, message, metric, nextAction });

  if (!spec || spec.schemaVersion !== SCHEMA_VERSION) {
    push('SCHEMA', 'spec 版本不匹配', spec && spec.schemaVersion, '用 createSpec() 重新初始化');
    return pack(failures, warnings, {});
  }

  if (!['male', 'female', 'unknown'].includes(spec.subject && spec.subject.gender)) {
    push('GENDER', '猫咪性别枚举非法', spec.subject && spec.subject.gender, '从档案读取或手动选择男/女/未知');
  }

  const views = (spec.source && spec.source.views) || [];
  if (!views.length) {
    push('NO_REFERENCE', '没有任何参考图', 0, '至少上传 1 张照片再运行 intake');
  } else if (strict && views.length < 3) {
    warnings.push({ code: 'SINGLE_VIEW', message: '少于 3 个视角，背面与侧面为推断区域，置信度已下调', metric: views.length });
  }

  const ev = spec.evidence;
  if (!ev) {
    push('NO_EVIDENCE', '缺少图像证据', null, '先运行 Stage 1 intake');
  } else {
    const palette = ev.palette || {};
    PALETTE_KEYS.forEach((key) => {
      const c = palette[key];
      const ok = c && [c.r, c.g, c.b].every((n) => Number.isFinite(n) && n >= 0 && n <= 255);
      if (!ok) push('PALETTE_' + key.toUpperCase(), `调色板 ${key} 非法`, c, '重新分析照片或手动给出 0-255 的 RGB');
    });
    if (!PATTERNS.includes(ev.pattern)) {
      push('PATTERN', '花纹类型不在枚举内', ev.pattern, '重新分析照片');
    }
    const q = ev.quality || {};
    if ((q.minSide || 0) < 128) {
      push('LOW_RESOLUTION', '参考图分辨率过低，细节不可信', q.minSide, '换一张短边 >= 128px 的照片');
    }
    if ((q.subjectCoverage || 0) < 0.10) {
      push('SUBJECT_TOO_SMALL', '主体在画面里占比太小', q.subjectCoverage, '裁剪到猫占画面 1/3 以上再上传');
    }
    if (q.meanLum !== undefined && (q.meanLum < 0.06 || q.meanLum > 0.94)) {
      push('EXPOSURE', '照片严重欠曝或过曝', q.meanLum, '换一张曝光正常的照片');
    }
    if ((ev.detailInventory || []).length < 6) {
      push('DETAIL_INVENTORY', '细节清单不足 6 项，属于浅层 spec', (ev.detailInventory || []).length, '重新运行 detail inventory');
    }
  }

  const materialIds = new Set((spec.materials || []).map((m) => m.id));
  const componentIds = new Set((spec.components || []).map((c) => c.id));

  (spec.materials || []).forEach((m) => {
    if (!m.provenance || !String(m.provenance).startsWith('evidence') && !String(m.provenance).startsWith('derived')) {
      push('MATERIAL_PROVENANCE', `材质 ${m.id} 缺少图像证据来源`, m.provenance, '颜色必须由照片证据推导，不允许凭记忆填写');
    }
    if (!m.color || ![m.color.r, m.color.g, m.color.b].every(Number.isFinite)) {
      push('MATERIAL_COLOR', `材质 ${m.id} 颜色非法`, m.color, '修正颜色');
    }
  });

  // 每个 identity-defining detail 必须落到真实组件或材质上，不允许悬空
  const inventory = (ev && ev.detailInventory) || [];
  const mappedIds = new Set();
  inventory.forEach((d) => {
    if (!d.mappedTo || (!materialIds.has(d.mappedTo) && !componentIds.has(d.mappedTo))) {
      push('UNMAPPED_DETAIL', `细节 ${d.id} 未映射到真实组件/材质`, d.mappedTo, '补上对应组件，或删除该无法落地的细节');
    } else {
      mappedIds.add(d.mappedTo);
    }
  });

  (spec.components || []).forEach((c) => {
    if (c.parent && c.parent !== '' && !componentIds.has(c.parent)) {
      push('ORPHAN_COMPONENT', `组件 ${c.id} 的父节点不存在`, c.parent, '修正组件树');
    }
  });
  Object.keys(spec.proportions || {}).forEach((key) => {
    const v = spec.proportions[key];
    if (!Number.isFinite(v) || v < 0.75 || v > 1.25) {
      push('PROPORTION_RANGE', `比例 ${key} 超出有界范围`, v, '把比例限制在 0.75 - 1.25');
    }
  });

  const detailCoverage = inventory.length
    ? inventory.filter((d) => materialIds.has(d.mappedTo) || componentIds.has(d.mappedTo)).length / inventory.length
    : 0;
  const metrics = {
    views: views.length,
    detailCount: inventory.length,
    detailCoverage: Number(detailCoverage.toFixed(3)),
    componentCount: (spec.components || []).length,
    materialCount: (spec.materials || []).length,
    minSide: ev && ev.quality ? ev.quality.minSide : 0,
    subjectCoverage: ev && ev.quality ? ev.quality.subjectCoverage : 0,
    mappedTargets: mappedIds.size
  };
  return pack(failures, warnings, metrics);

  function pack(f, w, m) {
    return {
      ok: f.length === 0,
      blocked: f.length > 0,
      failures: f,
      warnings: w,
      metrics: m,
      action: f.length ? 'BLOCKED' : 'ALLOW_BUILD'
    };
  }
}

/* 受限自纠正：评审不过时只允许有界、可追溯的修正，每轮单通道最多 10/255。
   对应 img2threejs 的 material_feedback / stop policy。 */
export function applyFeedback(spec, feedbacks = [], maxStep = 10) {
  const applied = [];
  feedbacks.forEach((fb) => {
    const parts = String(fb.target || '').split(':');
    if (parts[0] !== 'materials' || parts.length < 3) return;
    const material = (spec.materials || []).find((m) => m.id === parts[1]);
    if (!material || !fb.delta) return;
    const before = { ...material.color };
    ['r', 'g', 'b'].forEach((ch) => {
      const d = clamp(Number(fb.delta[ch]) || 0, -maxStep, maxStep);
      material.color[ch] = clamp(before[ch] + d, 0, 255);
    });
    material.provenance = 'derived:feedback:' + (fb.reason || 'review');
    applied.push({ target: fb.target, before, after: { ...material.color }, reason: fb.reason || '' });
  });
  spec.provenance.updatedAt = new Date().toISOString();
  return applied;
}

export function nextPass(spec) {
  return PASS_IDS.find((id) => spec.passes[id] && spec.passes[id].status === 'ready') || null;
}

export function currentPassIndex(spec) {
  for (let i = PASS_IDS.length - 1; i >= 0; i -= 1) {
    const status = spec.passes[PASS_IDS[i]].status;
    if (status === 'passed' || status === 'built' || status === 'ready') return i;
  }
  return 0;
}

/* 门禁式推进：只有当前 pass 评审通过，才解锁下一个，绝不静默降级。 */
export function markPass(spec, passId, status) {
  const idx = PASS_IDS.indexOf(passId);
  if (idx < 0) return false;
  spec.passes[passId].status = status;
  spec.passes[passId].attempts += 1;
  spec.passes[passId].at = new Date().toISOString();
  if (status === 'passed' && idx + 1 < PASS_IDS.length) {
    const next = PASS_IDS[idx + 1];
    if (spec.passes[next].status === 'locked') spec.passes[next].status = 'ready';
  }
  return true;
}

/* 切换猫咪档案里的性别：同步 spec、证据与细节清单那条说明，
   但不重建组件树 —— scrotum 的定义一直在，只是由 factory 按性别门控实例化。 */
export function setSubjectGender(spec, gender) {
  const g = ['male', 'female', 'unknown'].includes(gender) ? gender : 'unknown';
  spec.subject.gender = g;
  if (spec.evidence) {
    spec.evidence.subjectGender = g;
    const item = (spec.evidence.detailInventory || []).find((d) => d.id === 'anatomy.scrotum');
    if (item) item.value = g === 'male' ? '毛茸茸 · 与周围同色' : '不适用（仅公猫）';
  }
  spec.provenance.updatedAt = new Date().toISOString();
  return g;
}

export function appendReview(spec, record) {
  spec.reviewHistory.push({ at: new Date().toISOString(), ...record });
  spec.provenance.updatedAt = new Date().toISOString();
}

export function specForExport(spec) {
  const copy = JSON.parse(JSON.stringify(spec));
  copy.provenance.exportedAt = new Date().toISOString();
  copy.provenance.digest = digest({
    palette: copy.evidence && copy.evidence.palette,
    materials: copy.materials,
    proportions: copy.proportions,
    views: copy.source.views.map((v) => v.digest)
  });
  return copy;
}
