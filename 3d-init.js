import * as THREE from './node_modules/three/build/three.module.js';

/*
 * 3D 桌面宠物式猫咪
 *
 * 设计原则：
 *  1. 上传的照片只作为「毛色 / 花纹」的分析输入，不再以任何形式贴到 3D 头上。
 *     分析结果会生成带毛流笔触的程序化纹理，映射到头、身体、四肢、尾巴。
 *  2. 绒毛感 = 程序化毛发纹理 + 多层绒毛壳(alphaTest 噪声) + 实例化毛丝 + 毛簇。
 *  3. 动画 = 目标姿态 + 逐通道指数阻尼 + 次级运动（尾巴延迟、耳朵抽动、
 *     平滑眨眼、呼吸、视线跟随鼠标），不再硬切旋转。
 *  4. 所有位移都被 clamp 在头像框内，不做系统级桌面悬浮窗。
 */

const scenes = new Map();
const prefs = new Map();
const keys = {};

const ACTIONS = ['lick', 'scratch', 'parkour', 'toilet', 'wand', 'drink', 'sleep', 'taunt'];
const PATTERN_LABELS = {
  solid: '纯色', tabby: '虎斑', calico: '三花', tuxedo: '奶牛双色', points: '重点色'
};

let globalMode = 'auto';
let globalZoom = 1;
let lastCoat = null;

/* 头部几何约定：正面球面 z = HEAD_R * HEAD_SCALE[2] = 0.342，
   所有五官都必须放在 z > 0.342 才会真正可见。 */
const HEAD_R = 0.36;
const HEAD_SCALE = [1.08, 1.0, 0.95];
const HEAD_HOME = [0, 0.36, 0.3];
const BODY_HOME_Y = 0.62;
const UP = new THREE.Vector3(0, 1, 0);
const FRAME_BOUNDS = { x: 1.05, yMin: -0.3, yMax: 0.75 };
const SHOP_BOUNDS = { x: 3.8, yMin: -0.3, yMax: 0.75 };

window.addEventListener('keydown', (event) => { keys[event.key.toLowerCase()] = true; });
window.addEventListener('keyup', (event) => { keys[event.key.toLowerCase()] = false; });

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function damp(current, target, speed, dt) { return lerp(current, target, 1 - Math.exp(-speed * dt)); }
function rgbOf(c, a = 1) { return `rgba(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)},${a})`; }
function toThree(c) { return new THREE.Color().setRGB(c.r / 255, c.g / 255, c.b / 255, THREE.SRGBColorSpace); }
function lum(c) { return (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255; }
function sat(c) { const mx = Math.max(c.r, c.g, c.b); const mn = Math.min(c.r, c.g, c.b); return mx === 0 ? 0 : (mx - mn) / mx; }
function dist(a, b) { return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b); }
function shade(c, f) { return { r: clamp(c.r * f, 0, 255), g: clamp(c.g * f, 0, 255), b: clamp(c.b * f, 0, 255) }; }
function mixColor(a, b, t) { return { r: lerp(a.r, b.r, t), g: lerp(a.g, b.g, t), b: lerp(a.b, b.b, t) }; }
function hueOf(c) {
  const r = c.r / 255, g = c.g / 255, b = c.b / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (!d) return 0;
  let h;
  if (mx === r) h = ((g - b) / d) % 6;
  else if (mx === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return ((h / 6) + 1) % 1;
}
function cssColor(c) { return `#${toThree(c).getHexString()}`; }

/* 鼻头颜色不能一律用粉红：灰猫配亮粉鼻头一眼就是贴图。
 * 用「压暗的毛色 + 粉」按亮度混合：白猫偏粉、黑猫偏暗、灰猫偏藕荷。 */
function noseTone(base) {
  return mixColor(shade(base, 0.6), { r: 228, g: 146, b: 146 }, 0.45 + 0.3 * lum(base));
}

/* ------------------------------------------------------------------ *
 * 1. 毛色 / 花纹分析
 * ------------------------------------------------------------------ */

const BREED_PRESETS = [
  { key: 'calico', label: '三花', re: /三花|calico/i, pattern: 'calico', bib: true, base: { r: 232, g: 150, b: 76 }, accent: { r: 62, g: 56, b: 58 }, light: { r: 250, g: 244, b: 232 }, eye: { r: 122, g: 174, b: 98 } },
  { key: 'tuxedo', label: '奶牛', re: /奶牛|黑白|tuxedo/i, pattern: 'tuxedo', bib: true, base: { r: 52, g: 56, b: 62 }, accent: { r: 36, g: 40, b: 46 }, light: { r: 250, g: 248, b: 242 }, eye: { r: 208, g: 170, b: 72 } },
  { key: 'tabby', label: '狸花', re: /虎斑|狸花|tabby/i, pattern: 'tabby', bib: false, base: { r: 168, g: 142, b: 106 }, accent: { r: 80, g: 68, b: 56 }, light: { r: 238, g: 224, b: 198 }, eye: { r: 126, g: 178, b: 98 } },
  // 渐层（蓝金 / 银 / 金吉拉）要排在「蓝猫」前面，否则「蓝金渐层」会被蓝猫规则抢走
  { key: 'shaded', label: '渐层', re: /渐层|蓝金|金吉拉|shaded/i, pattern: 'solid', bib: false, base: { r: 156, g: 152, b: 146 }, accent: { r: 104, g: 104, b: 112 }, light: { r: 238, g: 226, b: 202 }, eye: { r: 208, g: 162, b: 74 } },
  { key: 'blue', label: '英短蓝', re: /英短蓝|蓝猫|蓝白|俄罗斯蓝/i, pattern: 'solid', bib: false, base: { r: 128, g: 152, b: 174 }, accent: { r: 98, g: 120, b: 142 }, light: { r: 208, g: 222, b: 232 }, eye: { r: 216, g: 170, b: 68 } },
  { key: 'points', label: '暹罗', re: /暹罗|siamese|重点/i, pattern: 'points', bib: false, base: { r: 236, g: 222, b: 200 }, accent: { r: 96, g: 72, b: 64 }, light: { r: 250, g: 244, b: 232 }, eye: { r: 96, g: 152, b: 208 } },
  { key: 'orange', label: '橘猫', re: /橘|orange/i, pattern: 'tabby', bib: true, base: { r: 238, g: 162, b: 82 }, accent: { r: 186, g: 106, b: 50 }, light: { r: 252, g: 232, b: 202 }, eye: { r: 120, g: 172, b: 96 } },
  { key: 'white', label: '白猫', re: /白|white/i, pattern: 'solid', bib: true, base: { r: 244, g: 242, b: 236 }, accent: { r: 214, g: 212, b: 206 }, light: { r: 252, g: 250, b: 246 }, eye: { r: 122, g: 172, b: 182 } }
];

// 毛色手动校正：自动解析经常被衣服、项圈、背景带偏，让用户一键改回来
const COAT_STORE_KEY = 'meow-kart-coat-v1';
function readCoatOverrides() {
  try { return JSON.parse(localStorage.getItem(COAT_STORE_KEY) || '{}') || {}; } catch (_) { return {}; }
}
function writeCoatOverride(catId, key) {
  const all = readCoatOverrides();
  if (key && key !== 'auto') all[catId] = key; else delete all[catId];
  try { localStorage.setItem(COAT_STORE_KEY, JSON.stringify(all)); } catch (_) { /* 无痕模式忽略 */ }
}
function presetCoat(key) {
  const preset = BREED_PRESETS.find((p) => p.key === key);
  if (!preset) return null;
  return {
    palette: { base: preset.base, accent: preset.accent, light: preset.light, eye: preset.eye, nose: noseTone(preset.base) },
    pattern: preset.pattern,
    bib: preset.bib !== false,
    source: 'manual',
    key: preset.key,
    thumb: ''
  };
}

function breedPreset(cat) {
  // 多视角照片算出来的毛色优先级最高（比品种词库更贴合本猫）
  const profile = cat.coatProfile;
  if (profile && profile.palette && profile.palette.base) {
    return {
      palette: {
        base: profile.palette.base,
        accent: profile.palette.accent || shade(profile.palette.base, 0.72),
        light: profile.palette.light || mixColor(profile.palette.base, { r: 255, g: 250, b: 240 }, 0.6),
        eye: profile.palette.eye || { r: 122, g: 174, b: 98 },
        nose: profile.palette.nose || noseTone(profile.palette.base)
      },
      pattern: profile.pattern || 'solid',
      bib: profile.bib !== false,
      source: 'views',
      key: '',
      thumb: ''
    };
  }
  const breed = String(cat.breed || '');
  const hit = BREED_PRESETS.find((preset) => preset.re.test(breed));
  const fallbackBase = hexToRgb(cat.color, { r: 242, g: 166, b: 90 });
  const fallbackAccent = hexToRgb(cat.color2, shade(fallbackBase, 0.72));
  const fallbackLight = hexToRgb(cat.belly, mixColor(fallbackBase, { r: 255, g: 250, b: 240 }, 0.6));
  const palette = hit
    ? { base: hit.base, accent: hit.accent, light: hit.light, eye: hit.eye, nose: noseTone(hit.base) }
    : { base: fallbackBase, accent: fallbackAccent, light: fallbackLight, eye: { r: 122, g: 174, b: 98 }, nose: noseTone(fallbackBase) };
  return { palette, pattern: hit ? hit.pattern : 'tabby', bib: hit ? hit.bib !== false : true, source: 'breed', key: hit ? hit.key : '', thumb: '' };
}

function hexToRgb(value, fallback) {
  if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value.trim())) return fallback;
  const hex = value.trim().slice(1);
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16)
  };
}

function analyzePhoto(image) {
  const S = 96;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, S, S);
  const data = ctx.getImageData(0, 0, S, S).data;
  const pixels = new Array(S * S);
  for (let y = 0; y < S; y += 1) {
    for (let x = 0; x < S; x += 1) {
      const i = (y * S + x) * 4;
      pixels[y * S + x] = { r: data[i], g: data[i + 1], b: data[i + 2] };
    }
  }

  // 先用四边框估计「背景色」：上传的头像常有纯色背景，直接统计会把背景当成猫的毛色
  const border = new Map();
  let borderN = 0;
  const tally = (map, c) => {
    const key = ((c.r >> 4) << 8) | ((c.g >> 4) << 4) | (c.b >> 4);
    let b = map.get(key);
    if (!b) { b = { n: 0, r: 0, g: 0, b: 0 }; map.set(key, b); }
    b.n += 1; b.r += c.r; b.g += c.g; b.b += c.b;
  };
  for (let y = 0; y < S; y += 1) {
    for (let x = 0; x < S; x += 1) {
      if (x < S * 0.13 || x > S * 0.87 || y < S * 0.13 || y > S * 0.87) {
        tally(border, pixels[y * S + x]); borderN += 1;
      }
    }
  }
  const borderList = Array.from(border.values())
    .map((b) => ({ n: b.n, color: { r: b.r / b.n, g: b.g / b.n, b: b.b / b.n } }))
    .sort((a, b) => b.n - a.n);
  const bgColors = borderList.filter((b) => b.n / (borderN || 1) > 0.07).slice(0, 3).map((b) => b.color);
  // 只有边框明显是单一底色时才做抠除，避免把白色猫咪本身误删
  const useBgFilter = borderList.length > 0 && borderList[0].n / (borderN || 1) > 0.38;
  const isBackground = (c) => useBgFilter && bgColors.some((bg) => dist(bg, c) < 44);

  const buckets = new Map();
  let white = 0, sampled = 0;
  for (let y = 0; y < S; y += 1) {
    for (let x = 0; x < S; x += 1) {
      const c = pixels[y * S + x];
      if (isBackground(c)) continue;
      sampled += 1;
      if (lum(c) > 0.84 && sat(c) < 0.2) white += 1;
      tally(buckets, c);
    }
  }
  if (sampled < S * S * 0.12) {
    // 抠除过头时退回全图统计
    buckets.clear(); white = 0;
    for (let y = 0; y < S; y += 1) {
      for (let x = 0; x < S; x += 1) {
        const c = pixels[y * S + x];
        if (lum(c) > 0.84 && sat(c) < 0.2) white += 1;
        tally(buckets, c);
      }
    }
    sampled = S * S;
  }

  // 边缘密度只统计中心区域，避免背景与主体的交界线被误判成虎斑纹
  const lo = Math.floor(S * 0.16), hi = Math.ceil(S * 0.84);
  let edges = 0;
  for (let y = lo; y < hi; y += 1) {
    for (let x = lo; x < hi; x += 1) {
      const a = lum(pixels[y * S + x]);
      if (Math.abs(a - lum(pixels[y * S + x + 1])) > 0.19 || Math.abs(a - lum(pixels[(y + 1) * S + x])) > 0.19) edges += 1;
    }
  }
  const edgeRatio = edges / ((hi - lo) * (hi - lo));
  const whiteRatio = white / (sampled || 1);

  // 合并相近颜色，取主要色族
  const raw = Array.from(buckets.values())
    .map((b) => ({ n: b.n, color: { r: Math.round(b.r / b.n), g: Math.round(b.g / b.n), b: Math.round(b.b / b.n) } }))
    .sort((a, b) => b.n - a.n);
  const merged = [];
  for (const item of raw) {
    const near = merged.find((m) => dist(m.color, item.color) < 46);
    if (near) {
      const total = near.n + item.n;
      near.color = mixColor(near.color, item.color, item.n / total);
      near.n = total;
    } else {
      merged.push({ n: item.n, color: { ...item.color } });
    }
    if (merged.length >= 8) break;
  }
  merged.sort((a, b) => b.n - a.n);
  const totalN = merged.reduce((sum, c) => sum + c.n, 0) || 1;
  const major = merged.filter((c) => c.n / totalN > 0.055).slice(0, 5).map((c) => c.color);
  const families = [];
  major.forEach((c) => {
    const hd = hueOf(c);
    if (!families.some((f) => Math.min(Math.abs(hueOf(f) - hd), 1 - Math.abs(hueOf(f) - hd)) < 0.09 || dist(f, c) < 48)) families.push(c);
  });
  const spread = families.length;

  const colored = merged.find((c) => !(lum(c.color) > 0.82 && sat(c.color) < 0.2));
  const base = (colored || merged[0] || { color: { r: 242, g: 166, b: 90 } }).color;
  const lightest = merged.reduce((best, c) => (lum(c.color) > lum(best) ? c.color : best), base);
  const light = lum(lightest) > lum(base) + 0.14 ? lightest : mixColor(base, { r: 255, g: 250, b: 240 }, 0.62);
  const accentHit = merged.find((c) => c.n / totalN > 0.035 && dist(c.color, base) > 58);
  const accent = accentHit ? accentHit.color : shade(base, 0.58);

  // 中心区域的虹膜颜色（绿 / 琥珀 / 蓝）
  const eyeHits = [];
  for (let y = Math.floor(S * 0.26); y < S * 0.72; y += 1) {
    for (let x = Math.floor(S * 0.2); x < S * 0.8; x += 1) {
      const c = pixels[y * S + x];
      const h = hueOf(c);
      if (sat(c) > 0.34 && lum(c) > 0.16 && lum(c) < 0.82 && ((h > 0.16 && h < 0.48) || (h > 0.05 && h < 0.15) || (h > 0.5 && h < 0.68))) eyeHits.push(c);
    }
  }
  let eye = { r: 122, g: 174, b: 98 };
  if (eyeHits.length > 14) {
    eye = eyeHits.reduce((acc, c) => ({ r: acc.r + c.r, g: acc.g + c.g, b: acc.b + c.b }), { r: 0, g: 0, b: 0 });
    eye = { r: eye.r / eyeHits.length, g: eye.g / eyeHits.length, b: eye.b / eyeHits.length };
  } else if (hueOf(base) < 0.12) {
    eye = { r: 122, g: 174, b: 98 };
  } else {
    eye = { r: 212, g: 172, b: 74 };
  }

  // 四角比中心明显暗 => 重点色（暹罗）
  let cornerLum = 0, cornerCount = 0, centerLum = 0, centerCount = 0;
  for (let y = 0; y < S; y += 1) {
    for (let x = 0; x < S; x += 1) {
      const l = lum(pixels[y * S + x]);
      const isCorner = (x < S * 0.22 || x > S * 0.78) && (y < S * 0.22 || y > S * 0.78);
      if (isCorner) { cornerLum += l; cornerCount += 1; }
      else if (x > S * 0.3 && x < S * 0.7 && y > S * 0.3 && y < S * 0.7) { centerLum += l; centerCount += 1; }
    }
  }
  const cornerDark = (centerLum / (centerCount || 1)) - (cornerLum / (cornerCount || 1));

  let pattern = 'solid';
  if (spread >= 3 && whiteRatio > 0.09) pattern = 'calico';
  else if (whiteRatio > 0.2 && whiteRatio < 0.72 && spread >= 2) pattern = 'tuxedo';
  else if (edgeRatio > 0.15 || (dist(base, accent) > 52 && lum(accent) < lum(base) - 0.16)) pattern = 'tabby';
  else if (cornerDark > 0.14) pattern = 'points';

  return {
    palette: { base, accent, light, eye, nose: noseTone(base) },
    pattern,
    // 只有照片里真的有大片白毛时才画白斑，否则整块浅色会把脸糊掉
    bib: whiteRatio > 0.12,
    source: 'photo'
  };
}

/* ------------------------------------------------------------------ *
 * 1b. 多视角校准：只取照片里「可信」的那部分
 * ------------------------------------------------------------------ *
 * 单张照片算出来的毛色几乎总被三件事带偏：室内暖光、身上的胸背带/衣服、截图黑边。
 * 四张照片各说各话时直接取 RGB 平均，得到的是一团泥褐色（实测 rgb(94,84,72)），
 * 而这只猫实际是冷调灰。所以分三步：
 *   1. 用「最亮的一撮接近中性色的像素」（白胸、白爪、白墙）当白参考，把每张照片
 *      先归一化到同一白平衡 —— 这一步就能把暖灯下的灰猫还原成灰猫；
 *   2. 逐张取亮度分位的深/中/浅三档，跨照片取【中位数】而不是平均数，抗坏样本；
 *   3. 色相只允许在品种预设附近漂移：照片能说明「多亮、有没有白斑、眼睛什么颜色」，
 *      但说明不了「是灰还是黄」，因为四张照片本身就不是同一个色温。
 */
const VIEW_SAMPLE = 128;

function medianOf(values) {
  const list = values.filter((v) => typeof v === 'number' && !Number.isNaN(v)).sort((a, b) => a - b);
  if (!list.length) return 0;
  return list[Math.floor(list.length / 2)];
}
function medianColor(list) {
  return { r: medianOf(list.map((p) => p.r)), g: medianOf(list.map((p) => p.g)), b: medianOf(list.map((p) => p.b)) };
}
function roundColor(c) {
  return { r: Math.round(clamp(c.r, 0, 255)), g: Math.round(clamp(c.g, 0, 255)), b: Math.round(clamp(c.b, 0, 255)) };
}
// 把颜色缩放到指定亮度：用于「保留照片的明暗，但换成预设的色相」
function scaleToLum(c, target) {
  const base = lum(c) || 0.01;
  return shade(c, clamp(target, 0.02, 0.98) / base);
}
// 预设色先对齐到照片的亮度，再把照片的色偏按 strength 混进来
function blendToPreset(photoColor, presetColor, strength) {
  const aligned = scaleToLum(presetColor, lum(photoColor));
  return roundColor(mixColor(aligned, photoColor, strength));
}

function analyzeViewPhoto(image) {
  const S = VIEW_SAMPLE;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, S, S);
  const data = ctx.getImageData(0, 0, S, S).data;
  const pixels = new Array(S * S);
  for (let y = 0; y < S; y += 1) {
    for (let x = 0; x < S; x += 1) {
      const i = (y * S + x) * 4;
      pixels[y * S + x] = { x, y, r: data[i], g: data[i + 1], b: data[i + 2] };
    }
  }

  // 四边框的中位色当背景。手机截图的上下黑条会在这里被识别成「背景」，
  // 后面按背景色剔除时正好连黑条一起丢掉
  const ring = pixels.filter((p) => p.x < S * 0.08 || p.x > S * 0.92 || p.y < S * 0.08 || p.y > S * 0.92);
  const bg = medianColor(ring);
  const bgShare = ring.filter((p) => dist(p, bg) < 40).length / (ring.length || 1);

  const inBox = (p) => p.x > S * 0.12 && p.x < S * 0.88 && p.y > S * 0.12 && p.y < S * 0.88;
  let inner = pixels.filter(inBox)
    .filter((p) => { const l = lum(p); return l > 0.085 && l < 0.985; })   // 黑边 / 过曝
    .filter((p) => !(bgShare > 0.34 && dist(p, bg) < 42));
  if (inner.length < 300) {
    inner = pixels.filter((p) => { const l = lum(p); return l > 0.085 && l < 0.985; });
  }
  inner.forEach((p) => { p.l = lum(p); });
  inner.sort((a, b) => a.l - b.l);

  const band = (lo, hi) => {
    const seg = inner.slice(Math.floor(inner.length * lo), Math.floor(inner.length * hi));
    const n = seg.length || 1;
    const sum = seg.reduce((a, p) => ({ r: a.r + p.r, g: a.g + p.g, b: a.b + p.b }), { r: 0, g: 0, b: 0 });
    return { r: sum.r / n, g: sum.g / n, b: sum.b / n };
  };

  // 白参考：最亮 10% 里低饱和的那撮。够亮才可信（昏暗照片里最亮的也可能是灰墙）
  const top = inner.slice(Math.floor(inner.length * 0.9));
  const whitish = top.filter((p) => sat(p) < 0.34);
  const ref = medianColor(whitish.length > 60 ? whitish : top);
  const wb = lum(ref) > 0.52;
  const gain = wb
    ? { r: 232 / Math.max(40, ref.r), g: 232 / Math.max(40, ref.g), b: 232 / Math.max(40, ref.b) }
    : { r: 1, g: 1, b: 1 };
  const norm = (c) => ({ r: c.r * gain.r, g: c.g * gain.g, b: c.b * gain.b });

  // 琥珀色虹膜：橙色、高饱和、中等亮度。取偏亮的一档，避开虹膜外圈和睫毛的暗边
  const iris = pixels.filter((p) => {
    const h = hueOf(p);
    const l = lum(p);
    return h > 0.045 && h < 0.135 && sat(p) > 0.5 && l > 0.22 && l < 0.72;
  }).sort((a, b) => lum(a) - lum(b));
  const irisTop = iris.slice(Math.floor(iris.length * 0.55), Math.floor(iris.length * 0.9));
  const eye = irisTop.length > 20 ? medianColor(irisTop) : null;
  const eyeScore = eye ? lum(eye) * sat(eye) : 0;

  // 白斑比例：只看主体区域，避免小图里猫只占一点点导致比例被稀释
  const whiteRatio = inner.filter((p) => p.l > 0.84 && sat(p) < 0.2).length / (inner.length || 1);

  return {
    wb,
    ref: roundColor(ref),
    dark: roundColor(norm(band(0.10, 0.28))),
    mid: roundColor(norm(band(0.45, 0.72))),
    light: roundColor(norm(band(0.88, 0.97))),
    eye: eye ? roundColor(eye) : null,
    eyeScore,
    whiteRatio,
    samples: inner.length
  };
}

function breedPalette(cat) {
  const breed = String((cat && cat.breed) || '');
  const hit = BREED_PRESETS.find((preset) => preset.re.test(breed));
  return hit || null;
}

/* 多张照片 -> 一份可用的毛色。返回逐张明细，方便界面解释「为什么是这个颜色」 */
function calibrateViews(images, cat) {
  const rows = [];
  images.forEach((image, index) => {
    try {
      const info = analyzePhoto(image);           // 花纹判定复用同一套逻辑，避免两套算法给两个结论
      rows.push({ index, ...analyzeViewPhoto(image), pattern: info.pattern, photoBib: info.bib });
    } catch (_) { /* 单张失败就跳过 */ }
  });
  if (!rows.length) return null;

  const wbRows = rows.filter((row) => row.wb);
  const pool = wbRows.length ? wbRows : rows;
  const med = (key, ch) => medianOf(pool.map((row) => (row[key] ? row[key][ch] : NaN)));

  const photoMid = { r: med('mid', 'r'), g: med('mid', 'g'), b: med('mid', 'b') };
  const photoDark = { r: med('dark', 'r'), g: med('dark', 'g'), b: med('dark', 'b') };
  const photoLight = { r: med('light', 'r'), g: med('light', 'g'), b: med('light', 'b') };

  const preset = breedPalette(cat);
  const fallback = { base: photoMid, accent: shade(photoMid, 0.62), light: photoLight, eye: { r: 202, g: 158, b: 72 } };
  const pPalette = preset ? { base: preset.base, accent: preset.accent, light: preset.light, eye: preset.eye } : fallback;

  // 有预设就往预设收（0.35 的色偏保留量）；没预设只能全信照片
  const strength = preset ? 0.35 : 1;
  const base = blendToPreset(photoMid, pPalette.base, strength);
  // 深色不从「照片最暗的一档」取：那一档主要是腿间和身下的投影，不是毛。
  // 按主色压暗一档再往预设收，才是「毛的暗部」该有的颜色
  const accent = blendToPreset(shade(base, 0.66), pPalette.accent, preset ? 0.5 : 0);
  const light = blendToPreset(photoLight, pPalette.light, Math.min(strength, 0.45));
  // 虹膜取「最像虹膜」的那张（亮度×饱和度最高），比跨图平均可靠得多
  const bestEye = rows.filter((row) => row.eye).sort((a, b) => b.eyeScore - a.eyeScore)[0];
  const eye = bestEye ? blendToPreset(bestEye.eye, pPalette.eye, 0.4) : pPalette.eye;

  const tally = (list) => {
    const counts = {};
    list.forEach((v) => { counts[v] = (counts[v] || 0) + 1; });
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || '';
  };
  let pattern = tally(rows.map((row) => row.pattern)) || 'solid';
  // 渐层/重点色本来就该是纯色底，别因为一张逆光照片判成虎斑
  if (preset && (preset.pattern === 'solid' || preset.pattern === 'points') && pattern === 'tabby') pattern = preset.pattern;

  // 白斑判定不能只看「白色像素占比」：猫在画面里只占一小块时，白胸白爪会被稀释掉。
  // 更稳的信号是「最亮那一档明显比主色亮，而且是中性色」——那就是白毛，不是灰毛的高光
  const whitePatch = rows.filter((row) => {
    const lift = lum(row.light) - lum(row.mid);
    return row.photoBib || row.whiteRatio > 0.055 || (lift > 0.12 && sat(row.light) < 0.3);
  }).length;
  const bib = preset && preset.bib === false
    ? whitePatch * 2 > rows.length        // 预设说没有白斑，但照片里过半有，就信照片
    : whitePatch * 2 >= rows.length;

  return {
    palette: {
      base: roundColor(base),
      accent: roundColor(accent),
      light: roundColor(light),
      eye: roundColor(eye),
      nose: roundColor(mixColor(shade(base, 0.46), { r: 186, g: 126, b: 128 }, 0.30))
    },
    pattern,
    bib,
    samples: rows.length,
    balanced: wbRows.length,
    rows
  };
}

/* ------------------------------------------------------------------ *
 * 2. 程序化毛发纹理
 * ------------------------------------------------------------------ */

function drawPattern(ctx, size, palette, pattern) {
  const { base, accent, light } = palette;
  if (pattern === 'tabby') {
    ctx.lineCap = 'round';
    for (let i = 0; i < 20; i += 1) {
      const x = ((i + 0.5) * size) / 20 + (Math.random() - 0.5) * 12;
      ctx.strokeStyle = rgbOf(accent, 0.55 + Math.random() * 0.3);
      ctx.lineWidth = 7 + Math.random() * 15;
      ctx.beginPath();
      for (let y = -12; y <= size + 12; y += 10) {
        const wobble = Math.sin(y * 0.021 + i * 1.6) * 15 + Math.sin(y * 0.057 + i) * 6;
        if (y === -12) ctx.moveTo(x + wobble, y);
        else ctx.lineTo(x + wobble, y);
      }
      ctx.stroke();
    }
  } else if (pattern === 'calico') {
    // 三花色块：边界必须是不规则的。用正圆会画出一顶「帽子」，
    // 所以每个色块都按几个不同频率的正弦扰动半径，再填内部渐变。
    // 注意这是圆柱投影 UV：画布 y=0 在耳尖、y=1 在脚底，正脸在 y≈0.38。
    // 色块必须贴着肩、胯、额角分布，绝不能有一块正好扣在脸上（那就是白面具）
    const patches = [
      { c: accent, x: 0.445, y: 0.135, r: 0.075 },
      { c: accent, x: 0.618, y: 0.238, r: 0.048 },
      { c: accent, x: 0.145, y: 0.46, r: 0.15 },
      { c: accent, x: 0.875, y: 0.58, r: 0.14 },
      { c: shade(base, 1.05), x: 0.985, y: 0.40, r: 0.17 },
      { c: shade(base, 0.88), x: 0.335, y: 0.77, r: 0.09 },
      { c: shade(base, 0.92), x: 0.70, y: 0.72, r: 0.10 }
    ];
    patches.forEach(({ c, x, y, r }) => {
      const gx = x * size;
      const gy = y * size;
      const rr = r * size;
      const seed = Math.random() * 12;
      ctx.beginPath();
      for (let k = 0; k <= 30; k += 1) {
        const a = (k / 30) * Math.PI * 2;
        const wob = 1 + 0.15 * Math.sin(a * 3 + seed) + 0.08 * Math.sin(a * 7 + seed * 2.3);
        const px = gx + Math.cos(a) * rr * wob;
        const py = gy + Math.sin(a) * rr * wob * 0.86;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.save();
      ctx.clip();
      const g = ctx.createRadialGradient(gx, gy, rr * 0.08, gx, gy, rr * 1.15);
      g.addColorStop(0, rgbOf(c, 0.97));
      g.addColorStop(0.72, rgbOf(c, 0.9));
      g.addColorStop(1, rgbOf(c, 0.8));
      ctx.fillStyle = g;
      ctx.fillRect(gx - rr * 1.4, gy - rr * 1.4, rr * 2.8, rr * 2.8);
      ctx.restore();
    });
  } else if (pattern === 'tuxedo') {
    ctx.fillStyle = rgbOf(light, 0.96);
    ctx.beginPath();
    ctx.moveTo(0, size * 0.52);
    for (let x = 0; x <= size; x += 12) {
      ctx.lineTo(x, size * 0.52 + Math.sin(x * 0.018) * 22 + Math.sin(x * 0.05) * 9);
    }
    ctx.lineTo(size, size); ctx.lineTo(0, size); ctx.closePath(); ctx.fill();
    const blaze = ctx.createRadialGradient(size * 0.25, size * 0.1, 0, size * 0.25, size * 0.1, size * 0.3);
    blaze.addColorStop(0, rgbOf(light, 0.75)); blaze.addColorStop(1, rgbOf(light, 0));
    ctx.fillStyle = blaze; ctx.fillRect(0, 0, size, size);
  } else if (pattern === 'points') {
    // 圆柱投影 UV：正前方（脸）在 u = 0.5、v ≈ 0.6
    const mask = ctx.createRadialGradient(size * 0.5, size * 0.4, size * 0.02, size * 0.5, size * 0.4, size * 0.26);
    mask.addColorStop(0, rgbOf(accent, 0.9));
    mask.addColorStop(0.6, rgbOf(accent, 0.62));
    mask.addColorStop(1, rgbOf(accent, 0));
    ctx.fillStyle = mask; ctx.fillRect(0, 0, size, size);
    const top = ctx.createLinearGradient(0, 0, 0, size * 0.3);
    top.addColorStop(0, rgbOf(accent, 0.72)); top.addColorStop(1, rgbOf(accent, 0));
    ctx.fillStyle = top; ctx.fillRect(0, 0, size, size * 0.3);
    const bottom = ctx.createLinearGradient(0, size, 0, size * 0.72);
    bottom.addColorStop(0, rgbOf(accent, 0.6)); bottom.addColorStop(1, rgbOf(accent, 0));
    ctx.fillStyle = bottom; ctx.fillRect(0, size * 0.72, size, size * 0.28);
  } else {
    /* 纯色猫的「毛色不匀」：以前是 9 个大径向渐变（半径 90–180px，画布才 512），
     * 在脸上就是几团水彩云，用户说的「面部纹理不对」一半来自这里。
     * 改成 22 个小斑、明暗双向、透明度压到 0.05：只是让底色别像塑料，
     * 真正的毛感交给 drawFurStrokes 的毛流笔触 */
    for (let i = 0; i < 22; i += 1) {
      const x = Math.random() * size, y = Math.random() * size;
      const r = 16 + Math.random() * 30;
      const bright = Math.random() < 0.55;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgbOf(bright ? shade(palette.base, 1.05) : shade(palette.base, 0.95), 0.055));
      g.addColorStop(1, rgbOf(palette.base, 0));
      ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
    }
  }
  const shadeGrad = ctx.createLinearGradient(0, 0, 0, size);
  shadeGrad.addColorStop(0, 'rgba(20,14,10,0.16)');
  shadeGrad.addColorStop(0.45, 'rgba(20,14,10,0)');
  shadeGrad.addColorStop(1, 'rgba(255,250,240,0.07)');
  ctx.fillStyle = shadeGrad; ctx.fillRect(0, 0, size, size);
}

/* 毛流方向场（输入是圆柱投影的 u/v，输出是画布上的角度：0=朝下）。
 *
 * 之前这里是无条件往下画短竖线 —— 但贴图是按圆柱投影铺的，
 * 竖向笔触到了脸上就是一排等距竖条，用户看到的「面部纹理不对」就是这个。
 * 真猫的毛有两个特征：一是有方向（从鼻梁往四周发散、身体上顺毛往下），
 * 二是成簇（同一撮毛方向一致，簇和簇之间才换向）。
 * 这里先把方向算出来，再在 drawFurStrokes 里按簇落笔。 */
function furFlowAngle(u, v) {
  const du = u - 0.5;
  const dv = v - 0.56;
  // 头脸区（v>0.62 起算，到 0.74 完全生效），下半身完全按「顺毛往下」
  const head = clamp((v - 0.60) / 0.14, 0, 1);
  // 以鼻头为原点的放射角：鼻下朝下(0)、鼻上朝上(±π)、两腮朝外(±π/2)
  const radial = Math.atan2(du * 2.4, -dv);
  return radial * head;
}

function drawFurStrokes(ctx, size, palette, count) {
  const highlight = mixColor(palette.base, { r: 255, g: 250, b: 238 }, 0.46);
  const shadow = mixColor(palette.base, { r: 30, g: 22, b: 18 }, 0.28);
  ctx.lineCap = 'round';
  let drawn = 0;
  let guard = 0;
  while (drawn < count && guard < count * 2) {
    guard += 1;
    const cu = Math.random();
    const cv = 1 - Math.random();
    const cx = cu * size;
    const cy = (1 - cv) * size;
    // 一簇 3–7 根，方向只在这个簇内保持一致
    const tuftAngle = furFlowAngle(cu, cv) + (Math.random() - 0.5) * 0.55;
    const bright = Math.random() < 0.54;
    const tuft = 3 + Math.floor(Math.random() * 5);
    const spread = 5 + Math.random() * 10;
    for (let k = 0; k < tuft && drawn < count; k += 1) {
      drawn += 1;
      const x = cx + (Math.random() - 0.5) * spread;
      const y = cy + (Math.random() - 0.5) * spread;
      // 笔触必须够大：贴图只有 512px，整张脸在贴图上约 180px，
      // 而屏幕上脸也只有 200px 左右 —— 1px 的细线等于没画。
      // 之前 len 4~17 / lineWidth 0.5~1.8，正是「脸上什么都没有」的原因
      const len = 7 + Math.random() * 14;
      const a = tuftAngle + (Math.random() - 0.5) * 0.32;
      const dx = Math.sin(a) * len;
      const dy = Math.cos(a) * len;
      const bend = (Math.random() - 0.5) * 0.55;
      ctx.strokeStyle = rgbOf(bright ? highlight : shadow, 0.028 + Math.random() * 0.062);
      ctx.lineWidth = 1.0 + Math.random() * 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(
        x + dx * 0.5 - dy * bend * 0.5,
        y + dy * 0.5 + dx * bend * 0.5,
        x + dx,
        y + dy
      );
      ctx.stroke();
    }
  }
}

/* 浅色区（胸腹白、口鼻白、四只白袜子）直接画进贴图。
 * 整只猫现在是一张网格、一个材质，靠贴图分区才不会出现「贴片」的硬边。
 * 坐标是圆柱投影 UV：u=0.5 是正前方，v 是高度（0=脚底，1=耳尖）。
 *
 * 位置必须按解剖来，不能凭手感放大：
 *   眼睛 v≈0.67、鼻头 v≈0.57、嘴 v≈0.535、下巴 v≈0.49、胸口 v≈0.30
 * 之前口鼻白和胸口白都画到了 v=0.60 以上，正好横穿两只眼睛，
 * 在脸上留下一条「眼罩」似的浅色横带 —— 这是最显假的地方。 */
function paintLightAreas(ctx, size, palette, bib) {
  const vy = (v) => (1 - v) * size;
  const soft = (u, v, rx, ry, strength = 1) => {
    const cx = u * size;
    const cy = vy(v);
    const rxPx = rx * size;
    const ryPx = ry * size;
    const r = Math.max(rxPx, ryPx);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, rgbOf(palette.light, strength));
    g.addColorStop(0.55, rgbOf(palette.light, strength * 0.96));
    g.addColorStop(0.82, rgbOf(palette.light, strength * 0.6));
    g.addColorStop(1, rgbOf(palette.light, 0));
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(rxPx / r, ryPx / r);
    ctx.translate(-cx, -cy);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  if (bib) {
    // 胸口白斑：不能用一个大椭圆 —— 圆柱 UV 里椭圆的顶边是一条水平线，
    // 会在胸口横切一刀。改成几个越来越窄的圆叠起来，边界才是自然的弧形。
    // 底边必须停在 v≈0.27 以上：前腿的 v 区间是 0.06–0.24，
    // 胸白一旦压到 0.24 以下就顺着腿一路流下去，四条腿整根变白。
    // u 半径也不能超过 0.06：前腿在 u 0.406 / 0.594，胸白一宽就盖到腿上
    soft(0.5, 0.286, 0.058, 0.040);
    soft(0.5, 0.322, 0.068, 0.046);
    soft(0.5, 0.362, 0.056, 0.046);
    soft(0.5, 0.400, 0.036, 0.038);
    // 口鼻白：三瓣（左右胡须垫 + 下巴），同样是圆的叠加，没有直边；
    // 强度压到 0.8，不然在头像尺寸下会变成一撇白胡子
    soft(0.474, 0.506, 0.024, 0.022, 0.55);
    soft(0.526, 0.506, 0.024, 0.022, 0.55);
    soft(0.5, 0.487, 0.028, 0.021, 0.62);
    // 四只白袜子：只盖住脚掌那一段。之前 rx/ry 给到 0.052/0.078，
    // 一路画到小腿，四条腿整根变白，远看像穿了四只白靴子
    [[0.406, 0.062], [0.594, 0.062], [0.143, 0.062], [0.857, 0.062]].forEach(([u, v]) => {
      soft(u, v, 0.030, 0.040);
    });
  } else {
    // 纯色猫（蓝猫、渐层）没有白斑，但下巴和胸口本身比身上浅一档，
    // 用低强度、大范围的柔光带过，避免整张脸像一块塑料
    soft(0.5, 0.20, 0.115, 0.085, 0.22);
    soft(0.5, 0.30, 0.070, 0.065, 0.24);
    soft(0.5, 0.512, 0.044, 0.032, 0.30);
  }
}

/* 圆柱 UV 的副作用：尾巴从臀部绕到左前方，在 u≈0.09–0.38、v≈0.05–0.22 一路扫过去，
 * 正好压在后腿白袜子（u 0.143, v 0.07）和左前腿白袜子（u 0.406）的位置上——
 * 结果整条尾巴被刷成一根奶白色、还带一圈圈横纹的棍子。
 *
 * 下面这张表是拿网格顶点的实际 UV 量出来的（x<-0.30、y<0.32 的顶点，
 * u 分位 0.097/0.152/0.199/0.287/0.375，v 分位 0.048/0.085/0.122/0.158/0.220），
 * 不是按控制点猜的。改尾巴几何必须重新量一遍。 */
const TAIL_UV_PATH = [
  // [u, v, u 半径, v 半径]
  [0.088, 0.208, 0.017, 0.064],
  [0.130, 0.162, 0.016, 0.060],
  [0.175, 0.136, 0.016, 0.056],
  [0.215, 0.108, 0.015, 0.052],
  [0.255, 0.086, 0.014, 0.048],
  [0.300, 0.076, 0.013, 0.045],
  [0.340, 0.092, 0.012, 0.040],
  [0.378, 0.122, 0.011, 0.034]
];

function paintTailBase(ctx, size, palette) {
  // 用「沿轨迹描一条实心粗线」而不是「沿轨迹盖一串径向渐变圆」：
  // 每个圆都是一圈 0.98→0 的 alpha 渐变，几十个叠在一起，重叠处必然一亮一暗，
  // 结果尾巴上出现一圈圈等距的横纹（试过，比原来的白袜子还难看）。
  // 描边是恒定 alpha，段与段之间只有圆头重叠，不会有周期性。
  const ctrl = TAIL_UV_PATH.map(([u, v, ru, rv]) => ({ x: u * size, y: (1 - v) * size, w: rv * size * 2 }));
  // 控制点之间要密集插值：只画 7 段的话，每段宽度是常数，段与段之间就留下
  // 一圈「台阶」，远看还是横纹。插到 ~0.002 的步长，宽度变化就看不见了
  const pts = [];
  for (let i = 0; i < ctrl.length - 1; i += 1) {
    const a = ctrl[i];
    const b = ctrl[i + 1];
    const steps = Math.max(4, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 1.2));
    for (let k = 0; k < steps; k += 1) {
      const t = k / steps;
      pts.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, w: a.w + (b.w - a.w) * t });
    }
  }
  pts.push(ctrl[ctrl.length - 1]);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 0; i < pts.length - 1; i += 1) {
    const a = pts[i];
    const b = pts[i + 1];
    // 尾尖压深一档：真猫的尾尖本来就比身上深
    const tip = i > pts.length * 0.74;
    ctx.strokeStyle = rgbOf(tip ? shade(palette.base, 0.86) : palette.base, 1);
    ctx.lineWidth = (a.w + b.w) / 2;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  const last = pts[pts.length - 1];
  ctx.fillStyle = rgbOf(shade(palette.base, 0.86), 1);
  ctx.beginPath();
  ctx.arc(last.x, last.y, last.w / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 顺向短毛：尾巴在贴图上是一条细长的带子，普通的竖直毛笔画到这里会横着穿过去，
  // 所以按轨迹的切线方向单独画一层
  ctx.save();
  ctx.lineCap = 'round';
  const dark = mixColor(palette.base, { r: 34, g: 28, b: 24 }, 0.38);
  const light = mixColor(palette.base, { r: 255, g: 248, b: 236 }, 0.55);
  for (let i = 1; i < pts.length - 1; i += 1) {
    const a = pts[i - 1];
    const b = pts[i + 1];
    const du = b.x - a.x;
    const dv = b.y - a.y;
    const len0 = Math.hypot(du, dv) || 1;
    const tx = du / len0;
    const ty = dv / len0;
    const p = pts[i];
    for (let k = 0; k < 26; k += 1) {
      const off = (Math.random() - 0.5) * p.w * 0.86;
      const px = p.x - ty * off;
      const py = p.y + tx * off;
      const len = 2 + Math.random() * 5;
      const tilt = (Math.random() - 0.5) * 0.7;
      const cx2 = Math.cos(tilt) * tx - Math.sin(tilt) * ty;
      const cy2 = Math.sin(tilt) * tx + Math.cos(tilt) * ty;
      ctx.strokeStyle = rgbOf(Math.random() < 0.5 ? dark : light, 0.05 + Math.random() * 0.11);
      ctx.lineWidth = 0.5 + Math.random() * 1.1;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + cx2 * len, py + cy2 * len);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function makeCoatCanvas(palette, pattern, lightPart, bib = true) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const p = lightPart
    ? { ...palette, base: palette.light, accent: shade(palette.light, 0.86) }
    : palette;
  ctx.fillStyle = rgbOf(p.base);
  ctx.fillRect(0, 0, size, size);
  const drawn = lightPart ? 'solid' : pattern;
  if (drawn === 'tabby' || drawn === 'calico') {
    // 花纹单独画一层，再按纬度淡出：球体 UV 在上下两极会压缩，
    // 条纹堆到极点就会变成「一顶深色帽子」
    const layer = document.createElement('canvas');
    layer.width = layer.height = size;
    const lctx = layer.getContext('2d');
    drawPattern(lctx, size, p, drawn);
    lctx.globalCompositeOperation = 'destination-in';
    const fade = lctx.createLinearGradient(0, 0, 0, size);
    fade.addColorStop(0, 'rgba(0,0,0,0)');
    fade.addColorStop(0.17, 'rgba(0,0,0,1)');
    fade.addColorStop(0.83, 'rgba(0,0,0,1)');
    fade.addColorStop(1, 'rgba(0,0,0,0)');
    lctx.fillStyle = fade;
    lctx.fillRect(0, 0, size, size);
    ctx.drawImage(layer, 0, 0);
  } else {
    drawPattern(ctx, size, p, drawn);
  }
  if (!lightPart) {
    paintLightAreas(ctx, size, palette, bib);
    paintTailBase(ctx, size, palette);
  }
  drawFurStrokes(ctx, size, p, lightPart ? 3000 : 4600);
  // 细颗粒叠加：让毛发有短绒的颗粒感，而不是高对比的黑白噪点
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.globalCompositeOperation = 'overlay';
  ctx.drawImage(getGrainCanvas(), 0, 0, size, size);
  ctx.restore();
  return canvas;
}

let grainCanvas = null;
function getGrainCanvas() {
  if (grainCanvas) return grainCanvas;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);
  ctx.lineCap = 'round';
  for (let i = 0; i < 9000; i += 1) {
    const x = Math.random() * size, y = Math.random() * size;
    const light = Math.random() < 0.5;
    const v = light ? 150 + Math.round(Math.random() * 95) : 25 + Math.round(Math.random() * 80);
    ctx.strokeStyle = `rgb(${v},${v},${v})`;
    ctx.lineWidth = 0.5 + Math.random() * 1.1;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (Math.random() - 0.5) * 3, y + 2 + Math.random() * 7); ctx.stroke();
  }
  grainCanvas = canvas;
  return canvas;
}

function canvasTexture(canvas, repeat = 1) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.anisotropy = 4;
  return texture;
}

function coatFrom(info, thumb) {
  const bib = info.bib !== false;
  const tex = {
    coat: canvasTexture(makeCoatCanvas(info.palette, info.pattern, false, bib)),
    light: canvasTexture(makeCoatCanvas(info.palette, info.pattern, true, bib)),
    // 四肢/尾巴用不带大块花纹的毛色，避免球面 UV 把虎斑拉成「斑马腿」；
    // 重点色猫的耳、爪、尾本身就是深色，直接用 accent 生成
    limb: canvasTexture(makeCoatCanvas(
      info.pattern === 'points' ? { ...info.palette, base: info.palette.accent } : info.palette,
      'solid', false, false
    ))
  };
  return {
    palette: info.palette,
    pattern: info.pattern,
    bib,
    source: info.source,
    key: info.key || '',
    thumb: thumb || '',
    tex,
    colors: {
      base: toThree(info.palette.base),
      accent: toThree(info.palette.accent),
      light: toThree(info.palette.light),
      eye: toThree(info.palette.eye),
      nose: toThree(info.palette.nose),
      // 内耳不能固定用糖果粉：灰猫配亮粉内耳一眼就是贴图。
      // 真猫的内耳其实很淡（灰猫就是一层灰粉），所以粉的比例只给 0.3，
      // 底色用比毛色略深的 0.86 —— 这样耳朵是「毛色的暗部」，不是贴了块粉布
      earInner: toThree(mixColor(shade(info.palette.base, 1.04), { r: 214, g: 166, b: 168 }, 0.55)),
      earRim: toThree(mixColor(mixColor(shade(info.palette.base, 0.86), { r: 206, g: 150, b: 152 }, 0.3), info.palette.accent, 0.3)),
      sheen: toThree(mixColor(info.palette.base, info.palette.light, 0.45)),
      shell: toThree(mixColor(info.palette.base, info.palette.light, 0.35))
    }
  };
}

function startCoatAnalysis(cat, rig) {
  renderCoatInfo(rig.coat());
  // 用户手动指定过毛色、或已经用多视角照片校准过，就别再让单张头像覆盖回去
  if (!cat.avatar || readCoatOverrides()[cat.id] || cat.coatProfile) return;
  const image = new Image();
  image.onload = () => {
    try {
      const info = analyzePhoto(image);
      info.thumb = cat.avatar;
      rig.applyCoat(coatFrom(info, cat.avatar));
    } catch (_) { /* 分析失败则保留品种推断的毛色 */ }
  };
  image.onerror = () => {};
  image.src = cat.avatar;
}

/* ------------------------------------------------------------------ *
 * 3. 材质 + 绒毛
 * ------------------------------------------------------------------ */

// 眼睛贴图：外圈直接画成毛色，内圈才是杏仁形眼裂。
// 这样眼球圆盘的硬边会被毛色吃掉，看上去像嵌在脸里，而不是贴了一颗玻璃珠。
function makeEyeTexture(eyeColor, furColor) {
  const S = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d');
  const c = S / 2;
  const fur = furColor || { r: 186, g: 150, b: 116 };

  // 整块画布保持透明：眼白/眼周不再铺一张方形毛色底，
  // 否则贴片的圆形轮廓会在脸上留一条浅色「眼罩」横带
  ctx.clearRect(0, 0, S, S);

  // 眼裂：圆润的杏仁形，外眼角比内眼角高一点。
  // 关键是虹膜半径必须【大于】眼裂半宽 —— 否则虹膜外圈那道深褐色边缘
  // 正好落在眼裂两端，整只眼睛看上去就是「两端发黑、中间一小块黄」
  const w = S * 0.40;
  const h = S * 0.315;
  const inner = c - w;
  const outer = c + w;
  const innerY = c + S * 0.020;
  const outerY = c - S * 0.014;
  const upper = new Path2D();
  upper.moveTo(inner, innerY);
  upper.bezierCurveTo(c - w * 0.58, c - h * 1.40, c + w * 0.34, c - h * 1.48, outer, outerY);
  const lower = new Path2D();
  lower.moveTo(outer, outerY);
  lower.bezierCurveTo(c + w * 0.50, c + h * 1.06, c - w * 0.46, c + h * 1.12, inner, innerY);
  const almond = new Path2D();
  almond.addPath(upper);
  almond.addPath(lower);
  almond.closePath();

  ctx.save();
  ctx.clip(almond);

  // 猫几乎没有眼白，眼裂里先铺一层深褐底，虹膜盖不到的角落也不会是死黑
  ctx.fillStyle = '#2a2320';
  ctx.fillRect(0, 0, S, S);

  // 虹膜要盖满整个眼裂：头像尺寸下留一圈深色底，就会变成两个黑洞
  const irisR = S * 0.545;
  const cy = c - S * 0.010;
  const bright = mixColor(eyeColor, { r: 255, g: 208, b: 112 }, 0.7);
  const iris = ctx.createRadialGradient(c, cy, irisR * 0.1, c, cy, irisR);
  iris.addColorStop(0, cssColor(mixColor(bright, { r: 255, g: 255, b: 242 }, 0.34)));
  iris.addColorStop(0.40, cssColor(bright));
  iris.addColorStop(0.82, cssColor(shade(eyeColor, 0.86)));
  iris.addColorStop(0.96, cssColor(shade(eyeColor, 0.62)));
  iris.addColorStop(1, 'rgba(56,42,30,0.5)');
  ctx.beginPath();
  ctx.arc(c, cy, irisR, 0, Math.PI * 2);
  ctx.fillStyle = iris;
  ctx.fill();

  // 放射状纤维
  ctx.save();
  ctx.beginPath();
  ctx.arc(c, cy, irisR * 0.98, 0, Math.PI * 2);
  ctx.clip();
  for (let i = 0; i < 150; i += 1) {
    const a = (i / 150) * Math.PI * 2 + Math.random() * 0.05;
    const r0 = irisR * (0.18 + Math.random() * 0.16);
    const r1 = irisR * (0.7 + Math.random() * 0.3);
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    ctx.lineTo(c + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.strokeStyle = Math.random() > 0.46 ? 'rgba(255,248,226,0.2)' : 'rgba(16,12,9,0.22)';
    ctx.lineWidth = 0.7 + Math.random() * 1.6;
    ctx.stroke();
  }
  ctx.restore();

  // 竖瞳：中间近黑，边缘带一点蓝灰，才不是一块剪贴的黑
  const pw = S * 0.034;
  const ph = irisR * 0.90;
  const pupil = ctx.createRadialGradient(c, cy, 1, c, cy, ph);
  pupil.addColorStop(0, '#04060a');
  pupil.addColorStop(0.7, '#080e12');
  pupil.addColorStop(1, '#172226');
  ctx.beginPath();
  ctx.ellipse(c, cy, pw, ph, 0, 0, Math.PI * 2);
  ctx.fillStyle = pupil;
  ctx.fill();

  // 角膜高光：主光偏左上，副光在右下，一大一小才显得湿润
  const glow = ctx.createRadialGradient(c - S * 0.14, cy - S * 0.16, 0, c - S * 0.14, cy - S * 0.16, S * 0.11);
  glow.addColorStop(0, 'rgba(255,255,255,0.97)');
  glow.addColorStop(0.5, 'rgba(255,255,255,0.8)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.beginPath();
  ctx.ellipse(c - S * 0.14, cy - S * 0.16, S * 0.085, S * 0.065, -0.42, 0, Math.PI * 2);
  ctx.fillStyle = glow;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(c + S * 0.115, cy + S * 0.13, S * 0.032, S * 0.024, 0.4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fill();

  // 上眼睑压在眼球上的投影：眼睛有没有立体感，全靠这道暗部
  const lidShadow = ctx.createLinearGradient(0, c - h * 1.5, 0, c + h * 0.1);
  lidShadow.addColorStop(0, 'rgba(0,0,0,0.30)');
  lidShadow.addColorStop(0.55, 'rgba(0,0,0,0.08)');
  lidShadow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = lidShadow;
  ctx.fillRect(0, 0, S, c + h * 0.1);

  // 下眼睑内侧的一点反光（泪膜）
  const tear = ctx.createLinearGradient(0, c + h * 0.35, 0, c + h * 1.05);
  tear.addColorStop(0, 'rgba(255,244,226,0)');
  tear.addColorStop(0.75, 'rgba(255,244,226,0.16)');
  tear.addColorStop(1, 'rgba(255,244,226,0)');
  ctx.fillStyle = tear;
  ctx.fillRect(0, c + h * 0.3, S, h * 0.8);
  ctx.restore();

  // 眼裂外侧只留一圈很窄的毛色过渡（多次叠加描边模拟羽化），再往外直接透明，
  // 这样眼球贴片没有可见轮廓，边缘是「长进毛里」的
  ctx.save();
  const outside = new Path2D();
  outside.rect(0, 0, S, S);
  outside.addPath(almond);
  ctx.clip(outside, 'evenodd');
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 5; i >= 1; i -= 1) {
    ctx.strokeStyle = rgbOf(fur, 0.16);
    ctx.lineWidth = S * 0.026 * i;
    ctx.stroke(almond);
  }
  ctx.restore();

  // 眼睑线：上眼睑重、下眼睑轻
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(30,22,19,0.78)';
  ctx.lineWidth = S * 0.021;
  ctx.stroke(upper);
  ctx.strokeStyle = 'rgba(52,38,32,0.5)';
  ctx.lineWidth = S * 0.013;
  ctx.stroke(lower);

  // 眼角一点点湿光
  [[inner, innerY], [outer, outerY]].forEach(([x, y]) => {
    const dot = ctx.createRadialGradient(x, y, 0, x, y, S * 0.05);
    dot.addColorStop(0, 'rgba(255,240,220,0.28)');
    dot.addColorStop(1, 'rgba(255,240,220,0)');
    ctx.fillStyle = dot;
    ctx.beginPath();
    ctx.arc(x, y, S * 0.05, 0, Math.PI * 2);
    ctx.fill();
  });

  const texture = canvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

// 眼球：中心微微鼓起，边缘向后弯，正好贴住脸部的弧面，
// 既不会浮在脸前，也不会被脸颊吃掉
function makeEyeDisc(radius, curve = 0.3) {
  const geo = new THREE.CircleGeometry(radius, 48);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const d = Math.min(1, Math.hypot(x, y) / radius);
    pos.setZ(i, radius * (0.16 * Math.sqrt(Math.max(0, 1 - d * d)) - curve * d * d));
  }
  geo.computeVertexNormals();
  return geo;
}

let furBumpTexture = null;
function getFurBumpTexture() {
  if (furBumpTexture) return furBumpTexture;
  const S = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, S, S);
  ctx.lineCap = 'round';
  // 和颜色贴图一样按「簇」落笔：一撮 3–6 根、方向相近。
  // 均匀随机撒点在高光下会读成砂纸，成簇才有短绒的块面感
  let n = 0;
  while (n < 5200) {
    const cx = Math.random() * S;
    const cy = Math.random() * S;
    const tuftAngle = (Math.random() - 0.5) * 1.1;
    const tuft = 3 + Math.floor(Math.random() * 4);
    const bright = Math.random() < 0.5;
    for (let k = 0; k < tuft && n < 5200; k += 1, n += 1) {
      const x = cx + (Math.random() - 0.5) * 7;
      const y = cy + (Math.random() - 0.5) * 7;
      const len = 3 + Math.random() * 8;
      const a = tuftAngle + (Math.random() - 0.5) * 0.4;
      const v = bright ? 138 + Math.random() * 34 : 104 + Math.random() * 34;
      ctx.strokeStyle = `rgba(${v},${v},${v},0.55)`;
      ctx.lineWidth = 0.5 + Math.random() * 1.2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(
        x + Math.sin(a) * len * 0.45, y + Math.cos(a) * len * 0.45,
        x + Math.sin(a) * len, y + Math.cos(a) * len
      );
      ctx.stroke();
    }
  }
  furBumpTexture = canvasTexture(canvas, 4);
  furBumpTexture.colorSpace = THREE.NoColorSpace;
  furBumpTexture.userData.shared = true;
  return furBumpTexture;
}

let shadowTexture = null;
function getShadowTexture() {
  if (shadowTexture) return shadowTexture;
  const S = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, S * 0.06, S / 2, S / 2, S * 0.5);
  g.addColorStop(0, 'rgba(34,44,50,0.62)');
  g.addColorStop(0.45, 'rgba(34,44,50,0.3)');
  g.addColorStop(0.75, 'rgba(34,44,50,0.1)');
  g.addColorStop(1, 'rgba(34,44,50,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  shadowTexture = canvasTexture(canvas);
  shadowTexture.wrapS = THREE.ClampToEdgeWrapping;
  shadowTexture.wrapT = THREE.ClampToEdgeWrapping;
  shadowTexture.userData.shared = true;
  return shadowTexture;
}

function makeNoseGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.041, 0.018);
  shape.quadraticCurveTo(0, 0.045, 0.041, 0.018);
  shape.quadraticCurveTo(0.033, -0.021, 0, -0.042);
  shape.quadraticCurveTo(-0.033, -0.021, -0.041, 0.018);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.022, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008,
    bevelSegments: 3, curveSegments: 14
  });
  geo.translate(0, 0, -0.011);
  return geo;
}

function makeEarGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.135, 0);
  shape.quadraticCurveTo(-0.115, 0.17, 0, 0.305);
  shape.quadraticCurveTo(0.115, 0.17, 0.135, 0);
  shape.quadraticCurveTo(0, -0.038, -0.135, 0);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.028, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012,
    bevelSegments: 2, curveSegments: 14
  });
  geo.translate(0, 0, -0.014);
  return geo;
}

function makeMaterials(coat) {
  // sheen 是毛边那层绒光的来源，但给到 0.85 + 纯浅色时，细圆柱（四条腿、尾巴）
  // 整根都在掠射角上，绒光会盖掉底色 —— 灰猫的腿会渲染成四根奶油棒。
  // 降到 0.55，并把绒光色改成「主色混浅色」，轮廓上还亮，腿上不再泛白
  const fur = (map) => new THREE.MeshPhysicalMaterial({
    color: 0xffffff, map, roughness: 1, metalness: 0,
    sheen: 0.55, sheenRoughness: 0.92, sheenColor: coat.colors.sheen.clone(),
    bumpMap: getFurBumpTexture(), bumpScale: 0.009
  });
  return {
    coat: fur(coat.tex.coat),
    light: fur(coat.tex.light),
    limb: fur(coat.tex.limb),
    strand: new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 1, metalness: 0, side: THREE.DoubleSide,
      // vertexColors 读的是锥体自带的「根暗尖亮」渐变，instanceColor 再乘上毛色
      vertexColors: true,
      transparent: true, opacity: 0.55, depthWrite: false
    }),
    earInner: new THREE.MeshStandardMaterial({ color: coat.colors.earInner.clone(), roughness: 0.95, side: THREE.DoubleSide }),
    // 耳窝内侧的暗边：没有这一圈，粉色内耳就像贴在耳朵上的一块塑料片
    earRim: new THREE.MeshStandardMaterial({
      color: coat.colors.earRim.clone(), roughness: 1, side: THREE.DoubleSide
    }),
    eye: new THREE.MeshPhysicalMaterial({
      // 这里必须传 0-255 的调色板，不能传 THREE.Color（0-1）：
      // 传错的话 shade()/mixColor() 全按 0-1 算，虹膜外圈和眼周羽化都会变成黑色
      map: makeEyeTexture(coat.palette.eye, coat.palette.base),
      roughness: 0.16, metalness: 0,
      clearcoat: 1, clearcoatRoughness: 0.04,
      // 眼裂以外是透明的，眼球贴片才不会有圆形轮廓
      transparent: true, alphaTest: 0.04,
      emissive: coat.colors.eye.clone().multiplyScalar(0.025)
    }),
    cornea: new THREE.MeshPhysicalMaterial({
      color: 0xffffff, transparent: true, opacity: 0.16, roughness: 0.02,
      metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, depthWrite: false
    }),
    nostril: new THREE.MeshStandardMaterial({ color: 0x2a1e1c, roughness: 0.7 }),
    nose: new THREE.MeshStandardMaterial({ color: coat.colors.nose.clone(), roughness: 0.5 }),
    mouth: new THREE.MeshStandardMaterial({ color: 0x6b4a46, roughness: 0.85 }),
    whisker: new THREE.LineBasicMaterial({ color: 0xfdf8ee, transparent: true, opacity: 0.82 }),
    tongue: new THREE.MeshStandardMaterial({ color: 0xef8fa5, roughness: 0.6 })
  };
}

function strandColors(coat) {
  /* 毛丝要比底色「亮」而不是「深」。
   * 之前直接拿 base / shell 上色，在浅色背景上，轮廓那一圈全是黑色硬刺 ——
   * 真猫的毛在边缘是透光的，越靠外越亮。
   * 现在以「主色混浅色」为主，只留一成暗色做层次。 */
  const soft = toThree(mixColor(coat.palette.base, coat.palette.light, 0.44));
  const mid = toThree(mixColor(coat.palette.base, coat.palette.light, 0.26));
  const dark = toThree(shade(coat.palette.base, 0.9));
  return [
    soft,
    soft.clone().offsetHSL(0, 0, 0.035),
    mid,
    mid.clone().offsetHSL(0, 0, 0.02),
    dark
  ];
}

function recolorStrands(mesh, colors) {
  for (let i = 0; i < mesh.count; i += 1) mesh.setColorAt(i, colors[Math.floor(Math.random() * colors.length)]);
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

/* 毛丝的锥体只有 4 个侧面，整根同色的话，掠射光下就是一排小三角。
 * 给顶点色加一个「根暗 → 尖亮」的渐变：毛尖受光更多，远看才有透光的绒感。
 * 顶点色会和 InstancedMesh 的 instanceColor 相乘，所以这里只放明度系数。 */
let strandGeometry = null;
function getStrandGeometry() {
  if (strandGeometry) return strandGeometry;
  const geo = new THREE.ConeGeometry(1, 1, 4, 3, true);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i += 1) {
    const t = clamp(pos.getY(i) + 0.5, 0, 1);
    const v = 0.70 + t * 0.52;
    colors[i * 3] = v; colors[i * 3 + 1] = v; colors[i * 3 + 2] = v;
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  strandGeometry = geo;
  return strandGeometry;
}

function addFurStrands(parent, count, scaleVec, colors, options = {}) {
  const geometry = getStrandGeometry();
  const mesh = new THREE.InstancedMesh(geometry, options.material, count);
  const dummy = new THREE.Object3D();
  const normal = new THREE.Vector3();
  const corrected = new THREE.Vector3();
  const golden = Math.PI * (3 - Math.sqrt(5));
  const minLen = options.minLen || 0.018;
  const maxLen = options.maxLen || 0.034;
  let n = 0;
  const attempts = count * 4;
  for (let i = 0; i < attempts && n < count; i += 1) {
    const y = 1 - (i / attempts) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    normal.set(Math.cos(theta) * r, y, Math.sin(theta) * r);
    if (options.filter && options.filter(normal)) continue;
    corrected.set(normal.x / scaleVec[0], normal.y / scaleVec[1], normal.z / scaleVec[2]).normalize();
    const length = minLen + Math.random() * (maxLen - minLen);
    const thickness = 0.0022 + Math.random() * 0.0022;
    dummy.position.set(normal.x * scaleVec[0], normal.y * scaleVec[1], normal.z * scaleVec[2]);
    dummy.position.addScaledVector(corrected, length * 0.4);
    dummy.quaternion.setFromUnitVectors(UP, corrected);
    dummy.rotateY(Math.random() * Math.PI * 2);
    dummy.rotateX((Math.random() - 0.5) * 0.55);
    dummy.scale.set(thickness, length, thickness);
    dummy.updateMatrix();
    mesh.setMatrixAt(n, dummy.matrix);
    n += 1;
  }
  mesh.count = n;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  recolorStrands(mesh, colors);
  parent.add(mesh);
  return mesh;
}

/* 在网格顶点上直接「种毛」。
 *
 * 走过两条弯路，都记在这里：
 *  1) 按椭球半径撒点（addFurStrands）：脸不是标准椭球，额头/腮鼓出去 1~2cm，
 *     毛根埋进网格里，只剩毛尖戳出来 —— 一脸小黑点。
 *  2) 从骨骼中心打射线求交：中心在实体内部，第一步就判「命中」，
 *     毛根全埋在头骨里 5cm，一根都看不见；而且密度按立体角分布，
 *     头顶密、脖子稀，会形成一条「发带」。
 * 正确做法：直接用蒙皮网格自己的顶点和法线。密度均匀、法线准确，
 * 每根毛挂到权重最大的那根骨头上，跟着动画一起动。 */
function addMeshStrands(mesh, bones, count, colors, options = {}) {
  const geo = mesh.geometry;
  const posAttr = geo.attributes.position;
  const nrmAttr = geo.attributes.normal;
  const skinIndex = geo.attributes.skinIndex;
  const skinWeight = geo.attributes.skinWeight;
  if (!posAttr || !nrmAttr || !skinIndex || !skinWeight) return [];
  const total = posAttr.count;
  const step = Math.max(1, Math.floor(total / Math.max(1, count)));
  const buckets = new Map();
  const p = new THREE.Vector3();
  const nv = new THREE.Vector3();
  for (let i = 0; i < total; i += step) {
    // 打散采样相位，否则毛会按顶点顺序排成一行行
    if (Math.random() < 0.3) continue;
    nv.set(nrmAttr.getX(i), nrmAttr.getY(i), nrmAttr.getZ(i));
    if (nv.lengthSq() < 1e-8) continue;
    nv.normalize();
    p.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
    if (options.filter && !options.filter(nv, p.x, p.y, p.z)) continue;
    let boneIdx = 0;
    let bestW = -1;
    const weights = [skinWeight.getX(i), skinWeight.getY(i), skinWeight.getZ(i), skinWeight.getW(i)];
    const idx = [skinIndex.getX(i), skinIndex.getY(i), skinIndex.getZ(i), skinIndex.getW(i)];
    for (let k = 0; k < 4; k += 1) {
      if (weights[k] > bestW) { bestW = weights[k]; boneIdx = idx[k]; }
    }
    if (!buckets.has(boneIdx)) buckets.set(boneIdx, []);
    buckets.get(boneIdx).push([p.x, p.y, p.z, nv.x, nv.y, nv.z]);
  }
  const minLen = options.minLen || 0.012;
  const maxLen = options.maxLen || 0.028;
  const minThick = options.minThick || 0.0020;
  const maxThick = options.maxThick || 0.0038;
  const dummy = new THREE.Object3D();
  const local = new THREE.Vector3();
  const localNormal = new THREE.Vector3();
  const out = [];
  buckets.forEach((list, boneIdx) => {
    const bone = bones[boneIdx];
    if (!bone || !list.length) return;
    bone.updateWorldMatrix(true, false);
    const toLocal = new THREE.Matrix4().copy(bone.matrixWorld).invert();
    const rotLocal = new THREE.Quaternion().setFromRotationMatrix(toLocal);
    const inst = new THREE.InstancedMesh(getStrandGeometry(), options.material, list.length);
    list.forEach(([x, y, z, nx, ny, nz], k) => {
      const length = minLen + Math.random() * (maxLen - minLen);
      const thickness = minThick + Math.random() * (maxThick - minThick);
      local.set(x, y, z).applyMatrix4(toLocal);
      localNormal.set(nx, ny, nz).applyQuaternion(rotLocal);
      dummy.position.copy(local).addScaledVector(localNormal, length * 0.35);
      dummy.quaternion.setFromUnitVectors(UP, localNormal);
      dummy.rotateY(Math.random() * Math.PI * 2);
      dummy.rotateX((Math.random() - 0.5) * 0.55);
      dummy.scale.set(thickness, length, thickness);
      dummy.updateMatrix();
      inst.setMatrixAt(k, dummy.matrix);
    });
    inst.count = list.length;
    inst.instanceMatrix.needsUpdate = true;
    inst.frustumCulled = false;
    recolorStrands(inst, colors);
    bone.add(inst);
    out.push(inst);
  });
  return out;
}

function sphere(parent, material, radius, position, scale, name, segments = 24) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, segments, Math.max(10, Math.round(segments * 0.7))), material);
  if (position) mesh.position.set(position[0], position[1], position[2]);
  if (scale) mesh.scale.set(scale[0], scale[1], scale[2]);
  if (name) mesh.name = name;
  parent.add(mesh);
  return mesh;
}

function addLights(scene) {
  // 暖主光 + 冷补光 + 背后轮廓光：毛发的层次主要靠轮廓光打出来
  scene.add(new THREE.HemisphereLight(0xfff6ea, 0xb09a80, 0.62));
  const key = new THREE.DirectionalLight(0xfff1de, 1.45);
  key.position.set(2.2, 3.4, 3.2); scene.add(key);
  const fill = new THREE.DirectionalLight(0xd6e8ff, 0.5);
  fill.position.set(-3, 1.2, 2.0); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffd2a8, 1.0);
  rim.position.set(-0.8, 2.6, -3); scene.add(rim);
  const bounce = new THREE.PointLight(0xfff0e0, 0.22, 8);
  bounce.position.set(0, 0.35, 2.0); scene.add(bounce);
  const top = new THREE.DirectionalLight(0xffffff, 0.26);
  top.position.set(0, 5, 0.4); scene.add(top);
}

/* ------------------------------------------------------------------ *
 * 3.5 连续曲面造型：SDF + Marching Tetrahedra
 *
 * 为什么不用一堆球拼：两个球相交会在交线处形成一圈凹槽，
 * 头/颈/肩/胯/尾根全是这种折痕，远看就是「一节一节」。
 * 这里把整只猫定义成一个带平滑并集的距离场，再提取成一张网格，
 * 关节处是真正的圆角过渡，从头到尾没有接缝。
 * ------------------------------------------------------------------ */

function smin(a, b, k) {
  const h = Math.max(0, Math.min(1, 0.5 + (0.5 * (b - a)) / k));
  return b + (a - b) * h - k * h * (1 - h);
}
function smax(a, b, k) { return -smin(-a, -b, k); }

// 椭球：零等值面精确，距离是近似值（用于平滑并集足够）
function sdEll(x, y, z, cx, cy, cz, rx, ry, rz) {
  const px = (x - cx) / rx;
  const py = (y - cy) / ry;
  const pz = (z - cz) / rz;
  const k0 = Math.sqrt(px * px + py * py + pz * pz);
  return (k0 - 1) * Math.min(rx, ry, rz);
}

function sdCap(x, y, z, ax, ay, az, bx, by, bz, r) {
  const pax = x - ax, pay = y - ay, paz = z - az;
  const bax = bx - ax, bay = by - ay, baz = bz - az;
  const len2 = bax * bax + bay * bay + baz * baz || 1e-6;
  let h = (pax * bax + pay * bay + paz * baz) / len2;
  h = h < 0 ? 0 : (h > 1 ? 1 : h);
  const dx = pax - bax * h, dy = pay - bay * h, dz = paz - baz * h;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - r;
}

// 锥形胶囊：半径沿轴线性变化，用来做耳朵和尾巴
function sdTaper(x, y, z, ax, ay, az, bx, by, bz, ra, rb) {
  const pax = x - ax, pay = y - ay, paz = z - az;
  const bax = bx - ax, bay = by - ay, baz = bz - az;
  const len2 = bax * bax + bay * bay + baz * baz || 1e-6;
  let h = (pax * bax + pay * bay + paz * baz) / len2;
  h = h < 0 ? 0 : (h > 1 ? 1 : h);
  const dx = pax - bax * h, dy = pay - bay * h, dz = paz - baz * h;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - (ra + (rb - ra) * h);
}

/* 尾巴不能用「几段胶囊 + 大半径 smin」拼：smin 在 h=0.5 处会把表面向外推 k/4，
 * k=0.065 时每个接头都鼓出一圈 1.2cm 的包 —— 这就是那几道横纹的来源。
 * 改成沿 Catmull-Rom 样条均匀取 48 段、半径线性插值的折线距离场：
 * 段与段之间半径完全连续，取 min 就够了，不需要 smin，管子是真正光滑的。 */
/* 尾巴改成「自然上扬的弯钩尾」：从臀部后方根部长出，先向后下、再向后上抬起，
 * 最后在背上方卷成问号。正面看会从背上方探出、侧面看是一条完整的曲线、
 * 背面看正中对着自己 —— 三个视角都能看到，不会再被身体挡住。 */
const TAIL_POINTS = [
  [0, 0.52, -0.46], [0, 0.46, -0.70], [0, 0.58, -0.86],
  [0, 0.86, -0.84], [0, 1.02, -0.62], [0, 1.00, -0.42]
];
const TAIL_RADII = [0.090, 0.084, 0.079, 0.072, 0.060, 0.046];

const TAIL_SAMPLES = (() => {
  const cr = (p0, p1, p2, p3, t) => {
    const t2 = t * t, t3 = t2 * t;
    return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
  };
  const out = [];
  const N = 8;
  for (let i = 0; i < TAIL_POINTS.length - 1; i += 1) {
    const p0 = TAIL_POINTS[Math.max(0, i - 1)];
    const p1 = TAIL_POINTS[i];
    const p2 = TAIL_POINTS[i + 1];
    const p3 = TAIL_POINTS[Math.min(TAIL_POINTS.length - 1, i + 2)];
    const r1 = TAIL_RADII[i];
    const r2 = TAIL_RADII[i + 1];
    for (let k = 0; k < N; k += 1) {
      const t = k / N;
      out.push([
        cr(p0[0], p1[0], p2[0], p3[0], t),
        cr(p0[1], p1[1], p2[1], p3[1], t),
        cr(p0[2], p1[2], p2[2], p3[2], t),
        r1 + (r2 - r1) * t
      ]);
    }
  }
  const last = TAIL_POINTS[TAIL_POINTS.length - 1];
  out.push([last[0], last[1], last[2], TAIL_RADII[TAIL_RADII.length - 1]]);
  return out;
})();

function sdTail(x, y, z) {
  // 先用一个宽松椭球做包围体：离得远就整段跳过，否则每个体素都要算 48 段，太慢
  const bound = sdEll(x, y, z, 0, 0.74, -0.64, 0.42, 0.40, 0.40);
  if (bound > 0.05) return bound;
  let d = 1e9;
  for (let i = 0; i < TAIL_SAMPLES.length - 1; i += 1) {
    const a = TAIL_SAMPLES[i];
    const b = TAIL_SAMPLES[i + 1];
    const seg = sdTaper(x, y, z, a[0], a[1], a[2], b[0], b[1], b[2], a[3], b[3]);
    if (seg < d) d = seg;
  }
  return d;
}

const CAT_BOUNDS = { min: [-0.62, -0.05, -0.94], max: [0.62, 1.58, 0.72] };

// 头在根空间的原点（与骨骼 head 的世界位置一致）
const HEAD_ORIGIN = [0, 0.98, 0.30];

/* 整只猫的距离场。所有坐标都是 rig 根空间，猫面朝 +z。 */
function catField(x, y, z) {
  // —— 躯干：一个椭球主体 + 胸腹 + 后胯，全部平滑并集
  let d = sdEll(x, y, z, 0, 0.62, -0.06, 0.445, 0.36, 0.525);
  d = smin(d, sdEll(x, y, z, 0, 0.57, 0.26, 0.27, 0.30, 0.20), 0.14);
  d = smin(d, sdEll(x, y, z, 0, 0.74, 0.25, 0.19, 0.16, 0.13), 0.12);
  d = smin(d, sdEll(x, y, z, -0.27, 0.49, -0.28, 0.22, 0.20, 0.24), 0.13);
  d = smin(d, sdEll(x, y, z, 0.27, 0.49, -0.28, 0.22, 0.20, 0.24), 0.13);

  // —— 颈：大半径过渡块，头与身体之间不再有折痕
  d = smin(d, sdEll(x, y, z, 0, 0.85, 0.24, 0.225, 0.205, 0.215), 0.15);

  // —— 头骨 + 口鼻 + 腮 + 眉骨
  // 比例按真猫的脸：下巴到颅顶算 1，眼睛在中线略上（约 0.55），
  // 鼻头在眼下 0.22 处，嘴再下 0.07 —— 之前眼和鼻挤在一起，脸被压成了扁饼
  // 英短的头是「宽、圆、扁」：横向比纵向略宽一点，额头平，
  // 腮骨要往外撑，但和颅骨的融合半径必须大，否则脸侧会鼓出两块「瘤」
  d = smin(d, sdEll(x, y, z, 0, 0.982, 0.30, 0.338, 0.296, 0.292), 0.13);
  d = smin(d, sdEll(x, y, z, 0, 0.874, 0.548, 0.152, 0.098, 0.100), 0.09);
  d = smin(d, sdEll(x, y, z, -0.218, 0.878, 0.338, 0.168, 0.148, 0.158), 0.14);
  d = smin(d, sdEll(x, y, z, 0.218, 0.878, 0.338, 0.168, 0.148, 0.158), 0.14);
  d = smin(d, sdEll(x, y, z, -0.152, 1.068, 0.436, 0.118, 0.070, 0.080), 0.11);
  d = smin(d, sdEll(x, y, z, 0.152, 1.068, 0.436, 0.118, 0.070, 0.080), 0.11);

  // —— 耳朵：z 向压扁的锥形胶囊，耳根平滑长进颅顶
  // 英短是短而圆的耳，耳尖不能收成针：末端半径留 0.05
  const ez = 0.24 + (z - 0.24) * 2.0;
  d = smin(d, sdTaper(x, y, ez, -0.170, 1.140, 0.235, -0.246, 1.404, 0.196, 0.142, 0.066), 0.055);
  d = smin(d, sdTaper(x, y, ez, 0.170, 1.140, 0.235, 0.246, 1.404, 0.196, 0.142, 0.066), 0.055);

  // —— 四肢：胶囊从体内深处长出来，肩胯处是圆角不是折痕
  d = smin(d, sdCap(x, y, z, -0.215, 0.34, 0.29, -0.215, 0.135, 0.322, 0.088), 0.09);
  d = smin(d, sdCap(x, y, z, 0.215, 0.34, 0.29, 0.215, 0.135, 0.322, 0.088), 0.09);
  d = smin(d, sdCap(x, y, z, -0.245, 0.36, -0.25, -0.245, 0.13, -0.195, 0.098), 0.09);
  d = smin(d, sdCap(x, y, z, 0.245, 0.36, -0.25, 0.245, 0.13, -0.195, 0.098), 0.09);
  d = smin(d, sdEll(x, y, z, -0.215, 0.072, 0.335, 0.096, 0.072, 0.115), 0.06);
  d = smin(d, sdEll(x, y, z, 0.215, 0.072, 0.335, 0.096, 0.072, 0.115), 0.06);
  d = smin(d, sdEll(x, y, z, -0.245, 0.072, -0.185, 0.10, 0.072, 0.115), 0.06);
  d = smin(d, sdEll(x, y, z, 0.245, 0.072, -0.185, 0.10, 0.072, 0.115), 0.06);

  // —— 尾巴：从臀部绕到左前方、贴地收在爪边（真猫坐着就是这个姿势）。
  // 之前做成竖直向上的一条：从正面看整条都被脑袋挡住，
  // 稍微往外掰一点又会从耳朵后面冒出来像只角。绕到侧面才看得见、也不像犄角
  // 尾巴：一条连续折线距离场，根部和身体之间才需要 smin 过渡
  d = smin(d, sdTail(x, y, z), 0.10);

  // —— 眼窝：从正面轻轻挖两个浅坑，眼球才有地方嵌
  d = smax(d, -sdEll(x, y, z, -0.146, 1.036, 0.706, 0.106, 0.092, 0.062), 0.05);
  d = smax(d, -sdEll(x, y, z, 0.146, 1.036, 0.706, 0.106, 0.092, 0.062), 0.05);

  return d;
}

/* 每个造型块属于哪根骨头：用来算蒙皮权重 */
const CAT_PRIMITIVES = [
  ['body', (x, y, z) => sdEll(x, y, z, 0, 0.62, -0.06, 0.445, 0.36, 0.525)],
  ['body', (x, y, z) => sdEll(x, y, z, 0, 0.57, 0.26, 0.27, 0.30, 0.20)],
  ['body', (x, y, z) => sdEll(x, y, z, 0, 0.74, 0.25, 0.19, 0.16, 0.13)],
  ['body', (x, y, z) => sdEll(x, y, z, -0.27, 0.49, -0.28, 0.22, 0.20, 0.24)],
  ['body', (x, y, z) => sdEll(x, y, z, 0.27, 0.49, -0.28, 0.22, 0.20, 0.24)],
  ['body', (x, y, z) => sdEll(x, y, z, 0, 0.85, 0.24, 0.225, 0.205, 0.215)],
  ['head', (x, y, z) => sdEll(x, y, z, 0, 0.982, 0.30, 0.338, 0.296, 0.292)],
  ['head', (x, y, z) => sdEll(x, y, z, 0, 0.874, 0.548, 0.152, 0.098, 0.100)],
  ['head', (x, y, z) => sdEll(x, y, z, -0.218, 0.878, 0.338, 0.168, 0.148, 0.158)],
  ['head', (x, y, z) => sdEll(x, y, z, 0.218, 0.878, 0.338, 0.168, 0.148, 0.158)],
  ['head', (x, y, z) => sdEll(x, y, z, -0.152, 1.068, 0.436, 0.118, 0.070, 0.080)],
  ['head', (x, y, z) => sdEll(x, y, z, 0.152, 1.068, 0.436, 0.118, 0.070, 0.080)],
  ['earL', (x, y, z) => sdTaper(x, y, 0.24 + (z - 0.24) * 2.0, -0.170, 1.140, 0.235, -0.246, 1.404, 0.196, 0.142, 0.066)],
  ['earR', (x, y, z) => sdTaper(x, y, 0.24 + (z - 0.24) * 2.0, 0.170, 1.140, 0.235, 0.246, 1.404, 0.196, 0.142, 0.066)],
  ['legFL', (x, y, z) => sdCap(x, y, z, -0.215, 0.34, 0.29, -0.215, 0.135, 0.322, 0.088)],
  ['legFR', (x, y, z) => sdCap(x, y, z, 0.215, 0.34, 0.29, 0.215, 0.135, 0.322, 0.088)],
  ['legBL', (x, y, z) => sdCap(x, y, z, -0.245, 0.36, -0.25, -0.245, 0.13, -0.195, 0.098)],
  ['legBR', (x, y, z) => sdCap(x, y, z, 0.245, 0.36, -0.25, 0.245, 0.13, -0.195, 0.098)],
  ['legFL', (x, y, z) => sdEll(x, y, z, -0.215, 0.072, 0.335, 0.096, 0.072, 0.115)],
  ['legFR', (x, y, z) => sdEll(x, y, z, 0.215, 0.072, 0.335, 0.096, 0.072, 0.115)],
  ['legBL', (x, y, z) => sdEll(x, y, z, -0.245, 0.072, -0.185, 0.10, 0.072, 0.115)],
  ['legBR', (x, y, z) => sdEll(x, y, z, 0.245, 0.072, -0.185, 0.10, 0.072, 0.115)],
  ['tail0', (x, y, z) => sdTaper(x, y, z, 0, 0.52, -0.46, 0, 0.46, -0.70, 0.090, 0.084)],
  ['tail1', (x, y, z) => sdTaper(x, y, z, 0, 0.46, -0.70, 0, 0.58, -0.86, 0.084, 0.079)],
  ['tail2', (x, y, z) => sdTaper(x, y, z, 0, 0.58, -0.86, 0, 0.86, -0.84, 0.079, 0.072)],
  ['tail3', (x, y, z) => sdTaper(x, y, z, 0, 0.86, -0.84, 0, 1.02, -0.62, 0.072, 0.060)],
  ['tail3', (x, y, z) => sdTaper(x, y, z, 0, 1.02, -0.62, 0, 1.00, -0.42, 0.060, 0.046)]
];

/* Surface Nets：每个穿过等值面的体素只生成一个顶点（取所有交点的平均），
 * 再沿网格边把相邻 4 个体素的顶点连成四边形。
 * 相比 Marching Cubes/Tetra，三角形数量只有 1/3~1/6，顶点天然共用，
 * 而且因为顶点是「平均」出来的，曲面更顺，圆角处不会出现折面。 */
function polygonizeCat(cell) {
  const [x0, y0, z0] = CAT_BOUNDS.min;
  const [x1, y1, z1] = CAT_BOUNDS.max;
  const nx = Math.ceil((x1 - x0) / cell);
  const ny = Math.ceil((y1 - y0) / cell);
  const nz = Math.ceil((z1 - z0) / cell);
  const sx = (x1 - x0) / nx;
  const sy = (y1 - y0) / ny;
  const sz = (z1 - z0) / nz;

  const gx = nx + 1;
  const gy = ny + 1;
  const at = (i, j, k) => (k * gy + j) * gx + i;
  const field = new Float32Array(gx * gy * (nz + 1));
  for (let k = 0; k <= nz; k += 1) {
    const z = z0 + k * sz;
    for (let j = 0; j <= ny; j += 1) {
      const y = y0 + j * sy;
      for (let i = 0; i <= nx; i += 1) {
        field[at(i, j, k)] = catField(x0 + i * sx, y, z);
      }
    }
  }

  const CORNER = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];
  const EDGE = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];

  const positions = [];
  const indices = [];
  const cellVert = new Int32Array(nx * ny * nz).fill(-1);
  const cellIndex = (i, j, k) => (k * ny + j) * nx + i;

  // 第一遍：每个跨面的体素放一个顶点
  for (let k = 0; k < nz; k += 1) {
    for (let j = 0; j < ny; j += 1) {
      for (let i = 0; i < nx; i += 1) {
        const v = new Float64Array(8);
        let neg = 0;
        for (let c = 0; c < 8; c += 1) {
          const o = CORNER[c];
          v[c] = field[at(i + o[0], j + o[1], k + o[2])];
          if (v[c] < 0) neg += 1;
        }
        if (neg === 0 || neg === 8) continue;
        let ax = 0, ay = 0, az = 0, n = 0;
        for (let e = 0; e < 12; e += 1) {
          const a = EDGE[e][0];
          const b = EDGE[e][1];
          if ((v[a] < 0) === (v[b] < 0)) continue;
          const t = v[a] / (v[a] - v[b]);
          const oa = CORNER[a];
          const ob = CORNER[b];
          ax += oa[0] + (ob[0] - oa[0]) * t;
          ay += oa[1] + (ob[1] - oa[1]) * t;
          az += oa[2] + (ob[2] - oa[2]) * t;
          n += 1;
        }
        if (!n) continue;
        positions.push(
          x0 + (i + ax / n) * sx,
          y0 + (j + ay / n) * sy,
          z0 + (k + az / n) * sz
        );
        cellVert[cellIndex(i, j, k)] = positions.length / 3 - 1;
      }
    }
  }

  // 第二遍：每条跨面的网格边，把周围 4 个体素的顶点连成四边形
  const emit = (a, b, c, d) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    const p = positions;
    const cx = (p[a * 3] + p[b * 3] + p[c * 3] + p[d * 3]) / 4;
    const cy = (p[a * 3 + 1] + p[b * 3 + 1] + p[c * 3 + 1] + p[d * 3 + 1]) / 4;
    const cz = (p[a * 3 + 2] + p[b * 3 + 2] + p[c * 3 + 2] + p[d * 3 + 2]) / 4;
    const e = 0.004;
    const nxv = catField(cx + e, cy, cz) - catField(cx - e, cy, cz);
    const nyv = catField(cx, cy + e, cz) - catField(cx, cy - e, cz);
    const nzv = catField(cx, cy, cz + e) - catField(cx, cy, cz - e);
    const e1x = p[b * 3] - p[a * 3], e1y = p[b * 3 + 1] - p[a * 3 + 1], e1z = p[b * 3 + 2] - p[a * 3 + 2];
    const e2x = p[c * 3] - p[a * 3], e2y = p[c * 3 + 1] - p[a * 3 + 1], e2z = p[c * 3 + 2] - p[a * 3 + 2];
    const fx = e1y * e2z - e1z * e2y;
    const fy = e1z * e2x - e1x * e2z;
    const fz = e1x * e2y - e1y * e2x;
    if (fx * nxv + fy * nyv + fz * nzv >= 0) {
      indices.push(a, b, c, a, c, d);
    } else {
      indices.push(a, c, b, a, d, c);
    }
  };

  for (let k = 1; k < nz; k += 1) {
    for (let j = 1; j < ny; j += 1) {
      for (let i = 1; i < nx; i += 1) {
        // x 方向边
        if ((field[at(i, j, k)] < 0) !== (field[at(i + 1, j, k)] < 0)) {
          emit(
            cellVert[cellIndex(i, j - 1, k - 1)],
            cellVert[cellIndex(i, j, k - 1)],
            cellVert[cellIndex(i, j, k)],
            cellVert[cellIndex(i, j - 1, k)]
          );
        }
        // y 方向边
        if ((field[at(i, j, k)] < 0) !== (field[at(i, j + 1, k)] < 0)) {
          emit(
            cellVert[cellIndex(i - 1, j, k - 1)],
            cellVert[cellIndex(i - 1, j, k)],
            cellVert[cellIndex(i, j, k)],
            cellVert[cellIndex(i, j, k - 1)]
          );
        }
        // z 方向边
        if ((field[at(i, j, k)] < 0) !== (field[at(i, j, k + 1)] < 0)) {
          emit(
            cellVert[cellIndex(i - 1, j - 1, k)],
            cellVert[cellIndex(i, j - 1, k)],
            cellVert[cellIndex(i, j, k)],
            cellVert[cellIndex(i - 1, j, k)]
          );
        }
      }
    }
  }

  return { positions, indices };
}

/* Taubin 平滑（λ/μ 交替）：Surface Nets 的顶点落在体素边上，
 * 0.018 的格子在脸这么大一块上只有 30 多格，轮廓会看出一个个小台阶，
 * 侧脸尤其明显（「脸部线条崎岖」）。Taubin 和普通拉普拉斯不同，
 * 交替一步负收缩，所以不会把整只猫越磨越小。 */
function taubinSmooth(positions, indices, iterations = 3, lambda = 0.52, mu = -0.55) {
  const n = positions.length / 3;
  const neighbours = new Array(n);
  for (let i = 0; i < n; i += 1) neighbours[i] = [];
  const seen = new Set();
  for (let t = 0; t + 2 < indices.length; t += 3) {
    const tri = [indices[t], indices[t + 1], indices[t + 2]];
    for (let e = 0; e < 3; e += 1) {
      const p = tri[e];
      const q = tri[(e + 1) % 3];
      const key = p < q ? p * n + q : q * n + p;
      if (seen.has(key)) continue;
      seen.add(key);
      neighbours[p].push(q);
      neighbours[q].push(p);
    }
  }
  let src = Float32Array.from(positions);
  let dst = new Float32Array(src.length);
  const step = (factor) => {
    for (let i = 0; i < n; i += 1) {
      const nb = neighbours[i];
      const o = i * 3;
      if (!nb.length) {
        dst[o] = src[o]; dst[o + 1] = src[o + 1]; dst[o + 2] = src[o + 2];
        continue;
      }
      let ax = 0, ay = 0, az = 0;
      for (let k = 0; k < nb.length; k += 1) {
        const j = nb[k] * 3;
        ax += src[j]; ay += src[j + 1]; az += src[j + 2];
      }
      const m = nb.length;
      dst[o] = src[o] + factor * (ax / m - src[o]);
      dst[o + 1] = src[o + 1] + factor * (ay / m - src[o + 1]);
      dst[o + 2] = src[o + 2] + factor * (az / m - src[o + 2]);
    }
    const swap = src; src = dst; dst = swap;
  };
  for (let i = 0; i < iterations; i += 1) { step(lambda); step(mu); }
  return src;
}


/* ------------------------------------------------------------------ *
 * 4. 3D 猫咪骨架
 * ------------------------------------------------------------------ */

function buildCatRig(cat, options = {}) {
  // 曲面采样精度与毛丝密度可由调用方指定；主站不传 options 时保持原有画质
  const cell = Number(options.cell) > 0 ? Number(options.cell) : 0.018;
  const strands = Number(options.strands) > 0 ? Math.round(Number(options.strands)) : 5200;
  const override = presetCoat(readCoatOverrides()[cat.id]);
  const initial = coatFrom(override || breedPreset(cat), cat.avatar || '');
  let coat = initial;
  const materials = makeMaterials(coat);
  const root = new THREE.Group();
  const parts = { root, materials, pupils: [], ears: [], strandMeshes: [] };

  /* —— 用距离场生成一整张连续的猫身网格（无接缝） —— */
  const built = polygonizeCat(cell);
  const smoothed = taubinSmooth(built.positions, built.indices, 3);
  const geo = new THREE.BufferGeometry();
  const posArr = new Float32Array(smoothed);
  geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));

  // 法线直接取距离场梯度：比按面平均平滑得多，圆角处不会出现棱
  const nrmArr = new Float32Array(posArr.length);
  for (let i = 0; i < posArr.length; i += 3) {
    const x = posArr[i], y = posArr[i + 1], z = posArr[i + 2];
    const e = 0.0035;
    const nx = catField(x + e, y, z) - catField(x - e, y, z);
    const ny = catField(x, y + e, z) - catField(x, y - e, z);
    const nz = catField(x, y, z + e) - catField(x, y, z - e);
    const l = Math.hypot(nx, ny, nz) || 1;
    nrmArr[i] = nx / l; nrmArr[i + 1] = ny / l; nrmArr[i + 2] = nz / l;
  }
  geo.setAttribute('normal', new THREE.BufferAttribute(nrmArr, 3));

  // 圆柱投影 UV：u 绕身体一圈（正前方 = 0.5），v 是高度
  const yMin = CAT_BOUNDS.min[1];
  const yMax = CAT_BOUNDS.max[1];
  const uvArr = new Float32Array((posArr.length / 3) * 2);
  for (let i = 0, j = 0; i < posArr.length; i += 3, j += 2) {
    uvArr[j] = Math.atan2(posArr[i], posArr[i + 2]) / (Math.PI * 2) + 0.5;
    uvArr[j + 1] = (posArr[i + 1] - yMin) / (yMax - yMin);
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2));
  geo.setIndex(built.indices);

  /* —— 骨骼：和原来的 Group 层级一一对应，动画代码不用改 —— */
  const BONE_DEFS = [
    ['body', null, 0, BODY_HOME_Y, 0],
    ['head', 'body', 0, 0.36, 0.30],
    ['earL', 'head', -0.175, 0.18, -0.06],
    ['earR', 'head', 0.175, 0.18, -0.06],
    ['legFL', 'body', -0.225, -0.22, 0.29],
    ['legFR', 'body', 0.225, -0.22, 0.29],
    ['legBL', 'body', -0.25, -0.20, -0.25],
    ['legBR', 'body', 0.25, -0.20, -0.25],
    ['tail0', 'body', 0, -0.10, -0.46],
    ['tail1', 'tail0', 0, -0.06, -0.24],
    ['tail2', 'tail1', 0, 0.12, -0.16],
    ['tail3', 'tail2', 0, 0.28, 0.02]
  ];
  const boneMap = {};
  const boneList = [];
  BONE_DEFS.forEach(([name, parent, x, y, z]) => {
    const bone = new THREE.Bone();
    bone.name = name;
    bone.position.set(x, y, z);
    boneMap[name] = bone;
    if (parent) boneMap[parent].add(bone);
    boneList.push(bone);
  });

  /* —— 蒙皮权重：按每个造型块的「有向距离」分配，
     贴在哪个块表面就跟随哪根骨头，关节处两块距离接近自然过渡 —— */
  const boneIndex = {};
  boneList.forEach((bone, i) => { boneIndex[bone.name] = i; });
  const vertCount = posArr.length / 3;
  const skinIndex = new Uint16Array(vertCount * 4);
  const skinWeight = new Float32Array(vertCount * 4);
  const TAU = 0.075;
  const acc = new Float32Array(boneList.length);
  const order = [];
  for (let v = 0; v < vertCount; v += 1) {
    const x = posArr[v * 3], y = posArr[v * 3 + 1], z = posArr[v * 3 + 2];
    acc.fill(0);
    for (let p = 0; p < CAT_PRIMITIVES.length; p += 1) {
      const [bone, fn] = CAT_PRIMITIVES[p];
      acc[boneIndex[bone]] += Math.exp(-fn(x, y, z) / TAU);
    }
    order.length = 0;
    for (let b = 0; b < acc.length; b += 1) order.push([acc[b], b]);
    order.sort((a, b) => b[0] - a[0]);
    let sum = 0;
    for (let q = 0; q < 4; q += 1) sum += order[q][0];
    if (sum <= 1e-6) {
      skinIndex[v * 4] = boneIndex.body;
      skinWeight[v * 4] = 1;
      continue;
    }
    for (let q = 0; q < 4; q += 1) {
      skinIndex[v * 4 + q] = order[q][1];
      skinWeight[v * 4 + q] = order[q][0] / sum;
    }
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));

  const mesh = new THREE.SkinnedMesh(geo, materials.coat);
  mesh.frustumCulled = false;
  root.add(mesh);
  mesh.add(boneMap.body);
  root.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(boneList));

  const bodyRig = boneMap.body;
  const headRig = boneMap.head;
  parts.bodyRig = bodyRig;
  parts.headRig = headRig;
  parts.skinnedMesh = mesh;

  /* 全身绒毛：一次撒在整张网格上，按蒙皮权重分到各根骨头。
   * 过滤三处：
   *  1) 正脸（眼、鼻、口那一块 z>0.58、y 0.86~1.10）留空，否则短毛插进眼睛里
   *  2) 朝下的面（贴地）不铺，会插进地毯
   *  3) 前胸白斑上不铺 —— 白毛配灰毛丝会脏，胸口的绒感交给贴图 */
  const bodyStrands = addMeshStrands(mesh, boneList, strands, strandColors(coat), {
    material: materials.strand,
    minLen: 0.008, maxLen: 0.019,
    minThick: 0.0022, maxThick: 0.0044,
    filter: (n, x, y, z) => {
      // 贴地的脚掌不铺：毛会插进地毯，还会在垫子上留下一片「掉毛」
      // 0.17 以下全是白袜子（脚掌），灰毛丝扎在白毛上像一圈黑针，干脆不长
      if (y < 0.17 || n.y < -0.62) return false;
      if (z > 0.45 && y > 0.78 && y < 1.16 && Math.abs(x) < 0.28) return false;
      if (z > 0.30 && y > 0.20 && y < 0.46 && Math.abs(x) < 0.16) return false;
      return true;
    }
  });
  bodyStrands.forEach((item) => parts.strandMeshes.push(item));

  /* —— 五官：全部贴在距离场算出来的真实表面上 —— */
  const surfaceZ = (x, y) => {
    let lo = 1.2;
    let hi = 0.0;
    for (let i = 0; i < 26; i += 1) {
      const mid = (lo + hi) / 2;
      if (catField(x, y, mid) > 0) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  };
  const toHead = (x, y, z) => [x - HEAD_ORIGIN[0], y - HEAD_ORIGIN[1], z - HEAD_ORIGIN[2]];

  const face = new THREE.Group();
  headRig.add(face);
  parts.face = face;
  const features = new THREE.Group();
  face.add(features);
  parts.features = features;

  // 眼睛要大：真猫的眼裂宽度约占脸宽的 1/4，高度接近宽度的 0.75。
  // 之前 R=0.085 加一条很粗的睫毛线，远看只剩两道细缝
  const EYE_R = 0.104;
  function makeEye(side) {
    const ex = side * 0.146;
    const ey = 1.036;
    const [lx, ly, lz] = toHead(ex, ey, surfaceZ(ex, ey) + 0.003);
    const eye = new THREE.Group();
    eye.position.set(lx, ly, lz);
    // 偏航角不能大：贴片是弧面的，转 0.2rad 会把外侧压扁，
    // 瞳孔看起来就往鼻梁挤，正面看像斗鸡眼
    eye.rotation.y = -side * 0.035;
    features.add(eye);
    const disc = new THREE.Mesh(makeEyeDisc(EYE_R, 0.26), materials.eye);
    disc.scale.set(1, 0.96, 1);
    eye.add(disc);
    /* 角膜那层半球壳不要了：它是整个圆形贴片的 16% 白色高光，
     * 但眼球贴图在眼裂以外是透明的，于是这层壳就在脸上留下一个
     * 比眼睛大一圈的浅色椭圆 —— 远看像戴了一副护目镜。
     * 湿润感由贴图里的两处高光和 clearcoat 提供就够了 */
    return eye;
  }
  parts.eyeL = makeEye(-1);
  parts.eyeR = makeEye(1);

  // 鼻子：圆角三角形 + 鼻孔 + 人中。
  // 之前鼻头压到 y=0.888，正好落在口鼻的下缘，嘴被人中挡住只剩一条线；
  // 抬到 0.910 之后鼻子和嘴都落在口鼻正面，嘴才看得见
  const NOSE_Y = 0.910;
  const MOUTH_Y = 0.862;
  const noseAt = toHead(0, NOSE_Y, surfaceZ(0, NOSE_Y) - 0.004);
  const nose = new THREE.Mesh(makeNoseGeometry(), materials.nose);
  nose.position.set(...noseAt);
  nose.scale.setScalar(0.66);
  features.add(nose);
  [-1, 1].forEach((side) => {
    const [nx, ny, nz] = toHead(side * 0.0090, NOSE_Y - 0.009, surfaceZ(0, NOSE_Y - 0.009) + 0.006);
    sphere(features, materials.nostril, 0.0044, [nx, ny, nz], [1, 0.8, 0.6], null, 10);
  });
  const mouthAt = toHead(0, MOUTH_Y, surfaceZ(0, MOUTH_Y) + 0.002);
  const philtrum = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, noseAt[1] - mouthAt[1] - 0.016, 6), materials.mouth);
  philtrum.position.set(0, (noseAt[1] + mouthAt[1]) / 2 - 0.004, mouthAt[2] + 0.004);
  features.add(philtrum);

  const mouthGeo = new THREE.TorusGeometry(0.020, 0.0022, 6, 16, Math.PI);
  [-1, 1].forEach((side) => {
    const arc = new THREE.Mesh(mouthGeo, materials.mouth);
    arc.position.set(side * 0.019, mouthAt[1], mouthAt[2]);
    arc.rotation.z = Math.PI;
    features.add(arc);
  });
  parts.tongue = sphere(features, materials.tongue, 0.032, [0, mouthAt[1] - 0.021, mouthAt[2] - 0.006], [0.72, 0.3, 0.42], 'tongue', 16);
  parts.tongue.visible = false;

  /* 胡须：真猫一侧 12 根左右，这里做 5 根，长度和角度必须不一样 ——
   * 之前每侧 3 根、上下等长、还都水平，看着像三根铁丝 */
  const whiskers = new THREE.Group();
  face.add(whiskers);
  parts.whiskers = whiskers;
  const wr = toHead(0.084, 0.872, surfaceZ(0.084, 0.872) + 0.004);
  [-1, 1].forEach((side) => {
    [
      { dy: 0.040, rise: 0.052, len: 0.300 },
      { dy: 0.021, rise: 0.026, len: 0.352 },
      { dy: 0.002, rise: -0.002, len: 0.386 },
      { dy: -0.017, rise: -0.034, len: 0.344 },
      { dy: -0.036, rise: -0.066, len: 0.286 }
    ].forEach(({ dy, rise, len }, row) => {
      // 毛根沿口鼻侧面上下散开（每根错开一点），否则五根胡须像从一个点射出的星芒
      const rootX = wr[0] - row * 0.006 + Math.abs(dy) * 0.10;
      const rootZ = wr[2] - row * 0.004;
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(side * rootX, wr[1] + dy, rootZ),
        new THREE.Vector3(side * (wr[0] + len * 0.52), wr[1] + dy + rise * 0.58, wr[2] - 0.032),
        new THREE.Vector3(side * (wr[0] + len), wr[1] + dy + rise, wr[2] - 0.108)
      );
      whiskers.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(18)), materials.whisker));
    });
    // 眉须：从眼睛斜上方往外上翘，两根一长一短
    [{ dx: 0.100, dy: 1.086, len: 0.104 }, { dx: 0.126, dy: 1.070, len: 0.082 }].forEach(({ dx, dy, len }) => {
      const [bx, by, bz] = toHead(side * dx, dy, surfaceZ(side * dx, dy) + 0.004);
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(bx, by, bz),
        new THREE.Vector3(bx + side * len * 0.5, by + 0.030, bz - 0.020),
        new THREE.Vector3(bx + side * len, by + 0.062, bz - 0.052)
      );
      whiskers.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(14)), materials.whisker));
    });
  });

  /* —— 耳朵：内耳贴在耳廓正面，随耳骨一起动 —— */
  const ears = [];
  [['earL', -1], ['earR', 1]].forEach(([name, side]) => {
    const bone = boneMap[name];
    /* 只留一层「耳窝」。以前是两层（暗边 + 内耳），两个都是手摆的椭球，
     * 一旦耳骨旋转幅度大一点，里面那个就会从耳廓里钻出来，在脸上留一块粉色。
     * 现在合成一个薄片，颜色直接用内耳色，位置往耳窝里收了 6mm */
    const inner = sphere(bone, materials.earInner, 0.086, [side * 0.012, 0.088, 0.030], [0.62, 1.12, 0.12], null, 18);
    ears.push({ ear: bone, inner, baseZ: 0 });
  });
  parts.ears = ears;

  /* —— 四肢 / 尾巴：直接用骨骼代替原来的 Group —— */
  parts.legs = {
    frontL: boneMap.legFL, frontR: boneMap.legFR,
    backL: boneMap.legBL, backR: boneMap.legBR
  };
  parts.tailRoot = boneMap.tail0;
  // tail0 是根骨，由 applyPoseToRig 单独驱动；逐节循环只能管 tail1..tail3，
  // 否则根骨的旋转会被最后一节覆盖掉，尾巴整条甩到画面外面
  parts.tail = [boneMap.tail1, boneMap.tail2, boneMap.tail3];
  // 尾尖的毛已经由 addMeshStrands 统一撒过，这里不再单独补一撮
  parts.strandMeshes[parts.strandMeshes.length - 1].position.set(0.10, 0.025, 0.44);

  const rig = {
    root, parts, materials,
    coat: () => coat,
    applyCoat: (next) => {
      const previous = coat;
      coat = next;
      materials.coat.map = next.tex.coat;
      materials.light.map = next.tex.light;
      materials.limb.map = next.tex.limb;
      materials.coat.sheenColor.copy(next.colors.sheen);
      materials.light.sheenColor.copy(next.colors.sheen);
      materials.limb.sheenColor.copy(next.colors.sheen);
      const previousEye = materials.eye.map;
      materials.eye.map = makeEyeTexture(next.palette.eye, next.palette.base);
      materials.eye.emissive.copy(next.colors.eye).multiplyScalar(0.025);
      materials.eye.needsUpdate = true;
      if (previousEye) previousEye.dispose();
      materials.nose.color.copy(next.colors.nose);
      materials.earInner.color.copy(next.colors.earInner);
      materials.earRim.color.copy(next.colors.earRim);
      materials.coat.needsUpdate = true;
      materials.light.needsUpdate = true;
      materials.limb.needsUpdate = true;
      const colors = strandColors(next);
      parts.strandMeshes.forEach((mesh) => recolorStrands(mesh, colors));
      if (previous && previous !== next) {
        Object.values(previous.tex).forEach((texture) => texture.dispose());
      }
      renderCoatInfo(next);
    }
  };
  return rig;
}

/* ------------------------------------------------------------------ *
 * 5. 道具
 * ------------------------------------------------------------------ */

function buildProps() {
  const group = new THREE.Group();
  const items = {};
  const wood = new THREE.MeshStandardMaterial({ color: 0xc39a70, roughness: 0.95 });
  const rope = new THREE.MeshStandardMaterial({ color: 0xe0c79c, roughness: 1 });
  const tray = new THREE.MeshStandardMaterial({ color: 0x9dbfd0, roughness: 0.75 });
  const sand = new THREE.MeshStandardMaterial({ color: 0xead9b4, roughness: 1 });
  const bowlMat = new THREE.MeshStandardMaterial({ color: 0xe99a9a, roughness: 0.65 });
  const water = new THREE.MeshStandardMaterial({ color: 0x7cc6e2, roughness: 0.18, metalness: 0.1 });
  const soft = new THREE.MeshStandardMaterial({ color: 0xf3dce7, roughness: 0.98 });
  const featherMat = new THREE.MeshStandardMaterial({ color: 0xf5aac6, roughness: 0.85 });

  const scratch = new THREE.Group();
  scratch.position.set(0.82, 0, 0.08);
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.07, 0.36), wood);
  base.position.y = 0.035; scratch.add(base);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.105, 0.88, 16), rope);
  post.position.y = 0.5; scratch.add(post);
  for (let i = 0; i < 7; i += 1) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.007, 5, 18), wood);
    ring.position.y = 0.18 + i * 0.11; ring.rotation.x = Math.PI / 2; scratch.add(ring);
  }
  group.add(scratch); items.scratch = scratch;

  const litter = new THREE.Group();
  litter.position.set(0, 0, 0.06);
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.18, 0.82), tray);
  box.position.y = 0.09; litter.add(box);
  const sd = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.02, 0.74), sand);
  sd.position.y = 0.19; litter.add(sd);
  group.add(litter); items.litter = litter;

  const bowl = new THREE.Group();
  bowl.position.set(0, 0, 0.78);
  const bowlBody = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.18, 0.14, 28), bowlMat);
  bowlBody.position.y = 0.07; bowl.add(bowlBody);
  const waterDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.215, 0.215, 0.012, 28), water);
  waterDisc.position.y = 0.135; bowl.add(waterDisc);
  const rippleMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false });
  const ripple = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.008, 6, 26), rippleMat);
  ripple.position.y = 0.146; ripple.rotation.x = Math.PI / 2; bowl.add(ripple);
  group.add(bowl); items.bowl = bowl;

  const wand = new THREE.Group();
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.05, 8), wood);
  stick.position.set(0.95, 1.62, 0.28); stick.rotation.z = 0.62; wand.add(stick);
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.55, 6), rope);
  string.position.set(0.62, 1.12, 0.4); string.rotation.z = 0.2; wand.add(string);
  const feather = new THREE.Group();
  feather.position.set(0.56, 0.95, 0.48);
  const plume = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.28, 8), featherMat);
  plume.rotation.z = 0.6; feather.add(plume);
  sphere(feather, featherMat, 0.06, [0.06, -0.1, 0], null, null, 12);
  wand.add(feather);
  group.add(wand); items.wand = wand;

  const hurdle = new THREE.Group();
  hurdle.position.set(-0.86, 0, -0.05);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.16), wood);
  bar.position.y = 0.22; hurdle.add(bar);
  [-0.21, 0.21].forEach((x) => {
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.12), wood);
    stand.position.set(x, 0.11, 0); hurdle.add(stand);
  });
  group.add(hurdle); items.hurdle = hurdle;

  const cushion = new THREE.Group();
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.66, 0.1, 32), soft);
  pad.position.y = 0.05; cushion.add(pad);
  group.add(cushion); items.cushion = cushion;

  Object.values(items).forEach((item) => {
    item.visible = false;
    item.scale.setScalar(0.01);
  });
  return { group, items, feather, ripple, rippleMat, weights: Object.fromEntries(Object.keys(items).map((k) => [k, 0])) };
}

/* ------------------------------------------------------------------ *
 * 6. 姿态系统：目标值 + 阻尼，杜绝硬切
 * ------------------------------------------------------------------ */

function neutralPose() {
  return {
    bodyY: BODY_HOME_Y, bodyRotX: 0, bodyRotY: 0, bodyRotZ: 0, bodyScaleY: 1,
    headX: HEAD_HOME[0], headY: HEAD_HOME[1], headZ: HEAD_HOME[2],
    headRotX: 0, headRotY: 0, headRotZ: 0,
    legFL: 0, legFR: 0, legBL: 0, legBR: 0, legFLZ: 0, legFRZ: 0,
    // 尾巴的弯曲已经做进静止几何里（绕到左前方贴地），
    // 这里的旋转只用来做「抬尾 / 甩尾」的小幅动作
    tailX: 0, tailY: 0, tailZ: 0, tailSegX: 0.02, tailWave: 1,
    eyeOpen: 1, earFlat: 0, tongue: 0,
    rootLift: 0, rootX: 0,
    prop: null
  };
}

function poseFor(mode, t, local) {
  const p = neutralPose();
  switch (mode) {
    case 'lick':
      p.headRotX = 0.6 + Math.sin(t * 5.5) * 0.09;
      p.headRotZ = 0.15;
      p.legFR = -1.0 + Math.sin(t * 5.5) * 0.12;
      p.legFRZ = -0.25;
      p.tongue = 0.55 + Math.abs(Math.sin(t * 6.5)) * 0.45;
      p.tailX = -0.10;
      break;
    case 'scratch':
      p.prop = 'scratch';
      p.bodyRotY = -0.2;
      p.bodyRotZ = Math.sin(t * 6) * 0.03;
      p.legFL = -0.72 + Math.sin(t * 7) * 0.5;
      p.legFR = -0.72 + Math.sin(t * 7 + Math.PI) * 0.5;
      p.legFLZ = -0.15; p.legFRZ = 0.15;
      p.headRotY = -0.4; p.headRotX = 0.12;
      p.tailX = -0.06;
      break;
    case 'parkour': {
      p.prop = 'hurdle';
      const phase = (local % 2.4) / 2.4;
      p.rootX = Math.sin(local * 1.05) * 0.38;
      p.rootLift = Math.abs(Math.sin(phase * Math.PI)) * 0.26;
      p.bodyRotX = -0.16 + Math.cos(phase * Math.PI * 2) * 0.12;
      p.legFL = Math.sin(local * 11) * 0.65;
      p.legFR = Math.sin(local * 11 + Math.PI) * 0.65;
      p.legBL = Math.sin(local * 11 + Math.PI / 2) * 0.5;
      p.legBR = Math.sin(local * 11 - Math.PI / 2) * 0.5;
      p.headRotX = -0.1;
      p.tailX = -0.02; p.tailSegX = 0.10;
      break;
    }
    case 'toilet':
      p.prop = 'litter';
      p.bodyY = 0.5; p.bodyScaleY = 0.9; p.bodyRotY = 0.3;
      p.legFL = 0.24; p.legFR = 0.24; p.legBL = 0.48;
      p.legBR = 0.48 + Math.sin(t * 7) * 0.24;
      p.headRotX = 0.22;
      p.tailX = -0.12; p.tailSegX = 0.14; p.tailWave = 0.4;
      break;
    case 'wand': {
      p.prop = 'wand';
      const swing = Math.sin(t * 2.05);
      p.headRotY = swing * 0.72;
      p.headRotX = -0.2 + Math.cos(t * 2.05) * 0.08;
      p.legFR = -0.82 + Math.sin(t * 4.4) * 0.4;
      p.rootLift = Math.max(0, swing) * 0.11;
      p.tailX = -0.04; p.tailWave = 1.3;
      break;
    }
    case 'drink':
      p.prop = 'bowl';
      p.headY = 0.24; p.headRotX = 0.76;
      p.legFL = 0.16; p.legFR = 0.16;
      p.tongue = 0.35 + Math.abs(Math.sin(t * 7.5)) * 0.4;
      p.tailX = -0.14;
      break;
    case 'sleep':
      // 蜷着睡：身体压低、头埋下来、爪子收拢、尾巴绕到身侧（不能整体前翻，否则只看到后背）
      p.prop = 'cushion';
      p.bodyY = 0.42; p.bodyRotX = 0.05; p.bodyRotY = 0.2; p.bodyRotZ = 0.04;
      p.bodyScaleY = 0.93;
      p.headY = 0.27; p.headZ = 0.34; p.headRotX = 0.3; p.headRotZ = 0.1;
      p.legFL = 1.1; p.legFR = 1.1; p.legBL = 1.0; p.legBR = 1.0;
      p.tailX = -0.18; p.tailY = 0; p.tailZ = 0.16;
      p.tailSegX = 0.04; p.tailWave = 0.1;
      p.eyeOpen = 0; p.tongue = 0;
      break;
    case 'taunt':
      p.bodyY = 0.62; p.bodyRotX = 0.4; p.bodyRotY = 0.48;
      p.bodyRotZ = Math.sin(t * 4.5) * 0.045;
      p.legFL = 0.46; p.legFR = 0.46; p.legBL = -0.14; p.legBR = -0.14;
      p.headRotY = -0.5; p.headRotX = -0.26;
      p.tailX = -0.05; p.tailSegX = 0.24; p.tailZ = 0.26; p.tailWave = 0.5;
      p.earFlat = 1;
      break;
    default:
      break;
  }
  return p;
}

function dampPose(current, target, dt) {
  Object.keys(target).forEach((key) => {
    if (typeof target[key] !== 'number') return;
    const speed = key.startsWith('leg') ? 10 : key.includes('Rot') ? 5.5 : key.startsWith('tail') ? 4.5 : 6.5;
    current[key] = damp(current[key] === undefined ? target[key] : current[key], target[key], speed, dt);
  });
  current.prop = target.prop;
}

function applyPoseToRig(parts, pose, t, pref, mode, dt) {
  const { bodyRig, headRig, legs, tailRoot, tail, ears, pupils, whiskers, tongue, props, root } = parts;
  const breathe = Math.sin(t * 1.55) * 0.012;
  const sway = Math.sin(t * 0.52) * 0.016;
  const blinkOpen = (() => {
    const cycle = t % 4.4;
    if (cycle <= 3.98) return 1;
    return 1 - Math.sin(((cycle - 3.98) / 0.42) * Math.PI) * 0.95;
  })();
  const twitch = (() => {
    const phase = t % 5.9;
    return phase > 5.72 ? Math.sin(((phase - 5.72) / 0.18) * Math.PI) * 0.22 : 0;
  })();

  // 视线跟随鼠标（阻尼后的 lookX/lookY），瞳孔也跟着偏移
  const lookX = pref.lookX;
  const lookY = pref.lookY;

  bodyRig.position.set(0, pose.bodyY + breathe * 0.4, 0);
  bodyRig.rotation.set(pose.bodyRotX, pose.bodyRotY, pose.bodyRotZ + sway);
  bodyRig.scale.set(1 + breathe * 0.2, pose.bodyScaleY + breathe, 1 + breathe * 0.2);

  headRig.position.set(pose.headX, pose.headY, pose.headZ);
  headRig.rotation.set(
    pose.headRotX - lookY * 0.15 + Math.sin(t * 0.9) * 0.035,
    pose.headRotY + lookX * 0.3 + Math.sin(t * 0.68) * 0.11,
    pose.headRotZ + Math.sin(t * 0.43) * 0.02
  );

  legs.frontL.rotation.set(pose.legFL, 0, pose.legFLZ);
  legs.frontR.rotation.set(pose.legFR, 0, pose.legFRZ);
  legs.backL.rotation.set(pose.legBL, 0, 0);
  legs.backR.rotation.set(pose.legBR, 0, 0);

  // 尾巴：逐节相位延迟，形成柔软的跟随感
  tailRoot.rotation.set(pose.tailX + Math.sin(t * 1.3) * 0.05, pose.tailY, pose.tailZ + Math.sin(t * 1.55) * 0.1 * pose.tailWave);
  tail.forEach((joint, i) => {
    const delay = i * 0.5;
    joint.rotation.x = pose.tailSegX + Math.sin(t * 1.7 - delay) * 0.05 * pose.tailWave;
    joint.rotation.z = Math.sin(t * 2.05 - delay) * 0.13 * pose.tailWave - pose.bodyRotY * 0.1;
  });

  const eyeScale = 0.06 + 0.94 * pose.eyeOpen * blinkOpen;
  parts.eyeL.scale.y = eyeScale;
  parts.eyeR.scale.y = eyeScale;
  pupils.forEach(({ mesh, x }) => { mesh.position.x = x + lookX * 0.013; });
  whiskers.rotation.z = Math.sin(t * 2.5) * 0.014;

  ears.forEach(({ ear, inner, baseZ }, i) => {
    const flatten = (i === 0 ? 0.4 : -0.4) * pose.earFlat;
    // 耳朵现在是骨骼：整只耳廓由蒙皮带动，内耳是耳骨的子物体，跟着走就行
    ear.rotation.z = baseZ + flatten + twitch * (i === 0 ? 1 : -0.6);
    if (inner) inner.rotation.z = 0;
  });

  tongue.visible = pose.tongue > 0.06;
  if (tongue.visible) tongue.scale.y = pose.tongue;

  // 道具渐显 / 渐隐
  Object.keys(props.items).forEach((name) => {
    const target = pose.prop === name ? 1 : 0;
    props.weights[name] = damp(props.weights[name], target, 7, dt);
    const w = props.weights[name];
    const item = props.items[name];
    item.visible = w > 0.02;
    item.scale.setScalar(Math.max(0.01, w));
  });

  if (mode === 'wand') {
    const swing = Math.sin(t * 2.05);
    props.feather.position.set(0.56 + swing * 0.48, 0.95 + Math.cos(t * 2.05) * 0.2, 0.48);
  }
  if (mode === 'drink') {
    const phase = (t * 1.4) % 1;
    props.ripple.scale.setScalar(0.55 + phase * 0.9);
    props.rippleMat.opacity = 0.6 * (1 - phase);
  }

  // 档案页的猫只能在头像框（圆形地毯）内活动；店铺漫游场景给出更宽的边界
  const bounds = pref.bounds || FRAME_BOUNDS;
  root.position.x = clamp(pref.offsetX + pose.rootX, -bounds.x, bounds.x);
  root.position.y = clamp(pref.offsetY + pose.rootLift, bounds.yMin, bounds.yMax);
}

/* ------------------------------------------------------------------ *
 * 7. 场景生命周期
 * ------------------------------------------------------------------ */

function disposeScene(canvas) {
  const state = scenes.get(canvas);
  if (!state) return;
  state.disposed = true;
  cancelAnimationFrame(state.raf);
  if (state.observer) state.observer.disconnect();
  state.scene.traverse((object) => {
    if (object.geometry) object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : (object.material ? [object.material] : []);
    materials.forEach((material) => {
      ['map', 'alphaMap', 'sheenColorMap', 'bumpMap', 'normalMap', 'roughnessMap'].forEach((key) => {
        const tex = material[key];
        // 绒毛卡片/凹凸/阴影纹理是全局共享的，跟着单个场景销毁会把其他猫也弄坏
        if (tex && tex.isTexture && !tex.userData.shared) tex.dispose();
      });
      material.dispose();
    });
  });
  try { state.renderer.forceContextLoss(); } catch (_) { /* noop */ }
  state.renderer.dispose();
  scenes.delete(canvas);
}

function createScene(canvas, setup) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (err) {
    console.warn('WebGL 不可用，保留 2D 头像。', err);
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  addLights(scene);

  const started = performance.now();
  let lastFrame = started;
  const state = { renderer, scene, camera, canvas, time: 0, disposed: false, raf: 0, firstFrame: false, kind: 'cat' };
  const hooks = setup({ renderer, scene, camera, canvas, state }) || {};
  // 把 setup 暴露的对象挂到 state 上（例如 rig），外部才能直接改毛色
  if (hooks.rig) state.rig = hooks.rig;

  function resize() {
    const width = Math.max(1, canvas.clientWidth || (canvas.parentElement && canvas.parentElement.clientWidth) || 320);
    const height = Math.max(1, canvas.clientHeight || (canvas.parentElement && canvas.parentElement.clientHeight) || 240);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  resize();
  state.resize = resize;
  state.observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  if (state.observer) state.observer.observe(canvas);
  scenes.set(canvas, state);

  function loop() {
    if (state.disposed) return;
    state.raf = requestAnimationFrame(loop);
    if (state.hidden) {
      // 照片模式下不渲染，但要刷新时间基准，切回 3D 时不会有一大段 dt
      lastFrame = performance.now();
      return;
    }
    const now = performance.now();
    const dt = Math.min((now - lastFrame) / 1000, 0.05);
    lastFrame = now;
    state.time = (now - started) / 1000;
    try {
      if (hooks.tick) hooks.tick(state, dt);
      renderer.render(scene, camera);
      if (!state.firstFrame) {
        state.firstFrame = true;
        if (hooks.onReady) hooks.onReady(state);
      }
    } catch (err) {
      console.error('3D 渲染异常', err);
      if (canvas.parentElement) delete canvas.parentElement.dataset['3dReady'];
      disposeScene(canvas);
    }
  }
  loop();
  return state;
}

function getPref(id) {
  if (!prefs.has(id)) {
    prefs.set(id, {
      mode: globalMode, zoom: globalZoom, yaw: 0, pitch: 0,
      offsetX: 0, offsetY: 0, pointerX: 0, pointerY: 0, lookX: 0, lookY: 0,
      active: 'idle', current: 'idle', pending: 'lick',
      switchAt: 0, nextSwitch: 0, pose: neutralPose()
    });
  }
  return prefs.get(id);
}

function renderCoatInfo(coat) {
  if (!coat) return;
  lastCoat = coat;
  const el = document.querySelector('[data-cat3d-coat]');
  if (!el) return;
  const panel = el.closest('[data-cat3d-panel]');
  const catId = panel ? panel.dataset.id : '';
  const activeKey = readCoatOverrides()[catId] || 'auto';
  const swatches = [coat.palette.base, coat.palette.accent, coat.palette.light, coat.palette.eye]
    .map((c) => `<i style="background:${cssColor(c)}"></i>`).join('');
  const thumb = /^(data:image\/|https?:\/\/|\/)/i.test(coat.thumb || '')
    ? `<img class="cat3d-coat-thumb" src="${String(coat.thumb).replace(/"/g, '&quot;')}" alt="用于毛色分析的照片" title="照片只用于分析毛色，不会贴到 3D 模型上">`
    : '';
  const source = coat.source === 'manual'
    ? '手动指定'
    : (coat.source === 'views' ? '多视角校准' : (coat.source === 'photo' ? '取自上传照片' : '按品种推断'));
  const chips = [{ key: 'auto', label: '自动' }].concat(BREED_PRESETS.map((p) => ({ key: p.key, label: p.label })))
    .map(({ key, label }) => `<button class="cat3d-coat-chip${key === activeKey ? ' active' : ''}" data-action="cat3d-coat" data-id="${key}" title="把毛色改成${label}">${label}</button>`)
    .join('');
  el.innerHTML = thumb
    + `<span class="cat3d-coat-label">毛色 · ${PATTERN_LABELS[coat.pattern] || '纯色'}</span>`
    + `<span class="cat3d-swatches">${swatches}</span>`
    + `<span class="cat3d-coat-source">${source}</span>`
    + `<span class="cat3d-coat-chips">${chips}</span>`;
}

function syncControls() {
  document.querySelectorAll('[data-action="cat3d-mode"]').forEach((button) => {
    button.classList.toggle('active', button.dataset.id === globalMode);
  });
  const label = document.querySelector('[data-cat3d-zoom-label]');
  if (label) label.textContent = `${globalZoom.toFixed(1)}×`;

  const panel = document.querySelector('[data-cat3d-panel]');
  const cat = panel && window.__meow3dCat ? window.__meow3dCat(panel.dataset.id) : null;
  const mode = cat ? getPetMode(cat) : 'model';
  if (panel) panel.dataset.petMode = mode;
  document.querySelectorAll('[data-action="cat3d-render"]').forEach((button) => {
    button.classList.toggle('active', button.dataset.id === mode);
  });
  const hasPhoto = !!(cat && cat.avatar);
  const note = document.querySelector('[data-cat3d-render-note]');
  if (note) {
    note.textContent = mode === 'photo'
      ? (hasPhoto ? '真实照片 · 可拖动 · 点一下换状态' : '先上传照片，才能用真实头像')
      : (hasPhoto ? '已上传照片 · 可切真实头像' : '程序化 3D · 可缩放旋转');
  }
  // 没照片时「状态」按钮没有可操作对象，直接收起
  const statesRow = document.querySelector('.pet2d-states');
  if (statesRow) statesRow.style.display = (mode === 'photo' && hasPhoto) ? '' : 'none';
  if (cat) {
    const rt = getPetRuntime(cat);
    document.querySelectorAll('[data-action="pet-state"]').forEach((button) => {
      button.classList.toggle('active', button.dataset.id === rt.state);
    });
  }
  renderCoatInfo(lastCoat);
}

function attachControls(canvas, pref) {
  // 切换「真实头像 / 3D 手办」会重建场景，监听只挂一次，避免重复绑定
  if (canvas.__meowControls) return;
  canvas.__meowControls = true;
  let dragging = false;
  let moved = false;
  let startX = 0, startY = 0;
  let startOffsetX = 0, startOffsetY = 0, startYaw = 0, startPitch = 0;

  canvas.addEventListener('pointerdown', (event) => {
    dragging = true; moved = false;
    startX = event.clientX; startY = event.clientY;
    startOffsetX = pref.offsetX; startOffsetY = pref.offsetY;
    startYaw = pref.yaw; startPitch = pref.pitch;
    try { canvas.setPointerCapture(event.pointerId); } catch (_) { /* noop */ }
    canvas.style.cursor = 'grabbing';
  });

  const updatePointer = (event) => {
    const rect = canvas.getBoundingClientRect();
    pref.pointerX = clamp(((event.clientX - rect.left) / rect.width - 0.5) * 2, -1, 1);
    pref.pointerY = clamp(((event.clientY - rect.top) / rect.height - 0.5) * 2, -1, 1);
  };

  canvas.addEventListener('pointermove', (event) => {
    updatePointer(event);
    if (!dragging) return;
    const dx = event.clientX - startX, dy = event.clientY - startY;
    if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
    if (!moved) return;
    if (event.shiftKey || event.buttons === 2) {
      pref.offsetX = clamp(startOffsetX + dx / 260, -0.8, 0.8);
      pref.offsetY = clamp(startOffsetY - dy / 260, -0.25, 0.45);
    } else {
      pref.yaw = clamp(startYaw + dx * 0.008, -Math.PI, Math.PI);
      pref.pitch = clamp(startPitch + dy * 0.005, -0.5, 0.5);
    }
  });

  canvas.addEventListener('pointerleave', () => { pref.pointerX = 0; pref.pointerY = 0; });
  canvas.addEventListener('pointerup', () => {
    dragging = false;
    canvas.style.cursor = 'grab';
    if (!moved) return;
    const block = (event) => { event.stopPropagation(); event.preventDefault(); };
    canvas.addEventListener('click', block, { capture: true, once: true });
    window.setTimeout(() => canvas.removeEventListener('click', block, true), 350);
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    window.__meow3dZoom(-Math.sign(event.deltaY) * 0.12);
  }, { passive: false });
}

function makeRoom(scene) {
  // 圆形地毯把猫咪「圈」在网站头像框里
  const rug = new THREE.Mesh(
    new THREE.CylinderGeometry(1.0, 1.04, 0.05, 48),
    new THREE.MeshStandardMaterial({ color: 0xf3e9dc, roughness: 1 })
  );
  rug.position.y = 0.025;
  scene.add(rug);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(1.0, 0.022, 8, 60),
    new THREE.MeshStandardMaterial({ color: 0xe4cfb6, roughness: 0.95 })
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.052;
  scene.add(rim);
}

function catScene(canvas, cat) {
  const pref = getPref(canvas.dataset.id);
  return createScene(canvas, ({ scene, camera, state }) => {
    state.kind = 'cat';
    state.pref = pref;
    const rig = buildCatRig(cat);
    const parts = rig.parts;
    scene.add(rig.root);
    startCoatAnalysis(cat, rig);

    // 软接触阴影：径向渐变贴图比一块灰色圆片自然得多
    const shadowMat = new THREE.MeshBasicMaterial({
      map: getShadowTexture(), transparent: true, opacity: 0.95, depthWrite: false
    });
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 1.15), shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(0, 0.058, -0.04);
    scene.add(shadow);
    makeRoom(scene);

    const props = buildProps();
    scene.add(props.group);
    parts.props = props;

    camera.position.set(0, 1.04, 3.1);
    camera.lookAt(0, 0.72, 0);
    attachControls(canvas, pref);

    return {
      rig,
      onReady: () => { if (canvas.parentElement) canvas.parentElement.dataset['3dReady'] = '1'; },
      tick: (current, dt) => {
        const t = current.time;
        if (pref.mode === 'auto') {
          if (t > pref.nextSwitch) {
            pref.pending = ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
            pref.switchAt = t;
            pref.nextSwitch = t + 5 + Math.random() * 3;
          }
          pref.current = t - pref.switchAt < 1.2 ? 'idle' : pref.pending;
        } else {
          pref.current = pref.mode;
          pref.switchAt = t;
        }
        const local = t - pref.switchAt;

        pref.lookX = damp(pref.lookX, pref.pointerX, 3.2, dt);
        pref.lookY = damp(pref.lookY, pref.pointerY, 3.2, dt);

        const target = poseFor(pref.current, t, local);
        dampPose(pref.pose, target, dt);
        applyPoseToRig(parts, pref.pose, t, pref, pref.current, dt);

        rig.root.rotation.y = damp(rig.root.rotation.y, pref.yaw, 5, dt);
        rig.root.rotation.x = damp(rig.root.rotation.x, pref.pitch, 5, dt);
        const scale = damp(rig.root.scale.x, pref.zoom, 5, dt);
        rig.root.scale.setScalar(scale);

        props.group.scale.setScalar(scale);
        props.group.position.x = rig.root.position.x * 0.35;
        const lift = Math.max(0, rig.root.position.y - pref.offsetY);
        shadow.position.x = rig.root.position.x;
        shadow.scale.set((1 - lift * 0.4) * scale, (0.78 - lift * 0.28) * scale, 1);
        shadowMat.opacity = clamp(0.95 - lift * 0.55, 0.2, 0.95);
      }
    };
  });
}

function shopScene(canvas, shop, cat) {
  const facade = shop && shop.facade ? shop.facade : '';
  createScene(canvas, ({ scene, camera, state }) => {
    state.kind = 'shop';
    const roomGroup = new THREE.Group();
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xd9e7f5, roughness: 0.9, side: THREE.DoubleSide });
    if (facade) {
      new THREE.TextureLoader().load(facade, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        wallMat.map = texture; wallMat.color.set(0xffffff); wallMat.needsUpdate = true;
      });
    }
    const floorMat = new THREE.MeshStandardMaterial({ color: 0xc8b69a, roughness: 0.9, side: THREE.DoubleSide });
    const roomWidth = 9, roomDepth = 4.4, roomCenterZ = -2.2;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, roomDepth), floorMat);
    floor.rotation.x = -Math.PI / 2; floor.position.z = roomCenterZ; roomGroup.add(floor);
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, 5.6), wallMat);
    backWall.position.set(0, 2.8, roomCenterZ - roomDepth / 2); roomGroup.add(backWall);
    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(roomDepth, 5.6), wallMat);
    leftWall.rotation.y = Math.PI / 2; leftWall.position.set(-roomWidth / 2, 2.8, roomCenterZ); roomGroup.add(leftWall);
    const rightWall = leftWall.clone();
    rightWall.rotation.y = -Math.PI / 2; rightWall.position.set(roomWidth / 2, 2.8, roomCenterZ); roomGroup.add(rightWall);
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, roomDepth), new THREE.MeshStandardMaterial({ color: 0xf5f9fc, roughness: 0.9, side: THREE.DoubleSide }));
    ceiling.rotation.x = Math.PI / 2; ceiling.position.set(0, 3.2, roomCenterZ); roomGroup.add(ceiling);
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(4, 1, 0.2), new THREE.MeshStandardMaterial({ color: 0x8a6f58 }));
    shelf.position.set(-1.6, 0.8, -3.8); roomGroup.add(shelf);
    const counter = new THREE.Mesh(new THREE.BoxGeometry(3, 0.9, 0.6), new THREE.MeshStandardMaterial({ color: 0x6f8f9b }));
    counter.position.set(1.8, 0.45, -3.6); roomGroup.add(counter);
    const frame = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.2), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    frame.position.set(0, 2.4, -4.34); roomGroup.add(frame);
    if (facade) {
      const posterMat = new THREE.MeshBasicMaterial({ transparent: true });
      new THREE.TextureLoader().load(facade, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        posterMat.map = texture; posterMat.needsUpdate = true;
      });
      const poster = new THREE.Mesh(new THREE.PlaneGeometry(2, 1), posterMat);
      poster.position.set(0, 2.4, -4.3); roomGroup.add(poster);
    }

    const rig = buildCatRig(cat);
    startCoatAnalysis(cat, rig);
    rig.root.position.set(0, 0, -2);
    roomGroup.add(rig.root);
    scene.add(roomGroup);
    rig.parts.props = buildProps();
    roomGroup.add(rig.parts.props.group);
    camera.position.set(0, 1.8, -0.4);
    camera.lookAt(0, 1, -2.8);

    const pose = neutralPose();
    return {
      tick: (current, dt) => {
        const t = current.time;
        const speed = 2.2 * dt;
        let dx = 0, dz = 0;
        if (keys.w || keys.arrowup) dz -= speed;
        if (keys.s || keys.arrowdown) dz += speed;
        if (keys.a || keys.arrowleft) dx -= speed;
        if (keys.d || keys.arrowright) dx += speed;
        rig.root.position.x = clamp(rig.root.position.x + dx, -3.8, 3.8);
        rig.root.position.z = clamp(rig.root.position.z + dz, -4, -0.5);
        const target = neutralPose();
        if (dx || dz) {
          rig.root.rotation.y = Math.atan2(dx, dz);
          const cycle = Math.sin(t * 9);
          target.legFL = cycle * 0.55; target.legFR = -cycle * 0.55;
          target.legBL = -cycle * 0.4; target.legBR = cycle * 0.4;
          target.bodyY = BODY_HOME_Y + Math.abs(cycle) * 0.035;
        }
        dampPose(pose, target, dt);
        applyPoseToRig(rig.parts, pose, t, {
          lookX: 0, lookY: 0, offsetX: rig.root.position.x, offsetY: 0, bounds: SHOP_BOUNDS
        }, 'idle', dt);
      }
    };
  });
}

/* ---------------- 真实头像：把上传照片做成桌面宠物 ---------------- */

const PET_STATE_LABELS = { idle: '普通', happy: '开心', sleep: '睡觉' };
const PET_STORE_KEY = 'meow-kart-pet-mode-v1';
const petModes = (() => {
  try { return JSON.parse(localStorage.getItem(PET_STORE_KEY)) || {}; } catch (_) { return {}; }
})();
const petRuntime = new Map();
const petCutCache = new Map();

function escapeAttr(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function getPetMode(cat) {
  const saved = petModes[cat.id];
  if (saved === 'photo' || saved === 'model') return saved;
  // 有照片时默认用真实头像：程序化 3D 只能做到「同品种」，照片才是本猫
  return cat.avatar ? 'photo' : 'model';
}

function getPetRuntime(cat) {
  if (!petRuntime.has(cat.id)) {
    petRuntime.set(cat.id, { state: 'idle', x: 0, y: 0, avatar: '', src: '', framed: false, loading: false });
  }
  return petRuntime.get(cat.id);
}

// 把边缘像素当成背景做泛洪填充，得到带透明通道的宠物素材
function featherMask(alpha, w, h) {
  const eroded = new Uint8ClampedArray(alpha);
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const i = y * w + x;
      if (!alpha[i]) continue;
      if (!alpha[i - 1] || !alpha[i + 1] || !alpha[i - w] || !alpha[i + w]) eroded[i] = 0;
    }
  }
  let cur = eroded;
  for (let pass = 0; pass < 2; pass += 1) {
    const out = new Uint8ClampedArray(cur.length);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        let sum = 0, n = 0;
        for (let dy = -1; dy <= 1; dy += 1) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -1; dx <= 1; dx += 1) {
            const xx = x + dx;
            if (xx < 0 || xx >= w) continue;
            sum += cur[yy * w + xx];
            n += 1;
          }
        }
        out[y * w + x] = sum / n;
      }
    }
    cur = out;
  }
  return cur;
}

function buildCutout(img) {
  const MAX = 440;
  const iw = img.naturalWidth || img.width || MAX;
  const ih = img.naturalHeight || img.height || MAX;
  const scale = Math.min(1, MAX / Math.max(iw, ih));
  const w = Math.max(8, Math.round(iw * scale));
  const h = Math.max(8, Math.round(ih * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;

  const ring = Math.max(1, Math.round(Math.min(w, h) * 0.014));
  let br = 0, bg = 0, bb = 0, bn = 0;
  const border = [];
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (x >= ring && x < w - ring && y >= ring && y < h - ring) continue;
      const i = (y * w + x) * 4;
      br += px[i]; bg += px[i + 1]; bb += px[i + 2];
      bn += 1;
      border.push(x, y);
    }
  }
  br /= bn; bg /= bn; bb /= bn;

  let variance = 0;
  for (let k = 0; k < border.length; k += 2) {
    const i = (border[k + 1] * w + border[k]) * 4;
    variance += (px[i] - br) ** 2 + (px[i + 1] - bg) ** 2 + (px[i + 2] - bb) ** 2;
  }
  variance = Math.sqrt(variance / (bn * 3));
  // 背景太花（比如沙发、草地），纯色抠图容易啃掉猫，直接做成照片卡片更稳
  if (variance > 46) return { src: img.src, framed: true };

  const tol = clamp(30 + variance * 1.6, 30, 78);
  const alpha = new Uint8ClampedArray(w * h).fill(255);
  const visited = new Uint8Array(w * h);
  const stack = [];
  const isBg = (i) => Math.hypot(px[i] - br, px[i + 1] - bg, px[i + 2] - bb) <= tol;

  for (let k = 0; k < border.length; k += 2) {
    const x = border[k], y = border[k + 1];
    const idx = y * w + x;
    if (visited[idx] || !isBg(idx * 4)) continue;
    visited[idx] = 1;
    alpha[idx] = 0;
    stack.push(idx);
  }

  while (stack.length) {
    const idx = stack.pop();
    const x = idx % w;
    const y = (idx - x) / w;
    const around = [
      x > 0 ? idx - 1 : -1,
      x < w - 1 ? idx + 1 : -1,
      y > 0 ? idx - w : -1,
      y < h - 1 ? idx + w : -1
    ];
    for (let n = 0; n < 4; n += 1) {
      const next = around[n];
      if (next < 0 || visited[next]) continue;
      if (!isBg(next * 4)) continue;
      visited[next] = 1;
      alpha[next] = 0;
      stack.push(next);
    }
  }

  let clear = 0;
  for (let i = 0; i < alpha.length; i += 1) if (!alpha[i]) clear += 1;
  const ratio = clear / alpha.length;
  // 几乎没抠掉（背景没识别出来）或抠得太狠（猫被当成背景）都退回照片卡片
  if (ratio < 0.06 || ratio > 0.93) return { src: img.src, framed: true };

  const soft = featherMask(alpha, w, h);
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const idx = y * w + x;
      const a = soft[idx];
      px[idx * 4 + 3] = a;
      if (a > 12) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX) return { src: img.src, framed: true };
  const pad = Math.round(Math.min(w, h) * 0.02);
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(w - 1, maxX + pad);
  maxY = Math.min(h - 1, maxY + pad);
  const outW = maxX - minX + 1;
  const outH = maxY - minY + 1;
  if (outW < w * 0.24 || outH < h * 0.24) return { src: img.src, framed: true };

  ctx.putImageData(data, 0, 0);
  const out = document.createElement('canvas');
  out.width = outW;
  out.height = outH;
  out.getContext('2d').drawImage(canvas, minX, minY, outW, outH, 0, 0, outW, outH);
  return { src: out.toDataURL('image/png'), framed: false };
}

function cutoutPhoto(src) {
  if (!src) return Promise.resolve(null);
  if (petCutCache.has(src)) return petCutCache.get(src);
  const task = new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      try { resolve(buildCutout(img)); } catch (err) {
        console.warn('头像抠图失败，改用照片卡片。', err);
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
  petCutCache.set(src, task);
  if (petCutCache.size > 6) petCutCache.delete(petCutCache.keys().next().value);
  return task;
}

function paintPetState(catId, state) {
  document.querySelectorAll(`[data-pet2d][data-id="${catId}"]`).forEach((layer) => {
    layer.dataset.state = state;
    const badge = layer.querySelector('[data-pet-badge]');
    if (badge) badge.textContent = PET_STATE_LABELS[state] || '普通';
  });
  document.querySelectorAll('[data-action="pet-state"]').forEach((button) => {
    button.classList.toggle('active', button.dataset.id === state);
  });
}

function cyclePetState(cat) {
  const rt = getPetRuntime(cat);
  const order = ['idle', 'happy', 'sleep'];
  rt.state = order[(order.indexOf(rt.state) + 1) % order.length];
  paintPetState(cat.id, rt.state);
}

function setPetState(catId, state) {
  if (!PET_STATE_LABELS[state]) return;
  const cat = window.__meow3dCat && window.__meow3dCat(catId);
  if (!cat) return;
  getPetRuntime(cat).state = state;
  paintPetState(cat.id, state);
}

function syncPetLayer(layer, cat) {
  const rt = getPetRuntime(cat);
  if (rt.avatar !== cat.avatar) {
    rt.avatar = cat.avatar;
    rt.src = '';
    rt.framed = false;
    rt.loading = false;
  }
  layer.dataset.state = rt.state;
  const badge = layer.querySelector('[data-pet-badge]');
  if (badge) badge.textContent = PET_STATE_LABELS[rt.state] || '普通';
  const body = layer.querySelector('[data-pet-body]');
  if (body) {
    body.style.setProperty('--pet-x', `${rt.x}px`);
    body.style.setProperty('--pet-y', `${rt.y}px`);
  }
  const img = layer.querySelector('[data-pet-img]');
  if (!img) return;
  if (rt.src) {
    if (img.getAttribute('src') !== rt.src) img.src = rt.src;
    layer.classList.toggle('is-framed', !!rt.framed);
    layer.classList.add('is-ready');
    return;
  }
  if (rt.loading) return;
  rt.loading = true;
  const avatar = cat.avatar;
  cutoutPhoto(avatar).then((result) => {
    rt.loading = false;
    if (!document.contains(layer) || rt.avatar !== avatar) return;
    if (!result) {
      rt.src = avatar;
      rt.framed = true;
    } else {
      rt.src = result.src;
      rt.framed = result.framed;
    }
    img.src = rt.src;
    layer.classList.toggle('is-framed', rt.framed);
    layer.classList.add('is-ready');
  });
}

function attachPetControls(layer, stage, cat) {
  const body = layer.querySelector('[data-pet-body]');
  if (!body) return;
  const rt = getPetRuntime(cat);
  let dragging = false;
  let moved = false;
  let startX = 0, startY = 0, baseX = 0, baseY = 0;

  body.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    dragging = true;
    moved = false;
    startX = event.clientX;
    startY = event.clientY;
    baseX = rt.x;
    baseY = rt.y;
    body.classList.add('dragging');
    try { body.setPointerCapture(event.pointerId); } catch (_) { /* noop */ }
    event.stopPropagation();
  });

  body.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (!moved && Math.abs(dx) + Math.abs(dy) > 5) moved = true;
    if (!moved) return;
    // 桌面宠物的拖动：活动范围仍然限制在头像框内
    const limitX = Math.max(6, stage.clientWidth * 0.17);
    const limitY = Math.max(4, stage.clientHeight * 0.11);
    rt.x = clamp(baseX + dx, -limitX, limitX);
    rt.y = clamp(baseY + dy, -limitY, limitY);
    body.style.setProperty('--pet-x', `${rt.x}px`);
    body.style.setProperty('--pet-y', `${rt.y}px`);
    event.preventDefault();
  });

  const finish = (event) => {
    if (!dragging) return;
    dragging = false;
    body.classList.remove('dragging');
    try { body.releasePointerCapture(event.pointerId); } catch (_) { /* noop */ }
    if (!moved) cyclePetState(cat);
    event.stopPropagation();
  };
  body.addEventListener('pointerup', finish);
  body.addEventListener('pointercancel', finish);

  // 宠物身上的一切点击都不应触发「上传头像」，换照片走右下角相机
  layer.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  layer.addEventListener('contextmenu', (event) => event.preventDefault());
}

function ensurePetLayer(stage, cat) {
  let layer = stage.querySelector('[data-pet2d]');
  if (layer && layer.dataset.id !== cat.id) {
    layer.remove();
    layer = null;
  }
  if (!layer) {
    layer = document.createElement('div');
    layer.className = 'pet2d';
    layer.dataset.pet2d = '1';
    layer.dataset.id = cat.id;
    layer.innerHTML = `<div class="pet2d-body" data-pet-body>
      <div class="pet2d-shadow"></div>
      <div class="pet2d-art">
        <img class="pet2d-img" alt="${escapeAttr(cat.name)} 的照片" draggable="false" data-pet-img>
        <span class="pet2d-fx" aria-hidden="true">
          <i class="fx-heart"></i><i class="fx-heart"></i><i class="fx-heart"></i>
          <i class="fx-zzz">Z</i><i class="fx-zzz">Z</i><i class="fx-zzz">Z</i>
        </span>
      </div>
    </div>
    <span class="pet2d-badge" data-pet-badge>普通</span>`;
    stage.appendChild(layer);
    attachPetControls(layer, stage, cat);
  }
  syncPetLayer(layer, cat);
  return layer;
}

function syncPetLayers() {
  document.querySelectorAll('[data-3d-cat]').forEach((canvas) => {
    const stage = canvas.parentElement;
    const cat = window.__meow3dCat && window.__meow3dCat(canvas.dataset.id);
    if (!stage || !cat) return;
    const mode = getPetMode(cat);
    stage.dataset.petMode = mode;
    if (mode === 'photo' && cat.avatar) ensurePetLayer(stage, cat);
    else {
      const layer = stage.querySelector('[data-pet2d]');
      if (layer) layer.remove();
    }
  });
}

function refresh3D() {
  for (const canvas of Array.from(scenes.keys())) {
    if (!canvas.isConnected) disposeScene(canvas);
  }
  document.querySelectorAll('[data-3d-cat]').forEach((canvas) => {
    const cat = window.__meow3dCat && window.__meow3dCat(canvas.dataset.id);
    if (!cat) return;
    // 真实头像模式暂停 WebGL 渲染（不销毁 context，切回来才能直接复用）
    if (getPetMode(cat) !== 'model') {
      canvas.style.display = 'none';
      const state = scenes.get(canvas);
      if (state) state.hidden = true;
      return;
    }
    canvas.style.display = '';
    const existing = scenes.get(canvas);
    if (existing) {
      existing.hidden = false;
      // 从 display:none 切回来时 ResizeObserver 不一定先触发，主动量一次
      if (existing.resize) existing.resize();
      if (canvas.parentElement) canvas.parentElement.dataset['3dReady'] = '1';
      return;
    }
    const created = catScene(canvas, cat);
    if (created && canvas.parentElement) canvas.parentElement.dataset['3dReady'] = '1';
  });
  document.querySelectorAll('[data-shop-3d]').forEach((canvas) => {
    if (scenes.has(canvas)) return;
    const shop = window.__meow3dShop && window.__meow3dShop(canvas.dataset.id);
    const catId = (document.querySelector('[data-3d-cat]') && document.querySelector('[data-3d-cat]').dataset.id)
      || (window.__meow3dCurrentCatId ? window.__meow3dCurrentCatId() : '');
    const cat = window.__meow3dCat && window.__meow3dCat(catId);
    if (shop && cat) shopScene(canvas, shop, cat);
  });
  syncPetLayers();
  syncControls();
}

window.__meowPetMode = (mode) => {
  if (mode !== 'photo' && mode !== 'model') return;
  const panel = document.querySelector('[data-cat3d-panel]');
  const catId = panel ? panel.dataset.id
    : (window.__meow3dCurrentCatId ? window.__meow3dCurrentCatId() : '');
  const cat = window.__meow3dCat && window.__meow3dCat(catId);
  if (!cat) return;
  // 还没有照片时点「真实头像」，直接打开上传，避免用户不知道要先传图
  if (mode === 'photo' && !cat.avatar) {
    const stage = document.querySelector('.cat-stage[data-photo-click]');
    if (stage) stage.click();
    return;
  }
  petModes[cat.id] = mode;
  try { localStorage.setItem(PET_STORE_KEY, JSON.stringify(petModes)); } catch (_) { /* noop */ }
  refresh3D();
};

window.__meowPetState = (state) => {
  const panel = document.querySelector('[data-cat3d-panel]');
  const catId = panel ? panel.dataset.id
    : (window.__meow3dCurrentCatId ? window.__meow3dCurrentCatId() : '');
  if (catId) setPetState(catId, state);
};

window.__meow3dSetMode = (mode) => {
  if (mode !== 'auto' && mode !== 'idle' && !ACTIONS.includes(mode)) return;
  globalMode = mode;
  prefs.forEach((pref) => { pref.mode = mode; pref.switchAt = 0; pref.nextSwitch = 0; });
  syncControls();
};
window.__meow3dZoom = (delta) => {
  globalZoom = clamp(globalZoom + Number(delta || 0), 0.55, 1.95);
  prefs.forEach((pref) => { pref.zoom = globalZoom; });
  syncControls();
};
window.__meow3dReset = () => {
  globalMode = 'auto';
  globalZoom = 1;
  prefs.forEach((pref) => {
    pref.mode = 'auto'; pref.zoom = 1; pref.yaw = 0; pref.pitch = 0;
    pref.offsetX = 0; pref.offsetY = 0; pref.nextSwitch = 0;
  });
  syncControls();
};

window.__meow3dCoat = (key) => {
  const panel = document.querySelector('[data-cat3d-panel]');
  const catId = panel ? panel.dataset.id : '';
  if (!catId) return;
  writeCoatOverride(catId, key);
  const canvas = document.querySelector(`.cat-3d-canvas[data-id="${CSS.escape(catId)}"]`);
  const state = canvas && scenes.get(canvas);
  const cat = window.__meow3dCat && window.__meow3dCat(catId);
  // 场景已经在跑就直接换毛色纹理，绝不重建 WebGL 上下文
  if (state && state.rig && cat) {
    if (key === 'auto') {
      state.rig.applyCoat(coatFrom(breedPreset(cat), cat.avatar || ''));
      startCoatAnalysis(cat, state.rig);
    } else {
      state.rig.applyCoat(coatFrom(presetCoat(key), ''));
    }
    return;
  }
  // 还没建场景（照片模式或没渲染）：覆盖值已存下，等切回 3D 时生效
  refresh3D();
};

window.__refreshMeow3D = refresh3D;
// 多视角照片的毛色校准要复用同一套分析逻辑，避免两套算法给出两种颜色
window.__meow3dAnalyzePhoto = (image) => analyzePhoto(image);
window.__meow3dCalibrateViews = (images, cat) => calibrateViews(images || [], cat || null);
window.__meow3dPatternLabel = (pattern) => PATTERN_LABELS[pattern] || pattern || '';

/* 供 recon/ 重建工作台复用同一套分析与造型逻辑，避免两套算法给出两种毛色。
   加 export 不影响本模块作为 <script type="module"> 直接运行。 */
export {
  analyzePhoto, calibrateViews, coatFrom, buildCatRig, addLights, getShadowTexture,
  presetCoat, breedPreset, PATTERN_LABELS, BREED_PRESETS
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', refresh3D);
} else {
  refresh3D();
}
