/*
 * 编排层：把 Stage 1~4 串成一条可恢复、fail-closed 的流水线。
 * 对应 img2threejs 的 forge/state.py + forge/next.py 的角色：
 * 脚本管状态与门禁，视觉判断只发生在「一张对比图 → pass/fail」这一步。
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  PASS_ORDER, PASS_IDS, createSpec, buildSpecFromEvidence, validateSpec,
  applyFeedback, markPass, appendReview, specForExport, setSubjectGender,
  qualityOf, QUALITY_TIERS
} from './spec.js';
import { loadImage, fileToDataUrl, analyseView, makeViewRecord, mergeViews } from './intake.js';
import { createModel, createLights, createShadow, lightsEnabled } from './factory.js';
import {
  evaluate, renderComparisonSheet, exportSpec, exportCanvas, exportGLB
} from './review.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
const STATE_KEY = 'meow-recon-state-v1';
const MAX_VIEWS = 6;

const state = {
  views: [],
  spec: null,
  gate: null,
  currentPass: 'blockout',
  model: null,
  sheetCanvas: null,
  lastReview: null,
  lights: null,
  shadow: null,
  busy: false,
  me: null,
  writableIds: new Set(),
  blockedIds: new Set(),
  manualIds: [],
  catGenderById: new Map()
};

let lastKnownToken = (window.MeowAPI && window.MeowAPI.getToken()) || '';

/* ---------------- Three.js 场景 ---------------- */
const canvas = $('sceneCanvas');
const renderer = new THREE.WebGLRenderer({
  canvas, antialias: true, alpha: true, preserveDrawingBuffer: true
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene();
scene.background = null;
const camera = new THREE.PerspectiveCamera(38, 4 / 3, 0.1, 100);
camera.position.set(0, 1.04, 3.1);
camera.lookAt(0, 0.72, 0);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.72, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 1.6;
controls.maxDistance = 6;
controls.enablePan = false;

// 基础照明：blockout 也能看清剪影；lighting pass 之后换成 spec 驱动的三点光
const baseAmbient = new THREE.AmbientLight(0xffffff, 0.72);
const baseKey = new THREE.DirectionalLight(0xffffff, 0.85);
baseKey.position.set(2, 3, 3);
scene.add(baseAmbient, baseKey);

function resize() {
  const box = canvas.parentElement;
  if (!box) return;
  const w = Math.max(1, Math.round(box.clientWidth));
  const h = Math.max(1, Math.round(box.clientHeight));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
}
new ResizeObserver(resize).observe(canvas.parentElement);
resize();

let frameTime = 0;
function loop(now) {
  requestAnimationFrame(loop);
  frameTime = now / 1000;
  controls.update();
  if (state.model && state.model.tick) state.model.tick(frameTime);
  renderer.render(scene, camera);
}
requestAnimationFrame(loop);

function renderNow() { renderer.render(scene, camera); }

function setupLights(passId) {
  if (state.lights) { scene.remove(state.lights); state.lights = null; }
  if (state.shadow) { scene.remove(state.shadow); state.shadow = null; }
  const full = lightsEnabled(passId) && !!state.spec;
  baseAmbient.visible = !full;
  baseKey.visible = !full;
  if (full) {
    state.lights = createLights(state.spec);
    state.shadow = createShadow();
    scene.add(state.lights, state.shadow);
    renderer.toneMappingExposure = state.spec.lighting.exposure || 1;
  } else {
    renderer.toneMappingExposure = 1;
  }
}

/* ---------------- 通用 UI ---------------- */
function log(kind, message) {
  const row = document.createElement('div');
  const cls = kind === 'PASS' || kind === 'GATE' || kind === 'EXPORT' ? 'ok'
    : kind === 'BLOCKED' || kind === 'FAIL' || kind === 'ERROR' ? 'bad' : 'info';
  row.className = 'log-row ' + cls;
  const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  row.innerHTML = `<span class="t">${time}</span><span class="k">${esc(kind)}</span><span>${esc(message)}</span>`;
  const host = $('log');
  host.appendChild(row);
  host.scrollTop = host.scrollHeight;
}

function setBusy(flag) {
  state.busy = flag;
  ['btnIntake', 'btnNext', 'btnPrev', 'btnRunAll', 'btnExportGLB'].forEach((id) => {
    const el = $(id); if (el) el.disabled = flag;
  });
  // 写回按钮的可点状态由登录 / 选中猫 / spec 三者共同决定，不能简单跟着 busy 放开
  updateWriteBackUI();
}

/* 性别来源：优先手动覆盖，其次选中猫咪的档案（后端 gender 是「男 / 女」）。 */
function normalizeGender(value) {
  if (value === '男' || value === 'male' || value === '公') return 'male';
  if (value === '女' || value === 'female' || value === '母') return 'female';
  return 'unknown';
}
function genderLabel(g) {
  return { male: '公猫', female: '母猫', unknown: '未知' }[g] || '未知';
}
function currentGender() {
  const override = $('genderSelect').value;
  if (override && override !== 'auto') return override;
  return normalizeGender(state.catGenderById.get($('catSelect').value));
}

function resolveQuality() {
  const tier = $('qualitySelect').value || 'standard';
  const q = qualityOf(tier);
  return { tier, cell: q.cell, strands: q.strands };
}

async function syncQuality(rebuild = true) {
  if (!state.spec) return;
  state.spec.quality = resolveQuality();
  if (rebuild && state.gate && state.gate.ok) {
    await buildPass(state.currentPass, false);
    log('INFO', `精细度=${QUALITY_TIERS[state.spec.quality.tier].label} · 重建当前阶段（cell=${state.spec.quality.cell} · 毛丝=${state.spec.quality.strands}）`);
  }
  updateBuildUI();
}

async function syncGender(rebuild = true) {
  const g = currentGender();
  if (state.spec) {
    setSubjectGender(state.spec, g);
    if (rebuild) {
      await buildPass(state.currentPass, false);
      log('INFO', `性别=${genderLabel(g)}，已重建当前阶段${g === 'male' ? '：公猫蛋蛋已生成' : '（无蛋蛋）'}`);
    }
  }
  updateBuildUI();
  return g;
}

function renderViews() {
  const host = $('viewList');
  host.innerHTML = state.views.map((v, i) => `
    <div class="view-item">
      <img src="${esc(v.dataUrl)}" alt="参考图 ${i + 1}">
      <button class="rm" data-rm="${i}" title="移除">×</button>
      <div class="meta">${esc(v.angle)}<br>${v.width}×${v.height}</div>
    </div>`).join('') || '<span class="muted">还没有上传照片</span>';
}

function renderGate() {
  const host = $('gateReport');
  const g = state.gate;
  if (!g) { host.dataset.state = ''; host.innerHTML = '<span class="muted">等待 intake…</span>'; return; }
  host.dataset.state = g.ok ? 'pass' : 'block';
  const color = g.ok ? 'var(--ok)' : 'var(--bad)';
  let html = `<div class="line"><span class="tag" style="color:${color}">${esc(g.action)}</span>
    <span>阻塞 ${g.failures.length} 项 · 警告 ${g.warnings.length} 项</span></div>`;
  g.failures.forEach((f) => {
    html += `<div class="line"><span class="tag">${esc(f.code)}</span><span>${esc(f.message)} — ${esc(f.nextAction)}</span></div>`;
  });
  g.warnings.forEach((w) => {
    html += `<div class="line"><span class="tag" style="color:var(--warn)">WARN</span><span>${esc(w.message)}</span></div>`;
  });
  html += `<div class="metrics">视角 ${g.metrics.views} · 细节 ${g.metrics.detailCount}（映射率 ${g.metrics.detailCoverage}）· 组件 ${g.metrics.componentCount} · 材质 ${g.metrics.materialCount} · 短边 ${g.metrics.minSide}px · 主体占比 ${g.metrics.subjectCoverage}</div>`;
  host.innerHTML = html;
}

function renderDetails() {
  const host = $('detailList');
  const list = state.spec && state.spec.evidence ? state.spec.evidence.detailInventory : [];
  if (!list.length) { host.innerHTML = '<span class="muted">等待 intake…</span>'; return; }
  host.innerHTML = list.map((d) => `
    <div class="detail-row" title="${esc(d.zone)} / ${esc(d.id)} → ${esc(d.mappedTo)}">
      <span class="k">${esc(d.feature)} → ${esc(d.mappedTo)}${d.inferred ? ' <i>·推断</i>' : ''}</span>
      <span class="v">${esc(d.value)}</span>
      <span class="c">${d.confidence}</span>
    </div>`).join('');
}

function updateRail() {
  $('passRail').innerHTML = PASS_ORDER.map((p, i) => {
    const st = state.spec ? state.spec.passes[p.id].status : (i === 0 ? 'ready' : 'locked');
    const shown = (state.currentPass === p.id && st !== 'passed' && state.spec) ? 'current' : st;
    const label = {
      locked: '未解锁', ready: '待构建', built: '已构建',
      passed: '已通过', failed: '未通过', current: '进行中'
    }[shown] || shown;
    return `<div class="pass-chip" data-status="${esc(shown)}" title="${esc(p.detail)}">
      <span class="n">${String(i + 1).padStart(2, '0')} · ${esc(p.en)}</span>
      <span class="t">${esc(p.label)}</span><span class="s">${label}</span></div>`;
  }).join('');
}

function updateBuildUI() {
  const idx = PASS_IDS.indexOf(state.currentPass);
  const p = PASS_ORDER[idx] || PASS_ORDER[0];
  $('passTitle').textContent = `${p.label} · ${p.en}`;
  $('passDetail').textContent = p.detail;
  $('viewportBadge').textContent = state.spec
    ? `${p.en} · ${state.spec.passes[state.currentPass].status}` : '等待构建';
  const m = state.model;
  const stats = [];
  const g = state.spec ? state.spec.subject.gender : currentGender();
  stats.push(`性别 <b>${genderLabel(g)}${g === 'male' ? ' · 蛋蛋' : ''}</b>`);
  if (m) {
    let visibleMeshes = 0;
    m.root.traverse((o) => { if ((o.isMesh || o.isInstancedMesh) && o.visible) visibleMeshes += 1; });
    stats.push(`网格 <b>${visibleMeshes}/${m.meshCount}</b>`);
    stats.push(`三角面 <b>${m.stats ? m.stats.triangles.toLocaleString() : '—'}</b>`);
    stats.push(`socket <b>${m.runtime ? m.runtime.sockets.length : '—'}</b>`);
    stats.push(`碰撞体 <b>${m.runtime ? m.runtime.colliders.length : '—'}</b>`);
    stats.push(`骨骼绑定 <b>${m.runtime && m.runtime.skeleton ? '是' : '否'}</b>`);
    stats.push(`tick <b>${m.tick ? '已挂载' : '未挂载'}</b>`);
  }
  $('buildStats').innerHTML = stats.map((s) => `<span class="stat">${s}</span>`).join('');
  $('specJson').textContent = state.spec ? JSON.stringify(state.spec, null, 2) : '{}';
  updateWriteBackUI();
}

function showSheet(sheetCanvas) {
  const host = $('sheetHost');
  host.innerHTML = '';
  host.appendChild(sheetCanvas);
}

function updateScores(result) {
  const s = result.scores;
  const ok = (v, threshold) => (v >= threshold ? 'good' : 'bad');
  const items = [
    { l: '色彩 ΔE00', v: s.color === null ? '—' : s.color, c: s.color === null ? '' : ok(s.color, 0.62) },
    { l: '轮廓', v: s.silhouette, c: ok(s.silhouette, 0.62) },
    { l: '细节映射', v: s.detail, c: ok(s.detail, 0.9) },
    { l: '综合', v: s.overall, c: ok(s.overall, 0.62) }
  ];
  $('scoreBoard').innerHTML = items.map((i) =>
    `<div class="score ${i.c}"><div class="v">${i.v}</div><div class="l">${i.l}</div></div>`).join('');
  const swatch = (c) => c
    ? `<i class="swatch" style="background:rgb(${c.r},${c.g},${c.b})"></i>`
    : '<span class="muted">—</span>';
  $('regionTable').innerHTML = `<tr><th>区域</th><th>参考</th><th>渲染</th><th>ΔE00</th></tr>`
    + result.rows.map((r) => `<tr><td>${esc(r.id)}</td><td>${swatch(r.ref)}</td>
        <td>${swatch(r.render)}</td><td>${r.deltaE === null ? '<span class="muted">—</span>' : r.deltaE}</td></tr>`).join('');
}

function updateHistory() {
  const list = state.spec ? state.spec.reviewHistory : [];
  $('reviewList').innerHTML = list.length
    ? list.slice().reverse().map((h) => `
      <div class="history-row">
        <span class="pill ${h.decision === 'pass' ? 'pass' : 'fail'}">${h.decision === 'pass' ? 'PASS' : 'FAIL'}</span>
        <span>${esc(h.pass)} · 第 ${(h.attempt || 0) + 1} 轮</span>
        <span>综合 ${h.scores ? h.scores.overall : '—'}</span>
        <span class="muted">${h.at ? h.at.slice(11, 19) : ''}</span>
      </div>`).join('')
    : '<span class="muted">暂无记录</span>';
}

/* ---------------- 流水线 ---------------- */
async function onFiles(files) {
  const picked = Array.from(files || [])
    .filter((f) => f && f.type.startsWith('image/'))
    .slice(0, MAX_VIEWS - state.views.length);
  for (const file of picked) {
    try {
      const dataUrl = await fileToDataUrl(file);
      const image = await loadImage(dataUrl);
      const record = makeViewRecord(file, dataUrl, image, $('angleSelect').value);
      state.views.push({ ...record, image });
      log('INFO', `载入参考图 ${record.angle} · ${record.width}×${record.height} · ${Math.round(record.bytes / 1024)}KB`);
    } catch (err) {
      log('ERROR', `${file.name}：${err.message}`);
    }
  }
  $('fileInput').value = '';
  renderViews();
}

async function runIntake() {
  if (!state.views.length) { log('BLOCKED', '请先上传至少一张参考图'); return; }
  setBusy(true);
  try {
    const images = state.views.map((v) => v.image);
    const rows = state.views.map((v) => analyseView(v.image, v.angle));
    const evidence = mergeViews(rows, images, '', currentGender());
    const id = 'recon-' + (state.views[0].digest || 'local');
    state.spec = createSpec({ id, name: '重建猫咪', gender: currentGender() });
    state.spec.quality = resolveQuality();
    buildSpecFromEvidence(state.spec, evidence, state.views);
    state.gate = validateSpec(state.spec, { strict: true });
    renderGate(); renderDetails(); updateRail(); updateBuildUI(); updateHistory();
    log('INTAKE', `证据来源 ${evidence.source} · ${evidence.samples} 张 · 花纹 ${evidence.pattern} · 细节 ${evidence.detailInventory.length} 项`);
    log(state.gate.ok ? 'GATE' : 'BLOCKED',
      state.gate.ok
        ? `ALLOW_BUILD · 映射率 ${state.gate.metrics.detailCoverage}，解锁 blockout`
        : `BLOCKED · ${state.gate.failures.map((f) => f.code).join(', ')}，不生成任何 Three.js 代码`);
    state.gate.warnings.forEach((w) => log('WARN', w.message));
    if (state.gate.ok) await buildPass('blockout', true);
  } catch (err) {
    log('ERROR', 'intake 失败：' + err.message);
  } finally {
    setBusy(false);
  }
}

async function buildPass(passId, doReview = true) {
  if (!state.spec || !state.gate || !state.gate.ok) {
    log('BLOCKED', 'spec 未通过严格门禁，禁止构建');
    return false;
  }
  state.currentPass = passId;
  if (state.model) { state.model.dispose(); state.model = null; }
  state.model = createModel(state.spec, passId);
  scene.add(state.model.root);
  const cam = state.spec.camera;
  camera.fov = cam.fov || 38;
  camera.position.fromArray(cam.position);
  camera.lookAt(new THREE.Vector3().fromArray(cam.target));
  camera.updateProjectionMatrix();
  setupLights(passId);
  renderNow();
  updateBuildUI(); updateRail();
  log('BUILD', `${passId} · mesh ${state.model.meshCount} · socket ${state.model.runtime ? state.model.runtime.sockets.length : 0}`);
  return doReview ? reviewPass(passId) : true;
}

async function reviewPass(passId, attempt = 0) {
  renderNow();
  const result = evaluate(state.spec, renderer.domElement, state.gate, passId);
  const ref = state.views[0] && state.views[0].image;
  state.lastReview = result;
  if (ref) {
    state.sheetCanvas = renderComparisonSheet(ref, renderer.domElement, {
      angle: state.views[0].angle,
      pass: passId,
      scores: result.scores,
      meanDE: result.meanDE,
      decision: result.decision,
      focus: result.focus
    });
    showSheet(state.sheetCanvas);
  }
  updateScores(result);
  log(result.decision === 'pass' ? 'PASS' : 'FAIL',
    `${passId} · 第 ${attempt + 1} 轮 · ΔE00 ${result.meanDE} · 综合 ${result.scores.overall}`);

  // 有界自纠正：只改材质颜色，最多 2 轮，绝不改几何与结构
  if (result.decision === 'fail' && attempt < 2 && result.feedback.length && ref) {
    const applied = applyFeedback(state.spec, result.feedback);
    appendReview(state.spec, {
      pass: passId, decision: 'fail', attempt, scores: result.scores,
      meanDE: result.meanDE, feedback: applied
    });
    log('SELF-FIX', `应用 ${applied.length} 条有界修正：${applied.map((a) => a.target).join(', ')}`);
    updateBuildUI(); updateHistory();
    await buildPass(passId, false);
    return reviewPass(passId, attempt + 1);
  }

  appendReview(state.spec, {
    pass: passId, decision: result.decision, attempt, scores: result.scores,
    meanDE: result.meanDE, feedback: []
  });
  markPass(state.spec, passId, result.decision === 'pass' ? 'passed' : 'failed');
  updateRail(); updateBuildUI(); updateHistory();
  return result.decision === 'pass';
}

async function runAll() {
  if (!state.gate || !state.gate.ok) { log('BLOCKED', '先运行 intake 并通过门禁'); return; }
  setBusy(true);
  try {
    PASS_IDS.forEach((id, i) => {
      state.spec.passes[id] = { status: i === 0 ? 'ready' : 'locked', attempts: 0, at: null };
    });
    state.spec.reviewHistory = [];
    log('INFO', '开始逐阶段构建：8 个 pass，每个 pass 独立评审');
    for (const passId of PASS_IDS) {
      const ok = await buildPass(passId, true);
      if (!ok) { log('BLOCKED', `${passId} 评审未通过，按 fail-closed 停止，不静默降级`); break; }
      await new Promise((r) => setTimeout(r, 40));
    }
    log('DONE', `流水线结束 · 已通过 ${PASS_IDS.filter((id) => state.spec.passes[id].status === 'passed').length} / ${PASS_IDS.length} 阶段`);
  } finally {
    setBusy(false);
  }
}

function resetAll() {
  if (state.model) { state.model.dispose(); state.model = null; }
  state.views = []; state.spec = null; state.gate = null;
  state.sheetCanvas = null; state.lastReview = null;
  state.currentPass = 'blockout';
  setupLights('blockout');
  renderViews(); renderGate(); renderDetails(); updateRail(); updateBuildUI();
  updateHistory();
  $('sheetHost').innerHTML = '<span class="muted">等待首次评审…</span>';
  $('scoreBoard').innerHTML = '';
  $('regionTable').innerHTML = '';
  log('INFO', '流水线已重置');
}

/* ---------------- 主站接入 ----------------
 * 后端 server-api.js 有全局登录门槛：未登录时 /api/* 一律 401。
 * 所以这里不静默失败，而是把「登录 → 拉取 → 分组 → 写回」做成闭环：
 * 可直接在页面登录；列表区分「我的猫（可写）」与「别人的猫（只读）」；
 * 未登录也能手动填 ID；切回主站登录后自动刷新。
 */
function setSiteStatus(text, kind) {
  const host = $('siteStatus');
  host.textContent = text;
  host.dataset.state = kind || '';
}

function renderLoginState(me) {
  $('loginBox').dataset.state = me ? 'ok' : 'guest';
  $('btnSiteLogin').textContent = me ? '切换账号' : '登录';
  $('loginTip').innerHTML = me
    ? `当前登录：<b>${esc(me.nickname || me.phone || me.id)}</b>。切换账号会重新读取猫咪列表。`
    : '演示账号 13800000001 ~ 13800000007，密码均为 <code>123456</code>。也可在主站登录后回来点「刷新列表」。';
}

function updateWriteBackUI() {
  const id = $('catSelect').value;
  const blocked = state.blockedIds.has(id);
  let reason = '';
  if (!id) reason = '请先选择一只猫咪';
  else if (!state.me) reason = '请先在上方登录主站';
  else if (blocked) reason = '只能写回自己的猫咪档案';
  else if (!state.spec) reason = '请先运行 intake 生成 spec';
  $('btnWriteBack').disabled = !!reason || state.busy;
  $('btnWriteBack').title = reason;
}

async function loadCats() {
  const api = window.MeowAPI;
  const token = api && api.getToken();
  let me = null;
  if (token) {
    try {
      const r = await api.get('/api/auth/me');
      me = r.user || null;
    } catch (err) {
      log('WARN', `主站登录态已失效（${err.status || ''} ${err.message}），请重新登录`);
    }
  }
  state.me = me;
  renderLoginState(me);

  let mine = [], others = [];
  if (me) {
    try {
      const ov = await api.get('/api/me/overview');
      mine = (ov.cats || []).filter((c) => c && c.id);
    } catch (err) { log('WARN', '读取「我的猫咪」失败：' + err.message); }
    try {
      const all = await api.get('/api/cats/search?q=');
      others = (all.cats || []).filter((c) => c && c.id && c.ownerId !== me.id);
    } catch (err) { log('WARN', '读取公开猫咪失败：' + err.message); }
  }

  state.writableIds = new Set(mine.map((c) => c.id));
  state.blockedIds = new Set(others.map((c) => c.id));
  [].concat(mine, others).forEach((c) => state.catGenderById.set(c.id, c.gender));

  const select = $('catSelect');
  const previous = select.value;
  const label = (c) => `${esc(c.name || c.id)}${c.breed ? ' · ' + esc(c.breed) : ''}`;
  const html = ['<option value="">选择猫咪…</option>'];
  if (mine.length) {
    html.push('<optgroup label="我的猫咪（可写入）">'
      + mine.map((c) => `<option value="${esc(c.id)}">${label(c)}</option>`).join('')
      + '</optgroup>');
  }
  if (others.length) {
    html.push('<optgroup label="其他家长公开的猫（仅浏览）">'
      + others.map((c) => `<option value="${esc(c.id)}">${label(c)}</option>`).join('')
      + '</optgroup>');
  }
  if (!mine.length && !others.length) {
    html.push(`<option value="" disabled>${me ? '这个账号下还没有猫咪，可在主站录入' : '未登录：请先在上方登录，或手动输入猫咪 ID'}</option>`);
  }
  select.innerHTML = html.join('');
  // 保留用户手动加入的 ID，刷新列表后不丢
  (state.manualIds || []).forEach((entry) => {
    const opt = document.createElement('option');
    opt.value = entry.id;
    opt.textContent = entry.label;
    opt.dataset.manual = '1';
    select.appendChild(opt);
  });
  if (previous && Array.from(select.options).some((o) => o.value === previous)) {
    select.value = previous;
  }

  if (me) {
    setSiteStatus(`已连接主站：我的猫 ${mine.length} 只（可写入），另有 ${others.length} 只公开猫咪仅可浏览。`, 'ok');
  } else {
    setSiteStatus('未登录主站，下拉暂时没有猫咪可选。请在上方直接登录，或手动输入猫咪 ID；写回仍需登录。', 'warn');
  }
  updateWriteBackUI();
  return { me, mine: mine.length, others: others.length };
}

async function siteLogin() {
  const phone = $('loginPhone').value.trim();
  const password = $('loginPassword').value;
  if (!phone || !password) { setSiteStatus('请填写手机号和密码。', 'warn'); return; }
  try {
    const r = await window.MeowAPI.post('/api/auth/login', { phone, password });
    window.MeowAPI.setToken(r.token);
    lastKnownToken = r.token;
    $('loginPassword').value = '';
    log('EXPORT', `已登录主站：${r.user.nickname || r.user.phone || r.user.id}`);
    const result = await loadCats();
    setSiteStatus(`登录成功，已载入 ${result.mine} 只自己的猫咪（另有 ${result.others} 只仅可浏览）。`, 'ok');
  } catch (err) {
    setSiteStatus('登录失败：' + err.message, 'bad');
    log('ERROR', '主站登录失败：' + err.message);
  }
}

async function useManualCatId() {
  const id = $('manualCatId').value.trim();
  if (!id) { setSiteStatus('请先填写猫咪 ID。', 'warn'); return; }
  state.manualIds = (state.manualIds || []).filter((x) => x.id !== id);
  let label = `${id}（手动）`;
  state.blockedIds.delete(id);
  if (state.me) {
    try {
      const r = await window.MeowAPI.get(`/api/cats/${encodeURIComponent(id)}`);
      if (r.cat) {
        if (r.cat.name) label = `${r.cat.name}（手动 · ${id}）`;
        if (r.cat.gender) state.catGenderById.set(id, r.cat.gender);
        if (r.cat.ownerId && r.cat.ownerId !== state.me.id) state.blockedIds.add(id);
      }
    } catch (_) { /* ID 不存在就保留输入，写回时由后端给出明确错误 */ }
  }
  state.manualIds.push({ id, label });
  const opt = document.createElement('option');
  opt.value = id;
  opt.textContent = label;
  opt.dataset.manual = '1';
  $('catSelect').appendChild(opt);
  $('catSelect').value = id;
  setSiteStatus(state.me ? `已选中手动 ID：${id}` : `已加入手动 ID：${id}；写回前仍需登录。`, state.me ? 'ok' : 'warn');
  updateWriteBackUI();
}

async function writeBack() {
  const catId = $('catSelect').value;
  if (!catId) { setSiteStatus('请先选择一只猫咪。', 'warn'); return; }
  if (!state.spec) { setSiteStatus('还没有 spec，先运行 intake。', 'warn'); return; }
  if (!window.MeowAPI || !state.me) { setSiteStatus('请先在上方登录主站，再写回。', 'warn'); return; }
  if (state.blockedIds.has(catId)) { setSiteStatus('这不是你的猫咪，只能写回自己的档案。', 'bad'); return; }
  setBusy(true);
  try {
    const payload = {
      recon: {
        status: 'done',
        method: 'spec-driven-procedural',
        generator: state.spec.generator,
        passes: state.spec.passes,
        spec: specForExport(state.spec),
        updatedAt: new Date().toISOString()
      }
    };
    await window.MeowAPI.patch(`/api/cats/${encodeURIComponent(catId)}`, payload);
    setSiteStatus(`已写入 ${catId} 的 cat.recon，主站下次读取即可拿到 spec。`, 'ok');
    log('EXPORT', `spec 已写回主站猫咪 ${catId}`);
  } catch (err) {
    setSiteStatus('写入失败：' + err.message, 'bad');
    log('ERROR', '写回主站失败：' + err.message);
  } finally {
    setBusy(false);
  }
}

/* ---------------- 状态存取 ---------------- */
function saveState() {
  if (!state.spec) { log('WARN', '没有可保存的 spec'); return; }
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify({ spec: state.spec, savedAt: new Date().toISOString() }));
    log('INFO', '状态已保存到 localStorage（不含照片原始数据）');
  } catch (err) { log('ERROR', '保存失败：' + err.message); }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) { log('WARN', '没有已保存的状态'); return; }
    state.spec = JSON.parse(raw).spec;
    // 兼容旧版保存的状态：补上后来新增的性别字段，否则门禁会判 GENDER 不合法
    if (!state.spec.subject) state.spec.subject = {};
    if (!state.spec.subject.gender) state.spec.subject.gender = 'unknown';
    state.gate = validateSpec(state.spec, { strict: true });
    const last = PASS_IDS.filter((id) => state.spec.passes[id].status === 'passed').pop()
      || nextReady() || 'blockout';
    state.currentPass = last;
    renderGate(); renderDetails(); updateHistory(); updateRail();
    if (state.gate.ok) buildPass(last, false);
    updateBuildUI();
    log('INFO', `状态已恢复 · 当前阶段 ${last}（照片未保存，重新评审需再次上传）`);
  } catch (err) { log('ERROR', '载入状态失败：' + err.message); }
}
function nextReady() { return PASS_IDS.find((id) => state.spec.passes[id].status === 'ready'); }

/* ---------------- 事件绑定 ---------------- */
$('fileInput').addEventListener('change', (e) => onFiles(e.target.files));
$('viewList').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-rm]');
  if (!btn) return;
  state.views.splice(Number(btn.dataset.rm), 1);
  renderViews();
});
$('btnIntake').addEventListener('click', runIntake);
$('btnClear').addEventListener('click', () => { state.views = []; renderViews(); log('INFO', '已清空参考图'); });
$('btnRunAll').addEventListener('click', runAll);
$('btnReset').addEventListener('click', resetAll);
$('btnSaveState').addEventListener('click', saveState);
$('btnLoadState').addEventListener('click', loadState);

$('btnNext').addEventListener('click', async () => {
  if (!state.gate || !state.gate.ok) { log('BLOCKED', '先运行 intake 并通过门禁'); return; }
  const cur = state.spec.passes[state.currentPass].status;
  if (cur === 'failed') { log('INFO', '当前阶段未通过，重跑当前阶段'); await buildPass(state.currentPass, true); return; }
  if (cur !== 'passed') { log('BLOCKED', `当前阶段 ${state.currentPass} 尚未通过评审，门禁不予放行`); return; }
  const idx = PASS_IDS.indexOf(state.currentPass);
  if (idx + 1 >= PASS_IDS.length) { log('INFO', '已经是最后一个阶段，可以导出产物了'); return; }
  if (state.spec.passes[PASS_IDS[idx + 1]].status === 'locked') {
    log('BLOCKED', '下一阶段仍被锁定'); return;
  }
  setBusy(true);
  try { await buildPass(PASS_IDS[idx + 1], true); } finally { setBusy(false); }
});

$('btnPrev').addEventListener('click', async () => {
  const idx = PASS_IDS.indexOf(state.currentPass);
  if (idx <= 0) { log('INFO', '已经是第一个阶段'); return; }
  setBusy(true);
  try { await buildPass(PASS_IDS[idx - 1], false); } finally { setBusy(false); }
});

$('btnCopySpec').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('specJson').textContent);
    log('EXPORT', 'spec JSON 已复制到剪贴板');
  } catch (_) { log('WARN', '复制失败，请手动选中文本'); }
});

$('btnExportSpec').addEventListener('click', () => {
  if (!state.spec) { log('WARN', '还没有 spec'); return; }
  exportSpec(state.spec); log('EXPORT', '已导出 spec.json');
});
$('btnExportSheet').addEventListener('click', () => {
  if (!state.sheetCanvas) { log('WARN', '还没有对比图'); return; }
  exportCanvas(state.sheetCanvas, `${state.spec.subject.id}.comparison.png`);
  log('EXPORT', '已导出对比图 PNG');
});
$('btnExportGLB').addEventListener('click', async () => {
  if (!state.model || !state.spec) { log('WARN', '请先构建模型'); return; }
  setBusy(true);
  try {
    const r = await exportGLB(state.model.root, state.spec);
    log('EXPORT', `GLB 已导出 · ${Math.round(r.bytes / 1024)}KB · ${r.meshes} 个网格`);
  } catch (err) {
    log('ERROR', `GLB 导出失败：${err.message}（可先导出 spec.json 与对比图）`);
  } finally { setBusy(false); }
});

$('btnLoadCats').addEventListener('click', () => loadCats().catch((err) => {
  setSiteStatus('刷新猫咪列表失败：' + err.message, 'bad');
  log('ERROR', '刷新猫咪列表失败：' + err.message);
}));
$('btnSiteLogin').addEventListener('click', siteLogin);
$('btnUseManualId').addEventListener('click', useManualCatId);
$('btnWriteBack').addEventListener('click', writeBack);
$('catSelect').addEventListener('change', () => {
  updateWriteBackUI();
  const g = currentGender();
  $('genderSelect').title = `档案性别：${genderLabel(g)}`;
  syncGender(true).catch((err) => log('ERROR', '切换猫咪失败：' + err.message));
});
$('genderSelect').addEventListener('change', () => {
  syncGender(true).catch((err) => log('ERROR', '切换性别失败：' + err.message));
});
$('qualitySelect').addEventListener('change', () => {
  syncQuality(true).catch((err) => log('ERROR', '切换精细度失败：' + err.message));
});
// 视角预设：正面 / 侧面 / 背面（看尾巴与蛋蛋）/ 俯视
const VIEW_PRESETS = {
  front: { pos: [0, 1.04, 3.1], tgt: [0, 0.72, 0] },
  side:  { pos: [3.0, 0.95, 0.05], tgt: [0, 0.66, 0] },
  back:  { pos: [0, 1.0, -3.1], tgt: [0, 0.72, 0] },
  top:   { pos: [0.02, 3.0, 0.02], tgt: [0, 0.5, -0.1] }
};
document.querySelectorAll('.view-presets .vp').forEach((btn) => {
  btn.addEventListener('click', () => {
    const v = VIEW_PRESETS[btn.dataset.view];
    if (!v) return;
    camera.position.set(...v.pos);
    controls.target.set(...v.tgt);
    camera.lookAt(...v.tgt);
    controls.update();
    document.querySelectorAll('.view-presets .vp').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    renderNow();
  });
});
$('loginForm').addEventListener('submit', (e) => { e.preventDefault(); siteLogin(); });
$('manualCatId').addEventListener('keydown', (e) => { if (e.key === 'Enter') useManualCatId(); });

// 在主站登录后切回来：token 变了就自动重拉列表，不用手动点刷新
window.addEventListener('focus', () => {
  const current = (window.MeowAPI && window.MeowAPI.getToken()) || '';
  if (current !== lastKnownToken) {
    lastKnownToken = current;
    loadCats().catch(() => {});
  }
});
$('btnClearLog').addEventListener('click', () => { $('log').innerHTML = ''; });

/* ---------------- 初始渲染 ---------------- */
renderViews(); renderGate(); renderDetails(); updateRail(); updateBuildUI(); updateHistory();
log('READY', '工作台就绪 · 上传参考图后运行 intake');
loadCats().catch((err) => {
  setSiteStatus('读取猫咪列表失败：' + err.message, 'bad');
  log('ERROR', 'loadCats：' + err.message);
});
