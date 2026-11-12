const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const VIEW_DIR = path.join(DATA_DIR, 'views');
const VIEW_MAX_BYTES = 14 * 1024 * 1024;
const VIEW_MAX_COUNT = 60;
const VIEW_ANGLES = ['front', 'left', 'right', 'back', 'top', 'bottom', 'face', 'body', 'extra'];

const REACTION_TYPES = ['亲亲', '摸肚皮', '摸爪', '咬妙脆角', '弹QQ'];

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function hashPassword(password, salt) {
  return crypto.createHash('sha256').update(`${salt}:${password}`).digest('hex');
}

function randomToken() {
  return crypto.randomBytes(24).toString('hex');
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function nowLabel() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isoNow() {
  return new Date().toISOString();
}

function seedDb() {
  const salt = 'meow-salt-v1';
  const parent = (id, phone, nickname) => ({
    id,
    phone,
    nickname,
    passwordHash: hashPassword('123456', salt),
    salt,
    avatar: '',
    background: '',
    createdAt: isoNow()
  });

  const users = [
    parent('u-tuan-parent', '13800000001', '团子家长'),
    parent('u-mimi-parent', '13800000002', '米咪家长'),
    parent('u-doudou-parent', '13800000003', '豆豆家长'),
    parent('u-xia-parent', '13800000004', '夏豆豆家长'),
    parent('u-leaf-parent', '13800000005', '小叶子家长'),
    parent('u-zhang-parent', '13800000006', '张二咪家长'),
    parent('u-san-parent', '13800000007', '张三咪家长')
  ];

  const cat = (id, ownerId, name, breed, gender, age, birthDate, color, color2, belly, weight, poop, pee, protein) => ({
    id,
    ownerId,
    name,
    breed,
    gender,
    age,
    birthDate,
    neutered: false,
    visible: true,
    avatar: '',
    background: '',
    color,
    color2,
    belly,
    weight,
    poop,
    pee,
    protein,
    healthSyncs: 0,
    balance: 620,
    createdAt: isoNow()
  });

  const cats = [
    cat('cat-tuan', 'u-tuan-parent', '团子', '三花猫', '女', 3, '2023-06-14', '#f2a65a', '#f7d6a3', '#fff3df', 3.8, 2, 5, 0.06),
    cat('cat-mimi', 'u-mimi-parent', '米咪', '英短蓝猫', '女', 2, '2024-07-02', '#7f9db9', '#b9cadd', '#eaf1f7', 3.2, 2, 6, 0.08),
    cat('cat-doudou', 'u-doudou-parent', '豆豆', '橘猫', '男', 4, '2022-03-09', '#e8903f', '#f6c07a', '#fff0d8', 4.5, 1, 4, 0.11),
    cat('cat-xia', 'u-xia-parent', '夏豆豆', '奶牛猫', '男', 3, '2023-05-20', '#5a6770', '#a8b6bd', '#eef3f5', 3.5, 2, 5, 0.08),
    cat('cat-leaf', 'u-leaf-parent', '小叶子', '虎斑猫', '女', 2, '2024-08-15', '#8ba968', '#c5d6a5', '#f5f9eb', 3.2, 2, 5, 0.07),
    cat('cat-zhang', 'u-zhang-parent', '张二咪', '橘猫', '男', 4, '2022-11-01', '#e8a04c', '#f7ca83', '#fff0d8', 5.2, 3, 7, 0.12),
    cat('cat-san', 'u-san-parent', '张三咪', '狸花猫', '女', 3, '2023-09-18', '#c18e6a', '#dfb596', '#fff3e8', 4.7, 2, 5, 0.19)
  ];

  const places = [
    { id: 'pond', name: '池塘', kind: 'travel', sceneKey: 'pond', category: '自然风光', cost: 120, desc: '荷叶船、小鱼干和晒太阳的芦苇岸', funText: '在荷叶船上捞到了一条会发光的鱼干' },
    { id: 'landmark', name: '云冈石窟', kind: 'travel', sceneKey: 'landmark', category: '名胜古迹', cost: 180, desc: '北方名窟，大佛和石阶都很壮观', funText: '站在石窟前惊叹了一下午' },
    { id: 'khorqin', name: '科尔沁草原', kind: 'travel', sceneKey: 'grass', category: '自然风光', cost: 170, desc: '一望无际的草原和牛羊群', funText: '在草原上打滚，尾巴沾了一路青草味' },
    { id: 'hgs', name: '黄果树瀑布', kind: 'travel', sceneKey: 'waterfall', category: '自然风光', cost: 185, desc: '飞瀑、水雾和彩虹桥', funText: '在水雾里看彩虹，爪爪都被瀑布打湿了' },
    { id: 'citywall', name: '西安古城墙', kind: 'travel', sceneKey: 'landmark', category: '名胜古迹', cost: 190, desc: '青砖城墙和黄昏里的鼓楼', funText: '在城墙上来回溜达了两圈' },
    { id: 'school', name: '第二实验小学', kind: 'travel', sceneKey: 'school', category: '学校', cost: 100, desc: '喵星课堂、图书角和午睡垫', funText: '认真听了一节小鱼干物理课' },
    { id: 'kindergarten', name: '喵星幼儿园', kind: 'travel', sceneKey: 'school', category: '学校', cost: 90, desc: '滑梯、绘本角和软乎乎的午睡垫', funText: '和小朋友玩了半天滑梯' },
    { id: 'hospital', name: '第一人民医院', kind: 'travel', sceneKey: 'hospital', category: '医院', cost: 150, desc: '体检室、健康小旗和薄荷糖', funText: '完成了全身体检并拿到健康小旗' },
    { id: 'dental', name: '喵星牙科诊所', kind: 'travel', sceneKey: 'hospital', category: '医院', cost: 160, desc: '牙医小镜子、蛀牙小虫和拔牙警告', funText: '咬着爪爪完成了牙科检查' },
    { id: 'mall', name: '喵星购物中心', kind: 'mall', sceneKey: 'mall', category: '商场', cost: 220, desc: '玻璃橱窗、试衣间和猫咪电梯', funText: '试了十顶帽子，逛到尾巴打转' },
    { id: 'snack', name: '宠物小吃夜市', kind: 'mall', sceneKey: 'snack', category: '小吃街', cost: 160, desc: '奶茶摊、烧烤摊和章鱼小丸子', funText: '一口气打卡三条小吃夜市，肚皮圆滚滚' }
  ];

  const streets = ['clothes', 'snack'];
  const shops = [];
  streets.forEach((street, streetIndex) => {
    for (let no = 1; no <= 20; no += 1) {
      shops.push({
        id: `shop-${street}-${no}`,
        street,
        no,
        name: '',
        ownerId: null,
        facade: '',
        itemImage: '',
        adopted: false,
        displayName: `${street === 'clothes' ? '商场门店' : '小吃摊位'} NO.${String(no).padStart(2, '0')}`
      });
    }
  });

  const posts = [
    { id: uid('post'), ownerId: 'u-tuan-parent', catId: 'cat-tuan', kind: 'trip', placeId: 'snack', caption: '被小吃街的风味封印了，今晚要抱着小鱼干睡觉。', photo: '', likes: 18, likedBy: ['u-mimi-parent', 'u-leaf-parent'], comments: [{ id: uid('comment'), userId: 'u-mimi-parent', nickname: '米咪家长', text: '求带同款路线', time: '昨天 20:01', color: '#2f9e8f' }], time: '昨天 19:42' },
    { id: uid('post'), ownerId: 'u-mimi-parent', catId: 'cat-mimi', kind: 'friend', placeId: 'pond', caption: '和隔壁的小橘猫交换了猫抓板，友情达成。', photo: '', likes: 24, likedBy: ['u-tuan-parent'], comments: [], time: '昨天 16:08' },
    { id: uid('post'), ownerId: 'u-doudou-parent', catId: 'cat-doudou', kind: 'withOwner', placeId: 'landmark', caption: '和主人一起看晚霞，今天也是被爱包围的喵。', photo: '', likes: 31, likedBy: ['u-tuan-parent', 'u-zhang-parent'], comments: [], time: '前天 18:20' }
  ];

  const bullets = [
    { id: uid('bullet'), targetCatId: 'cat-zhang', fromUserId: 'u-xia-parent', nickname: '夏豆豆家长', kind: 'praise', text: '团子今天吃得健康又规律，隔壁张二咪还在半路抛锚呢。', time: '昨天 12:30', color: '#e05d6f' },
    { id: uid('bullet'), targetCatId: 'cat-xia', fromUserId: 'u-zhang-parent', nickname: '张二咪家长', kind: 'roast', text: '隔壁村张二咪前来pk，但垃圾食品吃太多胖得走不动道。', time: '昨天 13:10', color: '#3f7fbf' }
  ];

  const follows = [
    { followerId: 'u-tuan-parent', followingId: 'u-mimi-parent' },
    { followerId: 'u-tuan-parent', followingId: 'u-leaf-parent' },
    { followerId: 'u-mimi-parent', followingId: 'u-tuan-parent' },
    { followerId: 'u-doudou-parent', followingId: 'u-tuan-parent' }
  ];

  return {
    users,
    cats,
    places,
    shops,
    posts,
    bullets,
    follows,
    sessions: [],
    trips: [
      { id: uid('trip'), catId: 'cat-tuan', ownerId: 'u-tuan-parent', placeId: 'snack', time: '昨天 19:42', note: '打卡小吃街', photo: '', caption: '被小吃街的风味封印了' },
      { id: uid('trip'), catId: 'cat-mimi', ownerId: 'u-mimi-parent', placeId: 'mall', time: '前天 14:10', note: '逛商场', photo: '', caption: '商场橱窗购物记' }
    ],
    inventory: []
  };
}

function loadDb() {
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    const seeded = seedDb();
    return {
      ...seeded,
      ...parsed,
      users: Array.isArray(parsed.users) ? parsed.users : seeded.users,
      cats: Array.isArray(parsed.cats) ? parsed.cats : seeded.cats,
      places: (() => {
        const parsedPlaces = Array.isArray(parsed.places) ? parsed.places : [];
        const seedMap = new Map(seeded.places.map((place) => [place.id, place]));
        const merged = parsedPlaces.map((place) => {
          const seed = seedMap.get(place.id);
          if (!seed) {
            const sceneKey = place.sceneKey && place.sceneKey !== 'custom' ? place.sceneKey : inferPlaceSceneKey(place.name);
            const category = sceneKey === 'snack' ? '小吃街'
              : sceneKey === 'mall' ? '商场'
              : sceneKey === 'school' ? '学校'
              : sceneKey === 'hospital' ? '医院'
              : ['pond', 'grass', 'sea', 'waterfall'].includes(sceneKey) ? '自然风光'
              : '名胜古迹';
            return { ...place, sceneKey, category };
          }
          return {
            ...place,
            name: seed.name,
            kind: seed.kind,
            sceneKey: seed.sceneKey,
            category: seed.category,
            cost: place.cost || seed.cost,
            desc: place.desc || seed.desc,
            funText: place.funText || seed.funText
          };
        });
        const missing = seeded.places.filter((seed) => !merged.some((place) => place.id === seed.id));
        const combined = merged.concat(missing);
        return combined.filter((place, index, all) => {
          const key = String(place.name || '').trim().toLowerCase();
          return all.findIndex((item) => String(item.name || '').trim().toLowerCase() === key) === index;
        });
      })(),
      shops: Array.isArray(parsed.shops) ? parsed.shops.map((shop) => shop.adopted
        ? shop
        : ({ ...shop, displayName: `${shop.street === 'clothes' ? '商场门店' : '小吃摊位'} NO.${String(shop.no || '').padStart(2, '0')}` }))
        : seeded.shops,
      posts: Array.isArray(parsed.posts) ? parsed.posts.map(normalizePost) : seeded.posts.map(normalizePost),
      bullets: Array.isArray(parsed.bullets) ? parsed.bullets : seeded.bullets,
      follows: Array.isArray(parsed.follows) ? parsed.follows : seeded.follows,
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : seeded.sessions,
      trips: Array.isArray(parsed.trips) ? parsed.trips : seeded.trips,
      inventory: Array.isArray(parsed.inventory) ? parsed.inventory : seeded.inventory
    };
  } catch (_) {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const seeded = seedDb();
    saveDb(seeded);
    return seeded;
  }
}

function saveDb(db) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

/* ---------------- 多视角照片（3D 重建素材） ---------------- *
 * 单张图片走原始二进制 body，不塞进 JSON：
 * 原来的 readBody 是「字符串累加 + 超 5MB 截断」，base64 塞进去会被悄悄截断成坏图。
 * 文件落在 data/views/<catId>/ 下，静态目录本来就能直接访问，URL 即文件路径。 */
function readBinary(req, limit = VIEW_MAX_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let failed = false;
    req.on('data', (chunk) => {
      if (failed) return;
      size += chunk.length;
      if (size > limit) {
        failed = true;
        reject(new Error(`单张图片不能超过 ${Math.round(limit / 1024 / 1024)}MB`));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => { if (!failed) resolve(Buffer.concat(chunks)); });
    req.on('error', (err) => { if (!failed) reject(err); });
  });
}

function sniffImage(buffer) {
  if (!buffer || buffer.length < 12) return '';
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'jpg';
  if (buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP') return 'webp';
  return '';
}

function safeViewName(raw) {
  const text = String(raw || '').replace(/[^\w.\-\u4e00-\u9fa5]+/g, '_').slice(0, 60);
  return text || 'view';
}

function catViewDir(catId) {
  const safeId = String(catId).replace(/[^\w-]/g, '');
  return path.join(VIEW_DIR, safeId);
}

function catViewsOf(cat) {
  if (!Array.isArray(cat.views)) cat.views = [];
  return cat.views;
}

function viewSummary(cat) {
  const views = catViewsOf(cat);
  const angles = {};
  views.forEach((view) => { angles[view.angle] = (angles[view.angle] || 0) + 1; });
  return {
    views,
    count: views.length,
    bytes: views.reduce((sum, view) => sum + (view.size || 0), 0),
    angles,
    recon: cat.recon || null
  };
}

async function handleViewUpload(req, res, url, db, user, catId) {
  if (!user) return json(res, 401, { error: '请先登录。' });
  const cat = db.cats.find((item) => item.id === catId);
  if (!cat) return json(res, 404, { error: '猫咪不存在。' });
  if (cat.ownerId !== user.id) return json(res, 403, { error: '只能给自己的猫咪上传照片。' });
  if (catViewsOf(cat).length >= VIEW_MAX_COUNT) {
    return json(res, 400, { error: `最多 ${VIEW_MAX_COUNT} 张，请先删掉一些再上传。` });
  }

  let buffer;
  try {
    buffer = await readBinary(req);
  } catch (err) {
    return json(res, 413, { error: err.message || '图片太大。' });
  }
  if (!buffer || !buffer.length) return json(res, 400, { error: '没有收到图片数据。' });
  const ext = sniffImage(buffer);
  if (!ext) return json(res, 415, { error: '只支持 JPG / PNG / WebP 图片。' });

  const dir = catViewDir(cat.id);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const id = uid('view');
  const fileName = `${Date.now().toString(36)}-${id.slice(-4)}.${ext}`;
  fs.writeFileSync(path.join(dir, fileName), buffer);

  const angleRaw = String(url.searchParams.get('angle') || 'extra');
  const angle = VIEW_ANGLES.includes(angleRaw) ? angleRaw : 'extra';
  const view = {
    id,
    url: `/data/views/${cat.id}/${fileName}`,
    angle,
    name: safeViewName(url.searchParams.get('name')),
    size: buffer.length,
    width: Number(url.searchParams.get('w')) || 0,
    height: Number(url.searchParams.get('h')) || 0,
    at: isoNow()
  };
  catViewsOf(cat).push(view);
  cat.recon = {
    status: 'collecting',
    updatedAt: isoNow(),
    note: `已收集 ${cat.views.length} 张多视角照片，等待重建`
  };
  saveDb(db);
  writeViewManifest(cat);
  return json(res, 200, { view, ...viewSummary(cat) });
}

function writeViewManifest(cat) {
  const dir = catViewDir(cat.id);
  if (!fs.existsSync(dir)) return;
  const manifest = {
    catId: cat.id,
    catName: cat.name,
    breed: cat.breed,
    updatedAt: isoNow(),
    count: catViewsOf(cat).length,
    angles: VIEW_ANGLES.reduce((acc, key) => {
      const list = catViewsOf(cat).filter((view) => view.angle === key);
      if (list.length) acc[key] = list.map((view) => path.basename(view.url));
      return acc;
    }, {}),
    views: catViewsOf(cat)
  };
  try {
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  } catch (_) { /* 写清单失败不影响上传本身 */ }
}

function normalizeReactions(post) {
  const source = post.reactions || {};
  const result = {};
  REACTION_TYPES.forEach((type) => {
    result[type] = Array.isArray(source[type]) ? source[type] : [];
  });
  if (!post.reactions && Array.isArray(post.likedBy) && post.likedBy.length) {
    result['亲亲'] = post.likedBy.slice();
  }
  return result;
}

function normalizePost(post) {
  const reactions = normalizeReactions(post);
  const likes = REACTION_TYPES.reduce((sum, type) => sum + reactions[type].length, 0);
  return { ...post, reactions, likes };
}

function json(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 5 * 1024 * 1024) {
        raw = raw.slice(0, 5 * 1024 * 1024);
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (_) {
        resolve({});
      }
    });
  });
}

function authUser(db, req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const session = db.sessions.find((item) => item.token === token);
  if (!session) return null;
  return db.users.find((user) => user.id === session.userId) || null;
}

function publicUser(user, db, viewerId) {
  const safe = { ...user };
  delete safe.passwordHash;
  delete safe.salt;
  safe.followers = countFollowers(db, user.id);
  safe.following = countFollowing(db, user.id);
  if (viewerId) {
    safe.iFollow = db.follows.some((item) => item.followerId === viewerId && item.followingId === user.id);
    safe.followsYou = db.follows.some((item) => item.followerId === user.id && item.followingId === viewerId);
  }
  safe.cats = db.cats
    .filter((cat) => cat.ownerId === user.id && cat.visible)
    .map((cat) => publicCat(cat, db));
  return safe;
}

function publicCat(cat, db) {
  return {
    id: cat.id,
    ownerId: cat.ownerId,
    name: cat.name,
    breed: cat.breed,
    gender: cat.gender,
    age: cat.age,
    birthDate: cat.birthDate,
    neutered: cat.neutered,
    visible: cat.visible,
    avatar: cat.avatar,
    background: cat.background,
    color: cat.color,
    color2: cat.color2,
    belly: cat.belly,
    weight: cat.weight,
    poop: cat.poop,
    pee: cat.pee,
    protein: cat.protein,
    healthSyncs: cat.healthSyncs,
    balance: cat.balance,
    viewCount: Array.isArray(cat.views) ? cat.views.length : 0,
    recon: cat.recon || null,
    coatProfile: cat.coatProfile || null
  };
}

function countFollowers(db, userId) {
  return db.follows.filter((item) => item.followingId === userId).length;
}

function countFollowing(db, userId) {
  return db.follows.filter((item) => item.followerId === userId).length;
}

function relationOf(db, viewerId, targetId) {
  return {
    iFollow: db.follows.some((item) => item.followerId === viewerId && item.followingId === targetId),
    followsYou: db.follows.some((item) => item.followerId === targetId && item.followingId === viewerId)
  };
}

function postPayload(post, db) {
  const cat = db.cats.find((item) => item.id === post.catId) || null;
  const owner = db.users.find((item) => item.id === post.ownerId) || null;
  return {
    ...post,
    catName: cat ? cat.name : '未知猫咪',
    catAvatar: cat ? cat.avatar : '',
    ownerName: owner ? owner.nickname : '未知家长',
    ownerId: owner ? owner.id : ''
  };
}

function catPostCount(catId, db) {
  return db.posts.filter((post) => post.catId === catId).length;
}

function catCommentCount(catId, db) {
  return db.bullets.filter((bullet) => bullet.targetCatId === catId).length;
}

function catDetailPayload(cat, db, viewerId) {
  const payload = publicCat(cat, db);
  const owner = db.users.find((user) => user.id === cat.ownerId) || null;
  payload.owner = owner ? publicUser(owner, db, viewerId) : null;
  payload.postCount = catPostCount(cat.id, db);
  payload.bulletCount = catCommentCount(cat.id, db);
  payload.posts = db.posts.filter((post) => post.catId === cat.id).map((post) => postPayload(post, db));
  payload.ownerPosts = db.posts.filter((post) => post.ownerId === cat.ownerId).map((post) => postPayload(post, db));
  payload.bullets = db.bullets.filter((bullet) => bullet.targetCatId === cat.id);
  payload.trips = db.trips.filter((trip) => trip.catId === cat.id);
  if (owner) {
    payload.ownerFollowing = db.follows
      .filter((follow) => follow.followerId === owner.id)
      .map((follow) => db.users.find((user) => user.id === follow.followingId))
      .filter(Boolean)
      .map((user) => publicUser(user, db, viewerId));
    payload.ownerFollowers = db.follows
      .filter((follow) => follow.followingId === owner.id)
      .map((follow) => db.users.find((user) => user.id === follow.followerId))
      .filter(Boolean)
      .map((user) => publicUser(user, db, viewerId));
  } else {
    payload.ownerFollowing = [];
    payload.ownerFollowers = [];
  }
  return payload;
}

function birthDateByAge(age) {
  const now = new Date();
  const date = new Date(now.getFullYear() - age, now.getMonth(), now.getDate());
  return date.toISOString().slice(0, 10);
}

function ageByBirthDate(birthDate) {
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

function makePost(db, ownerId, catId, kind, placeId, caption, photo) {
  const post = {
    id: uid('post'),
    ownerId,
    catId,
    kind,
    placeId,
    caption,
    photo: photo || '',
    likes: 0,
    likedBy: [],
    comments: [],
    time: nowLabel()
  };
  db.posts.unshift(post);
  return post;
}

function renderScenePhoto(cat, place) {
  if (place && place.image) {
    return place.image;
  }
  if (place && place.ownerImage) {
    return place.ownerImage;
  }
  return '';
}

function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function inferPlaceSceneKey(name) {
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

async function searchRemoteImage(name) {
  const keyword = encodeURIComponent(`${name} 景点 风景照`);
  try {
    const res = await fetch(`https://www.bing.com/images/search?q=${keyword}&format=rss`);
    if (res.ok) {
      const text = await res.text();
      const urls = [];
      const pattern = /<media:content url="([^"]+)"/g;
      let match;
      while ((match = pattern.exec(text))) {
        urls.push(match[1]);
      }
      if (urls.length) return randomPick(urls);
    }
  } catch (_) {
    // 网络图源不可用时使用公开图源兜底
  }
  return `https://source.unsplash.com/900x540/?${keyword}`;
}

const MALL_EVENTS = {
  clothes: [
    { expression: '试穿臭美', caption: '这件新衣服一上身，镜子都想退货：帅得像明星出街。' },
    { expression: '耍酷', caption: '墨镜一戴谁都不爱，整条街都在问这个酷盖是谁。' },
    { expression: '卖萌', caption: '店员姐姐给戴了个小蝴蝶结，全员心软到排队合影。' },
    { expression: '拽', caption: '试衣间走出来的步伐带风，老板当场想签代言。' }
  ],
  snack: [
    { expression: '沉浸式干饭', caption: '一口小鱼干下去，眼睛都亮了：这就是幸福的味道。' },
    { expression: '沉迷美食', caption: '光盘速度打破本店记录，老板当场送了一盒试吃。' },
    { expression: '不好吃', caption: '这口章鱼小丸子好像没熟，表情管理彻底失败。' },
    { expression: '回味无穷', caption: '第二份半价，猫咪表示还能再来两份。' }
  ]
};

const TRAVEL_EVENTS = {
  landmark: [
    { expression: '惊叹', caption: '站上城楼这一刻，惊叹得尾巴都忘了摇。' },
    { expression: '兴奋', caption: '登顶成功，风大到耳朵起飞，开心得原地转圈。' },
    { expression: '累崩', caption: '台阶爬了三百级，猫腿已经是别人的腿了。' }
  ],
  school: [
    { expression: '认真写作业', caption: '今天在喵星课堂认真写完了小鱼干应用题。' },
    { expression: '被打手板', caption: '上课偷吃猫粮被老师逮到，爪爪挨了一记手板。' },
    { expression: '和同学嬉闹', caption: '课间和同桌滚成一团，被罚站也不影响快乐。' },
    { expression: '打瞌睡流口水', caption: '下午第一节课困成说明书，口水差点淹了课本。' }
  ],
  hospital: [
    { expression: '查牙', caption: '牙医拿着小镜子伸进嘴里，猫咪紧张得爪爪开花。' },
    { expression: '拔牙痛哭', caption: '说好的不疼呢？拔牙那一刻整栋楼都听见了。' },
    { expression: '蛀牙肿脸', caption: '蛀虫打完卡，脸肿成一只圆猫，护士都忍不住拍照。' },
    { expression: '害怕医生', caption: '医生一靠近就后撤三步，白大褂自带恐猫光环。' }
  ],
  pond: [
    { expression: '湖边发呆', caption: '在池塘边看了一下午叶子，思考猫生的意义。' },
    { expression: '捞小鱼', caption: '爪子伸进水里一捞，居然捞到一条会发光的鱼干。' }
  ],
  custom: [
    { expression: '游客打卡', caption: '新地标打卡成功，游客照姿势已经进入决赛圈。' },
    { expression: '兴奋合影', caption: '这地方太好拍了，摄影师快门按到冒烟。' },
    { expression: '惊叹合影', caption: '第一次来就被震撼到，爪子扒着台阶不敢松。' }
  ]
};

function createCheckin(db, reqUser, cat, place, extra) {
  const photo = (extra && extra.photo) || renderScenePhoto(cat, place);
  const events = place.kind === 'mall'
    ? MALL_EVENTS[place.sceneKey || 'snack'] || MALL_EVENTS.snack
    : TRAVEL_EVENTS[place.sceneKey] || TRAVEL_EVENTS.custom;
  const event = randomPick(events);
  const note = place.funText || (place.name ? `${cat.name}在${place.name}完成打卡` : '完成打卡');
  const caption = (extra && extra.caption) || `${cat.name}在${place.name}：${event.caption}。`;
  const trip = {
    id: uid('trip'),
    catId: cat.id,
    ownerId: reqUser.id,
    placeId: place.id,
    time: nowLabel(),
    note,
    photo,
    caption,
    expression: event.expression
  };
  db.trips.unshift(trip);
  const post = makePost(db, reqUser.id, cat.id, 'trip', place.id, caption, photo);
  return { trip, post, event };
}

function seedRent(db, shopId, reqUser, body) {
  const shop = db.shops.find((item) => item.id === shopId);
  if (!shop) return null;
  shop.adopted = true;
  shop.ownerId = reqUser.id;
  shop.name = body.storeName || `${reqUser.nickname}的店`;
  shop.displayName = shop.name;
  shop.facade = body.facade || '';
  shop.itemImage = body.itemImage || '';
  return shop;
}

function shopVisit(db, reqUser, cat, shop) {
  const streetEvents = MALL_EVENTS[shop.street] || MALL_EVENTS.snack;
  const event = randomPick(streetEvents);
  const photo = shop.itemImage || '';
  const note = `${cat.name}在${shop.displayName}完成打卡`;
  const caption = `${cat.name}在${shop.displayName}：${event.caption}（${event.expression}）。`;
  const trip = {
    id: uid('trip'),
    catId: cat.id,
    ownerId: reqUser.id,
    placeId: shop.street === 'clothes' ? 'mall' : 'snack',
    time: nowLabel(),
    note,
    photo,
    caption,
    expression: event.expression,
    shopId: shop.id
  };
  db.trips.unshift(trip);
  const post = makePost(db, reqUser.id, cat.id, 'trip', shop.street === 'clothes' ? 'mall' : 'snack', caption, photo);
  return { trip, post, event };
}

async function handleApi(req, res, url) {
  const db = loadDb();
  const user = authUser(db, req);
  const parts = url.pathname.split('/').filter(Boolean);
  const route = parts.map(decodeURIComponent).join('/');

  // 图片上传走原始二进制：必须在 readBody 之前拦下来，否则流会被当成 JSON 读空
  const viewUploadMatch = route.match(/^api\/cats\/([^/]+)\/views$/);
  if (viewUploadMatch && req.method === 'POST' && /^image\//.test(String(req.headers['content-type'] || ''))) {
    return handleViewUpload(req, res, url, db, user, viewUploadMatch[1]);
  }

  const body = await readBody(req);

  if (route === 'api/auth/send-code' && req.method === 'POST') {
    const phone = String(body.phone || '').trim();
    if (!/^1\d{10}$/.test(phone)) {
      return json(res, 400, { error: '请输入正确的手机号。' });
    }
    const devCode = '123456';
    return json(res, 200, { ok: true, message: '验证码已发送', devCode });
  }

  if (route === 'api/auth/register' && req.method === 'POST') {
    const phone = String(body.phone || '').trim();
    const code = String(body.code || '').trim();
    const password = String(body.password || '');
    const nickname = String(body.nickname || '喵星家长').trim();
    if (!/^1\d{10}$/.test(phone)) return json(res, 400, { error: '请输入正确的手机号。' });
    if (code !== '123456') return json(res, 400, { error: '验证码错误，演示验证码为 123456。' });
    if (password.length < 6) return json(res, 400, { error: '密码至少 6 位。' });
    if (db.users.some((item) => item.phone === phone)) {
      return json(res, 400, { error: '该手机号已注册，请直接登录。' });
    }
    const salt = crypto.randomBytes(8).toString('hex');
    const newUser = {
      id: uid('user'),
      phone,
      nickname,
      passwordHash: hashPassword(password, salt),
      salt,
      avatar: '',
      background: '',
      createdAt: isoNow()
    };
    db.users.push(newUser);
    const token = randomToken();
    db.sessions.push({ token, userId: newUser.id });
    saveDb(db);
    return json(res, 200, { token, user: publicUser(newUser, db) });
  }

  if (route === 'api/auth/login' && req.method === 'POST') {
    const phone = String(body.phone || '').trim();
    const password = String(body.password || '');
    const found = db.users.find((item) => item.phone === phone);
    if (!found || found.passwordHash !== hashPassword(password, found.salt)) {
      return json(res, 400, { error: '手机号或密码不正确。' });
    }
    const token = randomToken();
    db.sessions = db.sessions.filter((item) => item.userId !== found.id);
    db.sessions.push({ token, userId: found.id });
    saveDb(db);
    return json(res, 200, { token, user: publicUser(found, db) });
  }

  if (route === 'api/auth/me' && req.method === 'GET') {
    if (!user) return json(res, 401, { error: '请先登录。' });
    return json(res, 200, { user: publicUser(user, db, user.id) });
  }

  if (route === 'api/auth/me' && req.method === 'PATCH') {
    if (!user) return json(res, 401, { error: '请先登录。' });
    if (body.nickname) user.nickname = String(body.nickname).trim();
    if (body.avatar !== undefined) user.avatar = body.avatar;
    if (body.background !== undefined) user.background = body.background;
    saveDb(db);
    return json(res, 200, { user: publicUser(user, db) });
  }

  if (!user && !route.match(/^api\/(cats\/[^/]+|users\/[^/]+)$/)) {
    return json(res, 401, { error: '请先登录。' });
  }

  if (route === 'api/cats' && req.method === 'POST') {
    const name = String(body.name || '').trim();
    if (!name) return json(res, 400, { error: '请填写猫咪名字。' });
    const age = Number(body.age);
    const birthDate = String(body.birthDate || '');
    const finalAge = age > 0 ? age : ageByBirthDate(birthDate);
    const finalBirth = birthDate || birthDateByAge(finalAge);
    const catRecord = {
      id: uid('cat'),
      ownerId: user.id,
      name,
      breed: String(body.breed || '中华田园猫').trim(),
      gender: body.gender === '男' ? '男' : '女',
      age: finalAge,
      birthDate: finalBirth,
      neutered: !!body.neutered,
      visible: body.visible !== false,
      avatar: '',
      background: '',
      color: '#f2a65a',
      color2: '#f7d6a3',
      belly: '#fff3df',
      weight: Number(body.weight) || 3.5,
      poop: Number(body.poop) || 2,
      pee: Number(body.pee) || 5,
      protein: Number(body.protein) || 0.08,
      healthSyncs: 0,
      balance: 620,
      createdAt: isoNow()
    };
    db.cats.push(catRecord);
    saveDb(db);
    return json(res, 200, { cat: publicCat(catRecord, db) });
  }

  if (route === 'api/cats/search' && req.method === 'GET') {
    const q = String(url.searchParams.get('q') || '').trim();
    const result = db.cats
      .filter((cat) => cat.visible && (!q || cat.name.includes(q) || cat.breed.includes(q)))
      .map((cat) => catDetailPayload(cat, db, user.id))
      .slice(0, 30);
    return json(res, 200, { cats: result });
  }

  const catMatch = route.match(/^api\/cats\/([^/]+)$/);
  if (catMatch && req.method === 'GET') {
    const cat = db.cats.find((item) => item.id === catMatch[1]);
    if (!cat) return json(res, 404, { error: '猫咪不存在。' });
    if (!cat.visible && (!user || cat.ownerId !== user.id)) {
      return json(res, 403, { error: '该猫咪档案已隐藏。' });
    }
    return json(res, 200, { cat: catDetailPayload(cat, db, user.id) });
  }

  if (catMatch && req.method === 'PATCH') {
    if (!user) return json(res, 401, { error: '请先登录。' });
    const cat = db.cats.find((item) => item.id === catMatch[1] && item.ownerId === user.id);
    if (!cat) return json(res, 404, { error: '猫咪不存在或无权修改。' });
    if (body.name !== undefined) cat.name = String(body.name).trim();
    if (body.breed !== undefined) cat.breed = String(body.breed).trim();
    if (body.gender === '男' || body.gender === '女') cat.gender = body.gender;
    if (body.neutered !== undefined) cat.neutered = !!body.neutered;
    if (body.visible !== undefined) cat.visible = !!body.visible;
    if (body.avatar !== undefined) cat.avatar = body.avatar;
    if (body.background !== undefined) cat.background = body.background;
    if (body.age !== undefined || body.birthDate !== undefined) {
      const age = Number(body.age);
      const birthDate = String(body.birthDate || '');
      if (age > 0 || birthDate) {
        cat.age = age > 0 ? age : ageByBirthDate(birthDate);
        cat.birthDate = birthDate || birthDateByAge(cat.age);
      }
    }
    if (body.weight !== undefined) cat.weight = Number(body.weight) || 0;
    if (body.poop !== undefined) cat.poop = Number(body.poop) || 0;
    if (body.pee !== undefined) cat.pee = Number(body.pee) || 0;
    if (body.protein !== undefined) cat.protein = Number(body.protein) || 0;
    if (body.coatProfile !== undefined) {
      const profile = body.coatProfile;
      cat.coatProfile = profile && profile.palette && profile.palette.base ? profile : null;
    }
    if (body.recon !== undefined) cat.recon = body.recon || null;
    saveDb(db);
    return json(res, 200, { cat: publicCat(cat, db) });
  }

  const bulletMatch = route.match(/^api\/cats\/([^/]+)\/bullet$/);
  if (bulletMatch && req.method === 'POST') {
    const cat = db.cats.find((item) => item.id === bulletMatch[1]);
    const text = String(body.text || '').trim();
    if (!cat || !text) return json(res, 400, { error: '猫咪或留言内容有误。' });
    if (!cat.visible) return json(res, 403, { error: '该猫咪档案已隐藏。' });
    const colors = ['#d94f6a', '#2f9e8f', '#3f7fbf', '#c06a34', '#7a5bb0', '#4f9d6a'];
    const bullet = {
      id: uid('bullet'),
      targetCatId: cat.id,
      fromUserId: user.id,
      nickname: user.nickname,
      kind: body.kind === 'roast' ? 'roast' : 'praise',
      text,
      time: nowLabel(),
      color: colors[Math.floor(Math.random() * colors.length)]
    };
    db.bullets.unshift(bullet);
    saveDb(db);
    return json(res, 200, { bullet });
  }

  const followMatch = route.match(/^api\/follows\/([^/]+)$/);
  if (followMatch && req.method === 'POST') {
    const targetId = followMatch[1];
    if (targetId === user.id) return json(res, 400, { error: '不能关注自己。' });
    if (!db.users.some((item) => item.id === targetId)) return json(res, 404, { error: '用户不存在。' });
    if (!db.follows.some((item) => item.followerId === user.id && item.followingId === targetId)) {
      db.follows.push({ followerId: user.id, followingId: targetId, time: nowLabel() });
      saveDb(db);
    }
    return json(res, 200, {
      following: true,
      followers: countFollowers(db, user.id),
      followingCount: countFollowing(db, user.id),
      relation: relationOf(db, user.id, targetId)
    });
  }

  if (followMatch && req.method === 'DELETE') {
    db.follows = db.follows.filter((item) => !(item.followerId === user.id && item.followingId === followMatch[1]));
    saveDb(db);
    return json(res, 200, {
      following: false,
      followers: countFollowers(db, user.id),
      followingCount: countFollowing(db, user.id),
      relation: relationOf(db, user.id, followMatch[1])
    });
  }

  if (route === 'api/follows' && req.method === 'GET') {
    const type = url.searchParams.get('type') === 'followers' ? 'followers' : 'following';
    const ids = type === 'followers'
      ? db.follows.filter((item) => item.followingId === user.id).map((item) => item.followerId)
      : db.follows.filter((item) => item.followerId === user.id).map((item) => item.followingId);
    const users = db.users.filter((item) => ids.includes(item.id)).map((item) => publicUser(item, db, user.id));
    return json(res, 200, { type, users, count: users.length });
  }

  const userMatch = route.match(/^api\/users\/([^/]+)$/);
  if (userMatch && req.method === 'GET') {
    const target = db.users.find((item) => item.id === userMatch[1]);
    if (!target) return json(res, 404, { error: '用户不存在。' });
    return json(res, 200, { user: publicUser(target, db, user.id) });
  }

  if (route === 'api/posts' && req.method === 'POST') {
    const cat = db.cats.find((item) => item.id === body.catId && item.ownerId === user.id);
    if (!cat) return json(res, 400, { error: '请选择自己的猫咪。' });
    const caption = String(body.caption || '').trim() || `${cat.name}的新鲜事`;
    const post = makePost(db, user.id, cat.id, body.kind || 'trip', body.placeId || 'pond', caption, body.photo || '');
    saveDb(db);
    return json(res, 200, { post: postPayload(post, db) });
  }

  if (route === 'api/posts' && req.method === 'GET') {
    const scope = url.searchParams.get('scope') || 'me';
    let posts = db.posts;
    if (scope === 'me') {
      posts = posts.filter((post) => post.ownerId === user.id);
    } else if (scope === 'friends') {
      const following = db.follows.filter((item) => item.followerId === user.id).map((item) => item.followingId);
      posts = posts.filter((post) => following.includes(post.ownerId) || post.ownerId === user.id);
    } else {
      posts = posts.slice().sort(() => Math.random() - 0.5);
    }
    const limit = scope === 'random' ? 10 : 30;
    return json(res, 200, { posts: posts.slice(0, limit).map((post) => postPayload(post, db)) });
  }

  const postMatch = route.match(/^api\/posts\/([^/]+)$/);
  if (postMatch && req.method === 'DELETE') {
    const index = db.posts.findIndex((post) => post.id === postMatch[1] && post.ownerId === user.id);
    if (index < 0) return json(res, 403, { error: '无权删除该推文。' });
    db.posts.splice(index, 1);
    saveDb(db);
    return json(res, 200, { ok: true });
  }

  const likeMatch = route.match(/^api\/posts\/([^/]+)\/like$/);
  if (likeMatch && req.method === 'POST') {
    const post = db.posts.find((item) => item.id === likeMatch[1]);
    if (!post) return json(res, 404, { error: '推文不存在。' });
    const type = String(body.type || '亲亲');
    if (!REACTION_TYPES.includes(type)) return json(res, 400, { error: '不支持的互动方式。' });
    post.reactions = normalizeReactions(post);
    const list = post.reactions[type] || (post.reactions[type] = []);
    const already = list.includes(user.id);
    if (!already) {
      list.push(user.id);
    } else {
      post.reactions[type] = list.filter((item) => item !== user.id);
    }
    post.likes = REACTION_TYPES.reduce((sum, item) => sum + (post.reactions[item] || []).length, 0);
    saveDb(db);
    return json(res, 200, { liked: !already, type, likes: post.likes, reactions: post.reactions });
  }

  const commentMatch = route.match(/^api\/posts\/([^/]+)\/comment$/);
  if (commentMatch && req.method === 'POST') {
    const post = db.posts.find((item) => item.id === commentMatch[1]);
    const text = String(body.text || '').trim();
    if (!post || !text) return json(res, 400, { error: '推文或评论内容有误。' });
    const colors = ['#2f9e8f', '#d94f6a', '#3f7fbf', '#c06a34', '#7a5bb0'];
    post.comments.push({
      id: uid('comment'),
      userId: user.id,
      nickname: user.nickname,
      text,
      time: nowLabel(),
      color: colors[Math.floor(Math.random() * colors.length)]
    });
    saveDb(db);
    return json(res, 200, { comment: post.comments[post.comments.length - 1] });
  }

  if (route === 'api/mall' && req.method === 'GET') {
    const streets = [
      { id: 'clothes', name: '宠物服饰街', shops: db.shops.filter((item) => item.street === 'clothes') },
      { id: 'snack', name: '宠物小吃街', shops: db.shops.filter((item) => item.street === 'snack') }
    ];
    return json(res, 200, { streets });
  }

  const shopCoverMatch = route.match(/^api\/mall\/shops\/([^/]+)\/cover$/);
  if (shopCoverMatch && req.method === 'POST') {
    const shop = db.shops.find((item) => item.id === shopCoverMatch[1]);
    if (!shop) return json(res, 404, { error: '门店不存在。' });
    if (!body.image) return json(res, 400, { error: '请上传门店封面。' });
    shop.facade = body.image;
    saveDb(db);
    return json(res, 200, { shop });
  }

  const shopMatch = route.match(/^api\/mall\/shops\/([^/]+)\/rent$/);
  if (shopMatch && req.method === 'POST') {
    const shop = seedRent(db, shopMatch[1], user, body);
    if (!shop) return json(res, 404, { error: '店铺不存在。' });
    saveDb(db);
    return json(res, 200, { shop });
  }

  const shopVisitMatch = route.match(/^api\/mall\/shops\/([^/]+)\/visit$/);
  if (shopVisitMatch && req.method === 'POST') {
    const shop = db.shops.find((item) => item.id === shopVisitMatch[1]);
    const cat = db.cats.find((item) => item.id === body.catId && item.ownerId === user.id);
    if (!shop || !cat) return json(res, 400, { error: '店铺或猫咪选择有误。' });
    const result = shopVisit(db, user, cat, shop);
    saveDb(db);
    return json(res, 200, { ...result, post: postPayload(result.post, db) });
  }

  if (route === 'api/places' && req.method === 'GET') {
    return json(res, 200, { places: db.places });
  }

  if (route === 'api/places' && req.method === 'POST') {
    const name = String(body.name || '').trim();
    if (!name) return json(res, 400, { error: '请填写打卡场所名称。' });
    const existing = db.places.find((item) => String(item.name || '').trim().toLowerCase() === name.toLowerCase());
    if (existing) {
      return json(res, 200, { place: existing, existing: true, message: '该场所已收录，直接出发打卡即可。' });
    }
    const sceneKey = body.sceneKey || inferPlaceSceneKey(name);
    const category = placeCategoryOf(sceneKey);
    const kind = sceneKey === 'mall' || sceneKey === 'snack' ? 'mall' : 'travel';
    const place = {
      id: uid('place'),
      name,
      kind,
      sceneKey,
      category,
      cost: Number(body.cost) || 130,
      desc: body.desc || '自定义打卡场所',
      image: body.image || '',
      funText: body.funText || `${name}打卡成功`,
      createdAt: isoNow()
    };
    db.places.push(place);
    saveDb(db);
    return json(res, 200, { place, existing: false, message: `${name} 已收录到「${category}」目录。` });
  }

  const checkinMatch = route.match(/^api\/places\/([^/]+)\/checkin$/);
  if (checkinMatch && req.method === 'POST') {
    const place = db.places.find((item) => item.id === checkinMatch[1]);
    const cat = db.cats.find((item) => item.id === body.catId && item.ownerId === user.id);
    if (!place || !cat) return json(res, 400, { error: '场所或猫咪选择有误。' });
    if (cat.balance < place.cost) return json(res, 400, { error: `喵星币不足，${place.name}需要 ${place.cost}。` });
    cat.balance -= place.cost;
    const result = createCheckin(db, user, cat, place, body);
    saveDb(db);
    return json(res, 200, { ...result, post: postPayload(result.post, db), balance: cat.balance });
  }

  /* ---- 多视角照片：列表 / 删除 ---- */
  if (viewUploadMatch && req.method === 'GET') {
    if (!user) return json(res, 401, { error: '请先登录。' });
    const cat = db.cats.find((item) => item.id === viewUploadMatch[1]);
    if (!cat) return json(res, 404, { error: '猫咪不存在。' });
    if (cat.ownerId !== user.id) return json(res, 403, { error: '只能查看自己猫咪的照片。' });
    return json(res, 200, viewSummary(cat));
  }

  const viewDeleteMatch = route.match(/^api\/cats\/([^/]+)\/views\/([^/]+)$/);
  if (viewDeleteMatch && req.method === 'DELETE') {
    if (!user) return json(res, 401, { error: '请先登录。' });
    const cat = db.cats.find((item) => item.id === viewDeleteMatch[1]);
    if (!cat) return json(res, 404, { error: '猫咪不存在。' });
    if (cat.ownerId !== user.id) return json(res, 403, { error: '只能删除自己猫咪的照片。' });
    const views = catViewsOf(cat);
    const index = views.findIndex((view) => view.id === viewDeleteMatch[2]);
    if (index < 0) return json(res, 404, { error: '照片不存在。' });
    const [removed] = views.splice(index, 1);
    try {
      const filePath = path.join(VIEW_DIR, path.basename(path.dirname(removed.url)), path.basename(removed.url));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (_) { /* 文件已不在也不影响记录删除 */ }
    if (!views.length) {
      cat.recon = null;
    } else {
      cat.recon = { status: 'collecting', updatedAt: isoNow(), note: `已收集 ${views.length} 张多视角照片，等待重建` };
    }
    saveDb(db);
    writeViewManifest(cat);
    return json(res, 200, viewSummary(cat));
  }

  const viewPatchMatch = route.match(/^api\/cats\/([^/]+)\/views\/([^/]+)$/);
  if (viewPatchMatch && req.method === 'PATCH') {
    if (!user) return json(res, 401, { error: '请先登录。' });
    const cat = db.cats.find((item) => item.id === viewPatchMatch[1]);
    if (!cat) return json(res, 404, { error: '猫咪不存在。' });
    if (cat.ownerId !== user.id) return json(res, 403, { error: '只能修改自己猫咪的照片。' });
    const view = catViewsOf(cat).find((item) => item.id === viewPatchMatch[2]);
    if (!view) return json(res, 404, { error: '照片不存在。' });
    const angle = String(body.angle || '');
    if (VIEW_ANGLES.includes(angle)) view.angle = angle;
    saveDb(db);
    writeViewManifest(cat);
    return json(res, 200, viewSummary(cat));
  }

  const placeImageMatch = route.match(/^api\/places\/([^/]+)\/fetch-image$/);
  if (placeImageMatch && req.method === 'GET') {
    const place = db.places.find((item) => item.id === placeImageMatch[1]);
    if (!place) return json(res, 404, { error: '场所不存在。' });
    place.image = await searchRemoteImage(place.name);
    saveDb(db);
    return json(res, 200, { place });
  }

  const placeImageUploadMatch = route.match(/^api\/places\/([^/]+)\/image$/);
  if (placeImageUploadMatch && req.method === 'POST') {
    const place = db.places.find((item) => item.id === placeImageUploadMatch[1]);
    if (!place) return json(res, 404, { error: '场所不存在。' });
    if (!body.image) return json(res, 400, { error: '请上传场所封面图片。' });
    place.image = body.image;
    saveDb(db);
    return json(res, 200, { place });
  }

  if (route === 'api/trips' && req.method === 'GET') {
    const mine = db.trips.filter((trip) => trip.ownerId === user.id);
    return json(res, 200, { trips: mine });
  }

  if (route === 'api/health/sync' && req.method === 'POST') {
    const cat = db.cats.find((item) => item.id === body.catId && item.ownerId === user.id);
    if (!cat) return json(res, 400, { error: '猫咪不存在。' });
    if (body.weight !== undefined) cat.weight = Number(body.weight) || 0;
    if (body.poop !== undefined) cat.poop = Number(body.poop) || 0;
    if (body.pee !== undefined) cat.pee = Number(body.pee) || 0;
    if (body.protein !== undefined) cat.protein = Number(body.protein) || 0;
    const closeness = (value, ideal) => Math.max(0, Math.min(100, Math.round(100 - (Math.abs(value - ideal) / ideal) * 100)));
    const reward = Math.round(
      200 * closeness(cat.weight, 3.6) / 100 +
      80 * closeness(cat.poop, 2) / 100 +
      60 * closeness(cat.pee, 5) / 100 +
      120 * closeness(cat.protein, 0.08) / 100
    );
    cat.balance += reward;
    cat.healthSyncs += 1;
    saveDb(db);
    return json(res, 200, { cat: publicCat(cat, db), reward });
  }

  if (route === 'api/me/overview' && req.method === 'GET') {
    const myCats = db.cats.filter((cat) => cat.ownerId === user.id);
    const overview = {
      user: publicUser(user, db, user.id),
      cats: myCats.map((cat) => publicCat(cat, db)),
      balance: myCats.reduce((sum, cat) => sum + (cat.balance || 0), 0),
      posts: db.posts.filter((post) => post.ownerId === user.id).map((post) => postPayload(post, db)),
      receivedBullets: db.bullets.filter((bullet) => myCats.some((cat) => cat.id === bullet.targetCatId)),
      trips: db.trips.filter((trip) => trip.ownerId === user.id),
      followers: countFollowers(db, user.id),
      following: countFollowing(db, user.id)
    };
    return json(res, 200, overview);
  }

  if (route === 'api/me/likers' && req.method === 'GET') {
    const ids = db.posts
      .filter((post) => post.ownerId === user.id)
      .flatMap((post) => Array.isArray(post.likedBy) ? post.likedBy : []);
    const uniqueIds = [...new Set(ids)];
    const users = db.users.filter((item) => uniqueIds.includes(item.id)).map((item) => publicUser(item, db, user.id));
    return json(res, 200, { users, count: users.length });
  }

  return json(res, 404, { error: '接口不存在。' });
}

module.exports = { handleApi, loadDb, saveDb, seedDb };
