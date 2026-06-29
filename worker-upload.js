// ===== Cloudflare Worker for MC Blueprint Workshop =====
// 包含：GitHub OAuth 登录 + 蓝图上传 + 审核队列 + OpenList 存储支持

// ==================== OAuth 配置 ====================

// GitHub OAuth 配置
const GITHUB_APP_ID = 'Ov23liYANHGQgZXXbIzC'; // 替换为你的 GitHub OAuth App ID
const GITHUB_APP_SECRET = '29badd7883fc87a5dcbf7cefd6c8efaf33e4f3f9'; // 替换为你的 GitHub OAuth App Secret
const GITHUB_REDIRECT_URI = 'https://qq-auth.wqclo.workers.dev/auth/github/callback';

// ==================== 存储配置 ====================

// OpenList 配置（可选，用于替代 R2 存储）
const OPENLIST_URL = 'https://cloud.888424.xyz/'; // 例如：https://openlist.example.com
const OPENLIST_TOKEN = 'openlist-813a5c61-3027-40b2-9104-fd431f6d1337sLiBiQBTHiuH84XS1rlQBmO2vTOf2OpYcBcHE3wMaWJX5cE3C4cxvG6Ps5NNg46I'; // OpenList 登录后的 token

// KV 命名空间绑定（需要在 Cloudflare Workers 控制台配置）
// 绑定名称：BLUEPRINT_KV
// R2 存储绑定名称：BLUEPRINT_R2

// 管理员密码（用于审核功能）
const ADMIN_PASSWORD = 'your_admin_password_here'; // 修改为你自己的密码

export default {
  async fetch(request) {
    const url = new URL(request.url);

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // /auth/github - GitHub OAuth 授权跳转
    if (url.pathname === '/auth/github') {
      return handleGitHubAuth(corsHeaders);
    }

    // /auth/github/callback - GitHub OAuth 回调
    if (url.pathname === '/auth/github/callback') {
      return await handleGitHubCallback(request, corsHeaders);
    }

    // /upload - 蓝图上传
    if (url.pathname === '/upload' && request.method === 'POST') {
      return await handleUpload(request, corsHeaders);
    }

    // /pending - 获取待审核列表
    if (url.pathname === '/pending' && request.method === 'GET') {
      return await handleGetPending(request, corsHeaders);
    }

    // /approve - 审核通过
    if (url.pathname === '/approve' && request.method === 'POST') {
      return await handleApprove(request, corsHeaders);
    }

    // /reject - 拒绝审核
    if (url.pathname === '/reject' && request.method === 'POST') {
      return await handleReject(request, corsHeaders);
    }

    return new Response('MC Blueprint Workshop API', { status: 200 });
  }
};

// ==================== GitHub OAuth ====================

function handleGitHubAuth(corsHeaders) {
  const state = Math.random().toString(36).substring(2);
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_APP_ID}&redirect_uri=${encodeURIComponent(GITHUB_REDIRECT_URI)}&scope=read:user&state=${state}`;

  return Response.redirect(githubAuthUrl, 302);
}

async function handleGitHubCallback(request, corsHeaders) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code) {
    return new Response(
      JSON.stringify({ error: '缺少授权码 (code)' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  try {
    // 使用 code 换取 access_token
    const tokenParams = new URLSearchParams();
    tokenParams.set('client_id', GITHUB_APP_ID);
    tokenParams.set('client_secret', GITHUB_APP_SECRET);
    tokenParams.set('code', code);
    tokenParams.set('redirect_uri', GITHUB_REDIRECT_URI);

    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: tokenParams.toString()
    });

    const tokenText = await tokenResponse.text();
    let tokenData;
    try {
      tokenData = JSON.parse(tokenText);
    } catch (e) {
      // 如果不是 JSON，可能是 URL encoded 格式
      const params = new URLSearchParams(tokenText);
      tokenData = { access_token: params.get('access_token'), error: params.get('error') };
    }

    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: '获取 Access Token 失败', raw: tokenData, raw_text: tokenText.substring(0, 200) }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // 获取用户信息
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    const userInfo = await userResponse.json();

    const userData = {
      platform: 'github',
      id: userInfo.id.toString(),
      nickname: userInfo.login,
      avatar: userInfo.avatar_url,
      bio: userInfo.bio || '',
      github_url: userInfo.html_url,
    };

    // 重定向回前端页面，携带用户信息
    const redirectUrl = new URL('https://kalloer1.github.io/mc_blueprint/auth/callback.html');
    redirectUrl.searchParams.set('user_data', JSON.stringify(userData));

    return Response.redirect(redirectUrl.toString(), 302);

  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'GitHub OAuth 失败', message: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

// ==================== 蓝图上传处理 ====================

async function handleUpload(request, corsHeaders) {
  try {
    const formData = await request.formData();
    const file = formData.get('blueprint_file');

    if (!file) {
      return new Response(
        JSON.stringify({ error: '未上传文件' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // 验证文件大小（最大 10MB）
    if (file.size > 10 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: '文件大小超过限制（最大 10MB）' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // 验证文件格式
    const fileName = file.name.toLowerCase();
    const validExtensions = ['.nbt', '.schematic', '.litematic', '.json'];
    const isValidFormat = validExtensions.some(ext => fileName.endsWith(ext));

    if (!isValidFormat) {
      return new Response(
        JSON.stringify({ error: '不支持的文件格式' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // 获取表单数据
    const name = formData.get('name');
    const description = formData.get('description') || '';
    const mcVersion = formData.get('mc_version');
    const author = formData.get('author') || '匿名玩家';

    // 获取多选值（模组和标签）
    const mods = [];
    const tags = [];
    formData.forEach((value, key) => {
      if (key === 'mods[]') mods.push(value);
      if (key === 'tags[]') tags.push(value);
    });

    // 生成唯一 ID
    const uploadId = Date.now().toString(36) + Math.random().toString(36).substr(2);

    // 保存文件到 R2
    const fileBuffer = await file.arrayBuffer();
    const r2Key = `uploads/${uploadId}/${file.name}`;
    
    if (typeof BLUEPRINT_R2 !== 'undefined') {
      await BLUEPRINT_R2.put(r2Key, fileBuffer, {
        httpMetadata: {
          contentType: file.type || 'application/octet-stream',
        }
      });
    }

    // 保存元数据到 KV
    const blueprintMeta = {
      id: uploadId,
      name: name,
      description: description,
      format: fileName.split('.').pop(),
      size: file.size,
      mc_version: mcVersion,
      mod_dependencies: mods,
      mod_names: getModNames(mods),
      tags: tags,
      author: author,
      is_approved: false,
      upload_time: new Date().toISOString(),
      file_key: r2Key,
      file_name: file.name,
    };

    if (typeof BLUEPRINT_KV !== 'undefined') {
      await BLUEPRINT_KV.put(`pending:${uploadId}`, JSON.stringify(blueprintMeta));
      await BLUEPRINT_KV.put('pending:list', JSON.stringify(await getPendingList()));
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: '上传成功！你的蓝图已进入审核队列',
        blueprint: blueprintMeta
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: '上传失败', message: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

// ==================== 获取待审核列表 ====================

async function handleGetPending(request, corsHeaders) {
  const password = request.headers.get('Authorization');
  if (password !== `Bearer ${ADMIN_PASSWORD}`) {
    return new Response(
      JSON.stringify({ error: '未授权' }),
      { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  try {
    const pendingList = await getPendingList();
    return new Response(
      JSON.stringify({ success: true, pending: pendingList }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: '获取失败', message: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

// ==================== 审核通过 ====================

async function handleApprove(request, corsHeaders) {
  const password = request.headers.get('Authorization');
  if (password !== `Bearer ${ADMIN_PASSWORD}`) {
    return new Response(
      JSON.stringify({ error: '未授权' }),
      { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  try {
    const { uploadId } = await request.json();
    if (!uploadId) {
      return new Response(
        JSON.stringify({ error: '缺少 uploadId' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const metaStr = await BLUEPRINT_KV.get(`pending:${uploadId}`);
    if (!metaStr) {
      return new Response(
        JSON.stringify({ error: '蓝图不存在' }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const meta = JSON.parse(metaStr);
    meta.is_approved = true;

    // 移动到已审核列表
    await BLUEPRINT_KV.put(`blueprint:${uploadId}`, JSON.stringify(meta));
    await BLUEPRINT_KV.delete(`pending:${uploadId}`);

    // 更新待审核列表
    await BLUEPRINT_KV.put('pending:list', JSON.stringify(await getPendingList()));

    return new Response(
      JSON.stringify({ success: true, message: '审核通过' }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: '审核失败', message: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

// ==================== 拒绝审核 ====================

async function handleReject(request, corsHeaders) {
  const password = request.headers.get('Authorization');
  if (password !== `Bearer ${ADMIN_PASSWORD}`) {
    return new Response(
      JSON.stringify({ error: '未授权' }),
      { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  try {
    const { uploadId } = await request.json();
    if (!uploadId) {
      return new Response(
        JSON.stringify({ error: '缺少 uploadId' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const metaStr = await BLUEPRINT_KV.get(`pending:${uploadId}`);
    if (!metaStr) {
      return new Response(
        JSON.stringify({ error: '蓝图不存在' }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const meta = JSON.parse(metaStr);

    // 删除文件和元数据
    if (typeof BLUEPRINT_R2 !== 'undefined') {
      await BLUEPRINT_R2.delete(meta.file_key);
    }
    await BLUEPRINT_KV.delete(`pending:${uploadId}`);

    // 更新待审核列表
    await BLUEPRINT_KV.put('pending:list', JSON.stringify(await getPendingList()));

    return new Response(
      JSON.stringify({ success: true, message: '已拒绝' }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: '操作失败', message: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

// ==================== 辅助函数 ====================

async function getPendingList() {
  const pendingList = [];
  if (typeof BLUEPRINT_KV !== 'undefined') {
    const keys = await BLUEPRINT_KV.list({ prefix: 'pending:' });
    for (const key of keys.keys) {
      if (key.name !== 'pending:list') {
        const metaStr = await BLUEPRINT_KV.get(key.name);
        if (metaStr) {
          pendingList.push(JSON.parse(metaStr));
        }
      }
    }
  }
  return pendingList;
}

function getModNames(modIds) {
  const modMap = {
    'ae2': '应用能源2',
    'create': '机械动力',
    'thaumcraft6': '神秘时代6',
    'industrialcraft': '工业时代2',
    'forge': 'Forge 通用',
    'fabric': 'Fabric 通用',
    'forestry': '林业',
    'buildcraft': '建筑工艺',
    'railcraft': '铁路工艺',
    'tinkers': '匠魂',
    'thermal': '热力系列',
  };
  return modIds.map(id => modMap[id] || id);
}

// ==================== OpenList 存储支持 ====================

async function uploadToOpenList(fileBuffer, fileName, path = '/blueprints') {
  if (!OPENLIST_URL || !OPENLIST_TOKEN) {
    throw new Error('OpenList 未配置');
  }

  const formData = new FormData();
  formData.append('file', new Blob([fileBuffer]), fileName);
  formData.append('path', path);

  const response = await fetch(`${OPENLIST_URL}/api/fs/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENLIST_TOKEN}`
    },
    body: formData
  });

  if (!response.ok) {
    throw new Error(`OpenList 上传失败: ${response.statusText}`);
  }

  return await response.json();
}

async function deleteFromOpenList(path) {
  if (!OPENLIST_URL || !OPENLIST_TOKEN) {
    throw new Error('OpenList 未配置');
  }

  const response = await fetch(`${OPENLIST_URL}/api/fs/remove`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENLIST_TOKEN}`
    },
    body: JSON.stringify({ path })
  });

  if (!response.ok) {
    throw new Error(`OpenList 删除失败: ${response.statusText}`);
  }

  return await response.json();
}