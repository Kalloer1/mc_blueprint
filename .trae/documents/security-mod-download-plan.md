# 静态网站账户安全分析与修改计划

## 一、账户安全问题分析

### 当前认证方案（QQ OAuth）

当前项目使用 **QQ OAuth 第三方登录**，这是安全的方案：

| 特性 | 说明 |
|------|------|
| **密码存储** | ❌ 不存储密码，仅存储 QQ 用户信息（昵称、头像） |
| **敏感数据** | ❌ QQ_APP_KEY 存储在 Cloudflare Worker（服务器端），前端不暴露 |
| **用户数据** | localStorage 存储 `{ openid, nickname, figureurl }`，不含敏感信息 |
| **安全风险** | ✅ 低风险 - OAuth 标准流程，由 QQ 服务器验证 |

### 如果添加本地账户系统（风险分析）

**❌ 不推荐**：静态网站无法安全存储密码

| 风险 | 说明 |
|------|------|
| **密码暴露** | 前端代码可被任何人查看，密码验证逻辑暴露 |
| **localStorage 泄露** | localStorage 可被恶意脚本读取 |
| **无加密** | 静态网站无法使用服务器端加密 |
| **CSRF 攻击** | 无服务器端 Session 保护 |

### 推荐方案

| 方案 | 安全性 | 说明 |
|------|--------|------|
| **QQ OAuth（当前）** | ✅ 安全 | 第三方验证，不涉及密码 |
| **GitHub OAuth** | ✅ 安全 | 可作为备选登录方式 |
| **本地账户系统** | ❌ 不安全 | 静态网站不建议实现 |

---

## 二、删除创作者收益功能

**决定**：从计划中删除创作者收益相关功能。

原 Reden 网站的功能（不实现）：
- 打赏/收益系统
- 收益看板
- 提现功能

---

## 三、模组资源下载功能

### 问题分析

蓝图预览需要模组材质资源，但 deepslate 库只支持原版 Minecraft 材质。对于模组蓝图，有以下方案：

### 方案 A：提供模组下载链接（推荐）

不直接下载模组文件，而是在蓝图详情页显示依赖模组的下载链接：

| 模组平台 | API | 需要密钥 |
|----------|-----|----------|
| **Modrinth** | `https://api.modrinth.com/v2/project/{slug}` | ❌ 免费 |
| **CurseForge** | `https://api.curseforge.com/v1/mods/{modId}` | ✅ 需申请 |

**实施方式**：
- 在 `data.json` 添加 `mod_links` 字段，存储模组的 Modrinth/CurseForge 页面链接
- 模态框显示"依赖模组"部分，提供跳转链接
- 用户手动前往平台下载模组

### 方案 B：Modrinth API 获取下载链接（可选）

Modrinth API 免费，可直接获取模组下载链接：

```javascript
// 获取模组信息
fetch('https://api.modrinth.com/v2/project/create')
  .then(res => res.json())
  .then(data => {
    // data.id = 模组ID
    // data.slug = 模组短名
    // data.title = 模组名称
  });

// 获取模组版本列表
fetch('https://api.modrinth.com/v2/project/create/version')
  .then(res => res.json())
  .then(versions => {
    // 筛选兼容的版本
  });
```

### CurseForge API 限制

**重要**：CurseForge API 需要申请 API 密钥：
- 申请地址：https://authors.curseforge.com/account/api-tokens
- 需要配置到 Cloudflare Worker（不能暴露在前端）
- 建议使用 Modrinth 作为主要下载源（免费、开源）

---

## 四、修改计划

### 任务 1：添加模组下载链接功能

**文件**：`blueprints/data.json`, `js/gallery.js`

**修改内容**：
- `data.json` 添加 `mod_links` 字段（Modrinth/CurseForge 页面链接）
- 模态框添加"依赖模组"部分，显示下载链接
- 使用 Modrinth API（免费）获取模组信息

```json
// data.json 示例
{
  "mod_dependencies": ["create"],
  "mod_names": ["机械动力"],
  "mod_links": {
    "create": "https://modrinth.com/mod/create"
  }
}
```

### 任务 2：模态框添加模组下载区域

**文件**：`js/gallery.js`

**修改内容**：
- 在模态框详情中添加"依赖模组下载"区域
- 显示模组名称和下载链接（跳转到 Modrinth/CurseForge）
- 添加提示："请先安装依赖模组再使用此蓝图"

### 任务 3：更新 data.json 模组列表

**文件**：`blueprints/data.json`

**添加 `modLinks` 配置**：
```json
{
  "modLinks": {
    "ae2": "https://modrinth.com/mod/ae2",
    "create": "https://modrinth.com/mod/create",
    "thaumcraft6": "https://www.curseforge.com/minecraft/mc-mods/thaumcraft-6",
    ...
  }
}
```

---

## 五、实施步骤

1. **更新数据模型**
   - 修改 `data.json` 添加 `mod_links` 字段和 `modLinks` 配置

2. **修改模态框渲染**
   - 添加依赖模组下载区域
   - 显示模组名称和下载链接

3. **添加下载提示**
   - 显示提示信息："使用此蓝图需要先安装以下模组"

4. **可选：Modrinth API集成**
   - 在 Worker 中添加 Modrinth API 代理
   - 获取模组最新版本信息

---

## 六、决策确认

| 问题 | 决定 | 说明 |
|------|------|------|
| **账户安全** | ✅ 保持 QQ OAuth | 不添加本地账户系统，保持当前 OAuth 方案 |
| **创作者收益** | ✅ 删除 | 不实现收益/打赏功能 |
| **模组下载** | ✅ 提供下载链接 | 使用 Modrinth（免费）为主，跳转到平台下载 |

---

## 七、文件修改清单

| 文件 | 修改内容 |
|------|----------|
| `blueprints/data.json` | 添加 `mod_links` 字段和 `modLinks` 配置 |
| `js/gallery.js` | 模态框添加依赖模组下载区域 |
| `css/style.css` | 添加模组下载链接样式 |
| `worker-upload.js` | 可选：添加 Modrinth API 代理 |

---

## 八、验证步骤

1. 打开蓝图详情，检查依赖模组下载链接是否显示
2. 点击模组链接，验证跳转到 Modrinth/CurseForge
3. 检查 QQ OAuth 登录是否正常（无密码暴露）
4. 确认无创作者收益相关功能