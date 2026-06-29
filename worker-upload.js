// ===== Cloudflare Worker for MC Blueprint Workshop =====
// 包含：GitHub OAuth 登录 + 蓝图上传 + 审核队列 + 用户管理 + OpenList 存储支持
// ⚠️ 敏感信息通过 Cloudflare Secrets 配置，不在代码中明文存储

export default {
  async fetch(request, env) {
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
      return handleGitHubAuth(url, env, corsHeaders);
    }

    // /auth/github/callback - GitHub OAuth 回调
    if (url.pathname === '/auth/github/callback') {
      return await handleGitHubCallback(request, url, env, corsHeaders);
    }

    // /api/user/profile - 获取用户信息
    if (url.pathname === '/api/user/profile' && request.method === 'GET') {
      return await handleGetUserProfile(request, env, corsHeaders);
    }

    // /api/user/blueprints - 获取用户上传的蓝图
    if (url.pathname === '/api/user/blueprints' && request.method === 'GET') {
      return await handleGetUserBlueprints(request, env, corsHeaders);
    }

    // /upload - 蓝图上传
    if (url.pathname === '/upload' && request.method === 'POST') {
      return await handleUpload(request, env, corsHeaders);
    }

    // /pending - 获取待审核列表
    if (url.pathname === '/pending' && request.method === 'GET') {
      return await handleGetPending(request, env, corsHeaders);
    }

    // /approve - 审核通过
    if (url.pathname === '/approve' && request.method === 'POST') {
      return await handleApprove(request, env, corsHeaders);
    }

    // /reject - 拒绝审核
    if (url.pathname === '/reject' && request.method === 'POST') {
      return await handleReject(request, env, corsHeaders);
    }

    return new Response('MC Blueprint Workshop API', { status: 200 });
  }
};

// ==================== GitHub OAuth ====================

function handleGitHubAuth(url, env, corsHeaders) {
  const state = Math.random().toString(36).substring(2);
  // 动态构建 redirect_uri，确保与 GitHub OAuth App 设置完全一致
  const redirectUri = `${url.origin}/auth/github/callback`;
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read:user&state=${state}`;

  return Response.redirect(githubAuthUrl, 302);
}

async function handleGitHubCallback(request, url, env, corsHeaders) {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code) {
    return new Response(
      JSON.stringify({ error: '缺少授权码 (code)' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  try {
    // 动态构建 redirect_uri（与授权时完全一致）
    const redirectUri = `${url.origin}/auth/github/callback`;

    const tokenParams = new URLSearchParams();
    tokenParams.set('client_id', env.GITHUB_APP_ID);
    tokenParams.set('client_secret', env.GITHUB_APP_SECRET);
    tokenParams.set('code', code);
    tokenParams.set('redirect_uri', redirectUri);

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
      const params = new URLSearchParams(tokenText);
      tokenData = { access_token: params.get('access_token'), error: params.get('error') };
    }

    if (tokenData.error) {
      return new Response(
        JSON.stringify({ error: 'GitHub 授权失败', detail: tokenData.error, description: tokenData.error_description }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: '获取 Access Token 失败', raw: tokenData, debug_redirect_uri: redirectUri }),
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
      id: 'github_' + userInfo.id,
      nickname: userInfo.login,
      avatar: userInfo.avatar_url,
      bio: userInfo.bio || '',
      github_url: userInfo.html_url,
      login_time: new Date().toISOString(),
    };

    // 保存用户数据到 KV
    if (env.BLUEPRINT_KV) {
      await env.BLUEPRINT_KV.put(`user:${userData.id}`, JSON.stringify(userData));
    }

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

// ==================== 用户管理 ====================

async function handleGetUserProfile(request, env, corsHeaders) {
  const url = new URL(request.url);
  const userId = url.searchParams.get('user_id');

  if (!userId) {
    return new Response(
      JSON.stringify({ error: '缺少 user_id 参数' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  try {
    const userData = await env.BLUEPRINT_KV.get(`user:${userId}`);
    if (!userData) {
      return new Response(
        JSON.stringify({ error: '用户不存在' }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
    return new Response(userData, { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: '获取用户信息失败', message: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

async function handleGetUserBlueprints(request, env, corsHeaders) {
  const url = new URL(request.url);
  const userId = url.searchParams.get('user_id');

  if (!userId) {
    return new Response(
      JSON.stringify({ error: '缺少 user_id 参数' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  try {
    const userBlueprints = [];
    if (env.BLUEPRINT_KV) {
      const keys = await env.BLUEPRINT_KV.list({ prefix: 'blueprint:' });
      for (const key of keys.keys) {
        const metaStr = await env.BLUEPRINT_KV.get(key.name);
        if (metaStr) {
          const meta = JSON.parse(metaStr);
          if (meta.author_id === userId) {
            userBlueprints.push(meta);
          }
        }
      }
    }
    return new Response(
      JSON.stringify({ success: true, blueprints: userBlueprints }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: '获取蓝图列表失败', message: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

// ==================== 蓝图上传处理 ====================

async function handleUpload(request, env, corsHeaders) {
  try {
    const formData = await request.formData();
    const file = formData.get('blueprint_file');

    if (!file) {
      return new Response(
        JSON.stringify({ error: '未上传文件' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: '文件大小超过限制（最大 10MB）' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const fileName = file.name.toLowerCase();
    const validExtensions = ['.nbt', '.schematic', '.litematic', '.json'];
    const isValidFormat = validExtensions.some(ext => fileName.endsWith(ext));

    if (!isValidFormat) {
      return new Response(
        JSON.stringify({ error: '不支持的文件格式' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const name = formData.get('name');
    const description = formData.get('description') || '';
    const mcVersion = formData.get('mc_version');
    const author = formData.get('author') || '匿名玩家';
    const authorId = formData.get('author_id') || '';

    const mods = [];
    const tags = [];
    formData.forEach((value, key) => {
      if (key === 'mods[]') mods.push(value);
      if (key === 'tags[]') tags.push(value);
    });

    const uploadId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    const fileBuffer = await file.arrayBuffer();
    const r2Key = `uploads/${uploadId}/${file.name}`;

    if (env.BLUEPRINT_R2) {
      await env.BLUEPRINT_R2.put(r2Key, fileBuffer, {
        httpMetadata: { contentType: file.type || 'application/octet-stream' }
      });
    }

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
      author_id: authorId,
      is_approved: false,
      upload_time: new Date().toISOString(),
      file_key: r2Key,
      file_name: file.name,
    };

    if (env.BLUEPRINT_KV) {
      await env.BLUEPRINT_KV.put(`pending:${uploadId}`, JSON.stringify(blueprintMeta));
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

// ==================== 审核管理 ====================

async function handleGetPending(request, env, corsHeaders) {
  const authHeader = request.headers.get('Authorization') || '';
  const password = authHeader.replace('Bearer ', '');

  if (password !== env.ADMIN_PASSWORD) {
    return new Response(
      JSON.stringify({ error: '未授权' }),
      { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  try {
    const pendingList = await getPendingList(env);
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

async function handleApprove(request, env, corsHeaders) {
  const authHeader = request.headers.get('Authorization') || '';
  const password = authHeader.replace('Bearer ', '');

  if (password !== env.ADMIN_PASSWORD) {
    return new Response(
      JSON.stringify({ error: '未授权' }),
      { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  try {
    const body = await request.json();
    const uploadId = body.uploadId;

    if (!uploadId) {
      return new Response(
        JSON.stringify({ error: '缺少 uploadId' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const metaStr = await env.BLUEPRINT_KV.get(`pending:${uploadId}`);
    if (!metaStr) {
      return new Response(
        JSON.stringify({ error: '蓝图不存在' }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const meta = JSON.parse(metaStr);
    meta.is_approved = true;
    meta.approved_time = new Date().toISOString();

    await env.BLUEPRINT_KV.put(`blueprint:${uploadId}`, JSON.stringify(meta));
    await env.BLUEPRINT_KV.delete(`pending:${uploadId}`);

    return new Response(
      JSON.stringify({ success: true, message: '审核通过', blueprint: meta }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: '审核失败', message: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

async function handleReject(request, env, corsHeaders) {
  const authHeader = request.headers.get('Authorization') || '';
  const password = authHeader.replace('Bearer ', '');

  if (password !== env.ADMIN_PASSWORD) {
    return new Response(
      JSON.stringify({ error: '未授权' }),
      { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  try {
    const body = await request.json();
    const uploadId = body.uploadId;

    if (!uploadId) {
      return new Response(
        JSON.stringify({ error: '缺少 uploadId' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const metaStr = await env.BLUEPRINT_KV.get(`pending:${uploadId}`);
    if (!metaStr) {
      return new Response(
        JSON.stringify({ error: '蓝图不存在' }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const meta = JSON.parse(metaStr);

    if (env.BLUEPRINT_R2) {
      await env.BLUEPRINT_R2.delete(meta.file_key);
    }
    await env.BLUEPRINT_KV.delete(`pending:${uploadId}`);

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

async function getPendingList(env) {
  const pendingList = [];
  if (env.BLUEPRINT_KV) {
    const keys = await env.BLUEPRINT_KV.list({ prefix: 'pending:' });
    for (const key of keys.keys) {
      if (key.name !== 'pending:list') {
        const metaStr = await env.BLUEPRINT_KV.get(key.name);
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