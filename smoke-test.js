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
  const token = login.token;
  const overview = await call('GET', '/api/me/overview', null, token);
  const search = await call('GET', `/api/cats/search?q=${encodeURIComponent('叶子')}`, null, token);
  const mall = await call('GET', '/api/mall', null, token);
  const random = await call('GET', '/api/posts?scope=random', null, token);
  const bullet = await call('POST', '/api/cats/cat-san/bullet', { text: '冒烟测试弹幕', kind: 'praise' }, token);
  const myPost = overview.posts[0] || (await call('POST', '/api/posts', {
    catId: overview.cats[0].id,
    kind: 'trip',
    placeId: 'pond',
    caption: '冒烟测试推文',
    photo: ''
  }, token));
  const like1 = await call('POST', `/api/posts/${myPost.id}/like`, {}, token);
  const like2 = await call('POST', `/api/posts/${myPost.id}/like`, {}, token);

  console.log('auth user:', login.user.nickname);
  console.log('cats:', overview.cats.length);
  console.log('friends:', JSON.stringify({ following: overview.following, followers: overview.followers }));
  console.log('search:', search.cats.length, search.cats[0] && search.cats[0].name);
  console.log('mall:', mall.streets.length, 'streets,', mall.streets.reduce((n, s) => n + s.shops.length, 0), 'shops');
  console.log('random posts:', random.posts.length);
  console.log('bullet:', bullet.bullet.id);
  console.log('like toggle:', like1.liked, '->', like2.liked, 'likes', like2.likes);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
