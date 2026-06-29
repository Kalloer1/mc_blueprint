var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker-upload.js
var GITHUB_APP_ID = "Ov23liYANHGQgZXXbIzC";
var GITHUB_APP_SECRET = "29badd7883fc87a5dcbf7cefd6c8efaf33e4f3f9";
var GITHUB_REDIRECT_URI = "https://qq-auth.wqclo.workers.dev/auth/github/callback";
var ADMIN_PASSWORD = "your_admin_password_here";
var worker_upload_default = {
  async fetch(request) {
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
      return handleGitHubAuth(corsHeaders);
    }
    if (url.pathname === "/auth/github/callback") {
      return await handleGitHubCallback(request, corsHeaders);
    }
    if (url.pathname === "/upload" && request.method === "POST") {
      return await handleUpload(request, corsHeaders);
    }
    if (url.pathname === "/pending" && request.method === "GET") {
      return await handleGetPending(request, corsHeaders);
    }
    if (url.pathname === "/approve" && request.method === "POST") {
      return await handleApprove(request, corsHeaders);
    }
    if (url.pathname === "/reject" && request.method === "POST") {
      return await handleReject(request, corsHeaders);
    }
    return new Response("MC Blueprint Workshop API", { status: 200 });
  }
};
function handleGitHubAuth(corsHeaders) {
  const state = Math.random().toString(36).substring(2);
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_APP_ID}&redirect_uri=${encodeURIComponent(GITHUB_REDIRECT_URI)}&scope=read:user&state=${state}`;
  return Response.redirect(githubAuthUrl, 302);
}
__name(handleGitHubAuth, "handleGitHubAuth");
async function handleGitHubCallback(request, corsHeaders) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code) {
    return new Response(
      JSON.stringify({ error: "\u7F3A\u5C11\u6388\u6743\u7801 (code)" }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
  try {
    const tokenParams = new URLSearchParams();
    tokenParams.set("client_id", GITHUB_APP_ID);
    tokenParams.set("client_secret", GITHUB_APP_SECRET);
    tokenParams.set("code", code);
    tokenParams.set("redirect_uri", GITHUB_REDIRECT_URI);
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
    const accessToken = tokenData.access_token;
    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: "\u83B7\u53D6 Access Token \u5931\u8D25", raw: tokenData, raw_text: tokenText.substring(0, 200) }),
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
      id: userInfo.id.toString(),
      nickname: userInfo.login,
      avatar: userInfo.avatar_url,
      bio: userInfo.bio || "",
      github_url: userInfo.html_url
    };
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
async function handleUpload(request, corsHeaders) {
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
    const mods = [];
    const tags = [];
    formData.forEach((value, key) => {
      if (key === "mods[]") mods.push(value);
      if (key === "tags[]") tags.push(value);
    });
    const uploadId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    const fileBuffer = await file.arrayBuffer();
    const r2Key = `uploads/${uploadId}/${file.name}`;
    if (typeof BLUEPRINT_R2 !== "undefined") {
      await BLUEPRINT_R2.put(r2Key, fileBuffer, {
        httpMetadata: {
          contentType: file.type || "application/octet-stream"
        }
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
      is_approved: false,
      upload_time: (/* @__PURE__ */ new Date()).toISOString(),
      file_key: r2Key,
      file_name: file.name
    };
    if (typeof BLUEPRINT_KV !== "undefined") {
      await BLUEPRINT_KV.put(`pending:${uploadId}`, JSON.stringify(blueprintMeta));
      await BLUEPRINT_KV.put("pending:list", JSON.stringify(await getPendingList()));
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
async function handleGetPending(request, corsHeaders) {
  const password = request.headers.get("Authorization");
  if (password !== `Bearer ${ADMIN_PASSWORD}`) {
    return new Response(
      JSON.stringify({ error: "\u672A\u6388\u6743" }),
      { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
  try {
    const pendingList = await getPendingList();
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
async function handleApprove(request, corsHeaders) {
  const password = request.headers.get("Authorization");
  if (password !== `Bearer ${ADMIN_PASSWORD}`) {
    return new Response(
      JSON.stringify({ error: "\u672A\u6388\u6743" }),
      { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
  try {
    const { uploadId } = await request.json();
    if (!uploadId) {
      return new Response(
        JSON.stringify({ error: "\u7F3A\u5C11 uploadId" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    const metaStr = await BLUEPRINT_KV.get(`pending:${uploadId}`);
    if (!metaStr) {
      return new Response(
        JSON.stringify({ error: "\u84DD\u56FE\u4E0D\u5B58\u5728" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    const meta = JSON.parse(metaStr);
    meta.is_approved = true;
    await BLUEPRINT_KV.put(`blueprint:${uploadId}`, JSON.stringify(meta));
    await BLUEPRINT_KV.delete(`pending:${uploadId}`);
    await BLUEPRINT_KV.put("pending:list", JSON.stringify(await getPendingList()));
    return new Response(
      JSON.stringify({ success: true, message: "\u5BA1\u6838\u901A\u8FC7" }),
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
async function handleReject(request, corsHeaders) {
  const password = request.headers.get("Authorization");
  if (password !== `Bearer ${ADMIN_PASSWORD}`) {
    return new Response(
      JSON.stringify({ error: "\u672A\u6388\u6743" }),
      { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
  try {
    const { uploadId } = await request.json();
    if (!uploadId) {
      return new Response(
        JSON.stringify({ error: "\u7F3A\u5C11 uploadId" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    const metaStr = await BLUEPRINT_KV.get(`pending:${uploadId}`);
    if (!metaStr) {
      return new Response(
        JSON.stringify({ error: "\u84DD\u56FE\u4E0D\u5B58\u5728" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    const meta = JSON.parse(metaStr);
    if (typeof BLUEPRINT_R2 !== "undefined") {
      await BLUEPRINT_R2.delete(meta.file_key);
    }
    await BLUEPRINT_KV.delete(`pending:${uploadId}`);
    await BLUEPRINT_KV.put("pending:list", JSON.stringify(await getPendingList()));
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
async function getPendingList() {
  const pendingList = [];
  if (typeof BLUEPRINT_KV !== "undefined") {
    const keys = await BLUEPRINT_KV.list({ prefix: "pending:" });
    for (const key of keys.keys) {
      if (key.name !== "pending:list") {
        const metaStr = await BLUEPRINT_KV.get(key.name);
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
