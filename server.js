const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg'
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let requestPath = '/';
  try {
    requestPath = decodeURIComponent(url.pathname);
  } catch (_) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad Request');
    return;
  }

  const safePath = requestPath.startsWith('/') ? requestPath : '/' + requestPath;
  let filePath = path.resolve(root, '.' + safePath);

  if (!filePath.startsWith(root)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        const fallback = path.join(root, 'index.html');
        fs.readFile(fallback, (fallbackErr, fallbackContent) => {
          if (fallbackErr) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404 Not Found');
            return;
          }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(fallbackContent);
        });
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': contentTypes[ext] || 'application/octet-stream'
      });
      res.end(content);
    });
  });
});

function listen(port) {
  server.listen(port, '127.0.0.1', () => {
    console.log(`喵星旅行社已启动： http://127.0.0.1:${port}`);
    console.log('按 Ctrl+C 停止服务');
  });
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE' && port < 3010) {
    listen(port + 1);
  } else {
    console.error(err.message);
    process.exit(1);
  }
});

let port = Number(process.env.PORT) || 3000;
listen(port);
