(() => {
  'use strict';

  const LS_KEY = 'meow-kart-state-v1';

  const CATS = [
    { id: 'tuan', name: '团子', age: 3, gender: '女', breed: '三花猫', color: '#f2a65a', color2: '#f7d6a3', belly: '#fff3df', weight: 3.8, poop: 2, pee: 5, protein: 0.06 },
    { id: 'mimi', name: '米咪', age: 2, gender: '女', breed: '英短蓝猫', color: '#7f9db9', color2: '#b9cadd', belly: '#eaf1f7', weight: 3.2, poop: 2, pee: 6, protein: 0.08 },
    { id: 'doudou', name: '豆豆', age: 4, gender: '男', breed: '橘猫', color: '#e8903f', color2: '#f6c07a', belly: '#fff0d8', weight: 4.5, poop: 1, pee: 4, protein: 0.11 }
  ];

  const NEIGHBORS = [
    { id: 'xia', name: '夏豆豆', gender: '男', age: 3, breed: '奶牛猫', color: '#5a6770', color2: '#a8b6bd', belly: '#eef3f5', weight: 3.5, poop: 2, pee: 5, protein: 0.08 },
    { id: 'leaf', name: '小叶子', gender: '女', age: 2, breed: '虎斑猫', color: '#8ba968', color2: '#c5d6a5', belly: '#f5f9eb', weight: 3.2, poop: 2, pee: 5, protein: 0.07 },
    { id: 'zhang', name: '张二咪', gender: '男', age: 4, breed: '橘猫', color: '#e8a04c', color2: '#f7ca83', belly: '#fff0d8', weight: 5.2, poop: 3, pee: 7, protein: 0.12 },
    { id: 'san', name: '张三咪', gender: '女', age: 3, breed: '狸花猫', color: '#c18e6a', color2: '#dfb596', belly: '#fff3e8', weight: 4.7, poop: 2, pee: 5, protein: 0.19 }
  ];
  const NORMAL_NEIGHBORS = NEIGHBORS.filter((item) => item.weight <= 4.3 && item.protein <= 0.12);
  const ABNORMAL_NEIGHBORS = NEIGHBORS.filter((item) => item.weight > 4.3 || item.protein > 0.12);

  const PLACES = [
    { id: 'pond', name: '池塘', cost: 120, desc: '荷叶船、小鱼干和晒太阳的芦苇岸', funText: '在荷叶船上捞到了一条会发光的鱼干' },
    { id: 'landmark', name: '名胜古迹', cost: 180, desc: '城楼、古塔和猫爪印石板路', funText: '爬上城楼拍下一张标准游客照' },
    { id: 'school', name: '学校', cost: 100, desc: '喵星课堂、图书角和午睡垫', funText: '认真听了一节小鱼干物理课' },
    { id: 'hospital', name: '医院', cost: 150, desc: '体检室、健康小旗和薄荷糖', funText: '完成了全身体检并拿到健康小旗' },
    { id: 'mall', name: '商场', cost: 220, desc: '玻璃橱窗、试衣间和猫咪电梯', funText: '试了十顶帽子，逛到尾巴打转' },
    { id: 'snack', name: '小吃街', cost: 160, desc: '奶茶摊、烧烤摊和章鱼小丸子', funText: '一口气打卡三条小吃街，肚皮圆滚滚' }
  ];

  const ITEMS = [
    { id: 'scarf', name: '毛线围巾', kind: 'outfit', price: 120, desc: '软乎乎的保暖围巾' },
    { id: 'hat', name: '小礼帽', kind: 'outfit', price: 160, desc: '去商场拍照的绅士帽' },
    { id: 'board', name: '猫抓板', kind: 'furniture', price: 90, desc: '磨爪又解压的波浪板' },
    { id: 'treats', name: '小鱼干礼包', kind: 'food', price: 80, desc: '旅行路上最爱的零食' },
    { id: 'medkit', name: '便携药箱', kind: 'health', price: 200, desc: '出门看病不怕手忙脚乱' },
    { id: 'card', name: '旅行明信片', kind: 'souvenir', price: 150, desc: '把去过的地点寄回家' }
  ];

  const REWARD_RULES = [
    { label: '体重贴近同龄平均', ideal: '3.6kg', reward: 200 },
    { label: '排便次数正常', ideal: '2 次/日', reward: 80 },
    { label: '排尿次数正常', ideal: '5 次/日', reward: 60 },
    { label: '蛋白质浓度正常', ideal: '0.08', reward: 120 }
  ];

  const PHOTO_REWARDS = { withOwner: 30, friend: 50, outfit: 40 };
  const TABS = [
    { id: 'profile', label: '猫咪档案' },
    { id: 'travel', label: '旅行打卡' },
    { id: 'market', label: '喵星市集' },
    { id: 'feed', label: '喵推广场' }
  ];

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function neighborIdFromPath() {
    const source = window.location.protocol === 'file:' ? window.location.hash : window.location.pathname;
    const match = source.match(/^#?\/neighbor\/([a-z0-9-]+)\/?$/i);
    return match ? match[1] : null;
  }

  function setLocation(path) {
    if (window.location.protocol === 'file:') {
      window.location.hash = path === '/' ? '#/' : `#${path}`;
    } else {
      history.pushState({}, '', path);
    }
  }

  function nowLabel() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function todayText() {
    const d = new Date();
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return `${d.getMonth() + 1}月${d.getDate()}日 ${days[d.getDay()]}`;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function defaultState() {
    return {
      tab: 'profile',
      currentCatId: 'tuan',
      viewingNeighbor: null,
      cats: CATS.map((cat) => ({ ...cat })),
      balance: 620,
      healthSyncs: 0,
      lastSync: '今天 08:30',
      inventory: [],
      placeImages: {},
      draft: { kind: 'trip', placeId: 'snack', caption: '', photo: '' },
      trips: [
        { id: uid(), catId: 'tuan', placeId: 'snack', time: '昨天 19:42', note: '打卡小吃街' },
        { id: uid(), catId: 'mimi', placeId: 'mall', time: '前天 14:10', note: '逛商场' }
      ],
      feed: [
        { id: uid(), catId: 'tuan', kind: 'trip', placeId: 'snack', caption: '被小吃街的风味封印了，今晚要抱着小鱼干睡觉。', likes: 18, comments: [{ author: '鱼丸爸爸', text: '求带同款路线', time: '昨天 20:01' }], time: '昨天 19:42' },
        { id: uid(), catId: 'mimi', kind: 'friend', placeId: 'pond', caption: '和隔壁的小橘猫交换了猫抓板，友情达成。', likes: 24, comments: [], time: '昨天 16:08' },
        { id: uid(), catId: 'doudou', kind: 'withOwner', placeId: 'landmark', caption: '和主人一起看晚霞，今天也是被爱包围的喵。', likes: 31, comments: [], time: '前天 18:20' }
      ],
      message: ''
    };
  }

  function loadState() {
    const base = defaultState();
    try {
      const saved = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
      if (!saved) return base;
      return {
        ...base,
        ...saved,
        cats: Array.isArray(saved.cats) ? saved.cats : base.cats,
        trips: Array.isArray(saved.trips) ? saved.trips : base.trips,
        inventory: Array.isArray(saved.inventory) ? saved.inventory : base.inventory,
        feed: Array.isArray(saved.feed) ? saved.feed : base.feed,
        draft: { ...base.draft, ...(saved.draft || {}) }
      };
    } catch (_) {
      return base;
    }
  }

  let state = loadState();
  const routeNeighborId = neighborIdFromPath();
  if (routeNeighborId) {
    state.viewingNeighbor = routeNeighborId;
  }
  let cropSession = null;

  function save() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch (_) {
      // localStorage 不可用时继续以内存状态运行
    }
  }

  function catById(id) {
    return state.cats.find((cat) => cat.id === id) || state.cats[0];
  }

  function neighborById(id) {
    return NEIGHBORS.find((item) => item.id === id) || NEIGHBORS[0];
  }

  function linkifyNeighbor(text) {
    let out = escapeHtml(text);
    NEIGHBORS.forEach((neighbor) => {
      const token = escapeHtml(neighbor.name);
      const link = `<button type="button" class="inline-link" data-action="goto-neighbor" data-id="${neighbor.id}">${token}</button>`;
      out = out.split(token).join(link);
    });
    return out;
  }

  function placeById(id) {
    return PLACES.find((place) => place.id === id) || PLACES[0];
  }

  function itemById(id) {
    return ITEMS.find((item) => item.id === id);
  }

  function totalLikes() {
    return state.feed.reduce((sum, post) => sum + post.likes, 0);
  }

  function closeness(value, ideal) {
    if (!ideal) return 100;
    return Math.max(0, Math.min(100, Math.round(100 - (Math.abs(value - ideal) / ideal) * 100)));
  }

  function healthScore(cat) {
    const parts = [
      closeness(cat.weight, 3.6),
      closeness(cat.poop, 2),
      closeness(cat.pee, 5),
      closeness(cat.protein, 0.08)
    ];
    return Math.max(0, Math.min(100, Math.round(parts.reduce((a, b) => a + b, 0) / 4)));
  }

  function healthReward(cat) {
    const weightNear = closeness(cat.weight, 3.6);
    const poopNear = closeness(cat.poop, 2);
    const peeNear = closeness(cat.pee, 5);
    const proteinNear = closeness(cat.protein, 0.08);
    return Math.round(200 * weightNear / 100 + 80 * poopNear / 100 + 60 * peeNear / 100 + 120 * proteinNear / 100);
  }

  function catGroup(cat, cx = 60, cy = 70, scale = 1) {
    return `<g transform="translate(${cx} ${cy}) scale(${scale})">
      <path d="M-36 -20 L-46 -52 L-22 -34 Z" fill="${cat.color}"/>
      <path d="M36 -20 L46 -52 L22 -34 Z" fill="${cat.color}"/>
      <path d="M-42 -24 L-50 -46 L-26 -32 Z" fill="${cat.color2}"/>
      <path d="M42 -24 L50 -46 L26 -32 Z" fill="${cat.color2}"/>
      <ellipse cx="0" cy="-4" rx="46" ry="36" fill="${cat.color}"/>
      <ellipse cx="0" cy="8" rx="32" ry="25" fill="${cat.belly}"/>
      <path d="M-32 -14 Q-15 -18 -3 -15" stroke="${cat.color2}" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path d="M32 -14 Q15 -18 3 -15" stroke="${cat.color2}" stroke-width="5" fill="none" stroke-linecap="round"/>
      <circle cx="-16" cy="0" r="5.5" fill="#263238"/>
      <circle cx="16" cy="0" r="5.5" fill="#263238"/>
      <circle cx="-14" cy="-2" r="1.8" fill="#fff"/>
      <circle cx="18" cy="-2" r="1.8" fill="#fff"/>
      <path d="M-8 14 Q0 19 8 14" stroke="#263238" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M-26 14 Q-36 13 -42 8" stroke="#9aa8b0" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M-26 20 Q-36 21 -42 27" stroke="#9aa8b0" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M26 14 Q36 13 42 8" stroke="#9aa8b0" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M26 20 Q36 21 42 27" stroke="#9aa8b0" stroke-width="3" fill="none" stroke-linecap="round"/>
    </g>`;
  }

  function catSvg(cat) {
    if (cat.avatar) {
      return `<img class="uploaded-avatar" src="${cat.avatar}" alt="${escapeHtml(cat.name)}">`;
    }
    return `<svg viewBox="0 0 120 120" role="img" aria-label="${escapeHtml(cat.name)}">${catGroup(cat)}</svg>`;
  }

  function placeArt(id) {
    const uploaded = state.placeImages && state.placeImages[id];
    if (uploaded) {
      return `<img class="uploaded-art" src="${uploaded}" alt="场所实拍图">`;
    }
    if (id === 'landmark') {
      return `<svg viewBox="0 0 320 180" role="img" aria-label="名胜古迹">
        <rect width="320" height="180" fill="#cfe8f2"/>
        <circle cx="42" cy="38" r="24" fill="#f8d66d"/>
        <path d="M0 140 L58 94 L40 140 Z" fill="#87b598"/>
        <path d="M64 140 L152 64 L240 140 Z" fill="#6fa486"/>
        <path d="M118 96 L160 56 L202 96 Z" fill="#c96b4a"/>
        <rect x="136" y="96" width="48" height="62" fill="#f3e6d8"/>
        <path d="M124 112 L196 112 L160 148 L132 148 Z" fill="#b74f3d"/>
        <circle cx="160" cy="128" r="6" fill="#f8d66d"/>
      </svg>`;
    }
    if (id === 'school') {
      return `<svg viewBox="0 0 320 180" role="img" aria-label="学校">
        <rect width="320" height="180" fill="#e4f1f7"/>
        <circle cx="276" cy="34" r="26" fill="#f8d66d"/>
        <rect y="140" width="320" height="40" fill="#a7d193"/>
        <path d="M56 72 L120 30 L184 72 Z" fill="#5879a7"/>
        <rect x="70" y="72" width="100" height="86" fill="#f2c8dd"/>
        <rect x="86" y="88" width="24" height="26" fill="#fff" stroke="#d9a8c4"/>
        <rect x="130" y="88" width="24" height="26" fill="#fff" stroke="#d9a8c4"/>
        <rect x="150" y="26" width="5" height="32" fill="#795548"/>
        <path d="M152 20 L170 15 L152 28 Z" fill="#e24d3b"/>
      </svg>`;
    }
    if (id === 'hospital') {
      return `<svg viewBox="0 0 320 180" role="img" aria-label="医院">
        <rect width="320" height="180" fill="#faf0f3"/>
        <circle cx="42" cy="38" r="24" fill="#f8d66d"/>
        <rect y="148" width="320" height="32" fill="#b8d7e5"/>
        <rect x="64" y="62" width="104" height="94" fill="#fdfdfd" stroke="#d2dde7"/>
        <rect x="76" y="76" width="32" height="34" fill="#dff2ff"/>
        <rect x="124" y="76" width="32" height="34" fill="#dff2ff"/>
        <rect x="106" y="120" width="20" height="36" fill="#ef6a59"/>
        <rect x="98" y="128" width="36" height="7" fill="#ef6a59"/>
      </svg>`;
    }
    if (id === 'mall') {
      return `<svg viewBox="0 0 320 180" role="img" aria-label="商场">
        <rect width="320" height="180" fill="#e7eef8"/>
        <circle cx="280" cy="36" r="26" fill="#f8d66d"/>
        <rect y="146" width="320" height="34" fill="#c7d8dd"/>
        <rect x="62" y="44" width="112" height="102" fill="#c8ddf0" stroke="#9eb9d4"/>
        <rect x="78" y="64" width="26" height="30" fill="#f6fbff"/>
        <rect x="134" y="64" width="26" height="30" fill="#f6fbff"/>
        <rect x="78" y="108" width="26" height="30" fill="#f6fbff"/>
        <rect x="134" y="108" width="26" height="30" fill="#f6fbff"/>
        <rect x="108" y="112" width="20" height="22" fill="#ef6a59"/>
        <path d="M240 52 Q252 36 264 52 L270 68 L234 68 Z" fill="#e5a81f"/>
      </svg>`;
    }
    if (id === 'snack') {
      return `<svg viewBox="0 0 320 180" role="img" aria-label="小吃街">
        <rect width="320" height="180" fill="#f9e4d9"/>
        <circle cx="280" cy="34" r="26" fill="#f8d66d"/>
        <rect y="146" width="320" height="34" fill="#d7b6aa"/>
        <rect x="32" y="92" width="86" height="60" fill="#f2a65a"/>
        <path d="M24 92 Q75 46 126 92 Z" fill="#ef6a59"/>
        <rect x="96" y="66" width="7" height="26" fill="#795548"/>
        <circle cx="99" cy="62" r="5" fill="#f2c14e"/>
        <rect x="186" y="92" width="86" height="60" fill="#e5a81f"/>
        <path d="M178 92 Q229 46 280 92 Z" fill="#5879a7"/>
        <rect x="228" y="66" width="7" height="26" fill="#795548"/>
        <circle cx="231" cy="62" r="5" fill="#ef6a59"/>
      </svg>`;
    }
    return `<svg viewBox="0 0 320 180" role="img" aria-label="池塘">
      <rect width="320" height="180" fill="#d7f1f5"/>
      <circle cx="276" cy="34" r="28" fill="#f8d66d"/>
      <path d="M0 92 Q60 76 120 92 T240 92 T320 92 V180 H0 Z" fill="#5bbdca"/>
      <path d="M0 116 Q80 104 160 118 T320 116 V180 H0 Z" fill="#23808f"/>
      <ellipse cx="76" cy="132" rx="24" ry="9" fill="#81c96d"/>
      <ellipse cx="104" cy="120" rx="11" ry="20" fill="#e35f7a"/>
      <path d="M244 142 Q250 132 259 135 L264 128 Q267 136 258 145 Z" fill="#e0a44b"/>
      <path d="M252 137 Q242 141 240 148 M270 141 Q280 144 284 150" stroke="#e0a44b" stroke-width="3" fill="none"/>
      <path d="M36 128 Q42 122 50 124 M44 126 Q38 118 40 110 M50 119 Q57 115 62 119" stroke="#e0a44b" stroke-width="3" fill="none"/>
    </svg>`;
  }

  function friendArt() {
    const friend = { color: '#67a96c', color2: '#b7d8a8', belly: '#f6fbef' };
    return `<svg viewBox="0 0 320 180" role="img" aria-label="朋友合照">
      <rect width="320" height="180" fill="#d8f0cb"/>
      <circle cx="286" cy="34" r="26" fill="#f8d66d"/>
      <rect y="144" width="320" height="36" fill="#8bc27e"/>
      ${catGroup(catById(state.currentCatId), 96, 104, 0.78)}
      ${catGroup(friend, 230, 104, 0.78)}
    </svg>`;
  }

  function withOwnerArt(cat) {
    return `<svg viewBox="0 0 320 180" role="img" aria-label="与主人合照">
      <rect width="320" height="180" fill="#fbe3cd"/>
      <circle cx="284" cy="34" r="26" fill="#f8d66d"/>
      <path d="M0 150 Q160 118 320 150 V180 H0 Z" fill="#e8c7a0"/>
      <g transform="translate(104 58)">
        <circle cx="0" cy="0" r="18" fill="#c98b5f"/>
        <path d="M-16 16 Q-16 46 0 48 Q16 46 16 16 Z" fill="#4f6f8f"/>
      </g>
      ${catGroup(cat, 236, 112, 0.75)}
    </svg>`;
  }

  function outfitArt(cat) {
    return `<svg viewBox="0 0 320 180" role="img" aria-label="换装晒照">
      <rect width="320" height="180" fill="#efe8fa"/>
      <circle cx="42" cy="38" r="24" fill="#f8d66d"/>
      <rect y="144" width="320" height="36" fill="#b9cfec"/>
      <g transform="translate(220 118) scale(0.72)">${catGroup(cat)}</g>
      <path d="M172 55 L220 42 L268 55 L254 68 L186 68 Z" fill="#ef6a59"/>
      <rect x="202" y="65" width="16" height="54" fill="#d84f42"/>
      <rect x="216" y="68" width="16" height="48" fill="#c9403a"/>
    </svg>`;
  }

  function itemArt(id) {
    if (id === 'hat') {
      return `<svg viewBox="0 0 120 100"><path d="M18 36 L102 36 L84 8 L36 8 Z" fill="#33415c"/><rect x="38" y="36" width="44" height="12" fill="#ef6a59"/><ellipse cx="60" cy="64" rx="34" ry="22" fill="#f2a65a"/><circle cx="60" cy="60" r="4" fill="#263238"/><path d="M40 70 Q60 80 80 70" stroke="#263238" stroke-width="3" fill="none"/></svg>`;
    }
    if (id === 'board') {
      return `<svg viewBox="0 0 120 100"><rect x="14" y="18" width="92" height="64" rx="10" fill="#e8b56f"/><path d="M22 60 Q40 34 60 60 T98 60 V82 H22 Z" fill="#d99a4f"/><circle cx="34" cy="44" r="5" fill="#f2c14e"/><circle cx="82" cy="44" r="5" fill="#f2c14e"/></svg>`;
    }
    if (id === 'treats') {
      return `<svg viewBox="0 0 120 100"><path d="M36 38 Q20 22 30 10 Q44 -4 58 12 Q72 -4 88 12 Q100 24 84 38 Q74 48 60 48 Q46 48 36 38 Z" fill="#79b8d9"/><circle cx="48" cy="26" r="5" fill="#eaf6ff"/><circle cx="72" cy="26" r="5" fill="#eaf6ff"/></svg>`;
    }
    if (id === 'medkit') {
      return `<svg viewBox="0 0 120 100"><rect x="22" y="28" width="76" height="54" rx="8" fill="#fdfdfd" stroke="#cfdde7"/><rect x="30" y="36" width="26" height="34" rx="5" fill="#dff2ff"/><rect x="64" y="36" width="26" height="34" rx="5" fill="#dff2ff"/><rect x="54" y="62" width="12" height="26" fill="#ef6a59"/></svg>`;
    }
    if (id === 'card') {
      return `<svg viewBox="0 0 120 100"><rect x="20" y="16" width="80" height="66" rx="6" fill="#fffdf3" stroke="#e3d3a5"/><rect x="28" y="26" width="40" height="30" rx="4" fill="#a7d9df"/><path d="M28 54 L46 38 L54 46 L66 32 L92 62 H28 Z" fill="#8bc27e"/><rect x="28" y="66" width="64" height="4" fill="#f2c14e"/><circle cx="86" cy="34" r="6" fill="#f8d66d"/></svg>`;
    }
    return `<svg viewBox="0 0 120 100"><rect x="18" y="28" width="84" height="22" rx="11" fill="#ef6a59"/><rect x="46" y="44" width="28" height="46" rx="10" fill="#d84f42"/><rect x="54" y="56" width="12" height="12" rx="6" fill="#f6c07a"/></svg>`;
  }

  function icon(name) {
    if (name === 'coin') {
      return '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#f8d66d" stroke="#8a6100" stroke-width="1.5"/><path d="M9 16V8l7 4z" fill="#e5a81f"/></svg>';
    }
    if (name === 'heart') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21C6 16 3 12.5 3 8.8 3 6 5 4 7.6 4c1.7 0 3.2.9 4.4 2.4C13.2 4.9 14.7 4 16.4 4 19 4 21 6 21 8.8c0 3.7-3 7.2-9 12.2Z"/></svg>';
    }
    if (name === 'comment') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5h16v11H9l-5 4V5Z"/></svg>';
    }
    if (name === 'send') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M15 5l7 7-7 7"/></svg>';
    }
    if (name === 'sync') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12a8 8 0 0 1 14-5M4 4v5h5M20 12a8 8 0 0 1-14 5M20 20v-5h-5"/></svg>';
    }
    if (name === 'bag') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 8h12v12H6zM9 8V6a3 3 0 0 1 6 0v2"/></svg>';
    }
    if (name === 'go') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
    }
    if (name === 'pencil') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h4L20 8l-4-4L4 16v4Z"/></svg>';
    }
    if (name === 'upload') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 16V4M7 9l5-5 5 5M4 20h16"/></svg>';
    }
    if (name === 'camera') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 18h16V8H4v10ZM8 8l2-3h4l2 3M12 15a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/></svg>';
    }
    return '';
  }

  function randomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  const OVERWEIGHT_TEXTS = [
    (model) => `瞧你胖的，3辆卡车都拉不走，也不说少吃点。你看看隔壁村的${model.name}，天天和爸爸妈妈健康饮食、多吃蔬菜，把咱们村的小母猫都迷得一愣一愣的。`,
    (model) => `我嘞个豆，隔壁${model.name}已经练出小猫胃了，你这体重主打一个实诚。家人们谁懂啊，再吃下去小区门禁都要给你专门拓宽。`,
    (model) => `你这体重出门就是移动堡垒，隔壁${model.name}路过都劝你：老铁，咱这波减脂必须安排，不然连猫爬架都会被你压塌。`,
    (model) => `别吃了别吃了，隔壁村的${model.name}看到你的碗都连夜报警，说有人把整条鱼塘倒进你碗里了。`
  ];
  const UNDERWEIGHT_TEXTS = [
    (model) => `你再不好好吃饭，风一吹就得飘到隔壁村去。你看看隔壁村的${model.name}，一顿能吃三碗猫粮，人家那才叫长身体。`,
    (model) => `瘦成这样还想当村口扛把子？隔壁${model.name}说，先干完三碗猫粮再来pk，不然风一吹你人就没了。`,
    (model) => `你这体重放风筝都不用线，隔壁村${model.name}看了直摇头：猫猫祟祟的，先吃一口饭再说话。`
  ];
  const PROTEIN_HIGH_TEXTS = [
    (model) => `地主家的傻儿子，你可长点心吧。吃那么好只会让你放臭屁，隔壁村的${model.name}天天清淡饮食，可不像你这么臭烘烘。`,
    (model) => `蛋白质超标，搁这儿给全村放毒气弹呢？隔壁${model.name}闻一口都直接戴上防毒面具，栓Q了。`,
    (model) => `你再这么吃肉，全村的猫都会以为你开了一个屁味熏鱼摊。${model.name}说：这味儿，city不city啊？`,
    (model) => `吃那么好只会让你放臭屁，隔壁${model.name}已经在村口拉了条警戒线，标语写着：张三咪屁区，猫咪勿近。`
  ];
  const PROTEIN_LOW_TEXTS = [
    (model) => `光吃零食不吃饭可不行，隔壁村的${model.name}每天都有鱼有肉，你赶紧学起来。`,
    (model) => `蛋白质这么低还怎么当村霸？隔壁${model.name}都看不下去了，说你再不吃肉，连猫跳板都跳不上去。`,
    (model) => `隔壁${model.name}端来一碗鱼汤：喝吧，别让全村都知道你营养不良。`
  ];
  const POOP_TOO_MANY_TEXTS = [
    (model) => `一天拉这么多次，你是在给全村搞地毯式施肥吗？隔壁村的${model.name}规律得很，你可得学着点。`,
    (model) => `你这排便频率，隔壁${model.name}数都数不过来，直接在你门上挂了块牌子：猫砂用量超标，请交公粮。`,
    (model) => `一上午跑八趟厕所，隔壁${model.name}问你是在搞马拉松还是拉练？`
  ];
  const POOP_TOO_FEW_TEXTS = [
    (model) => `好几天都不排便，你这是要当村口石狮子吗？隔壁村的${model.name}天天准时报告，别偷懒。`,
    (model) => `隔壁${model.name}已经在村口立了块倒计时牌：距离你上次排便，已经过去三天了。`,
    (model) => `一天到晚憋着，隔壁${model.name}说你这是想给猫砂盆做库存管理，主打一个省猫砂。`
  ];
  const PEE_TOO_MANY_TEXTS = [
    (model) => `喝水也要有个度，隔壁村的${model.name}可没有整天跑厕所。你再这样下去，全村的猫砂都要被你承包了。`,
    (model) => `你这排尿频率，隔壁${model.name}连夜给你申请了全村特等猫砂补贴，说你一个人顶半个养殖场。`,
    (model) => `隔壁${model.name}说，你再这么喝下去，村口鱼塘的水位都要被你喝出下降曲线。`
  ];
  const PEE_TOO_FEW_TEXTS = [
    (model) => `水都不喝一口，你这是要当沙漠骆驼吗？隔壁村的${model.name}一天喝五次水，比你乖多了。`,
    (model) => `隔壁${model.name}直接给你端来一碗水：快喝，再不喝你就要肾结石出道了。`,
    (model) => `一天到晚不喝水，隔壁${model.name}说你膀胱都快长成存钱罐了。`
  ];

  const PRAISE_TEXTS = {
    weight: [
      (model) => `隔壁村的${model.name}前来pk，但由于吃太多垃圾食品胖得走不动道，所以半路抛锚了。你可别学他，继续保持现在的健康饮食习惯。`,
      (model) => `隔壁${model.name}还在顿顿暴风吸入，你这体重管理已经是全村教科书级别，给你点个老铁666。`,
      (model) => `隔壁${model.name}的秤都看哭了，你这体重让全村妈妈省心，继续保持。`
    ],
    protein: [
      (model) => `隔壁村的${model.name}吃太多肉，今天放屁太多，把隔壁村一村的人都给毒跑了。你的清淡饮食真让人省心。`,
      (model) => `${model.name}蛋白质上头放了一下午烟花，你这蛋白质浓度稳得像老司机，弹幕全员给你打call。`,
      (model) => `隔壁${model.name}还在给全村制造屁味风暴，你这边饮食干净得能拍纪录片。`
    ],
    poop: [
      (model) => `隔壁${model.name}的猫砂盆已经堆成小山，你这排便节奏规律得像闹钟，全村都羡慕。`,
      (model) => `隔壁村的${model.name}施肥过度，你这边准时准点，猫砂用量都能写进教科书。`
    ],
    pee: [
      (model) => `隔壁${model.name}还在给鱼塘做吞吐实验，你这喝水排尿节奏稳定，简直是小猫养生博主。`,
      (model) => `隔壁村的${model.name}一天跑八百趟厕所，你这排尿频率刚刚好，猫砂盆听了都感动。`
    ]
  };

  function pick(templates, ...args) {
    return templates[Math.floor(Math.random() * templates.length)](...args);
  }

  function findIssues(cat) {
    const issues = [];
    if (cat.weight > 4.3) {
      issues.push({ key: 'overweight', title: '体重超标', texts: OVERWEIGHT_TEXTS });
    }
    if (cat.weight < 2.7) {
      issues.push({ key: 'underweight', title: '体重偏低', texts: UNDERWEIGHT_TEXTS });
    }
    if (cat.protein > 0.12) {
      issues.push({ key: 'proteinHigh', title: '蛋白质浓度偏高', texts: PROTEIN_HIGH_TEXTS });
    }
    if (cat.protein < 0.045) {
      issues.push({ key: 'proteinLow', title: '蛋白质浓度偏低', texts: PROTEIN_LOW_TEXTS });
    }
    if (cat.poop > 3) {
      issues.push({ key: 'poopTooMany', title: '排便次数过多', texts: POOP_TOO_MANY_TEXTS });
    }
    if (cat.poop < 1) {
      issues.push({ key: 'poopTooFew', title: '排便次数偏少', texts: POOP_TOO_FEW_TEXTS });
    }
    if (cat.pee > 7) {
      issues.push({ key: 'peeTooMany', title: '排尿次数过多', texts: PEE_TOO_MANY_TEXTS });
    }
    if (cat.pee < 3) {
      issues.push({ key: 'peeTooFew', title: '排尿次数偏少', texts: PEE_TOO_FEW_TEXTS });
    }
    return issues;
  }

  function healthBullets(cat) {
    const issues = findIssues(cat);
    if (issues.length) {
      const model = randomItem(NORMAL_NEIGHBORS);
      return {
        kind: 'bad',
        bullets: issues.map((issue) => ({
          title: `${issue.title} · 隔壁村家长式提醒`,
          text: pick(issue.texts, model)
        }))
      };
    }
    const model = randomItem(ABNORMAL_NEIGHBORS);
    const bullets = [];
    if (closeness(cat.weight, 3.6) >= 80) {
      bullets.push({ title: '体重管理表彰', text: pick(PRAISE_TEXTS.weight, model) });
    }
    if (closeness(cat.protein, 0.08) >= 80) {
      bullets.push({ title: '饮食管理表彰', text: pick(PRAISE_TEXTS.protein, model) });
    }
    if (closeness(cat.poop, 2) >= 80) {
      bullets.push({ title: '如厕规律表彰', text: pick(PRAISE_TEXTS.poop, model) });
    }
    if (closeness(cat.pee, 5) >= 80) {
      bullets.push({ title: '喝水习惯表彰', text: pick(PRAISE_TEXTS.pee, model) });
    }
    return { kind: 'good', bullets };
  }

  function preparedBullets(bullets) {
    const pool = bullets.map((bullet, index) => ({ ...bullet, sourceIndex: index }));
    const stayCount = pool.length <= 3 ? pool.length : 3;
    const shuffled = pool.slice().sort(() => Math.random() - 0.5);
    const parks = ['0%', '0%', '0%'];
    const stays = shuffled.slice(0, stayCount).map((bullet, index) => ({
      ...bullet,
      stay: true,
      park: parks[index % parks.length],
      duration: 18 + (bullet.sourceIndex % 3) * 2.5,
      delay: (bullet.sourceIndex % 3) * 2.2
    }));
    const passed = pool
      .filter((bullet) => !stays.some((item) => item.sourceIndex === bullet.sourceIndex))
      .map((bullet) => ({
        ...bullet,
        stay: false,
        park: '-15%',
        duration: 13 + (bullet.sourceIndex % 4) * 2,
        delay: (bullet.sourceIndex % 3) * 1.8
      }));
    return [...stays, ...passed].sort((a, b) => a.sourceIndex - b.sourceIndex);
  }

  function readImageFile(file, done) {
    if (!file || !file.type.startsWith('image/')) {
      setMessage('请选择图片文件。');
      render();
      return;
    }
    const reader = new FileReader();
    reader.onload = () => done(reader.result);
    reader.readAsDataURL(file);
  }

  function handleUpload(kind, id, file) {
    if (!file) return;
    readImageFile(file, (dataUrl) => {
      const image = new Image();
      image.onload = () => {
        cropSession = {
          kind,
          id,
          source: dataUrl,
          zoom: 1,
          dx: 0,
          dy: 0,
          width: image.width,
          height: image.height
        };
        render();
      };
      image.onerror = () => {
        setMessage('图片读取失败，请换一张。');
        render();
      };
      image.src = dataUrl;
    });
  }

  function openFilePicker(kind, id) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.addEventListener('change', () => handleUpload(kind, id, input.files[0]));
    input.click();
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function syncCropTransform() {
    if (!cropSession) return;
    const image = document.querySelector('[data-crop-image]');
    if (image) {
      image.style.transform = `translate(${cropSession.dx}px, ${cropSession.dy}px) scale(${cropSession.zoom})`;
    }
  }

  function applyCrop(dataUrl) {
    if (!cropSession) return;
    const { kind, id } = cropSession;
    if (kind === 'avatar') {
      const cat = catById(id);
      if (cat) cat.avatar = dataUrl;
      setMessage('猫咪头像已更新。');
    } else if (kind === 'place') {
      state.placeImages[id] = dataUrl;
      setMessage('场所实拍图已更新。');
    } else if (kind === 'photo') {
      state.draft.photo = dataUrl;
      setMessage('照片已选择，可以发布晒照。');
    }
    cropSession = null;
    save();
    render();
  }

  function confirmCrop() {
    if (!cropSession) return;
    const image = new Image();
    image.onload = () => {
      const width = image.width;
      const height = image.height;
      const aspect = cropSession.kind === 'avatar' ? 1 : 16 / 10;
      let cropWidth;
      let cropHeight;
      if (width / height > aspect) {
        cropHeight = height / cropSession.zoom;
        cropWidth = cropHeight * aspect;
      } else {
        cropWidth = width / cropSession.zoom;
        cropHeight = cropWidth / aspect;
      }
      const maxDx = Math.max(0, (width - cropWidth) / 2);
      const maxDy = Math.max(0, (height - cropHeight) / 2);
      const centerX = width / 2 + (cropSession.dx / 100) * maxDx;
      const centerY = height / 2 + (cropSession.dy / 100) * maxDy;
      const sx = clamp(centerX - cropWidth / 2, 0, width - cropWidth);
      const sy = clamp(centerY - cropHeight / 2, 0, height - cropHeight);
      const targetWidth = cropSession.kind === 'avatar' ? 600 : 900;
      const targetHeight = cropSession.kind === 'avatar' ? 600 : Math.round(targetWidth / aspect);
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      canvas.getContext('2d').drawImage(image, sx, sy, cropWidth, cropHeight, 0, 0, targetWidth, targetHeight);
      applyCrop(canvas.toDataURL('image/jpeg', 0.82));
    };
    image.src = cropSession.source;
  }

  function cropModalHtml() {
    if (!cropSession) return '';
    return `<div class="modal-backdrop">
      <div class="crop-modal">
        <div class="crop-head"><strong>框选照片</strong></div>
        <div class="crop-stage" data-crop-stage title="拖动照片调整位置">
          <div class="crop-window"></div>
          <img src="${cropSession.source}" alt="裁剪预览" data-crop-image>
        </div>
        <div class="crop-toolbar">
          <input type="range" min="1" max="4" step="0.1" value="${cropSession.zoom}" data-crop-zoom aria-label="缩放">
          <span class="zoom-value">${cropSession.zoom.toFixed(1)}x</span>
          <button data-action="crop-cancel">取消</button>
          <button class="primary" data-action="crop-confirm">确认裁剪</button>
        </div>
      </div>
    </div>`;
  }

  function inputField(key, label, type, value) {
    const extra = type === 'number' ? ' min="0" step="0.1"' : '';
    return `<div class="field"><label for="field-${key}">${label}</label><input id="field-${key}" data-field="${key}" type="${type}" value="${escapeHtml(value)}"${extra}></div>`;
  }

  function genderSelect(value) {
    return `<div class="field"><label for="field-gender">性别</label><select id="field-gender" data-field="gender"><option value="女" ${value === '女' ? 'selected' : ''}>女生</option><option value="男" ${value === '男' ? 'selected' : ''}>男生</option></select></div>`;
  }

  function metricInput(key, label, value, step) {
    return `<div class="metric"><div class="m-label">${label}</div><div class="m-value"><input data-field="${key}" type="number" min="0" step="${step}" value="${escapeHtml(value)}"></div></div>`;
  }

  function headerHtml() {
    const cat = state.cats[0];
    return `<header class="topbar">
      <div class="brand">
        <div class="brand-mark">${catSvg(cat)}</div>
        <div>
          <div class="brand-name">喵星旅行社</div>
          <div class="brand-sub">猫咪的虚拟旅行频道</div>
        </div>
      </div>
      <div class="top-actions">
        <span class="today-chip">${todayText()}</span>
        <span class="coin-chip">${icon('coin')}<strong>${state.balance}</strong><span>喵星币</span></span>
      </div>
    </header>`;
  }

  function navHtml() {
    return `<nav class="nav-tabs">${TABS.map((tab) => `<button class="nav-tab ${state.tab === tab.id ? 'active' : ''}" data-action="tab" data-id="${tab.id}">${tab.label}</button>`).join('')}</nav>`;
  }

  function statsHtml() {
    const cat = catById(state.currentCatId);
    return `<section class="stats-grid">
      <div class="card stat-card"><span class="stat-label">当前喵星币</span><span class="stat-value teal">${state.balance}</span></div>
      <div class="card stat-card"><span class="stat-label">综合健康分</span><span class="stat-value navy">${healthScore(cat)}</span></div>
      <div class="card stat-card"><span class="stat-label">旅行打卡</span><span class="stat-value coral">${state.trips.length}</span></div>
      <div class="card stat-card"><span class="stat-label">收到的赞</span><span class="stat-value navy">${totalLikes()}</span></div>
    </section>`;
  }

  function renderProfile() {
    const cat = catById(state.currentCatId);
    const score = healthScore(cat);
    const remark = healthBullets(cat);
    return `<div class="page-title">
      <div><h1>猫咪档案</h1><p>${escapeHtml(cat.breed)} · 最近同步 ${escapeHtml(state.lastSync)}</p></div>
      <span class="today-chip">健康数据已同步 ${state.healthSyncs} 次</span>
    </div>
    <section class="profile-layout">
      <div class="card cat-card">
        <div class="cat-stage" data-photo-click="avatar" data-id="${cat.id}" title="点击上传或更换头像">${catSvg(cat)}<span class="photo-hint">${icon('camera')}</span></div>
        <div class="cat-card-body">
          <div class="cat-name-row"><h2>${escapeHtml(cat.name)}</h2><span class="cat-tag">${cat.gender === '男' ? '男生' : '女生'} · ${cat.age}岁</span></div>
          <div class="cat-meta"><span>${escapeHtml(cat.breed)}</span><span>体重 ${cat.weight} kg</span><span>每次同步约奖励 ${healthReward(cat)} 喵星币</span></div>
          <div class="cat-edit">
            ${inputField('name', '名字', 'text', cat.name)}
            ${inputField('age', '年龄', 'number', cat.age)}
            ${inputField('breed', '品种', 'text', cat.breed)}
            ${genderSelect(cat.gender)}
          </div>
          <div class="avatar-row">
            ${state.cats.map((item) => `<button class="avatar-btn ${state.currentCatId === item.id ? 'active' : ''}" data-action="select-cat" data-id="${item.id}" aria-label="选择${escapeHtml(item.name)}">${catSvg(item)}</button>`).join('')}
          </div>
        </div>
      </div>
      <div class="panel-stack">
        <div class="card bullet-board ${remark.kind}">
          <div class="bullet-board-head">
            <h3>隔壁村弹幕</h3>
            <span class="muted">${remark.bullets.length} 条来信</span>
          </div>
          <div class="bullet-stage">
            ${remark.bullets.length ? preparedBullets(remark.bullets).map((bullet, renderIndex) => `<div class="bullet ${bullet.stay ? 'stay' : 'pass'}" style="--top:${10 + (renderIndex % 3) * 30}px; --duration:${bullet.duration}s; --delay:${bullet.delay}s; --park:${bullet.park}">${escapeHtml(bullet.title)}：${linkifyNeighbor(bullet.text)}</div>`).join('') : '<div class="bullet-empty">今天没有弹幕</div>'}
          </div>
        </div>
        <div class="card health-panel">
          <div class="panel-head">
            <h3>健康数据</h3>
            <div class="score-line"><span class="score-badge">${score} 分</span><div class="progress"><div class="progress-fill" style="width:${score}%"></div></div></div>
          </div>
          <div class="metric-list">
            ${metricInput('weight', '体重 kg', cat.weight, '0.1')}
            ${metricInput('poop', '排便次数 / 日', cat.poop, '1')}
            ${metricInput('pee', '排尿次数 / 日', cat.pee, '1')}
            ${metricInput('protein', '蛋白质浓度', cat.protein, '0.01')}
          </div>
          <button class="primary" data-action="sync-health">${icon('sync')}同步健康数据</button>
        </div>
        <div class="card rules-panel">
          <div class="panel-head"><h3>喵星币收入规则</h3></div>
          <table class="rules-table">
            <thead><tr><th>项目</th><th>参考值</th><th>奖励</th></tr></thead>
            <tbody>${REWARD_RULES.map((rule) => `<tr><td>${rule.label}</td><td>${rule.ideal}</td><td>${rule.reward}</td></tr>`).join('')}</tbody>
          </table>
          <p class="muted">活动晒照奖励：与主人合照 ${PHOTO_REWARDS.withOwner}，朋友合照 ${PHOTO_REWARDS.friend}，换装晒照 ${PHOTO_REWARDS.outfit}。</p>
        </div>
      </div>
    </section>`;
  }

  function renderTravel() {
    return `<div class="page-title"><div><h1>旅行打卡</h1><p>选择目的地并消耗喵星币，系统会生成一张虚拟旅行照片。</p></div></div>
    <section class="place-grid">
      ${PLACES.map((place) => `<article class="card place-card">
        <div class="place-art" data-photo-click="place" data-id="${place.id}" title="点击上传实拍图">${placeArt(place.id)}<span class="photo-hint">${icon('camera')}</span></div>
        <div class="place-body">
          <h3>${place.name}</h3>
          <p class="desc">${place.desc}</p>
          <div class="price-row"><span class="price">${place.cost} 喵星币</span><button class="primary" data-action="go-trip" data-id="${place.id}">${icon('go')}出发打卡</button></div>
        </div>
      </article>`).join('')}
    </section>
    <div class="section-head"><h2>旅行日记</h2><span class="muted">共 ${state.trips.length} 次打卡</span></div>
    <div class="log-list">${state.trips.length ? state.trips.map((trip) => {
      const place = placeById(trip.placeId);
      const cat = catById(trip.catId);
      return `<div class="log-row"><span><b>${escapeHtml(cat.name)}</b> 在 ${place.name} · ${escapeHtml(trip.note)}</span><span class="muted">${escapeHtml(trip.time)}</span></div>`;
    }).join('') : '<div class="card empty">还没有旅行记录，带猫咪出发吧。</div>'}</div>`;
  }

  function renderMarket() {
    return `<div class="page-title"><div><h1>喵星市集</h1><p>用喵星币兑换装备，换装后会自动晒出一张新照片。</p></div></div>
    <section class="item-grid">
      ${ITEMS.map((item) => {
        const owned = state.inventory.some((entry) => entry.itemId === item.id);
        return `<article class="card item-card">
          <div class="item-art">${itemArt(item.id)}</div>
          <div class="item-body">
            <h3>${item.name}</h3>
            <p class="desc">${item.desc}</p>
            <div class="price-row"><span class="price">${owned ? '已拥有' : item.price + ' 喵星币'}</span><button class="primary" data-action="buy-item" data-id="${item.id}" ${owned ? 'disabled' : ''}>${icon('bag')}兑换</button></div>
          </div>
        </article>`;
      }).join('')}
    </section>
    <div class="section-head"><h2>小仓库</h2><span class="muted">${state.inventory.length} 件物品</span></div>
    <div class="log-list">${state.inventory.length ? state.inventory.map((entry) => {
      const item = itemById(entry.itemId);
      return `<div class="log-row"><span><b>${item.name}</b></span><span class="muted">${escapeHtml(entry.time)}</span></div>`;
    }).join('') : '<div class="card empty">市集里还没有兑换过物品。</div>'}</div>`;
  }

  function kindLabel(kind) {
    return {
      trip: '旅行晒照',
      withOwner: '与主人合照',
      friend: '朋友合照',
      outfit: '换装晒照'
    }[kind] || '新鲜事';
  }

  function commentsHtml(comments) {
    if (!comments || !comments.length) return '';
    return `<div class="comments">${comments.map((comment) => `<div class="comment"><b>${escapeHtml(comment.author)}</b><span>${escapeHtml(comment.text)}</span><span>${escapeHtml(comment.time)}</span></div>`).join('')}</div>`;
  }

  function postArt(post) {
    if (post.photo) {
      return `<img class="uploaded-art" src="${post.photo}" alt="晒照照片">`;
    }
    const cat = catById(post.catId);
    if (post.kind === 'trip') return placeArt(post.placeId);
    if (post.kind === 'friend') return friendArt();
    if (post.kind === 'withOwner') return withOwnerArt(cat);
    if (post.kind === 'outfit') return outfitArt(cat);
    return catSvg(cat);
  }

  function renderFeed() {
    const kindOptions = [['trip', '旅行晒照'], ['withOwner', '与主人合照'], ['friend', '朋友合照'], ['outfit', '换装晒照']];
    const kind = state.draft.kind;
    return `<div class="page-title"><div><h1>喵推广场</h1><p>晒出旅行、合照和换装瞬间，其他家长可以点赞评论。</p></div></div>
    <section class="feed-layout">
      <div class="card compose">
        <h3>发布新鲜事</h3>
        <div class="compose-row">
          <select data-field="draftKind" aria-label="晒照类型">${kindOptions.map(([value, label]) => `<option value="${value}" ${kind === value ? 'selected' : ''}>${label}</option>`).join('')}</select>
          ${kind === 'trip' ? `<select data-field="draftPlaceId" aria-label="旅行地点">${PLACES.map((place) => `<option value="${place.id}" ${state.draft.placeId === place.id ? 'selected' : ''}>${place.name}</option>`).join('')}</select>` : '<span class="muted photos-tip">使用 2D 虚拟照片发布晒照</span>'}
        </div>
        <div class="compose-photo" data-photo-click="photo" data-id="draft" title="${state.draft.photo ? '点击重新选择照片' : '点击上传照片'}">
          ${state.draft.photo ? `<img class="draft-preview" src="${state.draft.photo}" alt="待发布照片">` : `<div class="photo-placeholder">${catSvg(catById(state.currentCatId))}</div>`}
          <span class="photo-hint">${icon('camera')}</span>
        </div>
        <textarea data-field="draftCaption" placeholder="配一句有趣的话">${escapeHtml(state.draft.caption)}</textarea>
        <button class="primary" data-action="publish">${icon('send')}发布晒照</button>
      </div>
      <div class="feed-list">
        ${state.feed.map((post) => {
          const cat = catById(post.catId);
          return `<article class="card post-card">
            <div class="post-art">${postArt(post)}</div>
            <div class="post-body">
              <div class="post-head"><span class="post-name">${escapeHtml(cat.name)}</span><span class="post-kind">${kindLabel(post.kind)}</span><span class="muted">${escapeHtml(post.time)}</span></div>
              <p class="post-caption">${escapeHtml(post.caption)}</p>
              <div class="post-actions">
                <button class="action-btn ${post.likes > 0 ? 'liked' : ''}" data-action="like" data-id="${post.id}">${icon('heart')}${post.likes} 赞</button>
                <button class="action-btn" data-action="comment" data-id="${post.id}">${icon('comment')}评论</button>
                <button class="action-btn" data-action="goto-cat" data-id="${post.catId}">${icon('pencil')}查看猫咪</button>
              </div>
              ${commentsHtml(post.comments)}
            </div>
          </article>`;
        }).join('')}
      </div>
    </section>`;
  }

  function renderPage() {
    if (state.viewingNeighbor) return renderNeighborPage();
    if (state.tab === 'travel') return renderTravel();
    if (state.tab === 'market') return renderMarket();
    if (state.tab === 'feed') return renderFeed();
    return renderProfile();
  }

  function neighborStat(label, value) {
    return `<div class="neighbor-stat"><span>${label}</span><b>${value}</b></div>`;
  }

  function renderNeighborPage() {
    const neighbor = neighborById(state.viewingNeighbor);
    const issue = (findIssues(neighbor) || [])[0] || null;
    return `<div class="page-title">
      <div><h1>隔壁村主页 · ${neighbor.name}</h1><p>${neighbor.breed} · ${neighbor.age}岁 · ${neighbor.gender === '男' ? '男生' : '女生'}</p></div>
      <button class="primary" data-action="back-neighbor">${icon('go')}返回我的猫咪</button>
    </div>
    <section class="profile-layout">
      <div class="card cat-card">
        <div class="cat-stage" style="cursor:default">${catSvg(neighbor)}</div>
        <div class="cat-card-body">
          <div class="cat-name-row"><h2>${neighbor.name}</h2><span class="cat-tag">${neighbor.gender === '男' ? '男生' : '女生'} · ${neighbor.age}岁</span></div>
          <div class="cat-meta"><span>${neighbor.breed}</span><span>体重 ${neighbor.weight} kg</span><span>${issue ? '最近被点名' : '最近常被表扬'}</span></div>
          <div class="neighbor-stats">
            ${neighborStat('体重', `${neighbor.weight} kg`)}
            ${neighborStat('排便', `${neighbor.poop} 次/日`)}
            ${neighborStat('排尿', `${neighbor.pee} 次/日`)}
            ${neighborStat('蛋白质', `${neighbor.protein}`)}
          </div>
        </div>
      </div>
      <div class="panel-stack">
        <div class="card health-panel">
          <div class="panel-head"><h3>健康档案</h3><span class="score-badge">${healthScore(neighbor)} 分</span></div>
          <p class="muted">${issue ? `${issue.title}：这位邻居最近被其他家长点名。` : '这位邻居最近身体健康，常常被当成隔壁村的模范。'}</p>
        </div>
        <div class="card rules-panel">
          <div class="panel-head"><h3>最近动态</h3></div>
          <p class="muted">${neighbor.name}今天去了${['池塘', '小吃街', '学校', '商城'][neighbor.id.length % 4]}打卡，并收到了家长们的点赞。</p>
        </div>
      </div>
    </section>`;
  }

  function render() {
    const app = document.getElementById('app');
    app.innerHTML = `${headerHtml()}${navHtml()}${state.message ? `<div class="toast">${escapeHtml(state.message)}</div>` : ''}<main class="page">${statsHtml()}${renderPage()}</main>${cropModalHtml()}`;
    syncCropTransform();
  }

  function setMessage(text) {
    state.message = text;
  }

  function handleAction(action, id) {
    const cat = catById(state.currentCatId);
    if (action === 'crop-confirm') {
      confirmCrop();
    } else if (action === 'crop-cancel') {
      cropSession = null;
    } else if (action === 'goto-neighbor') {
      state.viewingNeighbor = id;
      state.message = '';
      setLocation(`/neighbor/${id}`);
    } else if (action === 'back-neighbor') {
      state.viewingNeighbor = null;
      state.message = '';
      setLocation('/');
    } else if (action === 'tab') {
      state.tab = id;
      state.message = '';
      state.viewingNeighbor = null;
      if (window.location.protocol === 'file:' ? window.location.hash !== '#/' : window.location.pathname !== '/') {
        setLocation('/');
      }
    } else if (action === 'select-cat') {
      state.currentCatId = id;
      state.message = '';
    } else if (action === 'goto-cat') {
      state.currentCatId = id;
      state.tab = 'profile';
      state.message = '';
    } else if (action === 'go-trip') {
      const place = placeById(id);
      if (state.balance < place.cost) {
        setMessage(`${place.name}需要 ${place.cost} 喵星币，还差 ${place.cost - state.balance}。`);
      } else {
        state.balance -= place.cost;
        state.trips.unshift({ id: uid(), catId: cat.id, placeId: place.id, time: nowLabel(), note: place.funText });
        state.feed.unshift({ id: uid(), catId: cat.id, kind: 'trip', placeId: place.id, caption: `${cat.name}在${place.name}：${place.funText}。`, likes: 0, comments: [], time: nowLabel() });
        setMessage(`出发成功：${place.name}，消耗 ${place.cost} 喵星币。`);
      }
    } else if (action === 'sync-health') {
      const reward = healthReward(cat);
      state.balance += reward;
      state.healthSyncs += 1;
      state.lastSync = nowLabel();
      setMessage(`健康数据同步完成，奖励 ${reward} 喵星币。`);
    } else if (action === 'buy-item') {
      const item = itemById(id);
      if (!item) return;
      const owned = state.inventory.some((entry) => entry.itemId === item.id);
      if (owned) {
        setMessage('已经拥有这件物品。');
      } else if (state.balance < item.price) {
        setMessage(`喵星币不足，兑换${item.name}还差 ${item.price - state.balance}。`);
      } else {
        state.balance -= item.price;
        state.inventory.push({ id: uid(), itemId: item.id, time: nowLabel() });
        if (item.kind === 'outfit') {
          state.balance += PHOTO_REWARDS.outfit;
          state.feed.unshift({ id: uid(), catId: cat.id, kind: 'outfit', placeId: 'mall', caption: `${cat.name}换上了${item.name}，准备出门拍新照片。`, likes: 0, comments: [], time: nowLabel() });
          setMessage(`已兑换${item.name}，并获得 ${PHOTO_REWARDS.outfit} 喵星币晒照奖励。`);
        } else {
          setMessage(`已兑换${item.name}。`);
        }
      }
    } else if (action === 'publish') {
      const kind = state.draft.kind || 'trip';
      const caption = (state.draft.caption || '').trim() || `${cat.name}的${kindLabel(kind)}`;
      const placeId = state.draft.placeId || PLACES[0].id;
      state.feed.unshift({ id: uid(), catId: cat.id, kind, placeId, photo: state.draft.photo || null, caption, likes: 0, comments: [], time: nowLabel() });
      const reward = PHOTO_REWARDS[kind] || 0;
      state.balance += reward;
      state.draft.caption = '';
      state.draft.photo = '';
      state.tab = 'feed';
      setMessage(reward ? `晒照成功，获得 ${reward} 喵星币。` : '旅行晒照已发布。');
    } else if (action === 'like') {
      const post = state.feed.find((item) => item.id === id);
      if (post) post.likes += 1;
    } else if (action === 'comment') {
      const post = state.feed.find((item) => item.id === id);
      const text = prompt('写一条评论：');
      if (post && text && text.trim()) {
        post.comments.push({ author: '你', text: text.trim(), time: nowLabel() });
        setMessage('评论已发布。');
      }
    }
    save();
    render();
  }

  document.addEventListener('click', (event) => {
    const photoClick = event.target.closest('[data-photo-click]');
    if (photoClick) {
      openFilePicker(photoClick.dataset.photoClick, photoClick.dataset.id);
      return;
    }
    const button = event.target.closest('[data-action]');
    if (!button) return;
    handleAction(button.dataset.action, button.dataset.id);
  });

  document.addEventListener('change', (event) => {
    const zoom = event.target.closest('[data-crop-zoom]');
    if (zoom) {
      cropSession.zoom = Number(zoom.value);
      syncCropTransform();
      return;
    }
    const upload = event.target.closest('[data-upload]');
    if (upload) {
      handleUpload(upload.dataset.upload, upload.dataset.id, upload.files[0]);
      return;
    }
    const input = event.target.closest('[data-field]');
    if (!input) return;
    const field = input.dataset.field;
    if (field === 'draftKind') {
      state.draft.kind = input.value;
    } else if (field === 'draftPlaceId') {
      state.draft.placeId = input.value;
    } else if (field === 'draftCaption') {
      state.draft.caption = input.value;
    } else {
      const cat = catById(state.currentCatId);
      if (field === 'name' || field === 'breed' || field === 'gender') {
        cat[field] = input.value;
      } else {
        cat[field] = Number(input.value);
      }
    }
    save();
    render();
  });

  let dragStart = null;
  document.addEventListener('pointerdown', (event) => {
    const stage = event.target.closest('[data-crop-stage]');
    if (!stage || !cropSession) return;
    dragStart = { x: event.clientX, y: event.clientY };
    stage.setPointerCapture(event.pointerId);
  });

  document.addEventListener('pointermove', (event) => {
    if (!dragStart || !cropSession) return;
    cropSession.dx = clamp(cropSession.dx + (event.clientX - dragStart.x) * 0.12, -50, 50);
    cropSession.dy = clamp(cropSession.dy + (event.clientY - dragStart.y) * 0.12, -50, 50);
    dragStart = { x: event.clientX, y: event.clientY };
    syncCropTransform();
  });

  document.addEventListener('pointerup', () => {
    dragStart = null;
  });

  window.addEventListener('popstate', () => {
    state.viewingNeighbor = neighborIdFromPath();
    render();
  });

  window.addEventListener('hashchange', () => {
    state.viewingNeighbor = neighborIdFromPath();
    render();
  });

  render();
})();
