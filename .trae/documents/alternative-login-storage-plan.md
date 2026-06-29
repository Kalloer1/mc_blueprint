# 替代方案分析：登录方式与存储方案

## 一、登录方式对比

### 1. QQ 登录（当前）

| 项目 | 说明 |
|------|------|
| **状态** | 审核中 |
| **优点** | 国内用户熟悉 |
| **缺点** | 审核流程慢，需要企业/个人开发者认证 |
| **获取难度** | ⭐⭐⭐⭐⭐ |

### 2. GitHub 登录（推荐）

| 项目 | 说明 |
|------|------|
| **状态** | ✅ 可用 |
| **OAuth 地址** | https://github.com/login/oauth/authorize |
| **用户信息 API** | https://api.github.com/user |
| **获取难度** | ⭐（注册即用） |
| **申请地址** | https://github.com/settings/applications/new |

**GitHub OAuth 优势**：
- 无需审核，注册即可使用
- 开发者友好
- 支持获取用户头像、昵称等基本信息
- 完全免费

**GitHub OAuth 配置**：

```javascript
// Worker 中添加 GitHub 登录端点
const GITHUB_APP_ID = 'your_client_id';
const GITHUB_APP_SECRET = 'your_client_secret';
const GITHUB_REDIRECT_URI = 'https://kalloer1.github.io/mc_blueprint/auth/callback.html';

// 授权 URL
const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_APP_ID}&redirect_uri=${encodeURIComponent(GITHUB_REDIRECT_URI)}&scope=read:user`;

// 获取 access_token
const tokenUrl = 'https://github.com/login/oauth/access_token';
const tokenResponse = await fetch(tokenUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    client_id: GITHUB_APP_ID,
    client_secret: GITHUB_APP_SECRET,
    code: code
  })
});

// 获取用户信息
const userResponse = await fetch('https://api.github.com/user', {
  headers: { 'Authorization': `Bearer ${access_token}` }
});
```

### 3. B站登录

| 项目 | 说明 |
|------|------|
| **状态** | ✅ 可用 |
| **OAuth 地址** | https://account.bilibili.com/pc/account-pc/auth/oauth |
| **获取难度** | ⭐⭐⭐ |
| **申请地址** | https://open.bilibili.com/ |

**B站 OAuth 注意事项**：
- 需要在 B 站开放平台注册开发者账号
- 需要申请应用，获取 client_id 和 client_secret
- 回调地址必须是 HTTPS

---

## 二、存储方案对比

### 1. Cloudflare R2

| 项目 | 说明 |
|------|------|
| **免费额度** | 10GB 存储/月 |
| **Class A 操作** | 1000万次/月 |
| **Class B 操作** | 100万次/月 |
| **Egress 下载** | ✅ 完全免费 |
| **超出费用** | $0.015/GB/月 |
| **获取难度** | ⭐（注册即用） |

**结论**：对于小型网站来说，R2 的免费额度完全够用！

### 2. OpenList（AList 分支）

| 项目 | 说明 |
|------|------|
| **性质** | 开源自托管网盘管理工具 |
| **存储后端** | 支持 60+ 种（阿里云盘、百度网盘、Google Drive 等） |
| **API** | RESTful API |
| **获取难度** | ⭐⭐（需要部署） |

**OpenList API 示例**：

```javascript
// 上传文件
POST http://your-openlist-server/api/fs/upload
Headers: { 'Authorization': 'Bearer your_token' }
FormData: { file: binary_data, path: '/blueprints/file.nbt' }

// 获取文件列表
GET http://your-openlist-server/api/fs/list?path=/blueprints

// 下载文件
GET http://your-openlist-server/d/to/download_token
```

**使用 OpenList 作为存储的优势**：
- 可以利用已有的网盘资源（阿里云盘、百度网盘等）
- 无需额外付费
- 支持大文件存储

**使用 OpenList 作为存储的劣势**：
- 需要部署 OpenList 服务器
- 网盘可能有速度限制
- API 调用需要 token 管理

---

## 三、推荐方案

### 方案 A：GitHub 登录 + R2 存储（最简单）

| 组件 | 方案 | 费用 |
|------|------|------|
| 登录 | GitHub OAuth | 免费 |
| 存储 | Cloudflare R2 | 免费（10GB） |
| 后端 | Cloudflare Worker | 免费（10万次/天） |
| **总计** | - | **免费** |

**适合场景**：开发者用户为主，追求简单部署

### 方案 B：GitHub + B站双登录 + OpenList 存储

| 组件 | 方案 | 费用 |
|------|------|------|
| 登录 | GitHub + B站 OAuth | 免费 |
| 存储 | OpenList + 现有网盘 | 免费/低成本 |
| 后端 | Cloudflare Worker | 免费 |

**适合场景**：面向国内用户，需要多平台登录

---

## 四、修改计划

### 任务 1：添加 GitHub 登录支持

**文件**：`worker-upload.js`

**修改内容**：
- 添加 `/auth/github` 端点（授权跳转）
- 添加 `/auth/github/callback` 端点（回调处理）
- 添加获取 GitHub 用户信息的逻辑

**前端修改**：
- 在登录页面添加"使用 GitHub 登录"按钮
- `js/auth.js` 添加 GitHub OAuth 跳转逻辑

### 任务 2：添加 OpenList 存储支持（可选）

**文件**：`worker-upload.js`

**修改内容**：
- 添加 OpenList API 上传功能
- 配置 OpenList 服务器地址和 token

### 任务 3：保留 QQ 登录（降级）

**修改内容**：
- 将 QQ 登录作为备选方案
- 优先显示 GitHub 登录按钮
- QQ 登录按钮保留但降低优先级

---

## 五、决策确认

| 问题 | 决定 |
|------|------|
| **登录方式** | ✅ GitHub + B站双登录 |
| **存储方式** | ✅ R2 + OpenList 兼容 |
| **QQ 登录** | 保留作为备选 |

---

## 六、实施步骤

### 阶段 1：添加 GitHub 登录

1. 修改 `worker-upload.js` 添加 GitHub OAuth 端点
2. 修改 `js/auth.js` 添加 GitHub 登录按钮和逻辑
3. 修改登录页面 UI

### 阶段 2：添加 B站登录

1. 修改 `worker-upload.js` 添加 B站 OAuth 端点
2. 修改 `js/auth.js` 添加 B站登录按钮
3. 更新登录页面 UI

### 阶段 3：添加 OpenList 存储支持

1. 修改 `worker-upload.js` 添加 OpenList API 上传功能
2. 添加存储方式选择配置
3. 支持 R2 和 OpenList 双存储

### 阶段 4：更新 UI

1. 更新登录页面，显示所有登录选项
2. 添加存储后端配置选项