(function () {
  'use strict';

  const TOKEN_KEY = 'meow-kart-auth-token-v1';

  function getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY) || '';
    } catch (_) {
      return '';
    }
  }

  function setToken(token) {
    try {
      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }
    } catch (_) {}
  }

  async function request(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(data.error || '请求失败');
      err.status = response.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  window.MeowAPI = {
    getToken,
    setToken,
    request,
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body || {}),
    patch: (path, body) => request('PATCH', path, body || {}),
    del: (path) => request('DELETE', path)
  };
})();
