const BASE = 'http://127.0.0.1:3000';

async function call(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path}: ${data.error || res.status}`);
  return data;
}

async function main() {
  const login = await call('POST', '/api/auth/login', { phone: '13800000001', password: '123456' });
  const overview = await call('GET', '/api/me/overview', null, login.token);
  const search = await call('GET', `/api/cats/search?q=${encodeURIComponent('叶子')}`, null, login.token);
  const mall = await call('GET', '/api/mall', null, login.token);
  const neighbor = await call('GET', '/api/cats/cat-san', null, login.token);
  const random = await call('GET', '/api/posts?scope=random', null, login.token);
  const owner = neighbor.cat.owner || {};
  console.log(JSON.stringify({
    overviewCats: overview.cats.length,
    following: overview.following,
    followers: overview.followers,
    searchHits: search.cats.length,
    mallStreets: mall.streets.length,
    mallShops: mall.streets.reduce((n, s) => n + s.shops.length, 0),
    neighborName: neighbor.cat.name,
    neighborBullets: neighbor.cat.bullets.length,
    randomPosts: random.posts.length,
    ownerName: owner.nickname,
    ownerFollowsYou: owner.followsYou,
    iFollowOwner: owner.iFollow,
    ownerFollowing: (neighbor.cat.ownerFollowing || []).map((u) => u.nickname),
    ownerFollowers: (neighbor.cat.ownerFollowers || []).map((u) => u.nickname)
  }, null, 2));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
