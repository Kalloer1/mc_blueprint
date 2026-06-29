var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker-upload.js
var worker_upload_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    if (url.pathname === "/auth/github") {
      return handleGitHubAuth(url, env, corsHeaders);
    }
    if (url.pathname === "/auth/github/callback") {
      return await handleGitHubCallback(request, url, env, corsHeaders);
    }
    if (url.pathname === "/api/user/profile" && request.method === "GET") {
      return await handleGetUserProfile(request, env, corsHeaders);
    }
    if (url.pathname === "/api/user/blueprints" && request.method === "GET") {
      return await handleGetUserBlueprints(request, env, corsHeaders);
    }
    if (url.pathname === "/upload" && request.method === "POST") {
      return await handleUpload(request, env, corsHeaders);
    }
    if (url.pathname === "/pending" && request.method === "GET") {
      return await handleGetPending(request, env, corsHeaders);
    }
    if (url.pathname === "/approve" && request.method === "POST") {
      return await handleApprove(request, env, corsHeaders);
    }
    if (url.pathname === "/reject" && request.method === "POST") {
      return await handleReject(request, env, corsHeaders);
    }
    return new Response("MC Blueprint Workshop API", { status: 200 });
  }
};
function handleGitHubAuth(url, env, corsHeaders) {
  const state = Math.random().toString(36).substring(2);
  const redirectUri = `${url.origin}/auth/github/callback`;
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read:user&state=${state}`;
  return Response.redirect(githubAuthUrl, 302);
}
__name(handleGitHubAuth, "handleGitHubAuth");
async function handleGitHubCallback(request, url, env, corsHeaders) {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code) {
    return new Response(
      JSON.stringify({ error: "\u7F3A\u5C11\u6388\u6743\u7801 (code)" }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
  try {
    const redirectUri = `${url.origin}/auth/github/callback`;
    const tokenParams = new URLSearchParams();
    tokenParams.set("client_id", env.GITHUB_APP_ID);
    tokenParams.set("client_secret", env.GITHUB_APP_SECRET);
    tokenParams.set("code", code);
    tokenParams.set("redirect_uri", redirectUri);
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json"
      },
      body: tokenParams.toString()
    });
    const tokenText = await tokenResponse.text();
    let tokenData;
    try {
      tokenData = JSON.parse(tokenText);
    } catch (e) {
      const params = new URLSearchParams(tokenText);
      tokenData = { access_token: params.get("access_token"), error: params.get("error") };
    }
    if (tokenData.error) {
      return new Response(
        JSON.stringify({ error: "GitHub \u6388\u6743\u5931\u8D25", detail: tokenData.error, description: tokenData.error_description }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    const accessToken = tokenData.access_token;
    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: "\u83B7\u53D6 Access Token \u5931\u8D25", raw: tokenData, debug_redirect_uri: redirectUri }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json"
      }
    });
    const userInfo = await userResponse.json();
    const userData = {
      platform: "github",
      id: "github_" + userInfo.id,
      nickname: userInfo.login,
      avatar: userInfo.avatar_url,
      bio: userInfo.bio || "",
      github_url: userInfo.html_url,
      login_time: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (env.BLUEPRINT_KV) {
      await env.BLUEPRINT_KV.put(`user:${userData.id}`, JSON.stringify(userData));
    }
    const redirectUrl = new URL("https://kalloer1.github.io/mc_blueprint/auth/callback.html");
    redirectUrl.searchParams.set("user_data", JSON.stringify(userData));
    return Response.redirect(redirectUrl.toString(), 302);
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "GitHub OAuth \u5931\u8D25", message: err.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
}
__name(handleGitHubCallback, "handleGitHubCallback");
async function handleGetUserProfile(request, env, corsHeaders) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("user_id");
  if (!userId) {
    return new Response(
      JSON.stringify({ error: "\u7F3A\u5C11 user_id \u53C2\u6570" }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
  try {
    const userData = await env.BLUEPRINT_KV.get(`user:${userId}`);
    if (!userData) {
      return new Response(
        JSON.stringify({ error: "\u7528\u6237\u4E0D\u5B58\u5728" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    return new Response(userData, { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "\u83B7\u53D6\u7528\u6237\u4FE1\u606F\u5931\u8D25", message: err.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
}
__name(handleGetUserProfile, "handleGetUserProfile");
async function handleGetUserBlueprints(request, env, corsHeaders) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("user_id");
  if (!userId) {
    return new Response(
      JSON.stringify({ error: "\u7F3A\u5C11 user_id \u53C2\u6570" }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
  try {
    const userBlueprints = [];
    if (env.BLUEPRINT_KV) {
      const keys = await env.BLUEPRINT_KV.list({ prefix: "blueprint:" });
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
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "\u83B7\u53D6\u84DD\u56FE\u5217\u8868\u5931\u8D25", message: err.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
}
__name(handleGetUserBlueprints, "handleGetUserBlueprints");
async function handleUpload(request, env, corsHeaders) {
  try {
    const formData = await request.formData();
    const file = formData.get("blueprint_file");
    if (!file) {
      return new Response(
        JSON.stringify({ error: "\u672A\u4E0A\u4F20\u6587\u4EF6" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    if (file.size > 10 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: "\u6587\u4EF6\u5927\u5C0F\u8D85\u8FC7\u9650\u5236\uFF08\u6700\u5927 10MB\uFF09" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    const fileName = file.name.toLowerCase();
    const validExtensions = [".nbt", ".schematic", ".litematic", ".json"];
    const isValidFormat = validExtensions.some((ext) => fileName.endsWith(ext));
    if (!isValidFormat) {
      return new Response(
        JSON.stringify({ error: "\u4E0D\u652F\u6301\u7684\u6587\u4EF6\u683C\u5F0F" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    const name = formData.get("name");
    const description = formData.get("description") || "";
    const mcVersion = formData.get("mc_version");
    const author = formData.get("author") || "\u533F\u540D\u73A9\u5BB6";
    const authorId = formData.get("author_id") || "";
    const mods = [];
    const tags = [];
    formData.forEach((value, key) => {
      if (key === "mods[]") mods.push(value);
      if (key === "tags[]") tags.push(value);
    });
    const uploadId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    const fileBuffer = await file.arrayBuffer();
    const r2Key = `uploads/${uploadId}/${file.name}`;
    if (env.BLUEPRINT_R2) {
      await env.BLUEPRINT_R2.put(r2Key, fileBuffer, {
        httpMetadata: { contentType: file.type || "application/octet-stream" }
      });
    }
    const blueprintMeta = {
      id: uploadId,
      name,
      description,
      format: fileName.split(".").pop(),
      size: file.size,
      mc_version: mcVersion,
      mod_dependencies: mods,
      mod_names: getModNames(mods),
      tags,
      author,
      author_id: authorId,
      is_approved: false,
      upload_time: (/* @__PURE__ */ new Date()).toISOString(),
      file_key: r2Key,
      file_name: file.name
    };
    if (env.BLUEPRINT_KV) {
      await env.BLUEPRINT_KV.put(`pending:${uploadId}`, JSON.stringify(blueprintMeta));
    }
    return new Response(
      JSON.stringify({
        success: true,
        message: "\u4E0A\u4F20\u6210\u529F\uFF01\u4F60\u7684\u84DD\u56FE\u5DF2\u8FDB\u5165\u5BA1\u6838\u961F\u5217",
        blueprint: blueprintMeta
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "\u4E0A\u4F20\u5931\u8D25", message: err.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
}
__name(handleUpload, "handleUpload");
async function handleGetPending(request, env, corsHeaders) {
  const authHeader = request.headers.get("Authorization") || "";
  const password = authHeader.replace("Bearer ", "");
  if (password !== env.ADMIN_PASSWORD) {
    return new Response(
      JSON.stringify({ error: "\u672A\u6388\u6743" }),
      { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
  try {
    const pendingList = await getPendingList(env);
    return new Response(
      JSON.stringify({ success: true, pending: pendingList }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "\u83B7\u53D6\u5931\u8D25", message: err.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
}
__name(handleGetPending, "handleGetPending");
async function handleApprove(request, env, corsHeaders) {
  const authHeader = request.headers.get("Authorization") || "";
  const password = authHeader.replace("Bearer ", "");
  if (password !== env.ADMIN_PASSWORD) {
    return new Response(
      JSON.stringify({ error: "\u672A\u6388\u6743" }),
      { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
  try {
    const body = await request.json();
    const uploadId = body.uploadId;
    if (!uploadId) {
      return new Response(
        JSON.stringify({ error: "\u7F3A\u5C11 uploadId" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    const metaStr = await env.BLUEPRINT_KV.get(`pending:${uploadId}`);
    if (!metaStr) {
      return new Response(
        JSON.stringify({ error: "\u84DD\u56FE\u4E0D\u5B58\u5728" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    const meta = JSON.parse(metaStr);
    meta.is_approved = true;
    meta.approved_time = (/* @__PURE__ */ new Date()).toISOString();
    await env.BLUEPRINT_KV.put(`blueprint:${uploadId}`, JSON.stringify(meta));
    await env.BLUEPRINT_KV.delete(`pending:${uploadId}`);
    return new Response(
      JSON.stringify({ success: true, message: "\u5BA1\u6838\u901A\u8FC7", blueprint: meta }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "\u5BA1\u6838\u5931\u8D25", message: err.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
}
__name(handleApprove, "handleApprove");
async function handleReject(request, env, corsHeaders) {
  const authHeader = request.headers.get("Authorization") || "";
  const password = authHeader.replace("Bearer ", "");
  if (password !== env.ADMIN_PASSWORD) {
    return new Response(
      JSON.stringify({ error: "\u672A\u6388\u6743" }),
      { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
  try {
    const body = await request.json();
    const uploadId = body.uploadId;
    if (!uploadId) {
      return new Response(
        JSON.stringify({ error: "\u7F3A\u5C11 uploadId" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    const metaStr = await env.BLUEPRINT_KV.get(`pending:${uploadId}`);
    if (!metaStr) {
      return new Response(
        JSON.stringify({ error: "\u84DD\u56FE\u4E0D\u5B58\u5728" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    const meta = JSON.parse(metaStr);
    if (env.BLUEPRINT_R2) {
      await env.BLUEPRINT_R2.delete(meta.file_key);
    }
    await env.BLUEPRINT_KV.delete(`pending:${uploadId}`);
    return new Response(
      JSON.stringify({ success: true, message: "\u5DF2\u62D2\u7EDD" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "\u64CD\u4F5C\u5931\u8D25", message: err.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
}
__name(handleReject, "handleReject");
async function getPendingList(env) {
  const pendingList = [];
  if (env.BLUEPRINT_KV) {
    const keys = await env.BLUEPRINT_KV.list({ prefix: "pending:" });
    for (const key of keys.keys) {
      if (key.name !== "pending:list") {
        const metaStr = await env.BLUEPRINT_KV.get(key.name);
        if (metaStr) {
          pendingList.push(JSON.parse(metaStr));
        }
      }
    }
  }
  return pendingList;
}
__name(getPendingList, "getPendingList");
function getModNames(modIds) {
  const modMap = {
    "ae2": "\u5E94\u7528\u80FD\u6E902",
    "create": "\u673A\u68B0\u52A8\u529B",
    "thaumcraft6": "\u795E\u79D8\u65F6\u4EE36",
    "industrialcraft": "\u5DE5\u4E1A\u65F6\u4EE32",
    "forge": "Forge \u901A\u7528",
    "fabric": "Fabric \u901A\u7528",
    "forestry": "\u6797\u4E1A",
    "buildcraft": "\u5EFA\u7B51\u5DE5\u827A",
    "railcraft": "\u94C1\u8DEF\u5DE5\u827A",
    "tinkers": "\u5320\u9B42",
    "thermal": "\u70ED\u529B\u7CFB\u5217"
  };
  return modIds.map((id) => modMap[id] || id);
}
__name(getModNames, "getModNames");
export {
  worker_upload_default as default
};
//# sourceMappingURL=worker-upload.js.map
