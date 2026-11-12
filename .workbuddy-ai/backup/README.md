# 喵星旅行社

一个家长端可注册登录、多猫档案管理、好友关注、喵推广场、弹幕留言、旅行打卡与商场双街的 2D 简化版系统。

## 启动方式

```bash
npm start
```

浏览器打开：http://127.0.0.1:3000

演示账号：`13800000001` ~ `13800000007`，密码均为 `123456`。

注册时验证码固定为 `123456`；后端控制台说明为演示模式，后续可替换为真实短信服务。

## 目录结构

- `index.html`：单页应用入口
- `api.js`：浏览器端 API 封装，统一管理 token 与 `/api/*` 请求
- `app.js`：前端渲染与交互逻辑
- `styles.css`：全部 UI 样式
- `server.js`：静态文件服务与 SPA 回退，并将 `/api/*` 转交后端
- `server-api.js`：路由、认证、数据持久化接口
- `data/db.json`：自动生成的 JSON 数据文件（首次启动自动初始化）
- `smoke-test.js`：接口冒烟测试

## 主要接口

- `POST /api/auth/send-code`、`/api/auth/register`、`/api/auth/login`
- `GET /api/me/overview`、`/api/me/likers`
- `POST /api/cats`、`PATCH /api/cats/:id`
- `GET /api/cats/search`、`GET /api/cats/:id`
- `POST /api/cats/:id/bullet`
- `GET/POST /api/follows`、`POST/DELETE /api/follows/:userId`
- `GET /api/users/:id`
- `GET/POST /api/posts`、`DELETE /api/posts/:id`
- `POST /api/posts/:id/like`、`POST /api/posts/:id/comment`
- `GET/POST /api/places`、`GET /api/places/:id/fetch-image`
- `POST /api/places/:id/checkin`
- `GET /api/mall`、`POST /api/mall/shops/:id/rent`、`POST /api/mall/shops/:id/visit`
- `POST /api/health/sync`

## 扩展预留

- 真实短信验证码：替换 `server-api.js` 中发送验证码的逻辑即可。
- 网络风景图：`fetch-image` 当前使用公开图源 URL；可替换为 Bing/百度图片搜索接口。
- 3D 形象：现状为 2D SVG/上传图，后续可在 `catSvg` / 打卡照生成处接入混元 3D 或 Blender 输出。
