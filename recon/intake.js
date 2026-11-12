/*
 * Stage 1 —— Intake：把 2D 照片变成可审计的图像证据
 *
 * 关键约定：照片只作为证据被消费，绝不作为贴图贴到 3D 头上（与主站一致）。
 * 毛色 / 花纹分析直接复用主站 3d-init.js 的 analyzePhoto / calibrateViews，
 * 保证工作台和网站不会给出两套互相矛盾的结论。
 *
 * 本文件同样只做确定性计算：像素统计、区域采样、细节清单。不做视觉判断。
 */

import { analyzePhoto, calibrateViews } from '../3d-init.js';
import { digest } from './spec.js';

const S = 96;

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片加载失败'));
    image.src = src;
  });
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}

function luminance(r, g, b) { return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; }
function colorDist(a, b) { return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b); }
function round(c) { return { r: Math.round(c.r), g: Math.round(c.g), b: Math.round(c.b) }; }

/* 图像探针：分辨率 / 曝光 / 背景 / 主体占比 / 锐度 / 头身比 / 3x3 区域色。
   这些是硬指标，后面门禁和评审都用得上；不替模型「看图」。 */
export function probeImage(image) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, S, S);
  const data = ctx.getImageData(0, 0, S, S).data;
  const px = (x, y) => {
    const i = (y * S + x) * 4;
    return { r: data[i], g: data[i + 1], b: data[i + 2] };
  };
  const lum = (x, y) => { const c = px(x, y); return luminance(c.r, c.g, c.b); };

  // 边框主色 -> 背景估计（与 analyzePhoto 用同一套 4bit 分桶思路）
  const border = new Map();
  let borderN = 0;
  for (let y = 0; y < S; y += 1) {
    for (let x = 0; x < S; x += 1) {
      if (x < S * 0.13 || x > S * 0.87 || y < S * 0.13 || y > S * 0.87) {
        const c = px(x, y);
        const key = ((c.r >> 4) << 8) | ((c.g >> 4) << 4) | (c.b >> 4);
        let b = border.get(key);
        if (!b) { b = { n: 0, r: 0, g: 0, b: 0 }; border.set(key, b); }
        b.n += 1; b.r += c.r; b.g += c.g; b.b += c.b;
        borderN += 1;
      }
    }
  }
  const top = Array.from(border.values()).sort((a, b) => b.n - a.n)[0];
  const bg = top ? { r: top.r / top.n, g: top.g / top.n, b: top.b / top.n } : { r: 255, g: 255, b: 255 };
  const useBgFilter = top && top.n / (borderN || 1) > 0.38;
  const isSubject = (c) => !useBgFilter || colorDist(c, bg) > 44;

  let lumSum = 0, subject = 0, total = 0, over = 0, under = 0, edges = 0, edgeTotal = 0;
  for (let y = 0; y < S; y += 1) {
    for (let x = 0; x < S; x += 1) {
      const c = px(x, y);
      const l = luminance(c.r, c.g, c.b);
      lumSum += l; total += 1;
      if (l > 0.96) over += 1;
      if (l < 0.04) under += 1;
      if (isSubject(c)) subject += 1;
      if (x > S * 0.12 && x < S * 0.87 && y > S * 0.12 && y < S * 0.87) {
        edgeTotal += 1;
        if (Math.abs(l - lum(x + 1, y)) > 0.14 || Math.abs(l - lum(x, y + 1)) > 0.14) edges += 1;
      }
    }
  }

  // 上半 / 下半的主体宽度比：粗略的头身比信号，只用来给比例做有界微调
  let upper = 0, lower = 0;
  for (let y = Math.floor(S * 0.18); y < Math.floor(S * 0.48); y += 1) {
    for (let x = 0; x < S; x += 1) if (isSubject(px(x, y))) upper += 1;
  }
  for (let y = Math.floor(S * 0.52); y < Math.floor(S * 0.86); y += 1) {
    for (let x = 0; x < S; x += 1) if (isSubject(px(x, y))) lower += 1;
  }

  // 3x3 区域证据：评审阶段逐区域算 CIEDE2000 色差
  const regions = [];
  for (let gy = 0; gy < 3; gy += 1) {
    for (let gx = 0; gx < 3; gx += 1) {
      let r = 0, g = 0, b = 0, n = 0, cells = 0;
      for (let y = Math.floor(gy * S / 3); y < Math.floor((gy + 1) * S / 3); y += 1) {
        for (let x = Math.floor(gx * S / 3); x < Math.floor((gx + 1) * S / 3); x += 1) {
          cells += 1;
          const c = px(x, y);
          if (!isSubject(c)) continue;
          r += c.r; g += c.g; b += c.b; n += 1;
        }
      }
      regions.push({
        id: `r${gy}${gx}`,
        color: n ? round({ r: r / n, g: g / n, b: b / n }) : null,
        coverage: Number((n / (cells || 1)).toFixed(3))
      });
    }
  }

  const width = image.naturalWidth || image.width || S;
  const height = image.naturalHeight || image.height || S;
  return {
    width,
    height,
    minSide: Math.min(width, height),
    aspect: Number((width / (height || 1)).toFixed(3)),
    meanLum: Number((lumSum / (total || 1)).toFixed(3)),
    subjectCoverage: Number((subject / (total || 1)).toFixed(3)),
    backgroundRatio: Number((1 - subject / (total || 1)).toFixed(3)),
    overExposed: Number((over / (total || 1)).toFixed(3)),
    underExposed: Number((under / (total || 1)).toFixed(3)),
    sharpness: Number((edges / (edgeTotal || 1)).toFixed(3)),
    headRatio: Number((upper / (lower || 1)).toFixed(3)),
    background: round(bg),
    regions
  };
}

export function analyseView(image, angle = 'front') {
  const info = analyzePhoto(image);
  return {
    angle,
    palette: info.palette,
    pattern: info.pattern,
    bib: info.bib,
    probe: probeImage(image)
  };
}

/* 新增细节证据：眼睛形状 / 瞳孔形状 / 面部花纹 / 身体花纹 / 毛发颜色 / 尾巴颜色。
   只做可量化的像素统计；照片里根本看不到的项目一律标 inferred，不假装观测到。 */
function mixC(a, b, t) {
  return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t };
}
function shadeC(c, f) {
  const cap = (v) => Math.max(0, Math.min(255, v * f));
  return { r: cap(c.r), g: cap(c.g), b: cap(c.b) };
}
const TRAIT_LABELS = {
  almond: '杏仁眼', oval: '椭圆眼', round: '圆眼',
  slit: '竖瞳', roundPupil: '圆瞳',
  stripes: '条纹', patch: '斑块', mask: '面罩', solid: '纯色'
};

export function analyseTraits(image, palette, probe, pattern) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, S, S);
  const data = ctx.getImageData(0, 0, S, S).data;
  const at = (x, y) => {
    const i = (y * S + x) * 4;
    return { r: data[i], g: data[i + 1], b: data[i + 2] };
  };
  const lumAt = (x, y) => { const c = at(x, y); return luminance(c.r, c.g, c.b); };

  // 虹膜簇只取左半边：两眼一起统计会合成一个超宽包围盒，全都判成杏仁眼
  let minX = 1e9, maxX = -1, minY = 1e9, maxY = -1, hits = 0;
  for (let y = Math.floor(S * 0.22); y < Math.floor(S * 0.62); y += 1) {
    for (let x = Math.floor(S * 0.16); x < Math.floor(S * 0.49); x += 1) {
      const c = at(x, y);
      const mx = Math.max(c.r, c.g, c.b), mn = Math.min(c.r, c.g, c.b);
      const sat = mx ? (mx - mn) / mx : 0;
      if (sat > 0.24 && colorDist(c, palette.eye) < 82) {
        hits += 1;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
    }
  }
  const eyeObserved = hits >= 8;
  const ratio = eyeObserved ? (maxX - minX + 1) / Math.max(1, maxY - minY + 1) : null;
  const eyeShape = !eyeObserved ? 'almond' : (ratio > 1.55 ? 'almond' : ratio < 1.12 ? 'round' : 'oval');
  // 猫在强光下瞳孔收成竖缝、弱光下放大成圆；用整图平均亮度做可解释的启发式
  const pupilShape = (probe.meanLum || 0.5) > 0.55 ? 'slit' : 'round';

  const regionStats = (y0, y1) => {
    let n = 0, edges = 0, bright = 0, dark = 0;
    for (let y = Math.floor(S * y0); y < Math.floor(S * y1); y += 1) {
      for (let x = Math.floor(S * 0.12); x < Math.floor(S * 0.88); x += 1) {
        const l = lumAt(x, y);
        if (l > 0.66) bright += 1;
        if (l < 0.28) dark += 1;
        if (Math.abs(l - lumAt(x + 1, y)) > 0.15 || Math.abs(l - lumAt(x, y + 1)) > 0.15) edges += 1;
        n += 1;
      }
    }
    return { edge: edges / (n || 1), bright: bright / (n || 1), dark: dark / (n || 1) };
  };
  const classify = (s, zone) => {
    if (s.edge > 0.19) return 'stripes';
    if (s.bright > 0.18 && s.dark > 0.18) return 'patch';
    if (pattern === 'points') return 'mask';
    if (pattern === 'tuxedo' || pattern === 'calico') return 'patch';
    // 虎斑猫额头有标志性的 M 纹；照片里没测到强边缘时仍按条纹处理，但置信度较低
    if (pattern === 'tabby') return (zone === 'face' || s.edge > 0.08) ? 'stripes' : 'solid';
    return 'solid';
  };
  const faceStats = regionStats(0.18, 0.48);
  const bodyStats = regionStats(0.50, 0.86);
  const facePattern = classify(faceStats, 'face');
  const bodyPattern = classify(bodyStats, 'body');

  // 尾巴多数照片里不入镜，按花纹类型从主色/暗色有界推导，并明确标记 inferred
  const tailColor = pattern === 'points' ? round(palette.accent)
    : (pattern === 'tabby' || pattern === 'calico') ? round(mixC(palette.base, palette.accent, 0.42))
      : round(shadeC(palette.base, 0.94));

  return {
    eyeShape, pupilShape, facePattern, bodyPattern,
    coatColor: round(palette.base),
    tailColor,
    labels: TRAIT_LABELS,
    eyeObserved,
    inferred: ['tailColor', 'pupilShape'].concat(eyeObserved ? [] : ['eyeShape']),
    sample: {
      irisHits: hits,
      irisRatio: ratio === null ? null : Number(ratio.toFixed(2)),
      meanLum: probe.meanLum,
      faceEdge: Number(faceStats.edge.toFixed(3)),
      bodyEdge: Number(bodyStats.edge.toFixed(3))
    }
  };
}

export function makeViewRecord(file, dataUrl, image, angle) {
  return {
    id: 'v-' + digest(dataUrl.slice(0, 2048) + ':' + dataUrl.length),
    angle,
    width: image.naturalWidth || image.width,
    height: image.naturalHeight || image.height,
    bytes: file ? file.size : dataUrl.length,
    digest: digest(dataUrl.slice(0, 2048) + ':' + dataUrl.length),
    dataUrl
  };
}

/* 多视角合并：委托给主站 calibrateViews（白平衡、中位数、虹膜择优、花纹投票）。
   单张照片时退化为该张的 analyzePhoto 结果，并在门禁里给出低置信度警告。 */
export function mergeViews(rows, images, breed = '', gender = 'unknown') {
  if (!rows.length) throw new Error('没有可用的照片证据');
  let calibrated = null;
  try {
    calibrated = calibrateViews(images, { breed: breed || '' });
  } catch (_) { /* 单张或异常时走退化路径 */ }

  const first = rows[0];
  const palette = calibrated ? calibrated.palette : first.palette;
  const pattern = calibrated ? calibrated.pattern : first.pattern;
  const bib = calibrated ? calibrated.bib : first.bib;
  const best = rows.reduce((a, b) => (b.probe.subjectCoverage > a.probe.subjectCoverage ? b : a), first);
  const bestImage = images[rows.indexOf(best)] || images[0];
  let traits = null;
  try {
    traits = analyseTraits(bestImage, palette, best.probe, pattern);
  } catch (_) { /* 单张异常时保持为空，门禁会拒绝悬空细节 */ }

  const evidence = {
    palette: {
      base: round(palette.base), accent: round(palette.accent), light: round(palette.light),
      eye: round(palette.eye), nose: round(palette.nose)
    },
    pattern,
    bib: !!bib,
    samples: rows.length,
    balanced: calibrated ? calibrated.balanced : 0,
    source: calibrated ? 'calibrateViews' : 'analyzePhoto',
    quality: best.probe,
    regions: best.probe.regions,
    traits,
    subjectGender: ['male', 'female', 'unknown'].includes(gender) ? gender : 'unknown',
    viewReports: rows.map((r) => ({
      angle: r.angle,
      pattern: r.pattern,
      minSide: r.probe.minSide,
      subjectCoverage: r.probe.subjectCoverage,
      meanLum: r.probe.meanLum
    })),
    detailInventory: []
  };
  evidence.detailInventory = buildDetailInventory(evidence);
  return evidence;
}

/* Detail Inventory：先把「定义这只猫身份」的小细节逐条列出，
   每条都必须映射到真实 material / component id，门禁会拒绝悬空项。
   对应 img2threejs 的 detail-first analysis + strict-quality gate。 */
export function buildDetailInventory(evidence) {
  const p = evidence.palette;
  const q = evidence.quality || {};
  const t = evidence.traits || {};
  const labels = t.labels || {};
  const coverage = q.subjectCoverage || 0.3;
  const conf = (bonus = 0) => Number(Math.min(0.98, 0.42 + coverage * 0.9 + Math.min(evidence.samples, 3) * 0.06 + bonus).toFixed(2));
  const rgb = (c) => `${c.r},${c.g},${c.b}`;
  const lab = (v, fallback) => labels[v] || fallback;
  const isMale = evidence.subjectGender === 'male';
  return [
    { id: 'coat.base',      zone: 'body', feature: '主体毛色',   value: rgb(p.base),   confidence: conf(0.06), mappedTo: 'coat',        kind: 'material' },
    { id: 'coat.accent',    zone: 'body', feature: '花纹暗部',   value: rgb(p.accent), confidence: conf(),      mappedTo: 'coatPattern', kind: 'material' },
    { id: 'coat.light',     zone: 'chest',feature: '胸腹浅色区', value: rgb(p.light),  confidence: conf(),      mappedTo: 'bib',         kind: 'material' },
    { id: 'coat.pattern',   zone: 'body', feature: '花纹类型',   value: evidence.pattern, confidence: conf(-0.04), mappedTo: 'coatPattern', kind: 'material' },
    { id: 'coat.bib',       zone: 'chest',feature: '是否有白围兜', value: evidence.bib ? '有' : '无', confidence: conf(), mappedTo: 'bib',       kind: 'material' },
    { id: 'eye.iris',       zone: 'head', feature: '虹膜颜色',   value: rgb(p.eye),    confidence: conf(-0.08), mappedTo: 'iris',        kind: 'material' },
    { id: 'nose.tone',      zone: 'head', feature: '鼻头颜色',   value: rgb(p.nose),   confidence: conf(-0.06), mappedTo: 'nose',        kind: 'material' },
    { id: 'ear.inner',      zone: 'head', feature: '内耳色调',   value: '由毛色推导',   confidence: conf(-0.10), mappedTo: 'earInner',    kind: 'material' },
    { id: 'silhouette.head',zone: 'head', feature: '头部比例',   value: q.headRatio,   confidence: conf(-0.12), mappedTo: 'head',        kind: 'component' },
    { id: 'silhouette.tail',zone: 'rear', feature: '尾部走向',   value: '模板推断',     confidence: 0.55,        mappedTo: 'tail',        kind: 'component' },
    { id: 'silhouette.body',zone: 'body', feature: '躯干体量',   value: q.aspect,      confidence: conf(-0.10), mappedTo: 'body',        kind: 'component' },
    { id: 'coat.furColor',  zone: 'body', feature: '毛发颜色',   value: rgb(t.coatColor || p.base),   confidence: conf(0.05),  mappedTo: 'furColor',    kind: 'material' },
    { id: 'tail.color',     zone: 'tail', feature: '尾巴颜色',   value: rgb(t.tailColor || p.accent), confidence: 0.62,        mappedTo: 'tailCoat',    kind: 'material', inferred: true },
    { id: 'face.pattern',   zone: 'head', feature: '面部花纹',   value: lab(t.facePattern, '纯色'),   confidence: conf(-0.06), mappedTo: 'facePattern', kind: 'material' },
    { id: 'body.pattern',   zone: 'body', feature: '身体花纹',   value: lab(t.bodyPattern, '纯色'),   confidence: conf(-0.06), mappedTo: 'bodyPattern', kind: 'material' },
    { id: 'eye.shape',      zone: 'head', feature: '眼睛形状',   value: lab(t.eyeShape, '杏仁眼'),    confidence: t.eyeObserved ? conf(-0.06) : 0.58, mappedTo: 'eyeL', kind: 'component', inferred: !t.eyeObserved },
    { id: 'eye.pupil',      zone: 'head', feature: '瞳孔形状',   value: t.pupilShape === 'round' ? '圆瞳' : '竖瞳', confidence: 0.60, mappedTo: 'pupil', kind: 'material', inferred: true },
    { id: 'anatomy.scrotum',zone: 'rear', feature: '公猫蛋蛋',   value: isMale ? '毛茸茸 · 与周围同色' : '不适用（仅公猫）', confidence: 0.95, mappedTo: 'scrotum', kind: 'component' }
  ];
}
