// src/utils/upload-cache.ts
import * as crypto from "node:crypto";
var cache = /* @__PURE__ */ new Map();
var MAX_CACHE_SIZE = 500;
function computeFileHash(data) {
  const content = typeof data === "string" ? data : data;
  return crypto.createHash("md5").update(content).digest("hex");
}
function buildCacheKey(contentHash, scope, targetId, fileType) {
  return `${contentHash}:${scope}:${targetId}:${fileType}`;
}
function getCachedFileInfo(contentHash, scope, targetId, fileType) {
  const key = buildCacheKey(contentHash, scope, targetId, fileType);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  console.log(`[upload-cache] Cache HIT: key=${key.slice(0, 40)}..., fileUuid=${entry.fileUuid}`);
  return entry.fileInfo;
}
function setCachedFileInfo(contentHash, scope, targetId, fileType, fileInfo, fileUuid, ttl) {
  if (cache.size >= MAX_CACHE_SIZE) {
    const now = Date.now();
    for (const [k, v] of cache) {
      if (now >= v.expiresAt) {
        cache.delete(k);
      }
    }
    if (cache.size >= MAX_CACHE_SIZE) {
      const keys = Array.from(cache.keys());
      for (let i = 0; i < keys.length / 2; i++) {
        cache.delete(keys[i]);
      }
    }
  }
  const key = buildCacheKey(contentHash, scope, targetId, fileType);
  const safetyMargin = 60;
  const effectiveTtl = Math.max(ttl - safetyMargin, 10);
  cache.set(key, {
    fileInfo,
    fileUuid,
    expiresAt: Date.now() + effectiveTtl * 1e3
  });
  console.log(`[upload-cache] Cache SET: key=${key.slice(0, 40)}..., ttl=${effectiveTtl}s, uuid=${fileUuid}`);
}

// src/utils/platform.ts
function sanitizeFileName(name) {
  if (!name) return name;
  let result = name.trim();
  if (result.includes("%")) {
    try {
      result = decodeURIComponent(result);
    } catch {
    }
  }
  result = result.normalize("NFC");
  result = result.replace(/[\x00-\x1F\x7F]/g, "");
  return result;
}

// src/api.ts
var API_BASE = "https://api.sgroup.qq.com";
var TOKEN_URL = "https://bots.qq.com/app/getAppAccessToken";
var currentMarkdownSupport = false;
function initApiConfig(options) {
  currentMarkdownSupport = options.markdownSupport === true;
}
function isMarkdownSupport() {
  return currentMarkdownSupport;
}
var tokenCacheMap = /* @__PURE__ */ new Map();
var tokenFetchPromises = /* @__PURE__ */ new Map();
async function getAccessToken(appId, clientSecret) {
  const cachedToken = tokenCacheMap.get(appId);
  if (cachedToken && Date.now() < cachedToken.expiresAt - 5 * 60 * 1e3) {
    return cachedToken.token;
  }
  let fetchPromise = tokenFetchPromises.get(appId);
  if (fetchPromise) {
    console.log(`[qqbot-api:${appId}] Token fetch in progress, waiting for existing request...`);
    return fetchPromise;
  }
  fetchPromise = (async () => {
    try {
      return await doFetchToken(appId, clientSecret);
    } finally {
      tokenFetchPromises.delete(appId);
    }
  })();
  tokenFetchPromises.set(appId, fetchPromise);
  return fetchPromise;
}
async function doFetchToken(appId, clientSecret) {
  const requestBody = { appId, clientSecret };
  const requestHeaders = { "Content-Type": "application/json" };
  console.log(`[qqbot-api:${appId}] >>> POST ${TOKEN_URL}`);
  let response;
  try {
    response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(3e4)
      // 30 秒超时
    });
  } catch (err) {
    console.error(`[qqbot-api:${appId}] <<< Network error:`, err);
    throw new Error(`Network error getting access_token: ${err instanceof Error ? err.message : String(err)}`);
  }
  const responseHeaders = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });
  console.log(`[qqbot-api:${appId}] <<< Status: ${response.status} ${response.statusText}`);
  let data;
  let rawBody;
  try {
    rawBody = await response.text();
    const logBody = rawBody.replace(/"access_token"\s*:\s*"[^"]+"/g, '"access_token": "***"');
    console.log(`[qqbot-api:${appId}] <<< Body:`, logBody);
    data = JSON.parse(rawBody);
  } catch (err) {
    console.error(`[qqbot-api:${appId}] <<< Parse error:`, err);
    throw new Error(`Failed to parse access_token response: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!data.access_token) {
    throw new Error(`Failed to get access_token: ${JSON.stringify(data)}`);
  }
  const expiresAt = Date.now() + (data.expires_in ?? 7200) * 1e3;
  tokenCacheMap.set(appId, {
    token: data.access_token,
    expiresAt,
    appId
  });
  console.log(`[qqbot-api:${appId}] Token cached, expires at: ${new Date(expiresAt).toISOString()}`);
  return data.access_token;
}
function clearTokenCache(appId) {
  if (appId) {
    tokenCacheMap.delete(appId);
    console.log(`[qqbot-api:${appId}] Token cache cleared manually.`);
  } else {
    tokenCacheMap.clear();
    console.log(`[qqbot-api] All token caches cleared.`);
  }
}
function getTokenStatus(appId) {
  if (tokenFetchPromises.has(appId)) {
    return { status: "refreshing", expiresAt: tokenCacheMap.get(appId)?.expiresAt ?? null };
  }
  const cached = tokenCacheMap.get(appId);
  if (!cached) {
    return { status: "none", expiresAt: null };
  }
  const isValid = Date.now() < cached.expiresAt - 5 * 60 * 1e3;
  return { status: isValid ? "valid" : "expired", expiresAt: cached.expiresAt };
}
function getNextMsgSeq(_msgId) {
  const timePart = Date.now() % 1e8;
  const random = Math.floor(Math.random() * 65536);
  return (timePart ^ random) % 65536;
}
var DEFAULT_API_TIMEOUT = 3e4;
var FILE_UPLOAD_TIMEOUT = 12e4;
async function apiRequest(accessToken, method, path, body, timeoutMs) {
  const url = `${API_BASE}${path}`;
  const headers = {
    Authorization: `QQBot ${accessToken}`,
    "Content-Type": "application/json"
  };
  const isFileUpload = path.includes("/files");
  const timeout = timeoutMs ?? (isFileUpload ? FILE_UPLOAD_TIMEOUT : DEFAULT_API_TIMEOUT);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeout);
  const options = {
    method,
    headers,
    signal: controller.signal
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  console.log(`[qqbot-api] >>> ${method} ${url} (timeout: ${timeout}ms)`);
  if (body) {
    const logBody = { ...body };
    if (typeof logBody.file_data === "string") {
      logBody.file_data = `<base64 ${logBody.file_data.length} chars>`;
    }
  }
  let res;
  try {
    res = await fetch(url, options);
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      console.error(`[qqbot-api] <<< Request timeout after ${timeout}ms`);
      throw new Error(`Request timeout[${path}]: exceeded ${timeout}ms`);
    }
    console.error(`[qqbot-api] <<< Network error:`, err);
    throw new Error(`Network error [${path}]: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    clearTimeout(timeoutId);
  }
  const responseHeaders = {};
  res.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });
  console.log(`[qqbot-api] <<< Status: ${res.status} ${res.statusText}`);
  let data;
  let rawBody;
  try {
    rawBody = await res.text();
    data = JSON.parse(rawBody);
  } catch (err) {
    throw new Error(`Failed to parse response[${path}]: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!res.ok) {
    const error = data;
    throw new Error(`API Error [${path}]: ${error.message ?? JSON.stringify(data)}`);
  }
  return data;
}
var UPLOAD_MAX_RETRIES = 2;
var UPLOAD_BASE_DELAY_MS = 1e3;
async function apiRequestWithRetry(accessToken, method, path, body, maxRetries = UPLOAD_MAX_RETRIES) {
  let lastError = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await apiRequest(accessToken, method, path, body);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const errMsg = lastError.message;
      if (errMsg.includes("400") || errMsg.includes("401") || errMsg.includes("Invalid") || errMsg.includes("\u4E0A\u4F20\u8D85\u65F6") || errMsg.includes("timeout") || errMsg.includes("Timeout")) {
        throw lastError;
      }
      if (attempt < maxRetries) {
        const delay = UPLOAD_BASE_DELAY_MS * Math.pow(2, attempt);
        console.log(`[qqbot-api] Upload attempt ${attempt + 1} failed, retrying in ${delay}ms: ${errMsg.slice(0, 100)}`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}
async function getGatewayUrl(accessToken) {
  const data = await apiRequest(accessToken, "GET", "/gateway");
  return data.url;
}
function buildMessageBody(content, msgId, msgSeq) {
  const body = currentMarkdownSupport ? {
    markdown: { content },
    msg_type: 2,
    msg_seq: msgSeq
  } : {
    content,
    msg_type: 0,
    msg_seq: msgSeq
  };
  if (msgId) {
    body.msg_id = msgId;
  }
  return body;
}
async function sendC2CMessage(accessToken, openid, content, msgId) {
  const msgSeq = msgId ? getNextMsgSeq(msgId) : 1;
  const body = buildMessageBody(content, msgId, msgSeq);
  return apiRequest(accessToken, "POST", `/v2/users/${openid}/messages`, body);
}
async function sendC2CInputNotify(accessToken, openid, msgId, inputSecond = 60) {
  const msgSeq = msgId ? getNextMsgSeq(msgId) : 1;
  const body = {
    msg_type: 6,
    input_notify: {
      input_type: 1,
      input_second: inputSecond
    },
    msg_seq: msgSeq,
    ...msgId ? { msg_id: msgId } : {}
  };
  await apiRequest(accessToken, "POST", `/v2/users/${openid}/messages`, body);
}
async function sendChannelMessage(accessToken, channelId, content, msgId) {
  return apiRequest(accessToken, "POST", `/channels/${channelId}/messages`, {
    content,
    ...msgId ? { msg_id: msgId } : {}
  });
}
async function sendGroupMessage(accessToken, groupOpenid, content, msgId) {
  const msgSeq = msgId ? getNextMsgSeq(msgId) : 1;
  const body = buildMessageBody(content, msgId, msgSeq);
  return apiRequest(accessToken, "POST", `/v2/groups/${groupOpenid}/messages`, body);
}
function buildProactiveMessageBody(content) {
  if (!content || content.trim().length === 0) {
    throw new Error("\u4E3B\u52A8\u6D88\u606F\u5185\u5BB9\u4E0D\u80FD\u4E3A\u7A7A (markdown.content is empty)");
  }
  if (currentMarkdownSupport) {
    return { markdown: { content }, msg_type: 2 };
  } else {
    return { content, msg_type: 0 };
  }
}
async function sendProactiveC2CMessage(accessToken, openid, content) {
  const body = buildProactiveMessageBody(content);
  return apiRequest(accessToken, "POST", `/v2/users/${openid}/messages`, body);
}
async function sendProactiveGroupMessage(accessToken, groupOpenid, content) {
  const body = buildProactiveMessageBody(content);
  return apiRequest(accessToken, "POST", `/v2/groups/${groupOpenid}/messages`, body);
}
var MediaFileType = /* @__PURE__ */ ((MediaFileType2) => {
  MediaFileType2[MediaFileType2["IMAGE"] = 1] = "IMAGE";
  MediaFileType2[MediaFileType2["VIDEO"] = 2] = "VIDEO";
  MediaFileType2[MediaFileType2["VOICE"] = 3] = "VOICE";
  MediaFileType2[MediaFileType2["FILE"] = 4] = "FILE";
  return MediaFileType2;
})(MediaFileType || {});
async function uploadC2CMedia(accessToken, openid, fileType, url, fileData, srvSendMsg = false, fileName) {
  if (!url && !fileData) throw new Error("uploadC2CMedia: url or fileData is required");
  if (fileData) {
    const contentHash = computeFileHash(fileData);
    const cachedInfo = getCachedFileInfo(contentHash, "c2c", openid, fileType);
    if (cachedInfo) {
      return { file_uuid: "", file_info: cachedInfo, ttl: 0 };
    }
  }
  const body = { file_type: fileType, srv_send_msg: srvSendMsg };
  if (url) body.url = url;
  else if (fileData) body.file_data = fileData;
  if (fileType === 4 /* FILE */ && fileName) body.file_name = sanitizeFileName(fileName);
  const result = await apiRequestWithRetry(
    accessToken,
    "POST",
    `/v2/users/${openid}/files`,
    body
  );
  if (fileData && result.file_info && result.ttl > 0) {
    const contentHash = computeFileHash(fileData);
    setCachedFileInfo(contentHash, "c2c", openid, fileType, result.file_info, result.file_uuid, result.ttl);
  }
  return result;
}
async function uploadGroupMedia(accessToken, groupOpenid, fileType, url, fileData, srvSendMsg = false, fileName) {
  if (!url && !fileData) throw new Error("uploadGroupMedia: url or fileData is required");
  if (fileData) {
    const contentHash = computeFileHash(fileData);
    const cachedInfo = getCachedFileInfo(contentHash, "group", groupOpenid, fileType);
    if (cachedInfo) {
      return { file_uuid: "", file_info: cachedInfo, ttl: 0 };
    }
  }
  const body = { file_type: fileType, srv_send_msg: srvSendMsg };
  if (url) body.url = url;
  else if (fileData) body.file_data = fileData;
  if (fileType === 4 /* FILE */ && fileName) body.file_name = sanitizeFileName(fileName);
  const result = await apiRequestWithRetry(
    accessToken,
    "POST",
    `/v2/groups/${groupOpenid}/files`,
    body
  );
  if (fileData && result.file_info && result.ttl > 0) {
    const contentHash = computeFileHash(fileData);
    setCachedFileInfo(contentHash, "group", groupOpenid, fileType, result.file_info, result.file_uuid, result.ttl);
  }
  return result;
}
async function sendC2CMediaMessage(accessToken, openid, fileInfo, msgId, content) {
  const msgSeq = msgId ? getNextMsgSeq(msgId) : 1;
  return apiRequest(accessToken, "POST", `/v2/users/${openid}/messages`, {
    msg_type: 7,
    media: { file_info: fileInfo },
    msg_seq: msgSeq,
    ...content ? { content } : {},
    ...msgId ? { msg_id: msgId } : {}
  });
}
async function sendGroupMediaMessage(accessToken, groupOpenid, fileInfo, msgId, content) {
  const msgSeq = msgId ? getNextMsgSeq(msgId) : 1;
  return apiRequest(accessToken, "POST", `/v2/groups/${groupOpenid}/messages`, {
    msg_type: 7,
    media: { file_info: fileInfo },
    msg_seq: msgSeq,
    ...content ? { content } : {},
    ...msgId ? { msg_id: msgId } : {}
  });
}
async function sendC2CImageMessage(accessToken, openid, imageUrl, msgId, content) {
  let uploadResult;
  if (imageUrl.startsWith("data:")) {
    const matches = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) throw new Error("Invalid Base64 Data URL format");
    uploadResult = await uploadC2CMedia(accessToken, openid, 1 /* IMAGE */, void 0, matches[2], false);
  } else {
    uploadResult = await uploadC2CMedia(accessToken, openid, 1 /* IMAGE */, imageUrl, void 0, false);
  }
  return sendC2CMediaMessage(accessToken, openid, uploadResult.file_info, msgId, content);
}
async function sendGroupImageMessage(accessToken, groupOpenid, imageUrl, msgId, content) {
  let uploadResult;
  if (imageUrl.startsWith("data:")) {
    const matches = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) throw new Error("Invalid Base64 Data URL format");
    uploadResult = await uploadGroupMedia(accessToken, groupOpenid, 1 /* IMAGE */, void 0, matches[2], false);
  } else {
    uploadResult = await uploadGroupMedia(accessToken, groupOpenid, 1 /* IMAGE */, imageUrl, void 0, false);
  }
  return sendGroupMediaMessage(accessToken, groupOpenid, uploadResult.file_info, msgId, content);
}
async function sendC2CVoiceMessage(accessToken, openid, voiceBase64, msgId) {
  const uploadResult = await uploadC2CMedia(accessToken, openid, 3 /* VOICE */, void 0, voiceBase64, false);
  return sendC2CMediaMessage(accessToken, openid, uploadResult.file_info, msgId);
}
async function sendGroupVoiceMessage(accessToken, groupOpenid, voiceBase64, msgId) {
  const uploadResult = await uploadGroupMedia(accessToken, groupOpenid, 3 /* VOICE */, void 0, voiceBase64, false);
  return sendGroupMediaMessage(accessToken, groupOpenid, uploadResult.file_info, msgId);
}
async function sendC2CFileMessage(accessToken, openid, fileBase64, fileUrl, msgId, fileName) {
  const uploadResult = await uploadC2CMedia(accessToken, openid, 4 /* FILE */, fileUrl, fileBase64, false, fileName);
  return sendC2CMediaMessage(accessToken, openid, uploadResult.file_info, msgId);
}
async function sendGroupFileMessage(accessToken, groupOpenid, fileBase64, fileUrl, msgId, fileName) {
  const uploadResult = await uploadGroupMedia(accessToken, groupOpenid, 4 /* FILE */, fileUrl, fileBase64, false, fileName);
  return sendGroupMediaMessage(accessToken, groupOpenid, uploadResult.file_info, msgId);
}
async function sendC2CVideoMessage(accessToken, openid, videoUrl, videoBase64, msgId, content) {
  const uploadResult = await uploadC2CMedia(accessToken, openid, 2 /* VIDEO */, videoUrl, videoBase64, false);
  return sendC2CMediaMessage(accessToken, openid, uploadResult.file_info, msgId, content);
}
async function sendGroupVideoMessage(accessToken, groupOpenid, videoUrl, videoBase64, msgId, content) {
  const uploadResult = await uploadGroupMedia(accessToken, groupOpenid, 2 /* VIDEO */, videoUrl, videoBase64, false);
  return sendGroupMediaMessage(accessToken, groupOpenid, uploadResult.file_info, msgId, content);
}
var backgroundRefreshControllers = /* @__PURE__ */ new Map();
function startBackgroundTokenRefresh(appId, clientSecret, options) {
  if (backgroundRefreshControllers.has(appId)) {
    console.log(`[qqbot-api:${appId}] Background token refresh already running`);
    return;
  }
  const {
    refreshAheadMs = 5 * 60 * 1e3,
    randomOffsetMs = 30 * 1e3,
    minRefreshIntervalMs = 60 * 1e3,
    retryDelayMs = 5 * 1e3,
    log
  } = options ?? {};
  const controller = new AbortController();
  backgroundRefreshControllers.set(appId, controller);
  const signal = controller.signal;
  const refreshLoop = async () => {
    log?.info?.(`[qqbot-api:${appId}] Background token refresh started`);
    while (!signal.aborted) {
      try {
        await getAccessToken(appId, clientSecret);
        const cached = tokenCacheMap.get(appId);
        if (cached) {
          const expiresIn = cached.expiresAt - Date.now();
          const randomOffset = Math.random() * randomOffsetMs;
          const refreshIn = Math.max(
            expiresIn - refreshAheadMs - randomOffset,
            minRefreshIntervalMs
          );
          log?.debug?.(`[qqbot-api:${appId}] Token valid, next refresh in ${Math.round(refreshIn / 1e3)}s`);
          await sleep(refreshIn, signal);
        } else {
          log?.debug?.(`[qqbot-api:${appId}] No cached token, retrying soon`);
          await sleep(minRefreshIntervalMs, signal);
        }
      } catch (err) {
        if (signal.aborted) break;
        log?.error?.(`[qqbot-api:${appId}] Background token refresh failed: ${err}`);
        await sleep(retryDelayMs, signal);
      }
    }
    backgroundRefreshControllers.delete(appId);
    log?.info?.(`[qqbot-api:${appId}] Background token refresh stopped`);
  };
  refreshLoop().catch((err) => {
    backgroundRefreshControllers.delete(appId);
    log?.error?.(`[qqbot-api:${appId}] Background token refresh crashed: ${err}`);
  });
}
function stopBackgroundTokenRefresh(appId) {
  if (appId) {
    const controller = backgroundRefreshControllers.get(appId);
    if (controller) {
      controller.abort();
      backgroundRefreshControllers.delete(appId);
    }
  } else {
    for (const controller of backgroundRefreshControllers.values()) {
      controller.abort();
    }
    backgroundRefreshControllers.clear();
  }
}
function isBackgroundTokenRefreshRunning(appId) {
  if (appId) return backgroundRefreshControllers.has(appId);
  return backgroundRefreshControllers.size > 0;
}
async function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    if (signal) {
      if (signal.aborted) {
        clearTimeout(timer);
        reject(new Error("Aborted"));
        return;
      }
      const onAbort = () => {
        clearTimeout(timer);
        reject(new Error("Aborted"));
      };
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}
export {
  MediaFileType,
  apiRequest,
  clearTokenCache,
  getAccessToken,
  getGatewayUrl,
  getNextMsgSeq,
  getTokenStatus,
  initApiConfig,
  isBackgroundTokenRefreshRunning,
  isMarkdownSupport,
  sendC2CFileMessage,
  sendC2CImageMessage,
  sendC2CInputNotify,
  sendC2CMediaMessage,
  sendC2CMessage,
  sendC2CVideoMessage,
  sendC2CVoiceMessage,
  sendChannelMessage,
  sendGroupFileMessage,
  sendGroupImageMessage,
  sendGroupMediaMessage,
  sendGroupMessage,
  sendGroupVideoMessage,
  sendGroupVoiceMessage,
  sendProactiveC2CMessage,
  sendProactiveGroupMessage,
  startBackgroundTokenRefresh,
  stopBackgroundTokenRefresh,
  uploadC2CMedia,
  uploadGroupMedia
};
