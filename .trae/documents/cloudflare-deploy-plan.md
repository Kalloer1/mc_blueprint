# 网站架构分析与部署方案

## 决定：保持当前架构（静态前端 + 动态后端）

***

## 一、当前架构

| 部分       | 托管平台                   | 功能             |
| -------- | ---------------------- | -------------- |
| **前端页面** | GitHub Pages           | 静态 HTML/CSS/JS |
| **蓝图数据** | GitHub Pages           | data.json 静态文件 |
| **用户认证** | Cloudflare Worker      | QQ OAuth       |
| **文件上传** | Cloudflare Worker + R2 | 蓝图文件存储         |
| **审核队列** | Cloudflare KV          | 元数据存储          |

***

## 二、静态网站能实现的功能

| 功能     | 方案              | 说明                    |
| ------ | --------------- | --------------------- |
| 蓝图浏览   | ✅ data.json     | 预定义数据，前端加载            |
| 蓝图上传   | ✅ Worker + R2   | 用户上传，存 R2，需人工同步到 JSON |
| 用户登录   | ✅ OAuth         | QQ/Google/GitHub 登录   |
| 筛选排序   | ✅ 前端 JS         | 纯前端处理                 |
| 模组下载链接 | ✅ modLinks      | data.json 中配置         |
| 点赞/收藏  | ⚠️ localStorage | 仅当前浏览器有效              |
| 下载统计   | ⚠️ localStorage | 仅当前浏览器有效              |

***

## 三、保持当前架构的优势

| 优势       | 说明                                      |
| -------- | --------------------------------------- |
| **部署简单** | GitHub Pages 一键部署，无需服务器                 |
| **免费**   | GitHub Pages + Cloudflare Worker 免费额度足够 |
| **快速**   | 全球 CDN 加速，无需数据库查询                       |
| **安全**   | 静态文件无法被攻击，敏感操作在 Worker                  |
| **易维护**  | 代码即部署，无需数据库迁移                           |

***

## 四、部署操作指南

### 阶段 1：部署前端到 GitHub Pages

#### 步骤 1.1：推送代码到 GitHub

```bash
cd c:\Users\Sora\Desktop\mc

# 如果还没有初始化 Git
git init
git add .
git commit -m "MC Blueprint Workshop - Initial commit"

# 如果还没有关联远程仓库
git remote add origin https://github.com/kalloer1/mc_blueprint.git
git branch -M main
git push -u origin main
```

#### 步骤 1.2：启用 GitHub Pages

1. 访问 <https://github.com/kalloer1/mc_blueprint/settings/pages>
2. 在 "Build and deployment" → "Source" 选择 "Deploy from a branch"
3. 选择 `main` 分支和 `/ (root)` 目录
4. 点击 "Save"
5. 等待几分钟后，网站将在 `https://kalloer1.github.io/mc_blueprint` 可访问

***

### 阶段 2：部署后端到 Cloudflare

#### 步骤 2.1：创建 Cloudflare 账户

1. 访问 <https://dash.cloudflare.com/sign-up>
2. 注册并验证邮箱

#### 步骤 2.2：创建 KV 命名空间

1. 在 Cloudflare Dashboard 左侧点击 "Workers & Pages"
2. 点击 "Create application"
3. 点击 "KV" → "Create a namespace"
4. 名称输入 `BLUEPRINT_KV`
5. 点击 "Create"
6. 复制显示的 Namespace ID

#### 步骤 2.3：创建 R2 存储桶

1. 在 Cloudflare Dashboard 左侧点击 "Workers & Pages"
2. 点击 "R2"（在侧边栏）
3. 点击 "Create bucket"
4. 名称输入 `blueprint-files`
5. 点击 "Create"

#### 步骤 2.4：部署 Worker

1. 安装 Wrangler CLI：

```bash
npm install -g wrangler
```

1. 在项目目录创建 `wrangler.toml`：

```toml
name = "qq-auth"
main = "worker-upload.js"
compatibility_date = "2024-01-01"

[[kv_namespaces]]
binding = "BLUEPRINT_KV"
id = "在此粘贴你的KV_Namespace_ID"

[[r2_buckets]]
binding = "BLUEPRINT_R2"
bucket_name = "blueprint-files"
```

1. 部署 Worker：

```bash
cd c:\Users\Sora\Desktop\mc
wrangler deploy
```

1. 部署成功后会显示 Worker URL，例如：
   `https://qq-auth.<你的用户名>.workers.dev`

#### 步骤 2.5：更新前端 Worker URL

编辑 `js/upload.js` 中的 API 地址：

```javascript
// 找到这行
var response = await fetch('https://qq-auth.wqclo.workers.dev/upload', {

// 改为你的 Worker URL，例如：
var response = await fetch('https://qq-auth.kalloer.workers.dev/upload', {
```

同样更新 `js/auth.js` 中的 `AUTH_WORKER_URL`：

```javascript
const AUTH_WORKER_URL = 'https://qq-auth.kalloer.workers.dev/callback';
```

#### 步骤 2.6：更新 QQ 互联回调地址

1. 访问 <https://connect.qq.com/>
2. 登录你的应用管理后台
3. 修改回调地址为：`https://qq-auth.kalloer.workers.dev/callback`

#### 步骤 2.7：更新 Worker 中的回调地址

编辑 `worker-upload.js`：

```javascript
const QQ_REDIRECT_URI = 'https://kalloer1.github.io/mc_blueprint/auth/callback.html';
```

***

## 五、部署检查清单

| 步骤  | 任务               | 状态 |
| --- | ---------------- | -- |
| 1.1 | 推送代码到 GitHub     | ⬜  |
| 1.2 | 启用 GitHub Pages  | ⬜  |
| 2.1 | 创建 Cloudflare 账户 | ⬜  |
| 2.2 | 创建 KV 命名空间       | ⬜  |
| 2.3 | 创建 R2 存储桶        | ⬜  |
| 2.4 | 部署 Worker        | ⬜  |
| 2.5 | 更新前端 Worker URL  | ⬜  |
| 2.6 | 配置 QQ OAuth 回调   | ⬜  |
| 2.7 | 更新 Worker 回调地址   | ⬜  |

***

## 六、验证部署

部署完成后测试以下功能：

1. **访问网站**：`https://kalloer1.github.io/mc_blueprint`
2. **蓝图列表**：检查蓝图卡片是否正常显示
3. **蓝图上传**：访问 `/upload.html`，尝试上传文件
4. **QQ 登录**：点击登录按钮，测试 OAuth 流程
5. **筛选功能**：测试版本、模组、格式筛选
6. **模态框**：点击蓝图卡片，检查详情和模组下载链接

