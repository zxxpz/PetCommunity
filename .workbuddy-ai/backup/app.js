(() => {
  'use strict';

  const LS_KEY = 'meow-kart-state-v1';

  const CATS = [
    { id: 'tuan', name: '团子', age: 3, gender: '女', breed: '三花猫', color: '#f2a65a', color2: '#f7d6a3', belly: '#fff3df', weight: 3.8, poop: 2, pee: 5, protein: 0.06 },
    { id: 'mimi', name: '米咪', age: 2, gender: '女', breed: '英短蓝猫', color: '#7f9db9', color2: '#b9cadd', belly: '#eaf1f7', weight: 3.2, poop: 2, pee: 6, protein: 0.08 },
    { id: 'doudou', name: '豆豆', age: 4, gender: '男', breed: '橘猫', color: '#e8903f', color2: '#f6c07a', belly: '#fff0d8', weight: 4.5, poop: 1, pee: 4, protein: 0.11 }
  ];

  const NEIGHBORS = [
    { id: 'cat-xia', name: '夏豆豆', gender: '男', age: 3, breed: '奶牛猫', color: '#5a6770', color2: '#a8b6bd', belly: '#eef3f5', weight: 3.5, poop: 2, pee: 5, protein: 0.08 },
    { id: 'cat-leaf', name: '小叶子', gender: '女', age: 2, breed: '虎斑猫', color: '#8ba968', color2: '#c5d6a5', belly: '#f5f9eb', weight: 3.2, poop: 2, pee: 5, protein: 0.07 },
    { id: 'cat-zhang', name: '张二咪', gender: '男', age: 4, breed: '橘猫', color: '#e8a04c', color2: '#f7ca83', belly: '#fff0d8', weight: 5.2, poop: 3, pee: 7, protein: 0.12 },
    { id: 'cat-san', name: '张三咪', gender: '女', age: 3, breed: '狸花猫', color: '#c18e6a', color2: '#dfb596', belly: '#fff3e8', weight: 4.7, poop: 2, pee: 5, protein: 0.19 }
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
    { id: 'feed', label: '喵推广场' },
    { id: 'friends', label: '好友关注' }
  ];

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function neighborIdFromPath() {
    const source = window.location.protocol === 'file:' ? window.location.hash : window.location.pathname;
    const match = source.match(/^#?\/neighbor\/([a-z0-9-]+)\/?$/i);
    return match ? match[1] : null;
  }

  function userIdFromPath() {
    const source = window.location.protocol === 'file:' ? window.location.hash : window.location.pathname;
    const match = source.match(/^#?\/user\/([a-z0-9-]+)\/?$/i);
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

  function ageFromBirthDate(birthDate) {
    if (!birthDate) return 0;
    const start = new Date(birthDate);
    if (Number.isNaN(start.getTime())) return 0;
    const now = new Date();
    let age = now.getFullYear() - start.getFullYear();
    if (now.getMonth() < start.getMonth() || (now.getMonth() === start.getMonth() && now.getDate() < start.getDate())) {
      age -= 1;
    }
    return Math.max(0, age);
  }

  function birthDateFromAge(age, base = new Date()) {
    const date = new Date(base.getFullYear() - age, base.getMonth(), base.getDate());
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
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
      neighborTab: 'profile',
      categoryFolder: '',
      userId: 'local-user',
      userName: '你',
      authed: false,
      authMode: 'login',
      authInputs: { phone: '', code: '', password: '', nickname: '' },
      loading: false,
      cats: CATS.map((cat) => ({ ...cat, background: '', likedBy: [] })),
      addPlaceName: '',
      feedScope: 'me',
      feedLoading: false,
      places: PLACES.map((place) => ({ ...place })),
      mallStreets: [],
      rentingShopId: '',
      shopDraft: null,
      shop3DId: '',
      neighborDetail: null,
      friendSearch: '',
      searchResults: [],
      followingList: [],
      followersList: [],
      friendListType: 'following',
      followingCount: 0,
      followersCount: 0,
      userDetail: null,
      likers: [],
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
        { id: uid(), catId: 'tuan', ownerUserId: 'local-user', kind: 'trip', placeId: 'snack', caption: '被小吃街的风味封印了，今晚要抱着小鱼干睡觉。', likes: 18, likedBy: [], comments: [{ author: '鱼丸爸爸', text: '求带同款路线', time: '昨天 20:01' }], time: '昨天 19:42' },
        { id: uid(), catId: 'mimi', ownerUserId: 'neighbor-mimi', kind: 'friend', placeId: 'pond', caption: '和隔壁的小橘猫交换了猫抓板，友情达成。', likes: 24, likedBy: [], comments: [], time: '昨天 16:08' },
        { id: uid(), catId: 'doudou', ownerUserId: 'neighbor-doudou', kind: 'withOwner', placeId: 'landmark', caption: '和主人一起看晚霞，今天也是被爱包围的喵。', likes: 31, likedBy: [], comments: [], time: '前天 18:20' }
      ],
      message: '',
      toastKind: 'info'
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
        feed: Array.isArray(saved.feed) ? saved.feed.map((post) => ({
          ...post,
          likedBy: Array.isArray(post.likedBy) ? post.likedBy : [],
          comments: Array.isArray(post.comments) ? post.comments : []
        })) : base.feed,
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
  // 多视角照片（3D 重建素材）弹窗状态：null = 关闭
  let viewsSession = null;
  let appBusy = false;

  function save() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch (_) {
      // localStorage 不可用时继续以内存状态运行
    }
  }

  function catById(id) {
    return state.cats.find((cat) => cat.id === id) || state.cats[0] || {
      id: 'placeholder',
      name: '待录入',
      breed: '猫咪档案',
      gender: '女',
      age: 0,
      visible: true,
      neutered: false,
      avatar: '',
      background: '',
      color: '#f2a65a',
      color2: '#f7d6a3',
      belly: '#fff3df',
      weight: 0,
      poop: 0,
      pee: 0,
      protein: 0
    };
  }

  function setBusy(label) {
    state.loading = Boolean(label);
    state.loadingLabel = label || '';
  }

  function setMessage(text) {
    state.message = text;
  }

  function mergeServerOverview(data) {
    if (!data || !data.user) return;
    state.userId = data.user.id;
    state.userName = data.user.nickname;
    state.userAvatar = data.user.avatar || '';
    state.userBackground = data.user.background || '';
    state.followersCount = data.followers || 0;
    state.followingCount = data.following || 0;
    state.cats = (data.cats || []).map((cat) => ({
      ...cat,
      avatar: cat.avatar || '',
      background: cat.background || ''
    }));
    state.balance = data.balance || state.cats.reduce((sum, cat) => sum + (cat.balance || 0), 0);
    state.feed = (data.posts || []).map((post) => ({
      ...post,
      likedBy: Array.isArray(post.likedBy) ? post.likedBy : [],
      comments: Array.isArray(post.comments) ? post.comments : []
    }));
    state.trips = data.trips || [];
    state.currentCatId = state.cats[0] ? state.cats[0].id : '';
    state.authed = true;
    state.viewingNeighbor = null;
    state.message = '';
  }

  async function loadServerOverview() {
    setBusy('正在同步数据…');
    try {
      const [data, placesData, mallData, likersData] = await Promise.all([
        window.MeowAPI.get('/api/me/overview'),
        window.MeowAPI.get('/api/places'),
        window.MeowAPI.get('/api/mall'),
        window.MeowAPI.get('/api/me/likers')
      ]);
      mergeServerOverview(data);
      state.places = placesData.places || state.places;
      state.mallStreets = mallData.streets || [];
      state.likers = likersData.users || [];
    state.receivedBullets = data.receivedBullets || [];
      await Promise.all([loadFollowList('following'), loadFollowList('followers')]);
      save();
    } catch (err) {
      if (err.status === 401) {
        window.MeowAPI.setToken('');
        state.authed = false;
        state.message = '登录已过期，请重新登录。';
      } else {
        state.message = err.message;
      }
    } finally {
      setBusy('');
      render();
    }
  }

  async function initApp() {
    if (window.location.protocol === 'file:') {
      state.fileMode = true;
      state.authed = false;
      state.message = '请先运行 npm start，并通过 http://127.0.0.1:3000 访问。';
      render();
      return;
    }
    if (!window.MeowAPI || !window.MeowAPI.getToken()) {
      state.authed = false;
      render();
      return;
    }
    await loadServerOverview();
    const neighborId = neighborIdFromPath();
    if (neighborId) {
      await loadNeighbor(neighborId);
      return;
    }
    const userId = userIdFromPath();
    if (userId) {
      await loadUserProfile(userId);
    }
  }

  function routeFromLocation() {
    const neighborId = neighborIdFromPath();
    const userId = userIdFromPath();
    if (neighborId) {
      if (!state.neighborDetail || state.neighborDetail.id !== neighborId) {
        loadNeighbor(neighborId);
        return;
      }
      state.viewingUser = null;
      state.viewingNeighbor = neighborId;
      render();
      return;
    }
    if (userId) {
      if (!state.userDetail || state.userDetail.id !== userId) {
        loadUserProfile(userId);
        return;
      }
      state.viewingNeighbor = null;
      state.viewingUser = userId;
      render();
      return;
    }
    state.viewingNeighbor = null;
    state.viewingUser = null;
    state.neighborDetail = null;
    state.userDetail = null;
    render();
  }

  function currentUserId() {
    return state.userId || 'local-user';
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
    return state.places.find((place) => place.id === id)
      || PLACES.find((place) => place.id === id)
      || { id: 'custom', name: '新场所', cost: 0, desc: '自定义打卡地', funText: '完成打卡' };
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
    const place = state.places.find((item) => item.id === id);
    if (place && place.image) {
      return `<img class="uploaded-art" src="${place.image}" alt="${escapeHtml(place.name)}风景图">`;
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
    if (name === 'alert') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3 2 20h20L12 3Z"/><path d="M12 9v5M12 17.5v.5"/></svg>';
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

  OVERWEIGHT_TEXTS.push(
    (model) => `好家伙，你搁这儿卡bug呢？3辆卡车都拉不走的体重是真实存在的吗？隔壁${model.name}看了都替你捏把汗。`,
    (model) => `我儿向来方正，俺真想锤死你！谁家好猫一顿干三盆粮？隔壁${model.name}连夜给你申请了村口地磅年卡。`,
    (model) => `前方高能，这不是猫，这是煤气罐成精！隔壁${model.name}提醒你：再不减脂，全村都要被你堵路。`,
    (model) => `家人们谁懂啊，养猫养出个年货礼盒，体积都快追上隔壁${model.name}两倍了。`,
    (model) => `你这体重管理大漏特漏，隔壁${model.name}的猫爬架都替你累得吱哇乱叫。`,
    (model) => `离谱他妈给离谱开门，离谱到家了！隔壁${model.name}说你再胖下去，出门得叫拖车。`
  );
  UNDERWEIGHT_TEXTS.push(
    (model) => `瘦成这样还想去参加猫王争霸？隔壁${model.name}说你风一吹就能上热搜。`,
    (model) => `好家伙，你这体型主打一个骨感美，隔壁${model.name}路过都怕把你碰散架。`,
    (model) => `我儿向来方正，俺真想锤死你！一碗猫粮都喂不胖，隔壁${model.name}看了直摇头。`,
    (model) => `你搁这儿当风筝呢？隔壁${model.name}说，再不吃肉下回村口迎宾就派你去飘。`,
    (model) => `弹幕护体都护不住你那小细腿，隔壁${model.name}喊你赶紧加餐，别拿空气当主食。`
  );
  PROTEIN_HIGH_TEXTS.push(
    (model) => `你礼貌吗？一打嗝全村拉响毒气警报，隔壁${model.name}连夜戴上防毒面具。`,
    (model) => `蛋白质高成这样，隔壁${model.name}说你家猫放屁都能当村广播。`,
    (model) => `我儿向来方正，俺真想锤死你！天天大鱼大肉就算了，还拿臭屁熏人，隔壁${model.name}已经被你送进医院。`,
    (model) => `前方高能，这不是蛋白质，这是生化武器！${model.name}宣布：张三咪屁区，猫咪勿近。`,
    (model) => `好家伙，你这一身高蛋白含量快赶上满汉全席，隔壁${model.name}说闻一口能下三碗饭。`,
    (model) => `你这屁味city不city？隔壁${model.name}已经被熏到连夜搬家，说再待下去人要没了。`
  );
  PROTEIN_LOW_TEXTS.push(
    (model) => `蛋白质低成这样还想当村霸？隔壁${model.name}直接端来一碗鱼汤：喝吧，别让全村知道你营养不良。`,
    (model) => `光啃零食不吃饭，隔壁${model.name}都看不下去了，说你再这样下去猫跳板都跳不上。`,
    (model) => `家人们谁懂啊，别人家猫吃鱼吃肉，你搁这儿清汤寡水，隔壁${model.name}都替你嘴馋。`,
    (model) => `我儿向来方正，俺真想锤死你！猫粮不舍得吃，隔壁${model.name}已经把你的碗换成了聚宝盆。`,
    (model) => `你这蛋白质浓度低得能当壁画，隔壁${model.name}说再不吃肉就要把你供起来。`
  );
  POOP_TOO_MANY_TEXTS.push(
    (model) => `一天拉八百趟，你是来给全村搞地毯式施肥的吗？隔壁${model.name}已经把你列为猫砂采购大户。`,
    (model) => `好家伙，别人一天的KPI你半天就完成了，隔壁${model.name}说你这排便量能养活一整个化工厂。`,
    (model) => `你搁这儿搞猫砂马拉松呢？隔壁${model.name}搬着猫砂袋跟在后面跑，腿都细了。`,
    (model) => `前方高能，猫砂盆即将过载！${model.name}提醒你，再这么拉，全村猫砂都要被你承包。`,
    (model) => `我儿向来方正，俺真想锤死你！别人一天两趟，你一天两打，隔壁${model.name}都替你数累了。`
  );
  POOP_TOO_FEW_TEXTS.push(
    (model) => `好家伙，你这屎意主打一个蓄势待发，隔壁${model.name}已经在你门口立了倒计时牌。`,
    (model) => `一天到晚憋着，你是想当村口石狮子吗？隔壁${model.name}说你这是给猫砂盆做库存管理。`,
    (model) => `我儿向来方正，俺真想锤死你！再不排便，隔壁${model.name}说你这肚子都能当存钱罐了。`,
    (model) => `你搁这儿给地球省资源呢？隔壁${model.name}说，猫砂盆等你等到长蘑菇。`,
    (model) => `这排便频率，隔壁${model.name}都说离谱，你再憋下去肚子里的陈年旧货都能开博物馆。`
  );
  PEE_TOO_MANY_TEXTS.push(
    (model) => `好家伙，你搁这儿给鱼塘做吞吐实验呢？隔壁${model.name}说再让你喝下去，全村水位都要见底。`,
    (model) => `一天跑八百趟厕所，你是在练膀胱马拉松吗？隔壁${model.name}都替你数麻了。`,
    (model) => `我儿向来方正，俺真想锤死你！喝水也要有个度，隔壁${model.name}已经把你列为全村猫砂补贴特等户。`,
    (model) => `这排尿量，隔壁${model.name}说你家猫砂盆简直是大型泵站，建议申请专利。`,
    (model) => `你搁这儿给村子搞降水量呢？${model.name}路过都得绕道，怕被你呲一身。`
  );
  PEE_TOO_FEW_TEXTS.push(
    (model) => `水都不喝一口，你是想当沙漠骆驼吗？隔壁${model.name}直接给你端来一盆水：快喝！`,
    (model) => `好家伙，你膀胱都快长成存钱罐了，隔壁${model.name}说再憋下去能开出金矿。`,
    (model) => `我儿向来方正，俺真想锤死你！一天蹦不出两滴，隔壁${model.name}已经给你挂了缺水警告牌。`,
    (model) => `你搁这儿练龟息大法呢？隔壁${model.name}说，再不喝水你就要变成猫干。`,
    (model) => `这排尿频率低到离谱，${model.name}说给你一盆水，你都能拿来当传家宝供着。`
  );
  PRAISE_TEXTS.weight.push(
    (model) => `隔壁${model.name}还在暴风吸入，你已经是全村教科书级别的体重管理，给你点个老铁666。`,
    (model) => `这才是天选之喵！隔壁${model.name}的秤看了你都要哭，说这体重管理能保送大学。`,
    (model) => `别人家孩子都在胖着长大，你稳得像老司机，隔壁${model.name}连夜向你递上《别人家的猫》聘书。`,
    (model) => `家人们谁懂啊，你的体重管理居然比隔壁${model.name}的闹钟还准，全班妈妈都想抄作业。`,
    (model) => `前方高能，优秀到发光！隔壁${model.name}看到你的健康曲线，直接把自己碗里的饭夹给你。`
  );
  PRAISE_TEXTS.protein.push(
    (model) => `隔壁${model.name}还在给全村放屁味烟花，你这蛋白质浓度稳得像高考状元，弹幕全员给你打call。`,
    (model) => `别人家孩子蛋白质上头，你这边干净得像纪录片，隔壁${model.name}看了都想跟你换食谱。`,
    (model) => `这才是会吃猫！隔壁${model.name}一天三顿肉，你一口不多一口不少，优秀得让村口老中医点赞。`,
    (model) => `好家伙，你这饮食管理比隔壁${model.name}的香水还清新，隔壁猫闻了都想拜你为师。`,
    (model) => `弹幕护体都护不住你的优秀，${model.name}表示：这猫的蛋白质浓度，全村妈妈都放心。`
  );
  PRAISE_TEXTS.poop.push(
    (model) => `隔壁${model.name}的猫砂盆已经堆成山，你这边准时准点，连猫砂都能写出教科书。`,
    (model) => `好家伙，你这排便节奏比隔壁${model.name}的小闹钟还准，全村猫砂盆都为你点赞。`,
    (model) => `别人家猫一天三趟，你规律得像钟表，隔壁${model.name}说想跟你借个排便时间表。`,
    (model) => `你才是最懂猫砂盆的猫！隔壁${model.name}的猫砂账本跟你一比，全是乱账。`,
    (model) => `天选之喵就是你，隔壁${model.name}看你这节奏，连夜给自己定了同款闹钟。`
  );
  PRAISE_TEXTS.pee.push(
    (model) => `隔壁${model.name}还在给鱼塘做水量实验，你这喝水排尿节奏稳定，猫砂盆听了都感动。`,
    (model) => `好家伙，这自律程度比隔壁${model.name}的手机闹钟还强，全村水盆都想给你颁个奖。`,
    (model) => `别人家猫一天跑八百趟厕所，你这边量刚刚好，隔壁${model.name}说你是行走的喝水教科书。`,
    (model) => `你这排尿频率连医生都挑不出毛病，${model.name}表示：这猫喝水，我放心。`,
    (model) => `天选之喵实锤！隔壁${model.name}的猫砂盆看了你的数据，连夜把自家用量调成标准模式。`
  );

  function daySeed() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return Number(`${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`);
  }

  function seededRandom(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s = 1;
    return () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  function dailyCollectedTemplates(count = 5) {
    const pool = OVERWEIGHT_TEXTS
      .concat(UNDERWEIGHT_TEXTS, PROTEIN_HIGH_TEXTS, PROTEIN_LOW_TEXTS, POOP_TOO_MANY_TEXTS, POOP_TOO_FEW_TEXTS, PEE_TOO_MANY_TEXTS, PEE_TOO_FEW_TEXTS)
      .concat(PRAISE_TEXTS.weight, PRAISE_TEXTS.protein, PRAISE_TEXTS.poop, PRAISE_TEXTS.pee);
    const rnd = seededRandom(daySeed());
    const copy = pool.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rnd() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, count).map((fn) => {
      const model = NEIGHBORS[Math.floor(rnd() * NEIGHBORS.length)];
      return fn(model);
    });
  }

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

  const BULLET_SECONDS = 18;
  const BULLET_SPAWN_MS = BULLET_SECONDS * 500;

  function bulletItemHtml(item) {
    return `<div class="bullet" style="color:${escapeHtml(item.color || '#ffd166')}">${escapeHtml(item.title)}：${linkifyNeighbor(item.text)}</div>`;
  }

  function bulletStageHtml(bullets, emptyText) {
    if (!bullets.length) {
      return `<div class="bullet-stage bullet-stage-empty">${emptyText}</div>`;
    }
    return `<div class="bullet-stage" data-bullet-queue="${escapeHtml(JSON.stringify(bullets))}">
      <div class="bullet-lane"></div>
      <div class="bullet-lane"></div>
    </div>`;
  }

  // 窗口失焦时统一恢复所有弹幕区，避免浏览器没派发 pointerleave 导致一直卡在暂停状态
  window.addEventListener('blur', () => {
    document.querySelectorAll('[data-bullet-paused]').forEach((stage) => {
      if (stage.__bulletController) stage.__bulletController.reset();
    });
  });

  function startBulletQueues() {
    document.querySelectorAll('[data-bullet-queue]').forEach((stage) => {
      if (stage.__bulletController) return;
      let items = [];
      try {
        items = JSON.parse(stage.dataset.bulletQueue);
      } catch (_) {
        return;
      }
      if (!items.length) return;

      const lanes = stage.querySelectorAll('.bullet-lane');
      let next = 0;
      let showingLane = 0;

      // 暂停状态是「每个弹幕区独立」的：鼠标移到哪个区，就只冻结哪个区
      let hovered = false;
      let focused = false;
      let paused = false;
      let spawnTimer = 0;
      let spawnStartedAt = 0;
      let spawnRemaining = BULLET_SPAWN_MS;

      function showNext() {
        if (!document.contains(stage)) return;
        const lane = lanes[showingLane];
        showingLane = 1 - showingLane;
        if (items.length === 1) {
          showingLane = 0;
          if (lane !== lanes[0]) return;
        }
        const item = items[next % items.length];
        next += 1;
        lane.innerHTML = bulletItemHtml(item);
        const bullet = lane.firstElementChild;
        if (!bullet) return;
        // 用动画结束事件回收弹幕：CSS 动画被 animation-play-state 暂停时
        // animationend 会一起延后，用户正在看的这条不会突然消失。
        bullet.addEventListener('animationend', (event) => {
          if (event.target !== bullet) return;
          if (bullet.isConnected && lane.firstElementChild === bullet) bullet.remove();
        });
      }

      function scheduleSpawn() {
        clearTimeout(spawnTimer);
        spawnStartedAt = performance.now();
        spawnTimer = setTimeout(() => {
          if (!document.contains(stage)) return;
          showNext();
          spawnRemaining = BULLET_SPAWN_MS;
          scheduleSpawn();
        }, spawnRemaining);
      }

      function setPaused(value) {
        if (paused === value) return;
        paused = value;
        if (paused) {
          // 记下剩余时间，恢复时从中断处接着走，而不是重新计时
          spawnRemaining = Math.max(0, spawnRemaining - (performance.now() - spawnStartedAt));
          clearTimeout(spawnTimer);
          stage.dataset.bulletPaused = '1';
        } else {
          delete stage.dataset.bulletPaused;
          if (document.contains(stage)) scheduleSpawn();
        }
      }

      const syncPause = () => setPaused(hovered || focused);
      const isMouse = (event) => !event.pointerType || event.pointerType === 'mouse' || event.pointerType === 'pen';

      stage.addEventListener('pointerenter', (event) => {
        if (!isMouse(event)) return;
        hovered = true;
        syncPause();
      });
      // 页面重渲染后鼠标可能仍停在弹幕区上，此时不会再触发 pointerenter
      stage.addEventListener('pointermove', (event) => {
        if (!isMouse(event) || hovered) return;
        hovered = true;
        syncPause();
      });
      stage.addEventListener('pointerleave', (event) => {
        if (!isMouse(event)) return;
        hovered = false;
        syncPause();
      });
      stage.addEventListener('pointercancel', () => { hovered = false; syncPause(); });
      // 弹幕里的邻居链接可以键盘聚焦，聚焦时也暂停，方便点开
      stage.addEventListener('focusin', () => { focused = true; syncPause(); });
      stage.addEventListener('focusout', (event) => {
        if (stage.contains(event.relatedTarget)) return;
        focused = false;
        syncPause();
      });

      stage.__bulletController = {
        reset: () => { hovered = false; focused = false; syncPause(); },
        isPaused: () => paused
      };

      showNext();
      scheduleSpawn();
    });
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
      if (cat && cat.id && cat.id !== 'placeholder') syncCatMedia(cat);
    } else if (kind === 'background') {
      const cat = catById(id);
      if (cat) cat.background = dataUrl;
      setMessage('主页背景已更新。');
      if (cat && cat.id && cat.id !== 'placeholder') syncCatMedia(cat);
    } else if (kind === 'shop-facade') {
      state.shopDraft = state.shopDraft || {};
      state.shopDraft.id = id;
      state.shopDraft.facade = dataUrl;
      setMessage('店面装修图已选择。');
    } else if (kind === 'shop-cover') {
      const shop = findShopById(id);
      if (shop) {
        shop.facade = dataUrl;
        setMessage('门店封面已更新。');
        syncShopCover(id, dataUrl);
      }
    } else if (kind === 'shop-item') {
      state.shopDraft = state.shopDraft || {};
      state.shopDraft.id = id;
      state.shopDraft.itemImage = dataUrl;
      setMessage('商品图已选择。');
    } else if (kind === 'place') {
      state.placeImages[id] = dataUrl;
      setMessage('场所实拍图已更新。');
      syncPlaceCover(id, dataUrl);
    } else if (kind === 'photo') {
      state.draft.photo = dataUrl;
      setMessage('照片已选择，可以发布晒照。');
    }
    cropSession = null;
    save();
    render();
  }

  async function syncCatMedia(cat) {
    if (!window.MeowAPI || !window.MeowAPI.getToken()) return;
    try {
      await window.MeowAPI.patch(`/api/cats/${cat.id}`, {
        avatar: cat.avatar || '',
        background: cat.background || ''
      });
    } catch (_) {
      // 本地仍保留，下次保存档案时会再同步
    }
  }

  async function syncPlaceCover(placeId, dataUrl) {
    if (!window.MeowAPI || !window.MeowAPI.getToken()) return;
    try {
      const data = await window.MeowAPI.post(`/api/places/${placeId}/image`, { image: dataUrl });
      state.places = state.places.map((place) => place.id === placeId ? { ...place, ...data.place } : place);
      save();
    } catch (_) {
      // 本地保留，下次重新上传时再同步
    }
  }

  function findShopById(shopId) {
    for (const street of state.mallStreets) {
      const shop = street.shops.find((item) => item.id === shopId);
      if (shop) return shop;
    }
    return null;
  }

  async function syncShopCover(shopId, dataUrl) {
    if (!window.MeowAPI || !window.MeowAPI.getToken()) return;
    try {
      const data = await window.MeowAPI.post(`/api/mall/shops/${shopId}/cover`, { image: dataUrl });
      state.mallStreets = state.mallStreets.map((street) => ({
        ...street,
        shops: street.shops.map((shop) => shop.id === shopId ? { ...shop, ...data.shop } : shop)
      }));
      save();
    } catch (_) {
      // 本地保留，下次重新上传时再同步
    }
  }

  function confirmCrop() {
    if (!cropSession) return;
    const image = new Image();
    image.onload = () => {
      const width = image.width;
      const height = image.height;
      const aspect = cropSession.kind === 'avatar' ? 1 : cropSession.kind === 'background' ? 16 / 9 : 16 / 10;
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

  /* ------------------------------------------------------------------ *
   * 多视角照片：3D 重建素材采集
   * 弹窗挂在 body 上单独绘制，不走整页 render —— 整页 render 会重建 3D 场景，
   * 上传十几张照片期间会反复重建 WebGL 上下文。
   * ------------------------------------------------------------------ */
  const VIEW_ANGLES = [
    ['front', '正面'], ['left', '左侧'], ['right', '右侧'], ['back', '背面'],
    ['top', '俯视'], ['bottom', '仰视'], ['face', '面部特写'], ['body', '全身'], ['extra', '未标注']
  ];
  const VIEW_CORE_ANGLES = VIEW_ANGLES.filter(([key]) => key !== 'extra');
  const VIEW_MAX_SIDE = 1600;
  // 3 张就够起步：同一只猫的三个角度已经能定毛色和基本比例
  const VIEW_MIN_FOR_REBUILD = 3;

  function viewsCat() {
    return viewsSession ? catById(viewsSession.catId) : null;
  }

  function viewsCoverage() {
    const items = (viewsSession && viewsSession.items) || [];
    const used = new Set(items.map((view) => view.angle));
    return VIEW_CORE_ANGLES.filter(([key]) => used.has(key)).length;
  }

  function formatBytes(bytes) {
    const value = Number(bytes) || 0;
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
    return `${(value / 1024 / 1024).toFixed(1)} MB`;
  }

  function viewsModalHtml() {
    const items = viewsSession.items || [];
    const count = items.length;
    const coverage = viewsCoverage();
    const cat = viewsCat();
    const coverageChips = VIEW_CORE_ANGLES.map(([key, label]) => {
      const used = items.some((view) => view.angle === key);
      return `<span class="views-angle ${used ? 'on' : ''}">${label}${used ? '' : '<i>待补</i>'}</span>`;
    }).join('');

    const cards = items.map((view) => `<figure class="views-item">
      <img src="${view.url}" alt="${escapeHtml(view.name || '多视角照片')}" loading="lazy">
      <figcaption>
        <select data-views-angle data-id="${view.id}" aria-label="标注视角">
          ${VIEW_ANGLES.map(([key, label]) => `<option value="${key}" ${key === view.angle ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
        <span class="views-size">${formatBytes(view.size)}</span>
      </figcaption>
      <button class="views-del" data-action="views-delete" data-id="${view.id}" title="删除这张">✕</button>
    </figure>`).join('');

    const proposal = viewsSession.proposal;
    const swatches = proposal
      ? `<div class="views-proposal">
          <div class="views-swatches">
            ${[['主色', proposal.palette.base], ['深色', proposal.palette.accent], ['浅色', proposal.palette.light], ['眼睛', proposal.palette.eye], ['鼻头', proposal.palette.nose]]
              .map(([label, color]) => `<span class="views-swatch" title="${label}"><i style="background:rgb(${Math.round(color.r)},${Math.round(color.g)},${Math.round(color.b)})"></i>${label}</span>`).join('')}
          </div>
          <div class="views-proposal-text">用 ${proposal.samples} 张照片算出：${escapeHtml(proposal.patternLabel)} · ${proposal.bib ? '有白斑' : '无白斑'}。${proposal.balanced < proposal.samples ? `其中 ${proposal.samples - proposal.balanced} 张光线太暗，没参与配色。` : ''}色温已逐张校正，色相只在品种预设附近小幅修正——直接取像素平均会把灰猫算成土黄猫。</div>
          <div class="views-proposal-actions">
            <button class="cat3d-btn" data-action="views-discard">丢弃</button>
            <button class="primary" data-action="views-apply">应用到 3D</button>
          </div>
        </div>`
      : '';

    const shortBy = Math.max(0, VIEW_MIN_FOR_REBUILD - count);
    const status = viewsSession.progress
      || (viewsSession.loading
        ? '正在读取已上传的照片…'
        : count
          ? `已上传 ${count} 张 · ${formatBytes(viewsSession.bytes)} · 覆盖 ${coverage}/8 个视角${shortBy ? ` · 再传 ${shortBy} 张就能开始` : ''}`
          : `还没有照片。传 3 张（正面 / 左侧 / 右侧）就能起步，越多越准。`);

    return `<div class="modal-backdrop" data-views-modal>
      <div class="views-modal">
        <div class="views-head">
          <div>
            <strong>多视角照片 · 3D 重建素材</strong>
            <p class="views-sub">${cat ? escapeHtml(cat.name) : ''} 的照片会存到本地 <code>data/views/${cat ? escapeHtml(cat.id) : ''}/</code>，每张自动压到长边 ${VIEW_MAX_SIDE}px。</p>
          </div>
          <button class="views-close" data-action="views-close" title="关闭">✕</button>
        </div>

        <div class="views-drop" data-views-drop>
          <div class="views-drop-main">
            <span class="views-drop-icon">＋</span>
            <div>
              <strong>把照片拖到这里，或点右边选择</strong>
              <p>3 张起就能用（建议正面 / 左侧 / 右侧），8 张以上更准，20 张左右最好</p>
            </div>
          </div>
          <button class="primary" data-action="views-pick">选择照片（可多选）</button>
        </div>

        <div class="views-coverage">${coverageChips}</div>

        ${count ? `<div class="views-grid">${cards}</div>` : '<div class="views-empty">还没有照片</div>'}

        ${proposal ? swatches : ''}

        <div class="views-foot">
          <span class="views-status">${escapeHtml(status)}</span>
          <div class="views-foot-actions">
            <button class="cat3d-btn" data-action="views-calibrate" ${count < VIEW_MIN_FOR_REBUILD || viewsSession.busy ? 'disabled' : ''}>用照片校准毛色</button>
            <button class="primary" data-action="views-rebuild" ${count < VIEW_MIN_FOR_REBUILD || viewsSession.busy ? 'disabled' : ''}>开始重建</button>
          </div>
        </div>
      </div>
    </div>`;
  }

  function paintViewsModal() {
    let host = document.querySelector('[data-views-modal-host]');
    if (!viewsSession) {
      if (host) host.remove();
      return;
    }
    if (!host) {
      host = document.createElement('div');
      host.setAttribute('data-views-modal-host', '');
      document.body.appendChild(host);
    }
    host.innerHTML = viewsModalHtml();
  }

  async function reloadViews() {
    if (!viewsSession) return;
    try {
      const data = await window.MeowAPI.get(`/api/cats/${viewsSession.catId}/views`);
      if (!viewsSession) return;
      viewsSession.items = data.views || [];
      viewsSession.bytes = data.bytes || 0;
      viewsSession.recon = data.recon || null;
    } catch (err) {
      if (viewsSession) viewsSession.progress = `读取失败：${err.message}`;
    } finally {
      if (viewsSession) viewsSession.loading = false;
      paintViewsModal();
    }
  }

  async function openViews(catId) {
    viewsSession = {
      catId,
      items: [],
      bytes: 0,
      recon: null,
      loading: true,
      busy: false,
      progress: '',
      proposal: null
    };
    paintViewsModal();
    if (window.MeowAPI && window.MeowAPI.getToken()) await reloadViews();
    else viewsSession.loading = false;
  }

  function closeViews() {
    viewsSession = null;
    paintViewsModal();
  }

  // 上传前先压图：手机原图 4~8MB，压完一般 200~500KB，几十张也不会卡
  function prepareViewFile(file) {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        const scale = Math.min(1, VIEW_MAX_SIDE / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(image, 0, 0, width, height);
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(objectUrl);
          if (!blob) { reject(new Error('图片压缩失败')); return; }
          resolve({ blob, width, height });
        }, 'image/jpeg', 0.86);
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('无法读取这张图片'));
      };
      image.src = objectUrl;
    });
  }

  function guessViewAngle(name) {
    const text = String(name || '').toLowerCase();
    if (/face|头|脸|特写/.test(text)) return 'face';
    if (/front|正面|正脸/.test(text)) return 'front';
    if (/left|左/.test(text)) return 'left';
    if (/right|右/.test(text)) return 'right';
    if (/back|背|后/.test(text)) return 'back';
    if (/top|俯|上/.test(text)) return 'top';
    if (/bottom|仰|下/.test(text)) return 'bottom';
    if (/body|全身|站|坐/.test(text)) return 'body';
    return 'extra';
  }

  async function uploadViewFiles(files) {
    if (!viewsSession) return;
    const list = Array.from(files || []).filter((file) => file && file.type.startsWith('image/'));
    if (!list.length) {
      viewsSession.progress = '没有可上传的图片（只支持 JPG / PNG / WebP）。';
      paintViewsModal();
      return;
    }
    viewsSession.busy = true;
    viewsSession.proposal = null;
    let done = 0;
    let failed = 0;
    const failedNames = [];
    for (let i = 0; i < list.length; i += 1) {
      const file = list[i];
      viewsSession.progress = `正在上传 ${i + 1}/${list.length}：${file.name}`;
      paintViewsModal();
      try {
        const prepared = await prepareViewFile(file);
        const query = new URLSearchParams({
          angle: guessViewAngle(file.name),
          name: file.name,
          w: String(prepared.width),
          h: String(prepared.height)
        });
        const data = await window.MeowAPI.upload(`/api/cats/${viewsSession.catId}/views?${query}`, prepared.blob);
        if (!viewsSession) return;
        viewsSession.items = data.views || viewsSession.items;
        viewsSession.bytes = data.bytes || 0;
        viewsSession.recon = data.recon || null;
        done += 1;
      } catch (err) {
        failed += 1;
        failedNames.push(file.name);
        console.warn('上传失败', file.name, err.message);
      }
    }
    if (!viewsSession) return;
    viewsSession.busy = false;
    const heic = failedNames.some((name) => /\.heic$/i.test(name));
    const total = viewsSession.items.length;
    viewsSession.progress = failed
      ? `上传完成：成功 ${done} 张，失败 ${failed} 张${heic ? '（HEIC 浏览器解不开，先在相册里转成 JPG）' : '（可能不是图片或文件已损坏）'}`
      : `上传完成：本批 ${done} 张，共 ${total} 张`;
    paintViewsModal();
    // 侧栏按钮上的张数要跟着变
    const cat = catById(viewsSession.catId);
    if (cat) cat.viewCount = viewsSession.items.length;
    save();
  }

  async function deleteView(viewId) {
    if (!viewsSession) return;
    viewsSession.busy = true;
    viewsSession.progress = '正在删除…';
    paintViewsModal();
    try {
      const data = await window.MeowAPI.del(`/api/cats/${viewsSession.catId}/views/${viewId}`);
      if (!viewsSession) return;
      viewsSession.items = data.views || [];
      viewsSession.bytes = data.bytes || 0;
      viewsSession.recon = data.recon || null;
      viewsSession.progress = '';
    } catch (err) {
      viewsSession.progress = `删除失败：${err.message}`;
    } finally {
      if (viewsSession) viewsSession.busy = false;
      paintViewsModal();
    }
  }

  async function setViewAngle(viewId, angle) {
    if (!viewsSession) return;
    const local = viewsSession.items.find((view) => view.id === viewId);
    if (local) local.angle = angle;
    paintViewsModal();
    try {
      await window.MeowAPI.patch(`/api/cats/${viewsSession.catId}/views/${viewId}`, { angle });
    } catch (err) {
      if (viewsSession) viewsSession.progress = `视角保存失败：${err.message}`;
      paintViewsModal();
    }
  }

  function loadImageElement(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('图片加载失败'));
      image.src = src;
    });
  }

  async function calibrateCoatFromViews() {
    if (!viewsSession || viewsSession.busy) return;
    if (!window.__meow3dCalibrateViews) {
      viewsSession.progress = '3D 模块还没加载完，稍后再试。';
      paintViewsModal();
      return;
    }
    viewsSession.busy = true;
    viewsSession.proposal = null;
    viewsSession.progress = '正在逐张分析毛色…';
    paintViewsModal();
    const images = [];
    const views = viewsSession.items.slice(0, 30);
    for (let i = 0; i < views.length; i += 1) {
      viewsSession.progress = `正在读取 ${i + 1}/${views.length}…`;
      paintViewsModal();
      try {
        images.push(await loadImageElement(views[i].url));
      } catch (_) { /* 单张失败就跳过 */ }
    }
    if (!viewsSession) return;
    const cat = catById(viewsSession.catId);
    // 逐张做白平衡归一化，再取中位数：四张照片的色温各不相同，直接平均会得到一团泥褐色
    const result = images.length && window.__meow3dCalibrateViews(images, cat);
    if (!result) {
      viewsSession.busy = false;
      viewsSession.progress = '这些照片都没分析出结果，换几张光线好一点的试试。';
      paintViewsModal();
      return;
    }
    viewsSession.proposal = {
      palette: result.palette,
      pattern: result.pattern,
      patternLabel: (window.__meow3dPatternLabel && window.__meow3dPatternLabel(result.pattern)) || result.pattern,
      bib: result.bib,
      samples: result.samples,
      balanced: result.balanced
    };
    viewsSession.busy = false;
    viewsSession.progress = `分析完成：用了 ${result.samples} 张照片，其中 ${result.balanced} 张的白平衡可信。`;
    paintViewsModal();
  }

  async function applyCoatProposal() {
    if (!viewsSession || !viewsSession.proposal) return;
    const cat = catById(viewsSession.catId);
    if (!cat) return;
    const profile = {
      palette: viewsSession.proposal.palette,
      pattern: viewsSession.proposal.pattern,
      bib: viewsSession.proposal.bib,
      samples: viewsSession.proposal.samples,
      balanced: viewsSession.proposal.balanced,
      source: 'views'
    };
    cat.coatProfile = profile;
    cat.viewCount = viewsSession.items.length;
    save();
    viewsSession.proposal = null;
    viewsSession.progress = '已应用到 3D 头像。不喜欢就点上面的毛色按钮换回预设。';
    paintViewsModal();
    try {
      await window.MeowAPI.patch(`/api/cats/${cat.id}`, { coatProfile: profile });
    } catch (err) {
      viewsSession.progress = `本地已生效，但保存失败：${err.message}`;
      paintViewsModal();
    }
    if (window.__meow3dCoat) window.__meow3dCoat('auto');
  }

  async function requestRebuild() {
    if (!viewsSession) return;
    const cat = catById(viewsSession.catId);
    if (!cat) return;
    viewsSession.busy = true;
    viewsSession.progress = '正在提交…';
    paintViewsModal();
    const recon = {
      status: 'queued',
      updatedAt: new Date().toISOString(),
      samples: viewsSession.items.length,
      angles: VIEW_CORE_ANGLES.filter(([key]) => viewsSession.items.some((view) => view.angle === key)).map(([key]) => key),
      note: '素材已就绪：多视角重建需要离线跑（COLMAP 标定 + 3DGS 训练），页面只负责收集和排队。'
    };
    cat.recon = recon;
    cat.viewCount = viewsSession.items.length;
    save();
    try {
      await window.MeowAPI.patch(`/api/cats/${cat.id}`, { recon });
      viewsSession.recon = recon;
      viewsSession.progress = `已排队 ${recon.samples} 张（覆盖 ${recon.angles.length} 个视角）。素材在 data/views/${cat.id}/，含 manifest.json。`;
    } catch (err) {
      viewsSession.progress = `提交失败：${err.message}`;
    } finally {
      if (viewsSession) viewsSession.busy = false;
      paintViewsModal();
    }
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

  function metricInput(key, label, value, step) {
    return `<div class="metric"><div class="m-label">${label}</div><div class="m-value"><input data-field="${key}" type="number" min="0" step="${step}" value="${escapeHtml(value)}"></div></div>`;
  }

  function headerHtml() {
    const cat = catById(state.currentCatId);
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
        <button class="user-chip" data-action="switch-account" title="切换账号">${icon('go')}${escapeHtml(state.userName)}</button>
        <button data-action="logout">退出</button>
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
    const receivedBullets = (state.receivedBullets || []).map((bullet) => ({
      title: bullet.kind === 'roast' ? '吐槽' : '夸赞',
      text: `${bullet.nickname}：${bullet.text}`,
      color: bullet.color || '#ffd166'
    }));
    const profileBullets = remark.bullets
      .map((bullet) => ({ ...bullet, color: remark.kind === 'bad' ? '#e8590c' : '#ffd166' }))
      .concat(receivedBullets);
    return `<div class="page-title">
      <div><h1>猫咪档案</h1><p>${escapeHtml(cat.breed)} · 最近同步 ${escapeHtml(state.lastSync)}</p></div>
      <span class="today-chip">健康数据已同步 ${cat.healthSyncs || 0} 次</span>
    </div>
    <section class="profile-layout">
      <div class="card cat-card">
        <div class="cat-stage" data-photo-click="avatar" data-id="${cat.id}" title="点猫咪切换状态、拖动移动位置；右下角相机可更换照片">${catSvg(cat)}<canvas class="cat-3d-canvas" data-3d-cat data-id="${cat.id}"></canvas><span class="photo-hint" title="上传或更换猫咪照片">${icon('camera')}</span></div>
        <div class="cat-3d-panel" data-cat3d-panel data-id="${cat.id}">
          <div class="cat3d-render">
            <span class="cat3d-render-label">形象</span>
            <div class="cat3d-seg">
              <button class="cat3d-btn" data-action="cat3d-render" data-id="photo" title="用上传的照片抠图做成桌面宠物，最像本猫">真实头像</button>
              <button class="cat3d-btn" data-action="cat3d-render" data-id="model" title="程序化 3D 手办，可缩放、旋转、跑酷">3D 手办</button>
            </div>
            <span class="cat3d-render-note" data-cat3d-render-note></span>
          </div>
          <div class="pet2d-states">
            <span class="cat3d-render-label">状态</span>
            ${[['idle', '普通'], ['happy', '开心'], ['sleep', '睡觉']].map(([value, label]) => `<button class="cat3d-btn" data-action="pet-state" data-id="${value}" title="切换到${label}">${label}</button>`).join('')}
            <span class="cat3d-tip">点猫咪切换 · 拖动移动</span>
          </div>
          <div class="cat3d-modes">
            ${[['auto', '自动'], ['idle', '发呆'], ['lick', '舔毛'], ['scratch', '磨爪'], ['parkour', '跑酷'], ['toilet', '上厕所'], ['wand', '逗猫棒'], ['drink', '喝水'], ['sleep', '睡觉'], ['taunt', '撅屁股']].map(([value, label]) => `<button class="cat3d-btn ${value === 'auto' ? 'active' : ''}" data-action="cat3d-mode" data-id="${value}" title="${label}">${label}</button>`).join('')}
          </div>
          <div class="cat3d-coat" data-cat3d-coat></div>
          <div class="cat3d-views-row">
            <button class="cat3d-btn cat3d-views-btn" data-action="views-open" data-id="${cat.id}" title="上传同一只猫的多角度照片，用于三维重建">
              多视角照片${cat.viewCount ? ` · ${cat.viewCount}` : ''}
            </button>
            <span class="cat3d-tip">${cat.recon && cat.recon.status === 'queued' ? '素材已排队，等待重建' : '3 张起，不同角度'}</span>
          </div>
          <div class="cat3d-tools">
            <span class="cat3d-tip">滚轮缩放 · 拖动旋转 · Shift+拖动移动 · 仅在框内活动</span>
            <div class="cat3d-zoom-row">
              <button class="cat3d-btn" data-action="cat3d-zoom" data-id="-0.15" title="缩小">−</button>
              <span class="cat3d-zoom-label" data-cat3d-zoom-label>1.0×</span>
              <button class="cat3d-btn" data-action="cat3d-zoom" data-id="0.15" title="放大">＋</button>
              <button class="cat3d-btn" data-action="cat3d-reset" title="恢复默认视角">重置</button>
            </div>
          </div>
        </div>
        <div class="cat-cover" data-photo-click="background" data-id="${cat.id}" title="点击上传或更换主页背景" style="${cat.background ? `background-image:url('${cat.background}')` : ''}"><span class="cover-hint">${icon('upload')}主页背景</span></div>
        <div class="cat-card-body">
          <div class="cat-name-row"><h2>${escapeHtml(cat.name)}</h2><span class="cat-tag">${cat.gender === '男' ? '男生' : '女生'}</span></div>
          <div class="cat-meta"><span>${escapeHtml(cat.breed)}</span><span>${cat.age}岁</span></div>
          <div class="cat-admin-row">
            <button class="primary" data-action="add-cat">添加猫咪</button>
          </div>
          <div class="avatar-row">
            ${state.cats.map((item) => `<button class="avatar-btn ${state.currentCatId === item.id ? 'active' : ''}" data-action="select-cat" data-id="${item.id}" aria-label="选择${escapeHtml(item.name)}">${catSvg(item)}</button>`).join('')}
          </div>
        </div>
      </div>
      ${renderAddCatHtml()}
      <div class="panel-stack">
        <div class="card bullet-board ${remark.kind}">
          <div class="bullet-board-head">
            <h3>隔壁村弹幕</h3>
            <span class="muted">${remark.bullets.length} 条来信</span>
          </div>
          ${bulletStageHtml(profileBullets, '今天没有弹幕')}
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
        <div class="card rules-panel">
          <div class="panel-head"><h3>收到的赞</h3><span class="muted">${state.likers.length} 位家长</span></div>
          <div class="log-list">${state.likers.length ? state.likers.map((user) => `<div class="log-row"><span><button class="inline-link" data-action="goto-user" data-id="${user.id}">${escapeHtml(user.nickname)}</button></span><span class="muted">${user.cats ? user.cats.length : 0} 只猫咪</span></div>`).join('') : '<div class="card empty">还没有收到点赞。</div>'}</div>
        </div>
      </div>
    </section>`;
  }

  function renderTravel() {
    return `<div class="page-title"><div><h1>旅行打卡</h1><p>输入想去的地方，系统会生成情境打卡照并发布旅行推文。</p></div></div>
    <div class="card custom-place">
      <div class="compose-row">
        <input data-add-place-name type="text" value="${escapeHtml(state.addPlaceName || '')}" placeholder="例如：大同悬空寺、科尔沁草原、西安古城墙、牙科诊所、喵星小学">
        <button class="primary" data-action="save-place">创建场所</button>
      </div>
      <p class="muted">用户自定义场所不限数量，商场也在这里创建；下方内置网红地可立即出发。</p>
    </div>
    ${state.categoryFolder ? folderContentsHtml(state.categoryFolder) : categoryFoldersHtml()}
    <div class="section-head"><h2>旅行日记</h2><span class="muted">共 ${state.trips.length} 次打卡</span></div>
    <div class="log-list">${state.trips.length ? state.trips.map((trip) => {
      const place = placeById(trip.placeId);
      const cat = catById(trip.catId);
      return `<div class="log-row"><span><button class="inline-link" data-action="goto-cat" data-id="${trip.catId}">${escapeHtml(cat.name)}</button> 在 ${escapeHtml(place.name)} · ${escapeHtml(trip.caption || trip.note)}</span><span class="muted">${escapeHtml(trip.time)}</span></div>`;
    }).join('') : '<div class="card empty">还没有旅行记录，带猫咪出发吧。</div>'}</div>`;
  }

  function streetBlockHtml(street) {
    return `<section class="card street-block">
      <div class="street-head"><h3>${escapeHtml(street.name)}</h3><span class="muted">${street.shops.filter((shop) => shop.adopted).length}/20 已入驻</span></div>
      <div class="shop-grid">
        ${street.shops.map((shop) => {
          const renting = state.rentingShopId === shop.id;
          if (!shop.adopted && !renting) {
            return `<article class="shop-card empty-shop">
              <div class="shop-facade empty" data-photo-click="shop-cover" data-id="${shop.id}" title="点击上传门店封面">${shop.facade ? `<img src="${shop.facade}" alt="门店封面">` : `<span>待入驻</span><b>${escapeHtml(shop.displayName)}</b>`}<span class="photo-hint">${icon('camera')}</span></div>
              <div class="shop-card-body"><p class="muted">${shop.street === 'clothes' ? '商场门店' : '小吃摊位'} · 等待商家入驻</p><button data-action="rent-shop" data-id="${shop.id}">申请入驻</button></div>
            </article>`;
          }
          if (renting) {
            const draft = state.shopDraft || {};
            const facade = draft.facade || '';
            const itemImage = draft.itemImage || '';
            return `<article class="shop-card shop-renting">
              <div class="shop-upload-row">
                <div class="shop-facade upload" data-photo-click="shop-facade" data-id="${shop.id}" title="点击上传店面装修图">${facade ? `<img src="${facade}" alt="店面图">` : '<span>点击上传店面装修图</span>'}<span class="photo-hint">${icon('camera')}</span></div>
                <div class="shop-facade upload" data-photo-click="shop-item" data-id="${shop.id}" title="点击上传商品图">${itemImage ? `<img src="${itemImage}" alt="商品图">` : '<span>点击上传商品图</span>'}<span class="photo-hint">${icon('camera')}</span></div>
              </div>
              <div class="shop-card-body"><input data-shop-name type="text" value="${escapeHtml(draft.storeName || '')}" placeholder="店铺名称"><div class="add-cat-actions"><button data-action="cancel-rent-shop">取消</button><button class="primary" data-action="save-rent-shop" data-id="${shop.id}">${icon('bag')}入驻开店</button></div></div>
            </article>`;
          }
          return `<article class="shop-card adopted">
            <div class="shop-facade" data-photo-click="shop-cover" data-id="${shop.id}" title="点击上传门店封面">${shop.facade ? `<img src="${shop.facade}" alt="门店图">` : `<span>${escapeHtml(shop.displayName)}</span>`}<span class="photo-hint">${icon('camera')}</span></div>
            <div class="shop-card-body"><h4>${escapeHtml(shop.name || shop.displayName)}</h4><p class="muted">${shop.street === 'clothes' ? '宠物服饰' : '宠物小吃'}</p><div class="shop-card-actions"><button data-action="tour-shop-3d" data-id="${shop.id}">3D漫游</button><button class="primary" data-action="visit-shop" data-id="${shop.id}">${icon('go')}进店打卡</button></div></div>
          </article>`;
        }).join('')}
      </div>
    </section>`;
  }

  function mallSectionHtml() {
    return `<section class="mall-streets">${state.mallStreets.map(streetBlockHtml).join('')}</section>`;
  }

  function renderMarket() {
    return `${mallSectionHtml()}<div class="page-title"><div><h1>喵星市集</h1><p>商场双街由商家入住装修，猫咪进店会生成试穿/试吃打卡照。</p></div></div>
    <div class="section-head"><h2>喵星道具兑换</h2><span class="muted">用喵星币兑换装备</span></div>
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

  const REACTION_TYPES = ['亲亲', '摸肚皮', '摸爪', '咬妙脆角', '弹QQ'];

  function reactionButtonsHtml(post) {
    const reactions = post.reactions || {};
    return `<div class="reaction-row">${REACTION_TYPES.map((type) => {
      const list = reactions[type] || [];
      const active = list.includes(state.userId);
      return `<button class="action-btn ${active ? 'liked' : ''}" data-action="react-post" data-id="${post.id}" data-type="${type}">${icon('heart')}${type} ${list.length}</button>`;
    }).join('')}</div>`;
  }

  function commentsHtml(comments) {
    if (!comments || !comments.length) return '';
    return `<div class="comments">${comments.map((comment) => {
      const nameHtml = comment.userId
        ? `<button class="inline-link" data-action="goto-user" data-id="${comment.userId}" style="color:${comment.color || '#64767f'}">${escapeHtml(comment.nickname || comment.author || '你')}</button>`
        : `<b style="color:${comment.color || '#64767f'}">${escapeHtml(comment.nickname || comment.author || '你')}</b>`;
      return `<div class="comment" style="color:${comment.color || '#64767f'}">${nameHtml}<span style="color:${comment.color || '#64767f'}">${escapeHtml(comment.text)}</span><span class="muted">${escapeHtml(comment.time)}</span></div>`;
    }).join('')}</div>`;
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
    const scopes = [
      ['me', '个人广场'],
      ['friends', '好友广场'],
      ['random', '随机广场']
    ];
    return `<div class="page-title"><div><h1>喵推广场</h1><p>晒出旅行、合照和换装瞬间，其他家长可以点赞评论。</p></div></div>
    <div class="feed-scope-tabs">${scopes.map(([value, label]) => `<button class="${state.feedScope === value ? 'active' : ''}" data-action="feed-scope" data-id="${value}">${label}</button>`).join('')}</div>
    <section class="feed-layout">
      <div class="card compose">
        <h3>发布新鲜事</h3>
        ${state.cats.length ? '' : '<p class="muted">请先在猫咪档案中录入猫咪。</p>'}
        <div class="compose-row">
          <select data-field="draftKind" aria-label="晒照类型">${kindOptions.map(([value, label]) => `<option value="${value}" ${kind === value ? 'selected' : ''}>${label}</option>`).join('')}</select>
          ${kind === 'trip' ? `<select data-field="draftPlaceId" aria-label="旅行地点">${state.places.map((place) => `<option value="${place.id}" ${state.draft.placeId === place.id ? 'selected' : ''}>${place.name}</option>`).join('')}</select>` : '<span class="muted photos-tip">使用 2D 虚拟照片发布晒照</span>'}
        </div>
        <div class="compose-photo" data-photo-click="photo" data-id="draft" title="${state.draft.photo ? '点击重新选择照片' : '点击上传照片'}">
          ${state.draft.photo ? `<img class="draft-preview" src="${state.draft.photo}" alt="待发布照片">` : `<div class="photo-placeholder">${catSvg(catById(state.currentCatId))}</div>`}
          <span class="photo-hint">${icon('camera')}</span>
        </div>
        <textarea data-field="draftCaption" placeholder="配一句有趣的话">${escapeHtml(state.draft.caption)}</textarea>
        <button class="primary" data-action="publish" ${state.cats.length ? '' : 'disabled'}>${icon('send')}发布晒照</button>
      </div>
      <div class="feed-list">
        ${state.feedLoading ? '<div class="card empty">正在刷新广场…</div>' : !state.feed.length ? '<div class="card empty">这个广场暂时没有推文。</div>' : state.feed.map((post) => {
          const cat = catById(post.catId);
          const isMine = post.ownerId === state.userId;
          return `<article class="card post-card">
            <div class="post-art">${postArt(post)}</div>
            <div class="post-body">
              <div class="post-head"><button class="post-name-link ${isMine ? '' : 'link'}" data-action="${isMine ? 'goto-cat' : 'goto-neighbor'}" data-id="${post.catId}">${escapeHtml(post.catName || cat.name)}</button><span class="post-kind">${kindLabel(post.kind)}</span><span class="muted">${escapeHtml(post.time)}</span></div>
              <p class="post-caption">${escapeHtml(post.caption)}</p>
              <div class="post-actions">
                ${reactionButtonsHtml(post)}
                <button class="action-btn" data-action="comment" data-id="${post.id}">${icon('comment')}评论</button>
                <button class="action-btn" data-action="${isMine ? 'goto-cat' : 'goto-neighbor'}" data-id="${post.catId}">${icon('pencil')}查看猫咪</button>
                ${post.ownerId === state.userId ? `<button class="action-btn danger" data-action="delete-post" data-id="${post.id}">${icon('comment')}删除</button>` : ''}
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
    if (state.viewingUser) return renderUserHome();
    if (state.tab === 'travel') return renderTravel();
    if (state.tab === 'market') return renderMarket();
    if (state.tab === 'feed') return renderFeed();
    if (state.tab === 'friends') return renderFriends();
    return renderProfile();
  }

function renderFriends() {
  const list = state.friendListType === 'following' ? state.followingList : state.followersList;
  const listTitle = state.friendListType === 'following' ? '我关注的家长' : '关注我的家长';
  const followLabel = (user) => state.followingList.some((item) => item.id === user.id) ? '已关注' : '关注';
  return `<div class="page-title"><div><h1>好友与关注</h1><p>按姓名检索猫咪，关注后可进入对方主页。</p></div></div>
    <div class="card friend-search">
      <div class="compose-row">
        <input data-friend-search type="text" value="${escapeHtml(state.friendSearch || '')}" placeholder="输入猫咪姓名或品种">
        <button class="primary" data-action="search-friends">${icon('pencil')}搜索</button>
      </div>
      <p class="muted">找不到时也可以直接点击广场推文里的猫咪或评论者进入主页。</p>
    </div>
    ${state.searchResults.length ? `<div class="section-head"><h2>搜索结果</h2><span class="muted">${state.searchResults.length} 只猫咪</span></div><div class="friend-result-list">${state.searchResults.map((cat) => {
      const owner = cat.owner || {};
      return `<article class="card friend-result">
        <button class="friend-avatar" data-action="goto-neighbor" data-id="${cat.id}">${catSvg(cat)}</button>
        <div class="friend-result-body">
          <div><button class="inline-link" data-action="goto-neighbor" data-id="${cat.id}">${escapeHtml(cat.name)}</button><span class="muted"> · ${escapeHtml(cat.breed)}</span></div>
          <div class="muted">家长：<button class="inline-link" data-action="goto-user" data-id="${owner.id || ''}">${escapeHtml(owner.nickname || '未知家长')}</button></div>
          <div class="muted">关注 ${owner.following || 0} · 粉丝 ${owner.followers || 0}</div>
        </div>
        <button class="action-btn ${followLabel(owner) === '已关注' ? 'liked' : ''}" data-action="follow-user" data-id="${owner.id || ''}" data-following="${followLabel(owner) === '已关注' ? '1' : '0'}">${icon('heart')}${followLabel(owner)}</button>
      </article>`;
    }).join('')}</div>` : ''}
    <div class="friend-count-grid">
      <button class="friend-count-card card ${state.friendListType === 'following' ? 'active' : ''}" data-action="friend-list" data-id="following"><span>关注</span><b>${state.followingCount}</b></button>
      <button class="friend-count-card card ${state.friendListType === 'followers' ? 'active' : ''}" data-action="friend-list" data-id="followers"><span>粉丝</span><b>${state.followersCount}</b></button>
    </div>
    <div class="section-head"><h2>${listTitle}</h2><span class="muted">${list.length} 位家长</span></div>
    <div class="log-list">${list.length ? list.map((user) => `<div class="log-row">
      <div><button class="inline-link" data-action="goto-user" data-id="${user.id}">${escapeHtml(user.nickname)}</button><span class="muted"> · ${user.cats ? user.cats.length : 0} 只猫咪</span></div>
      <button class="action-btn ${state.friendListType === 'following' ? 'danger' : ''}" data-action="follow-user" data-id="${user.id}" data-following="${state.friendListType === 'following' ? '1' : '0'}">${state.friendListType === 'following' ? '取消关注' : '关注'}</button>
    </div>`).join('') : '<div class="card empty">这里还没有家长，去搜索猫咪吧。</div>'}</div>`;
}

function renderUserHome() {
  const user = state.userDetail;
  if (!user) return '<div class="card empty">用户主页加载中…</div>';
  return `<div class="page-title"><div><h1>${escapeHtml(user.nickname)} 的主页</h1><p>${user.phone ? `手机尾号 ${user.phone.slice(-4)}` : ''} · 关注 ${user.following} · 粉丝 ${user.followers}</p></div>
    <div class="neighbor-page-actions">
      ${user.id !== state.userId ? `<button class="action-btn ${user.iFollow ? 'liked' : ''}" data-action="follow-user" data-id="${user.id}" data-following="${user.iFollow ? '1' : '0'}">${icon('heart')}${user.iFollow ? '已关注' : '关注'}${user.followsYou ? ' · TA关注你' : ''}</button>` : ''}
      <button class="primary" data-action="back-user">返回好友</button>
    </div>
  </div>
  <section class="profile-layout">
    <div class="card cat-card">
      <div class="user-cover"><span class="muted">${escapeHtml(user.nickname)} 家长主页</span></div>
      <div class="cat-card-body">
        <h2>${escapeHtml(user.nickname)}</h2>
        <p class="muted">管理 ${user.cats ? user.cats.length : 0} 只猫咪</p>
        <div class="avatar-row">${(user.cats || []).map((cat) => `<button class="avatar-btn" data-action="goto-neighbor" data-id="${cat.id}" aria-label="查看${escapeHtml(cat.name)}">${catSvg(cat)}</button>`).join('')}</div>
      </div>
    </div>
    <div class="panel-stack">
      <div class="card rules-panel">
        <div class="panel-head"><h3>猫咪列表</h3></div>
        <div class="log-list">${(user.cats || []).map((cat) => `<div class="log-row"><span><button class="inline-link" data-action="goto-neighbor" data-id="${cat.id}">${escapeHtml(cat.name)}</button><span class="muted"> · ${escapeHtml(cat.breed)}</span></span><span class="muted">${cat.gender === '男' ? '男生' : '女生'} · ${cat.age}岁</span></div>`).join('') || '<div class="card empty">还没有公开猫咪档案。</div>'}</div>
      </div>
    </div>
  </section>`;
}

  function neighborStat(label, value) {
    return `<div class="neighbor-stat"><span>${label}</span><b>${value}</b></div>`;
  }

  function renderNeighborPage() {
    const neighbor = neighborById(state.viewingNeighbor);
    const detail = state.neighborDetail && state.neighborDetail.id === state.viewingNeighbor ? state.neighborDetail : null;
    const current = detail || neighbor;
    const tab = state.neighborTab || 'profile';
    if (tab !== 'profile') {
      return renderNeighborTabPage(tab, detail, current);
    }
    const issue = (findIssues(neighbor) || [])[0] || null;
    const bullets = detail && Array.isArray(detail.bullets) ? detail.bullets : [];
    const posts = detail && Array.isArray(detail.posts) ? detail.posts : [];
    const trips = detail && Array.isArray(detail.trips) ? detail.trips : [];
    return `<div class="page-title">
      <div><h1>猫咪主页 · ${current.name}</h1><p>${current.breed} · ${current.age}岁 · ${current.gender === '男' ? '男生' : '女生'}${detail && detail.owner ? ` · 家长 ${detail.owner.nickname}` : ''}</p></div>
      <div class="neighbor-page-actions">
        ${detail && detail.owner && detail.owner.id !== state.userId ? `<button class="action-btn ${detail.owner.iFollow ? 'liked' : ''}" data-action="follow-user" data-id="${detail.owner.id}" data-following="${detail.owner.iFollow ? '1' : '0'}">${icon('heart')}${detail.owner.iFollow ? '已关注' : '关注'}${detail.owner.followsYou ? ' · TA关注你' : ''}</button>` : ''}
        <button class="primary" data-action="back-neighbor">${icon('go')}返回我的猫咪</button>
      </div>
    </div>
    <div class="neighbor-tabs">
      <button class="active" data-action="neighbor-tab" data-id="profile">猫咪档案</button>
      <button data-action="neighbor-tab" data-id="feed">喵推广场</button>
      <button data-action="neighbor-tab" data-id="friends">好友关注</button>
    </div>
    <section class="profile-layout">
      <div class="card cat-card">
        <div class="cat-stage" style="cursor:default">${catSvg(current)}</div>
        <div class="cat-card-body">
          <div class="cat-name-row"><h2>${current.name}</h2><span class="cat-tag">${current.gender === '男' ? '男生' : '女生'} · ${current.age}岁${current.neutered ? ' · 已绝育' : ''}</span></div>
          <div class="cat-meta"><span>${current.breed}</span><span>体重 ${current.weight} kg</span><span>${issue ? '最近被点名' : '最近常被表扬'}</span></div>
          <div class="neighbor-stats">
            ${neighborStat('体重', `${current.weight} kg`)}
            ${neighborStat('排便', `${current.poop} 次/日`)}
            ${neighborStat('排尿', `${current.pee} 次/日`)}
            ${neighborStat('蛋白质', `${current.protein}`)}
          </div>
        </div>
      </div>
      <div class="panel-stack">
        <div class="card health-panel">
          <div class="panel-head"><h3>健康档案</h3><span class="score-badge">${healthScore(current)} 分</span></div>
          <p class="muted">${issue ? `${issue.title}：这位邻居最近被其他家长点名。` : '这位邻居最近身体健康，常常被当成隔壁村的模范。'}</p>
        </div>
        <div class="card bullet-board good">
          <div class="bullet-board-head"><h3>弹幕留言</h3><span class="muted">${bullets.length} 条</span></div>
          ${bulletStageHtml(bullets.map((bullet) => ({
            title: bullet.kind === 'roast' ? '吐槽' : '夸赞',
            text: `${bullet.nickname}：${bullet.text}`,
            color: bullet.color || '#ffd166'
          })), '还没有人留言，来发第一条弹幕吧。', true)}
          <div class="bullet-compose">
            <select data-bullet-kind aria-label="弹幕类型"><option value="praise">夸赞</option><option value="roast">吐槽</option></select>
            <textarea data-bullet-text id="bullet-text" placeholder="留一句嘴贱或暖心的弹幕">${escapeHtml(state.bulletDraft || '')}</textarea>
            <button class="primary" data-action="post-bullet" data-id="${current.id}">${icon('send')}发布弹幕</button>
          </div>
        </div>
      </div>
    </section>`;
  }

  function renderNeighborTabPage(tab, detail, current) {
    const owner = detail && detail.owner ? detail.owner : null;
    return `<div class="page-title">
      <div><h1>猫咪主页 · ${current.name}</h1><p>${current.breed} · ${current.age}岁 · ${current.gender === '男' ? '男生' : '女生'}${owner ? ` · 家长 ${owner.nickname}` : ''}</p></div>
      <div class="neighbor-page-actions">
        ${owner && owner.id !== state.userId ? `<button class="action-btn ${owner.iFollow ? 'liked' : ''}" data-action="follow-user" data-id="${owner.id}" data-following="${owner.iFollow ? '1' : '0'}">${icon('heart')}${owner.iFollow ? '已关注' : '关注'}${owner.followsYou ? ' · TA关注你' : ''}</button>` : ''}
        <button class="primary" data-action="back-neighbor">${icon('go')}返回我的猫咪</button>
      </div>
    </div>
    <div class="neighbor-tabs">
      <button class="${tab === 'profile' ? 'active' : ''}" data-action="neighbor-tab" data-id="profile">猫咪档案</button>
      <button class="${tab === 'feed' ? 'active' : ''}" data-action="neighbor-tab" data-id="feed">喵推广场</button>
      <button class="${tab === 'friends' ? 'active' : ''}" data-action="neighbor-tab" data-id="friends">好友关注</button>
    </div>
    ${tab === 'feed' ? renderNeighborFeed(detail, current) : renderNeighborFriends(detail, current)}`;
  }

  function renderNeighborFeed(detail, current) {
    const posts = detail && Array.isArray(detail.ownerPosts)
      ? detail.ownerPosts
      : (detail && Array.isArray(detail.posts) ? detail.posts : []);
    const ownerName = detail && detail.owner ? detail.owner.nickname : '对方';
    return `<div class="section-head"><h2>喵推广场</h2><span class="muted">${escapeHtml(ownerName)}发布的 ${posts.length} 条推文</span></div>
    <section class="feed-list">
      ${posts.length ? posts.map((post) => `<article class="card post-card">
        <div class="post-art">${post.photo ? `<img class="uploaded-art" src="${post.photo}" alt="晒照照片">` : placeArt(post.placeId)}</div>
        <div class="post-body">
          <div class="post-head"><button class="post-name-link link" data-action="goto-neighbor" data-id="${post.catId}">${escapeHtml(post.catName || current.name)}</button><span class="post-kind">${kindLabel(post.kind)}</span><span class="muted">${escapeHtml(post.time)}</span></div>
          <p class="post-caption">${escapeHtml(post.caption)}</p>
          <div class="post-actions">
            ${reactionButtonsHtml(post)}
            <button class="action-btn" data-action="comment" data-id="${post.id}">${icon('comment')}评论</button>
            <button class="action-btn" data-action="goto-neighbor" data-id="${post.catId}">${icon('pencil')}查看猫咪</button>
          </div>
          ${commentsHtml(post.comments)}
        </div>
      </article>`).join('') : '<div class="card empty">对方还没有发布推文。</div>'}
    </section>`;
  }

  function renderNeighborFriends(detail, current) {
    const owner = detail && detail.owner ? detail.owner : null;
    const following = detail && Array.isArray(detail.ownerFollowing) ? detail.ownerFollowing : [];
    const followers = detail && Array.isArray(detail.ownerFollowers) ? detail.ownerFollowers : [];
    const ownerName = owner ? owner.nickname : '对方';
    return `<div class="section-head"><h2>好友关注</h2><span class="muted">${escapeHtml(ownerName)}的人脉</span></div>
    <div class="friend-count-grid">
      <div class="card friend-count-card"><span>对方关注</span><b>${following.length}</b></div>
      <div class="card friend-count-card"><span>关注对方</span><b>${followers.length}</b></div>
    </div>
    <div class="section-head"><h2>对方关注列表</h2><span class="muted">${following.length} 位家长</span></div>
    <div class="log-list">${following.length ? following.map((user) => `<div class="log-row"><span><button class="inline-link" data-action="goto-user" data-id="${user.id}">${escapeHtml(user.nickname)}</button><span class="muted"> · ${user.cats ? user.cats.length : 0} 只猫咪</span></span><span class="muted">粉丝 ${user.followers || 0}</span></div>`).join('') : '<div class="card empty">对方还没有关注任何人。</div>'}</div>
    <div class="section-head"><h2>关注对方列表</h2><span class="muted">${followers.length} 位家长</span></div>
    <div class="log-list">${followers.length ? followers.map((user) => `<div class="log-row"><span><button class="inline-link" data-action="goto-user" data-id="${user.id}">${escapeHtml(user.nickname)}</button><span class="muted"> · ${user.cats ? user.cats.length : 0} 只猫咪</span></span><span class="muted">粉丝 ${user.followers || 0}</span></div>`).join('') : '<div class="card empty">还没有人关注对方。</div>'}</div>`;
  }

  function renderAuthHtml() {
    const inputs = state.authInputs || {};
    const isRegister = state.authMode === 'register';
    return `<section class="auth-shell">
      <div class="card auth-card">
        <div class="auth-mark">${catSvg(CATS[0])}</div>
        <h1>喵星旅行社</h1>
        <p class="muted">家长手机号登录，管理家中每只猫咪的档案与旅行。</p>
        <div class="auth-tabs">
          <button class="${!isRegister ? 'active' : ''}" data-action="auth-mode" data-id="login">登录</button>
          <button class="${isRegister ? 'active' : ''}" data-action="auth-mode" data-id="register">注册</button>
        </div>
        <div class="auth-form">
          <div class="field"><label for="auth-phone">手机号</label><input id="auth-phone" data-auth-field="phone" type="tel" value="${escapeHtml(inputs.phone || '')}" placeholder="请输入手机号"></div>
          <div class="auth-code-row">
            <div class="field"><label for="auth-code">验证码</label><input id="auth-code" data-auth-field="code" type="text" value="${escapeHtml(inputs.code || '')}" placeholder="演示验证码 123456"></div>
            <button class="auth-code-btn" data-action="send-code">获取验证码</button>
          </div>
          <div class="field"><label for="auth-password">密码</label><input id="auth-password" data-auth-field="password" type="password" value="${escapeHtml(inputs.password || '')}" placeholder="${isRegister ? '至少 6 位' : '请输入密码'}"></div>
          ${isRegister ? `<div class="field"><label for="auth-nickname">家长昵称</label><input id="auth-nickname" data-auth-field="nickname" type="text" value="${escapeHtml(inputs.nickname || '')}" placeholder="和猫咪一起出镜的名字"></div>` : ''}
          <button class="primary auth-submit" data-action="auth-submit" ${state.loading ? 'disabled' : ''}>${isRegister ? '注册并登录' : '登录'}${state.loading ? '…' : ''}</button>
          <p class="muted auth-tip">演示账号：13800000001 ~ 13800000007，密码 123456。</p>
        </div>
      </div>
    </section>`;
  }

  function renderAddCatHtml() {
    if (!state.showCatForm) return '';
    return `<div class="card add-cat-card">
      <div class="panel-head"><h3>录入新猫咪</h3><span class="muted">年龄与出生日期会自动换算</span></div>
      <div class="cat-edit">
        <div class="field"><label for="new-name">名字</label><input id="new-name" data-add-field="name" type="text" placeholder="猫咪名字"></div>
        <div class="field"><label for="new-breed">品种</label><input id="new-breed" data-add-field="breed" type="text" placeholder="如橘猫、三花猫"></div>
        <div class="field"><label for="new-age">年龄（岁）</label><input id="new-age" data-add-field="age" type="number" min="0" step="1" value="1"></div>
        <div class="field"><label for="new-birth">出生日期</label><input id="new-birth" data-add-field="birthDate" type="date"></div>
        <div class="field"><label for="new-gender">性别</label><select id="new-gender" data-add-field="gender"><option value="女">女生</option><option value="男">男生</option></select></div>
        <div class="field"><label>档案状态</label><label class="checkline"><input type="checkbox" data-add-field="visible" checked>展示给其他家长</label></div>
        <div class="field"><label>绝育状态</label><label class="checkline"><input type="checkbox" data-add-field="neutered">已绝育</label></div>
      </div>
      <div class="add-cat-actions"><button data-action="cancel-add-cat">取消</button><button class="primary" data-action="save-add-cat">${icon('send')}保存猫咪</button></div>
    </div>`;
  }

  function render() {
    const app = document.getElementById('app');
    if (!state.authed || state.fileMode) {
      app.innerHTML = `${state.message ? `<div class="toast">${escapeHtml(state.message)}</div>` : ''}${renderAuthHtml()}`;
      return;
    }
    const neighborMode = !!state.viewingNeighbor;
    const shop3D = state.shop3DId ? findShopById(state.shop3DId) : null;
    app.innerHTML = `${headerHtml()}${neighborMode ? '' : navHtml()}${state.message ? `<div class="toast ${state.toastKind === 'error' ? 'toast-error' : ''}">${state.toastKind === 'error' ? icon('alert') : ''}${escapeHtml(state.message)}</div>` : ''}<main class="page">${neighborMode ? '' : statsHtml()}${renderPage()}</main>${state.shop3DId ? `<div class="modal-backdrop"><div class="shop-3d-modal"><div class="shop-3d-head"><strong>${shop3D ? escapeHtml(shop3D.name || shop3D.displayName) : ''} 3D漫游</strong><button data-action="close-shop-3d">关闭</button></div><canvas class="shop-3d-canvas" data-shop-3d data-id="${state.shop3DId}"></canvas><p class="muted">方向键 / WASD 控制猫咪漫游，点击封面可更新门店空间。</p></div></div>` : ''}${cropModalHtml()}`;
    syncCropTransform();
    startBulletQueues();
    if (window.__refreshMeow3D) window.__refreshMeow3D();
  }

  function setMessage(text) {
    state.message = text;
    state.toastKind = 'info';
  }

  function setError(text) {
    state.message = text;
    state.toastKind = 'error';
  }

  function authField(name) {
    return document.querySelector(`[data-auth-field="${name}"]`).value.trim();
  }

  async function sendCode() {
    const phone = authField('phone');
    if (!/^1\d{10}$/.test(phone)) {
      setMessage('请输入正确的手机号。');
      render();
      return;
    }
    setBusy('正在发送验证码…');
    try {
      const data = await window.MeowAPI.post('/api/auth/send-code', { phone });
      setMessage(`${data.message}，演示验证码：${data.devCode || '123456'}。`);
    } catch (err) {
      if (String(err.message || '').includes('喵星币')) {
        setError(err.message);
      } else {
        setMessage(err.message);
      }
    } finally {
      setBusy('');
      render();
    }
  }

  async function submitAuth() {
    const phone = authField('phone');
    const code = authField('code');
    const password = authField('password');
    const nicknameEl = document.querySelector('[data-auth-field="nickname"]');
    const nickname = nicknameEl ? nicknameEl.value.trim() : '喵星家长';
    if (!/^1\d{10}$/.test(phone)) {
      setMessage('请输入正确的手机号。');
      render();
      return;
    }
    if (password.length < 6) {
      setMessage('密码至少 6 位。');
      render();
      return;
    }
    setBusy('正在登录…');
    try {
      const path = state.authMode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const payload = state.authMode === 'register'
        ? { phone, code, password, nickname }
        : { phone, password };
      const data = await window.MeowAPI.post(path, payload);
      window.MeowAPI.setToken(data.token);
      await loadServerOverview();
    } catch (err) {
      setMessage(err.message);
      setBusy('');
      render();
    }
  }

  function collectAddCat() {
    const read = (name) => {
      const el = document.querySelector(`[data-add-field="${name}"]`);
      return el ? el.value : '';
    };
    const checked = (name) => {
      const el = document.querySelector(`[data-add-field="${name}"]`);
      return el ? el.checked : false;
    };
    const age = Number(read('age'));
    const birthDate = read('birthDate');
    return {
      name: read('name'),
      breed: read('breed') || '中华田园猫',
      gender: read('gender') === '男' ? '男' : '女',
      age: age > 0 ? age : undefined,
      birthDate: birthDate || undefined,
      neutered: checked('neutered'),
      visible: checked('visible') !== false,
      weight: 3.5,
      poop: 2,
      pee: 5,
      protein: 0.08
    };
  }

  async function saveNewCat() {
    const payload = collectAddCat();
    if (!payload.name) {
      setMessage('请填写猫咪名字。');
      render();
      return;
    }
    setBusy('正在保存猫咪…');
    try {
      const data = await window.MeowAPI.post('/api/cats', payload);
      state.cats.push({ ...data.cat, avatar: data.cat.avatar || '', background: data.cat.background || '' });
      state.currentCatId = data.cat.id;
      state.balance = state.cats.reduce((sum, cat) => sum + (cat.balance || 0), 0);
      state.showCatForm = false;
      state.message = `${data.cat.name} 已录入，出生日期也保存好了。`;
      save();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy('');
      render();
    }
  }

  function handleAction(action, id, extra) {
    const cat = catById(state.currentCatId);
    // 3D 头像控制不重渲染页面，否则 canvas 会被替换、场景状态被重置
    if (action === 'cat3d-mode') {
      if (window.__meow3dSetMode) window.__meow3dSetMode(id);
      return;
    } else if (action === 'cat3d-zoom') {
      if (window.__meow3dZoom) window.__meow3dZoom(Number(id) || 0);
      return;
    } else if (action === 'cat3d-reset') {
      if (window.__meow3dReset) window.__meow3dReset();
      return;
    } else if (action === 'cat3d-coat') {
      if (window.__meow3dCoat) window.__meow3dCoat(id);
      return;
    } else if (action === 'cat3d-render') {
      if (window.__meowPetMode) window.__meowPetMode(id);
      return;
    } else if (action === 'pet-state') {
      if (window.__meowPetState) window.__meowPetState(id);
      return;
    } else if (action === 'views-open') {
      openViews(id || state.currentCatId);
      return;
    } else if (action === 'views-close') {
      closeViews();
      return;
    } else if (action === 'views-pick') {
      const picker = document.createElement('input');
      picker.type = 'file';
      picker.accept = 'image/*';
      picker.multiple = true;
      picker.addEventListener('change', () => uploadViewFiles(picker.files));
      picker.click();
      return;
    } else if (action === 'views-delete') {
      deleteView(id);
      return;
    } else if (action === 'views-calibrate') {
      calibrateCoatFromViews();
      return;
    } else if (action === 'views-apply') {
      applyCoatProposal();
      return;
    } else if (action === 'views-discard') {
      if (viewsSession) viewsSession.proposal = null;
      paintViewsModal();
      return;
    } else if (action === 'views-rebuild') {
      requestRebuild();
      return;
    }
    if (action === 'crop-confirm') {
      confirmCrop();
    } else if (action === 'crop-cancel') {
      cropSession = null;
    } else if (action === 'logout' || action === 'switch-account') {
      window.MeowAPI.setToken('');
      state.authed = false;
      state.message = action === 'logout' ? '已退出登录。' : '已返回登录页，可切换账号。';
      state.viewingNeighbor = null;
      state.neighborDetail = null;
      state.viewingUser = null;
      state.userDetail = null;
      state.categoryFolder = '';
    } else if (action === 'auth-mode') {
      state.authMode = id;
      state.message = '';
    } else if (action === 'send-code') {
      sendCode();
      return;
    } else if (action === 'auth-submit') {
      submitAuth();
      return;
    } else if (action === 'goto-neighbor') {
      loadNeighbor(id);
      return;
    } else if (action === 'back-neighbor') {
      state.viewingNeighbor = null;
      state.neighborDetail = null;
      state.neighborTab = 'profile';
      state.message = '';
      setLocation('/');
    } else if (action === 'neighbor-tab') {
      state.neighborTab = id;
      state.message = '';
    } else if (action === 'post-bullet') {
      postBullet(id);
      return;
    } else if (action === 'tab') {
      state.tab = id;
      state.message = '';
      state.viewingNeighbor = null;
      if (id === 'travel') {
        state.categoryFolder = '';
      }
      if (window.location.protocol === 'file:' ? window.location.hash !== '#/' : window.location.pathname !== '/') {
        setLocation('/');
      }
    } else if (action === 'select-cat') {
      state.currentCatId = id;
      state.message = '';
    } else if (action === 'add-cat') {
      state.showCatForm = true;
      state.message = '';
    } else if (action === 'cancel-add-cat') {
      state.showCatForm = false;
      state.message = '';
    } else if (action === 'save-add-cat') {
      saveNewCat();
      return;
    } else if (action === 'save-place') {
      saveCustomPlace();
      return;
    } else if (action === 'fetch-place-image') {
      fetchPlaceImage(id);
      return;
    } else if (action === 'open-category') {
      state.categoryFolder = id;
      state.message = '';
    } else if (action === 'back-folder') {
      state.categoryFolder = '';
      state.message = '';
    } else if (action === 'category-trip') {
      startCategoryTrip(id);
      return;
    } else if (action === 'open-mall-street') {
      state.categoryFolder = '';
      state.tab = 'market';
      setLocation('/');
    } else if (action === 'feed-scope') {
      refreshFeed(id);
      return;
    } else if (action === 'search-friends') {
      searchFriends();
      return;
    } else if (action === 'friend-list') {
      state.friendListType = id;
      loadFollowList(id);
      return;
    } else if (action === 'follow-user') {
      const button = document.querySelector(`[data-action="follow-user"][data-id="${id}"]`);
      followUser(id, button && button.dataset.following === '1');
      return;
    } else if (action === 'rent-shop') {
      state.rentingShopId = id;
      state.shopDraft = { id };
      state.message = '';
    } else if (action === 'cancel-rent-shop') {
      state.rentingShopId = '';
      state.shopDraft = null;
      state.message = '';
    } else if (action === 'save-rent-shop') {
      rentShop(id);
      return;
    } else if (action === 'visit-shop') {
      visitShop(id);
      return;
    } else if (action === 'tour-shop-3d') {
      state.shop3DId = id;
      state.message = '';
    } else if (action === 'close-shop-3d') {
      state.shop3DId = '';
    } else if (action === 'goto-user') {
      if (id) {
        loadUserProfile(id);
        return;
      }
    } else if (action === 'back-user') {
      state.viewingUser = null;
      state.userDetail = null;
      state.message = '';
      setLocation('/');
    } else if (action === 'goto-cat') {
      state.currentCatId = id;
      state.tab = 'profile';
      state.message = '';
    } else if (action === 'go-trip') {
      startTrip(id);
      return;
    } else if (action === 'sync-health') {
      syncHealthToServer();
      return;
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
      publishPost();
      return;
    } else if (action === 'react-post') {
      reactPost(id, extra || '亲亲');
      return;
    } else if (action === 'delete-post') {
      deletePost(id);
      return;
    } else if (action === 'comment') {
      commentPost(id);
      return;
    }
    save();
    render();
  }

  function inferSceneKey(name) {
    const text = String(name || '');
    if (/商场|超市|百货|购物|商城/.test(text)) return 'mall';
    if (/小吃|美食|夜市|食街|零食/.test(text)) return 'snack';
    if (/学校|小学|中学|大学|课堂|幼儿园/.test(text)) return 'school';
    if (/医院|诊所|牙|口腔|医生/.test(text)) return 'hospital';
    if (/寺|庙|古城|城楼|名胜|遗产|石窟|城墙/.test(text)) return 'landmark';
    if (/草原|牧场|大原/.test(text)) return 'grass';
    if (/海|沙滩|海岸|海岛/.test(text)) return 'sea';
    if (/瀑布|山泉|峡谷|溪流|溶洞|森林/.test(text)) return 'waterfall';
    if (/池|湖|湿地|河边/.test(text)) return 'pond';
    return 'custom';
  }

  function placeCategoryOf(sceneKey) {
    if (sceneKey === 'mall') return '商场';
    if (sceneKey === 'snack') return '小吃街';
    if (sceneKey === 'school') return '学校';
    if (sceneKey === 'hospital') return '医院';
    if (['pond', 'grass', 'sea', 'waterfall'].includes(sceneKey)) return '自然风光';
    return '名胜古迹';
  }

  function startCategoryTrip(folderId) {
    const list = categoryPlaces(folderId);
    if (!list.length) {
      setMessage('这个文件夹还没有收录场所，先去创建场所吧。');
      render();
      return;
    }
    const place = randomItem(list);
    startTrip(place.id);
  }

  const CATEGORY_FOLDERS = [
    { id: '名胜古迹', title: '名胜古迹', intro: '石窟、古城墙、草原、名山大川都在这里' },
    { id: '自然风光', title: '自然风光', intro: '池塘、湖边、湿地等适合发发呆的地方' },
    { id: '医院', title: '医院', intro: '诊所、牙科、体检中心和医生出没地' },
    { id: '学校', title: '学校', intro: '喵星课堂、幼儿园和图书馆' },
    { id: '商场', title: '商场', intro: '宠物服饰街的20间待入驻商铺' },
    { id: '小吃街', title: '小吃街', intro: '宠物小吃街的20个待入驻摊位' }
  ];

  function categoryPlaces(folderId) {
    return state.places.filter((place) => {
      if (folderId === '商场') return place.sceneKey === 'mall';
      if (folderId === '小吃街') return place.sceneKey === 'snack';
      if (folderId === '医院') return place.sceneKey === 'hospital';
      if (folderId === '学校') return place.sceneKey === 'school';
      if (folderId === '自然风光') return ['pond', 'grass', 'sea', 'waterfall'].includes(place.sceneKey);
      return !['mall', 'snack', 'school', 'hospital', 'pond', 'grass', 'sea', 'waterfall'].includes(place.sceneKey);
    });
  }

  function folderCoverSvg(folderId) {
    if (folderId === '医院') {
      return `<svg viewBox="0 0 360 180" role="img" aria-label="医院文件夹封面">
        <rect width="360" height="180" fill="#faf0f3"/>
        <rect x="92" y="42" width="176" height="126" rx="10" fill="#fff" stroke="#d2dde7"/>
        <rect x="112" y="64" width="48" height="46" fill="#dff2ff"/>
        <rect x="200" y="64" width="48" height="46" fill="#dff2ff"/>
        <rect x="172" y="118" width="16" height="50" fill="#ef6a59"/>
        <text x="180" y="28" text-anchor="middle" font-size="18" fill="#8a3f52">医院 · 牙科 · 体检</text>
      </svg>`;
    }
    if (folderId === '学校') {
      return `<svg viewBox="0 0 360 180" role="img" aria-label="学校文件夹封面">
        <rect width="360" height="180" fill="#e4f1f7"/>
        <rect y="140" width="360" height="40" fill="#a7d193"/>
        <rect x="92" y="52" width="176" height="96" rx="8" fill="#f2c8dd"/>
        <path d="M112 52 L180 20 L248 52 Z" fill="#5879a7"/>
        <text x="180" y="30" text-anchor="middle" font-size="18" fill="#33415c">学校 · 课堂 · 午睡垫</text>
        <text x="180" y="116" text-anchor="middle" font-size="26" fill="#fff">喵星小学</text>
      </svg>`;
    }
    if (folderId === '商场') {
      return `<svg viewBox="0 0 360 180" role="img" aria-label="商场文件夹封面">
        <rect width="360" height="180" fill="#e7eef8"/>
        <rect y="146" width="360" height="34" fill="#c7d8dd"/>
        <rect x="66" y="36" width="228" height="120" rx="8" fill="#f6fbff" stroke="#9eb9d4"/>
        <rect x="88" y="58" width="112" height="58" fill="#d9e8f7"/>
        <text x="144" y="92" text-anchor="middle" font-size="24" fill="#233344" font-weight="700">CHANEL</text>
        <rect x="226" y="58" width="52" height="58" fill="#f7e3c6"/>
        <text x="252" y="92" text-anchor="middle" font-size="16" fill="#8a6100">猫咪专柜</text>
        <text x="180" y="26" text-anchor="middle" font-size="18" fill="#33415c">商场 · 宠物服饰街 · 宠物小吃街</text>
      </svg>`;
    }
    if (folderId === '自然风光') {
      return `<svg viewBox="0 0 360 180" role="img" aria-label="自然风光文件夹封面">
        <rect width="360" height="180" fill="#d7f1f5"/>
        <path d="M0 92 Q90 72 180 92 T360 92 V180 H0 Z" fill="#5bbdca"/>
        <path d="M0 116 Q120 100 240 116 T360 116 V180 H0 Z" fill="#23808f"/>
        <text x="180" y="30" text-anchor="middle" font-size="18" fill="#14657a">自然风光 · 池塘 · 湖边</text>
      </svg>`;
    }
    if (folderId === '小吃街') {
      return `<svg viewBox="0 0 360 180" role="img" aria-label="小吃街文件夹封面">
        <rect width="360" height="180" fill="#f9e4d9"/>
        <rect y="146" width="360" height="34" fill="#d7b6aa"/>
        <rect x="28" y="92" width="120" height="64" rx="8" fill="#f2a65a"/>
        <path d="M18 92 Q88 46 158 92 Z" fill="#ef6a59"/>
        <rect x="118" y="64" width="8" height="28" fill="#795548"/>
        <circle cx="122" cy="60" r="6" fill="#f2c14e"/>
        <rect x="204" y="92" width="120" height="64" rx="8" fill="#e5a81f"/>
        <path d="M194 92 Q264 46 334 92 Z" fill="#5879a7"/>
        <rect x="282" y="64" width="8" height="28" fill="#795548"/>
        <circle cx="286" cy="60" r="6" fill="#ef6a59"/>
        <text x="180" y="28" text-anchor="middle" font-size="18" fill="#8a3f35">小吃街 · 20个待入驻摊位</text>
      </svg>`;
    }
    return `<svg viewBox="0 0 360 180" role="img" aria-label="名胜古迹文件夹封面">
      <rect width="360" height="180" fill="#cfe8f2"/>
      <rect x="0" y="0" width="180" height="180" fill="#d9c9a8"/>
      <path d="M10 180 V70 Q30 30 60 34 L70 180 Z" fill="#b98f68"/>
      <path d="M108 180 V72 Q128 40 160 46 L170 180 Z" fill="#a97c58"/>
      <path d="M0 150 Q180 108 360 150 V180 H0 Z" fill="#88c178"/>
      <ellipse cx="268" cy="132" rx="80" ry="34" fill="#8fbf67"/>
      <text x="90" y="90" text-anchor="middle" font-size="18" fill="#fff" font-weight="700">云冈石窟</text>
      <text x="286" y="86" text-anchor="middle" font-size="18" fill="#2f6f3a" font-weight="700">科尔沁草原</text>
      <text x="180" y="28" text-anchor="middle" font-size="18" fill="#33415c">名胜古迹 · 草原 · 古城墙</text>
    </svg>`;
  }

  function categoryFoldersHtml() {
    return `<section class="folder-grid">
      ${CATEGORY_FOLDERS.map((folder) => {
        const list = categoryPlaces(folder.id);
        return `<article class="card folder-card">
          <div class="folder-cover">${folderCoverSvg(folder.id)}<span class="folder-count">${list.length} 处收录</span></div>
          <div class="folder-body">
            <h3>${folder.title}</h3>
            <p class="muted">${folder.intro}</p>
          </div>
          <div class="folder-actions">
            <button data-action="category-trip" data-id="${folder.id}" ${list.length ? '' : 'disabled'}>${icon('go')}随机打卡出发</button>
            <button class="primary" data-action="open-category" data-id="${folder.id}">进入文件夹</button>
          </div>
        </article>`;
      }).join('')}
    </section>`;
  }

  function folderContentsHtml(folderId) {
    const folder = CATEGORY_FOLDERS.find((item) => item.id === folderId) || { id: folderId, title: folderId, intro: '' };
    const isStreetFolder = folderId === '商场' || folderId === '小吃街';
    const list = isStreetFolder ? [] : categoryPlaces(folderId);
    const streetId = folderId === '商场' ? 'clothes' : folderId === '小吃街' ? 'snack' : '';
    const streetRow = state.mallStreets.find((street) => street.id === streetId);
    const streetHeading = folderId === '商场' ? '喵星购物中心 · 20家商场门店' : folderId === '小吃街' ? '宠物小吃夜市 · 20家小吃摊位' : (streetRow ? streetRow.name : '');
    const streetRows = streetRow ? `<div class="section-head"><h2>${escapeHtml(streetHeading)}</h2><span class="muted">${streetRow.shops.filter((shop) => shop.adopted).length}/20 已入驻</span></div>${streetBlockHtml(streetRow)}` : '';
    return `<div class="folder-inside-head">
      <div class="folder-cover folder-cover-small">${folderCoverSvg(folderId)}</div>
      <div>
        <h2>${folder.title}</h2>
        <p class="muted">${folder.intro}</p>
        <div class="folder-actions">
          <button data-action="category-trip" data-id="${folderId}" ${list.length ? '' : 'disabled'}>${icon('go')}随机打卡出发</button>
          <button data-action="back-folder">返回文件夹</button>
        </div>
      </div>
    </div>
    ${isStreetFolder ? '' : `<div class="section-head"><h2>${folder.title} · 具体场所</h2><span class="muted">${list.length} 处收录</span></div>
    <section class="place-grid">
      ${list.length ? list.map((place) => `<article class="card place-card">
        <div class="place-art" data-photo-click="place" data-id="${place.id}" title="点击上传或更换该场所封面">${placeArt(place.id)}<span class="photo-hint">${icon('camera')}</span></div>
        <div class="place-body">
          <h3>${escapeHtml(place.name)}</h3>
          <p class="muted">${escapeHtml(place.desc)}</p>
          <div class="price-row"><span class="price">${place.cost} 喵星币</span><div class="place-actions"><button data-action="fetch-place-image" data-id="${place.id}">换风景图</button><button class="primary" data-action="go-trip" data-id="${place.id}">${icon('go')}出发打卡</button></div></div>
        </div>
      </article>`).join('') : '<div class="card empty">这个文件夹还没有收录场所，先去搜索栏创建吧。</div>'}
    </section>`}
    ${streetRows}`;
  }

  async function saveCustomPlace() {
    const name = (state.addPlaceName || '').trim();
    if (!name) {
      setMessage('请先填写打卡场所名称。');
      render();
      return;
    }
    setBusy('正在创建场所…');
    try {
      const sceneKey = inferSceneKey(name);
      const data = await window.MeowAPI.post('/api/places', {
        name,
        kind: sceneKey === 'mall' || sceneKey === 'snack' ? 'mall' : 'travel',
        sceneKey,
        cost: 130
      });
      const existed = !!data.existing;
      state.places = state.places.some((place) => place.id === data.place.id)
        ? state.places.map((place) => place.id === data.place.id ? data.place : place)
        : state.places.concat([data.place]);
      state.addPlaceName = '';
      state.message = existed
        ? (data.message || `${name} 已收录，直接出发打卡即可。`)
        : `${name} 已收录到「${data.place.category || placeCategoryOf(data.place.sceneKey)}」目录。`;
      save();
      if (!existed) fetchPlaceImage(data.place.id);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy('');
      render();
    }
  }

  async function fetchPlaceImage(placeId) {
    setBusy('正在获取风景图…');
    try {
      const data = await window.MeowAPI.get(`/api/places/${placeId}/fetch-image`);
      state.places = state.places.map((place) => place.id === placeId ? data.place : place);
      state.message = '已更新风景图，出发打卡时会作为合影背景。';
      save();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy('');
      render();
    }
  }

  async function startTrip(placeId) {
    const cat = catById(state.currentCatId);
    const place = placeById(placeId);
    if (!cat || cat.id === 'placeholder') {
      setMessage('请先录入猫咪档案。');
      render();
      return;
    }
    if (!place) {
      setMessage('场所不存在。');
      render();
      return;
    }
    const cost = Number(place.cost) || 0;
    const balance = typeof cat.balance === 'number' ? cat.balance : state.balance;
    if (balance < cost) {
      setError(`${cat.name}的喵星币不足：${place.name}需要 ${cost} 喵星币，当前只有 ${balance} 喵星币。`);
      render();
      return;
    }
    setBusy(`正在带${cat.name}出发…`);
    try {
      const data = await window.MeowAPI.post(`/api/places/${placeId}/checkin`, {
        catId: cat.id,
        photo: state.placeImages && state.placeImages[placeId] ? state.placeImages[placeId] : undefined
      });
      cat.balance = data.balance;
      state.balance = state.cats.reduce((sum, item) => sum + (item.balance || 0), 0);
      state.trips = state.trips.concat([data.trip]);
      state.feed = [{
        ...data.post,
        likedBy: Array.isArray(data.post.likedBy) ? data.post.likedBy : [],
        comments: Array.isArray(data.post.comments) ? data.post.comments : []
      }].concat(state.feed);
      state.message = `出发成功：${place.name}，${data.event ? data.event.expression : ''}打卡照已生成。`;
      save();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy('');
      render();
    }
  }

  async function refreshFeed(scope) {
    state.feedScope = scope || state.feedScope;
    state.feedLoading = true;
    render();
    try {
      const data = await window.MeowAPI.get(`/api/posts?scope=${state.feedScope}`);
      state.feed = (data.posts || []).map((post) => ({
        ...post,
        likedBy: Array.isArray(post.likedBy) ? post.likedBy : [],
        comments: Array.isArray(post.comments) ? post.comments : []
      }));
      save();
    } catch (err) {
      setMessage(err.message);
    } finally {
      state.feedLoading = false;
      render();
    }
  }

  async function publishPost() {
    const cat = catById(state.currentCatId);
    if (!cat || cat.id === 'placeholder') {
      setMessage('请先录入猫咪档案。');
      render();
      return;
    }
    setBusy('正在发布…');
    try {
      const kind = state.draft.kind || 'trip';
      const caption = (state.draft.caption || '').trim() || `${cat.name}的${kindLabel(kind)}`;
      const data = await window.MeowAPI.post('/api/posts', {
        catId: cat.id,
        kind,
        placeId: state.draft.placeId || (state.places[0] || PLACES[0]).id,
        caption,
        photo: state.draft.photo || ''
      });
      state.feed = [{
        ...data.post,
        likedBy: [],
        comments: []
      }].concat(state.feed);
      state.draft.caption = '';
      state.draft.photo = '';
      state.message = '晒照已发布到喵推广场。';
      save();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy('');
      render();
    }
  }

  async function reactPost(postId, type) {
    try {
      const data = await window.MeowAPI.post(`/api/posts/${postId}/like`, { type });
      const lists = [
        state.feed,
        state.neighborDetail && state.neighborDetail.posts,
        state.neighborDetail && state.neighborDetail.ownerPosts
      ];
      lists.forEach((list) => {
        if (!Array.isArray(list)) return;
        const post = list.find((item) => item.id === postId);
        if (post) {
          post.reactions = data.reactions;
          post.likes = data.likes;
        }
      });
      state.message = `${type} ${data.liked ? '已送上。' : '已取消。'}`;
      save();
    } catch (err) {
      setMessage(err.message);
    } finally {
      render();
    }
  }

  async function deletePost(postId) {
    setBusy('正在删除…');
    try {
      await window.MeowAPI.del(`/api/posts/${postId}`);
      state.feed = state.feed.filter((post) => post.id !== postId);
      state.message = '推文已删除。';
      save();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy('');
      render();
    }
  }

  async function commentPost(postId) {
    const text = prompt('写一条评论：');
    if (!text || !text.trim()) return;
    setBusy('正在发送评论…');
    try {
      const data = await window.MeowAPI.post(`/api/posts/${postId}/comment`, { text: text.trim() });
      const post = state.feed.find((item) => item.id === postId);
      if (post && post.comments) post.comments.push(data.comment);
      state.message = '评论已发布。';
      save();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy('');
      render();
    }
  }

  async function syncHealthToServer() {
    const cat = catById(state.currentCatId);
    if (!cat || cat.id === 'placeholder') {
      setMessage('请先录入猫咪档案。');
      render();
      return;
    }
    setBusy('正在同步健康数据…');
    try {
      const data = await window.MeowAPI.post('/api/health/sync', {
        catId: cat.id,
        weight: Number(cat.weight) || 0,
        poop: Number(cat.poop) || 0,
        pee: Number(cat.pee) || 0,
        protein: Number(cat.protein) || 0
      });
      cat.balance = data.cat.balance;
      cat.healthSyncs = data.cat.healthSyncs;
      state.balance = state.cats.reduce((sum, item) => sum + (item.balance || 0), 0);
      state.lastSync = nowLabel();
      state.message = `健康数据同步完成，奖励 ${data.reward} 喵星币。`;
      save();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy('');
      render();
    }
  }

  async function loadFollowList(type) {
    state.friendListType = type || state.friendListType;
    try {
      const data = await window.MeowAPI.get(`/api/follows?type=${state.friendListType}`);
      if (state.friendListType === 'followers') {
        state.followersList = data.users || [];
        state.followersCount = data.count || data.users.length;
      } else {
        state.followingList = data.users || [];
        state.followingCount = data.count || data.users.length;
      }
      save();
    } catch (err) {
      setMessage(err.message);
    } finally {
      render();
    }
  }

  async function searchFriends() {
    const input = document.querySelector('[data-friend-search]');
    state.friendSearch = input ? input.value.trim() : (state.friendSearch || '');
    if (!state.friendSearch) {
      setMessage('请输入猫咪姓名或品种。');
      render();
      return;
    }
    setBusy('正在检索…');
    try {
      const data = await window.MeowAPI.get(`/api/cats/search?q=${encodeURIComponent(state.friendSearch)}`);
      state.searchResults = data.cats || [];
      state.message = state.searchResults.length ? `找到 ${state.searchResults.length} 只猫咪。` : '没有找到匹配的猫咪。';
      save();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy('');
      render();
    }
  }

  async function followUser(targetId, alreadyFollowing) {
    if (!targetId) {
      setMessage('请先选择一位家长。');
      render();
      return;
    }
    setBusy(alreadyFollowing ? '正在取消关注…' : '正在关注…');
    try {
      const data = alreadyFollowing
        ? await window.MeowAPI.del(`/api/follows/${targetId}`)
        : await window.MeowAPI.post(`/api/follows/${targetId}`);
      state.followingCount = data.followingCount;
      state.followersCount = data.followers;
      state.message = alreadyFollowing ? '已取消关注。' : '关注成功。';
      if (data.relation) {
        const relation = data.relation;
        if (state.neighborDetail && state.neighborDetail.owner && state.neighborDetail.owner.id === targetId) {
          Object.assign(state.neighborDetail.owner, relation);
        }
        if (state.userDetail && state.userDetail.id === targetId) {
          Object.assign(state.userDetail, relation);
        }
        state.searchResults = state.searchResults.map((cat) => {
          if (cat.owner && cat.owner.id === targetId) {
            return { ...cat, owner: { ...cat.owner, ...relation } };
          }
          return cat;
        });
      }
      await Promise.all([loadFollowList('following'), loadFollowList('followers')]);
      save();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy('');
      render();
    }
  }

  async function loadUserProfile(userId) {
    setBusy('正在打开主页…');
    try {
      const data = await window.MeowAPI.get(`/api/users/${userId}`);
      state.userDetail = data.user;
      state.viewingUser = userId;
      setLocation(`/user/${userId}`);
      save();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy('');
      render();
    }
  }

  async function loadNeighbor(catId) {
    setBusy('正在打开猫咪主页…');
    try {
      const data = await window.MeowAPI.get(`/api/cats/${catId}`);
      state.neighborDetail = data.cat;
      state.viewingNeighbor = catId;
      state.neighborTab = 'profile';
      state.viewingUser = null;
      state.message = '';
      setLocation(`/neighbor/${catId}`);
      save();
    } catch (err) {
      setMessage(err.message);
      if (err.status === 404) {
        state.viewingNeighbor = null;
      }
    } finally {
      setBusy('');
      render();
    }
  }

  async function postBullet(catId) {
    const kindEl = document.querySelector('[data-bullet-kind]');
    const textEl = document.querySelector('[data-bullet-text]');
    const text = textEl ? textEl.value.trim() : '';
    if (!text) {
      setMessage('请先写一句弹幕留言。');
      render();
      return;
    }
    setBusy('正在发布弹幕…');
    try {
      const data = await window.MeowAPI.post(`/api/cats/${catId}/bullet`, {
        text,
        kind: kindEl ? kindEl.value : 'praise'
      });
      if (state.neighborDetail && state.neighborDetail.id === catId) {
        state.neighborDetail.bullets = [data.bullet].concat(state.neighborDetail.bullets || []);
      }
      state.bulletDraft = '';
      state.message = '弹幕留言已发布。';
      save();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy('');
      render();
    }
  }

  async function rentShop(shopId) {
    const draft = state.shopDraft || {};
    const storeName = (draft.storeName || '').trim();
    if (!storeName) {
      setMessage('请填写店铺名称。');
      render();
      return;
    }
    setBusy('正在入驻店铺…');
    try {
      const data = await window.MeowAPI.post(`/api/mall/shops/${shopId}/rent`, {
        storeName,
        facade: draft.facade || '',
        itemImage: draft.itemImage || ''
      });
      state.mallStreets = state.mallStreets.map((street) => ({
        ...street,
        shops: street.shops.map((shop) => shop.id === shopId ? data.shop : shop)
      }));
      state.rentingShopId = '';
      state.shopDraft = null;
      state.message = `${data.shop.name} 已入驻营业。`;
      save();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy('');
      render();
    }
  }

  async function visitShop(shopId) {
    const cat = catById(state.currentCatId);
    if (!cat || cat.id === 'placeholder') {
      setMessage('请先录入猫咪档案。');
      render();
      return;
    }
    setBusy(`正在带${cat.name}进店…`);
    try {
      const data = await window.MeowAPI.post(`/api/mall/shops/${shopId}/visit`, { catId: cat.id });
      state.trips = state.trips.concat([data.trip]);
      state.feed = [{
        ...data.post,
        likedBy: Array.isArray(data.post.likedBy) ? data.post.likedBy : [],
        comments: Array.isArray(data.post.comments) ? data.post.comments : []
      }].concat(state.feed);
      state.message = `进店成功：${data.event.expression}打卡照已发布。`;
      save();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy('');
      render();
    }
  }

  document.addEventListener('click', (event) => {
    // 点弹窗遮罩关闭（点弹窗本体不关）
    const viewsBackdrop = event.target.closest('[data-views-modal]');
    if (viewsBackdrop && !event.target.closest('.views-modal')) {
      closeViews();
      return;
    }
    const photoClick = event.target.closest('[data-photo-click]');
    if (photoClick) {
      openFilePicker(photoClick.dataset.photoClick, photoClick.dataset.id);
      return;
    }
    const button = event.target.closest('[data-action]');
    if (!button) return;
    handleAction(button.dataset.action, button.dataset.id, button.dataset.type || '');
  });

  document.addEventListener('change', (event) => {
    const angleSelect = event.target.closest('[data-views-angle]');
    if (angleSelect) {
      setViewAngle(angleSelect.dataset.id, angleSelect.value);
      return;
    }
    const shopName = event.target.closest('[data-shop-name]');
    if (shopName) {
      state.shopDraft = state.shopDraft || {};
      state.shopDraft.storeName = shopName.value;
      return;
    }
    const bulletText = event.target.closest('[data-bullet-text]');
    if (bulletText) {
      state.bulletDraft = bulletText.value;
      return;
    }
    const friendInput = event.target.closest('[data-friend-search]');
    if (friendInput) {
      state.friendSearch = friendInput.value;
      return;
    }
    const placeInput = event.target.closest('[data-add-place-name]');
    if (placeInput) {
      state.addPlaceName = placeInput.value;
      return;
    }
    const authInput = event.target.closest('[data-auth-field]');
    if (authInput) {
      state.authInputs = state.authInputs || {};
      state.authInputs[authInput.dataset.authField] = authInput.value;
      return;
    }
    const addInput = event.target.closest('[data-add-field]');
    if (addInput) {
      state.addDraft = state.addDraft || {};
      state.addDraft[addInput.dataset.addField] = addInput.type === 'checkbox' ? addInput.checked : addInput.value;
      return;
    }
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
      if (input.type === 'checkbox') {
        cat[field] = input.checked;
      } else if (field === 'birthDate') {
        cat.birthDate = input.value;
        cat.age = ageFromBirthDate(input.value);
      } else if (field === 'age') {
        cat.age = Number(input.value) || 0;
        if (cat.age > 0) cat.birthDate = birthDateFromAge(cat.age);
      } else if (field === 'name' || field === 'breed' || field === 'gender') {
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

  // 多视角弹窗：拖拽上传。弹窗开着时全页都要 preventDefault，
  // 否则拖到弹窗外浏览器会直接打开这张图片
  ['dragenter', 'dragover'].forEach((type) => {
    document.addEventListener(type, (event) => {
      if (!viewsSession) return;
      event.preventDefault();
      const zone = event.target.closest && event.target.closest('[data-views-drop]');
      if (zone) zone.classList.add('dragging');
    });
  });

  document.addEventListener('dragleave', (event) => {
    if (!viewsSession) return;
    const zone = event.target.closest && event.target.closest('[data-views-drop]');
    if (zone) zone.classList.remove('dragging');
  });

  document.addEventListener('drop', (event) => {
    if (!viewsSession) return;
    event.preventDefault();
    const zone = event.target.closest && event.target.closest('[data-views-drop]');
    if (zone) zone.classList.remove('dragging');
    const files = event.dataTransfer && event.dataTransfer.files;
    if (files && files.length) uploadViewFiles(files);
  });

  window.addEventListener('popstate', () => {
    routeFromLocation();
  });

  window.addEventListener('hashchange', () => {
    routeFromLocation();
  });

  window.__meow3dCat = (id) => catById(id);
  window.__meow3dShop = (id) => findShopById(id);
  window.__meow3dCurrentCatId = () => state.currentCatId;

  initApp();
})();

