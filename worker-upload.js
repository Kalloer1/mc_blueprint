// ===== Cloudflare Worker for MC Blueprint Workshop =====
// 包含：多平台 OAuth 登录 + 蓝图上传 + 审核队列 + OpenList 存储支持

// ==================== OAuth 配置 ====================

// GitHub OAuth 配置
const GITHUB_APP_ID = 'YOUR_GITHUB_APP_ID'; // 替换为你的 GitHub OAuth App ID
const GITHUB_APP_SECRET = 'YOUR_GITHUB_APP_SECRET'; // 替换为你的 GitHub OAuth App Secret
const GITHUB_REDIRECT_URI = 'https://qq-auth.wqclo.workers.dev/auth/github/callback';

// B站 OAuth 配置
const BILIBILI_CLIENT_ID = 'YOUR_BILIBILI_CLIENT_ID'; // 替换为你的 B站 Client ID
const BILIBILI_CLIENT_SECRET = 'YOUR_BILIBILI_CLIENT_SECRET'; // 替换为你的 B站 Client Secret
const BILIBILI_REDIRECT_URI = 'https://qq-auth.wqclo.workers.dev/auth/bilibili/callback';

// QQ 互联应用配置（保留作为备选）
const QQ_APP_ID = '1112518560';
const QQ_APP_KEY = 'Ps6lLVltZEMLWTbQ';
const QQ_REDIRECT_URI = 'https://kalloer1.github.io/mc_blueprint/auth/callback.html';

// ==================== 存储配置 ====================

// OpenList 配置（可选，用于替代 R2 存储）
const OPENLIST_URL = ''; // 例如：https://openlist.example.com
const OPENLIST_TOKEN = ''; // OpenList 登录后的 token

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

    // /callback - QQ OAuth 回调
    if (url.pathname === '/callback') {
      return await handleQQCallback(request, corsHeaders);
    }

    // /auth/github - GitHub OAuth 授权跳转
    if (url.pathname === '/auth/github') {
      return handleGitHubAuth(corsHeaders);
    }

    // /auth/github/callback - GitHub OAuth 回调
    if (url.pathname === '/auth/github/callback') {
      return await handleGitHubCallback(request, corsHeaders);
    }

    // /auth/bilibili - B站 OAuth 授权跳转
    if (url.pathname === '/auth/bilibili') {
      return handleBilibiliAuth(corsHeaders);
    }

    // /auth/bilibili/callback - B站 OAuth 回调
    if (url.pathname === '/auth/bilibili/callback') {
      return await handleBilibiliCallback(request, corsHeaders);
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

// ==================== QQ OAuth 回调处理 ====================

async function handleQQCallback(request, corsHeaders) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  if (!code) {
    return new Response(
      JSON.stringify({ error: '缺少授权码 (code)' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  try {
    const tokenUrl = `https://graph.qq.com/oauth2.0/token?grant_type=authorization_code&client_id=${QQ_APP_ID}&client_secret=${QQ_APP_KEY}&code=${code}&redirect_uri=${encodeURIComponent(QQ_REDIRECT_URI)}`;
    const tokenResponse = await fetch(tokenUrl);
    const tokenText = await tokenResponse.text();
    const tokenParams = new URLSearchParams(tokenText);
    const accessToken = tokenParams.get('access_token');

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: '获取 Access Token 失败', raw: tokenText }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const openidUrl = `https://graph.qq.com/oauth2.0/me?access_token=${accessToken}`;
    const openidResponse = await fetch(openidUrl);
    const openidText = await openidResponse.text();
    const jsonMatch = openidText.match(/\{[^}]+\}/);

    if (!jsonMatch) {
      return new Response(
        JSON.stringify({ error: '获取 OpenID 失败', raw: openidText }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const openidData = JSON.parse(jsonMatch[0]);
    const openid = openidData.openid;

    const userInfoUrl = `https://graph.qq.com/user/get_user_info?access_token=${accessToken}&oauth_consumer_key=${QQ_APP_ID}&openid=${openid}`;
    const userInfoResponse = await fetch(userInfoUrl);
    const userInfo = await userInfoResponse.json();

    if (userInfo.ret !== 0) {
      return new Response(
        JSON.stringify({ error: '获取用户信息失败', info: userInfo }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const userData = {
      openid: openid,
      nickname: userInfo.nickname,
      figureurl: userInfo.figureurl,
      figureurl_1: userInfo.figureurl_1,
      figureurl_2: userInfo.figureurl_2,
      figureurl_qq_1: userInfo.figureurl_qq_1,
      figureurl_qq_2: userInfo.figureurl_qq_2,
      gender: userInfo.gender,
    };

    return new Response(
      JSON.stringify({ success: true, user: userData }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: '服务器错误', message: err.message }),
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
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        client_id: GITHUB_APP_ID,
        client_secret: GITHUB_APP_SECRET,
        code: code,
        redirect_uri: GITHUB_REDIRECT_URI
      })
    });

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: '获取 Access Token 失败', raw: tokenData }),
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

// ==================== B站 OAuth ====================

function handleBilibiliAuth(corsHeaders) {
  const state = Math.random().toString(36).substring(2);
  const bilibiliAuthUrl = `https://account.bilibili.com/pc/account-pc/auth/oauth?client_id=${BILIBILI_CLIENT_ID}&gourl=${encodeURIComponent('https://kalloer1.github.io/mc_blueprint/auth/callback.html')}&state=${state}`;

  return Response.redirect(bilibiliAuthUrl, 302);
}

async function handleBilibiliCallback(request, corsHeaders) {
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
    const tokenResponse = await fetch('https://api.bilibili.com/x/account-oauth2/v1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: BILIBILI_CLIENT_ID,
        client_secret: BILIBILI_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code
      })
    });

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: '获取 Access Token 失败', raw: tokenData }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // 获取用户信息
    const userResponse = await fetch('https://api.bilibili.com/x/web-interface/nav', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const userInfo = await userResponse.json();

    if (userInfo.code !== 0) {
      return new Response(
        JSON.stringify({ error: '获取用户信息失败', raw: userInfo }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const userData = {
      platform: 'bilibili',
      id: userInfo.data.mid.toString(),
      nickname: userInfo.data.uname,
      avatar: userInfo.data.face,
      vip_status: userInfo.data.vip_status,
      level: userInfo.data.level,
    };

    // 重定向回前端页面，携带用户信息
    const redirectUrl = new URL('https://kalloer1.github.io/mc_blueprint/auth/callback.html');
    redirectUrl.searchParams.set('user_data', JSON.stringify(userData));

    return Response.redirect(redirectUrl.toString(), 302);

  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'B站 OAuth 失败', message: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
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