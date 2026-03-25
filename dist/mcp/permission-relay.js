#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/mcp/permission-relay.ts
var permission_relay_exports = {};
__export(permission_relay_exports, {
  getAdminOpenids: () => getAdminOpenids,
  getPendingRequestCount: () => getPendingRequestCount,
  getPendingRequests: () => getPendingRequests,
  handlePermissionReply: () => handlePermissionReply,
  handlePermissionRequest: () => handlePermissionRequest,
  initPermissionRelay: () => initPermissionRelay,
  isPermissionReply: () => isPermissionReply,
  setAdminOpenids: () => setAdminOpenids
});
module.exports = __toCommonJS(permission_relay_exports);

// src/mcp/qq-client.ts
var clients = /* @__PURE__ */ new Map();
function getActiveClients() {
  return clients;
}

// src/mcp/config.ts
var fs = __toESM(require("fs"), 1);
var path = __toESM(require("path"), 1);
var os = __toESM(require("os"), 1);
var CONFIG_DIR = path.join(os.homedir(), ".claude", "qqbot-mcp");
var CONFIG_FILE = path.join(CONFIG_DIR, "config.json");
function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}
function readConfig() {
  ensureConfigDir();
  if (!fs.existsSync(CONFIG_FILE)) {
    return {
      version: "1.0.0",
      bots: {},
      lastUpdated: Date.now()
    };
  }
  try {
    const content = fs.readFileSync(CONFIG_FILE, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.error("[qqbot-mcp] Failed to read config:", error);
    return {
      version: "1.0.0",
      bots: {},
      lastUpdated: Date.now()
    };
  }
}
function getAllBots() {
  return readConfig().bots;
}

// src/mcp/permission-relay.ts
var PERMISSION_ID_PATTERN = /^[a-km-z]{5}$/;
var PERMISSION_REPLY_RE = /^\s*(y|yes|n|no)\s+([a-km-z]{5})\s*$/i;
var pendingRequests = /* @__PURE__ */ new Map();
var REQUEST_EXPIRY_MS = 5 * 60 * 1e3;
var adminOpenids = [];
var mcpServer = null;
function initPermissionRelay(server, config) {
  mcpServer = server;
  if (config?.adminOpenids) {
    adminOpenids = config.adminOpenids;
  }
  console.error("[permission-relay] Initialized");
}
function generateRequestId() {
  const chars = "abcdefghijkmnopqrstuvwxyz";
  let id = "";
  for (let i = 0; i < 5; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}
function cleanupExpiredRequests() {
  const now = Date.now();
  for (const [id, request] of pendingRequests.entries()) {
    if (request.expiresAt < now) {
      pendingRequests.delete(id);
      console.error(`[permission-relay] Expired request: ${id}`);
    }
  }
}
async function handlePermissionRequest(params) {
  cleanupExpiredRequests();
  const requestId = params.request_id || generateRequestId();
  if (!PERMISSION_ID_PATTERN.test(requestId)) {
    const newId = generateRequestId();
    console.warn(`[permission-relay] Invalid request_id ${requestId}, generated ${newId}`);
  }
  const request = {
    id: requestId,
    toolName: params.tool_name,
    description: params.description || "",
    inputPreview: params.input_preview || "",
    createdAt: Date.now(),
    expiresAt: Date.now() + REQUEST_EXPIRY_MS
  };
  pendingRequests.set(requestId, request);
  const message = `\u{1F512} \u6743\u9650\u8BF7\u6C42

\u5DE5\u5177: ${params.tool_name}
${params.description ? `\u63CF\u8FF0: ${params.description}` : ""}
${params.input_preview ? `\u8F93\u5165\u9884\u89C8: ${params.input_preview.slice(0, 200)}${params.input_preview.length > 200 ? "..." : ""}` : ""}

\u8BF7\u56DE\u590D "yes ${requestId}" \u6216 "no ${requestId}"`;
  try {
    const clientsMap = getActiveClients();
    if (clientsMap.size === 0) {
      console.error("[permission-relay] No active clients to send permission request");
      return { success: false, request_id: requestId };
    }
    for (const [botName, client] of clientsMap) {
      const bots = getAllBots();
      const botConfig = bots[botName];
      const targetId = botConfig?.defaultTargetId;
      if (targetId && adminOpenids.includes(targetId)) {
        await client.sendMessage(targetId, message);
        request.adminOpenid = targetId;
        console.error(`[permission-relay] Sent to admin ${targetId}`);
        break;
      }
    }
    if (!request.adminOpenid && clientsMap.size > 0) {
      const firstEntry = clientsMap.entries().next().value;
      if (firstEntry) {
        const [botName, client] = firstEntry;
        const bots = getAllBots();
        const botConfig = bots[botName];
        if (botConfig?.defaultTargetId) {
          await client.sendMessage(botConfig.defaultTargetId, message);
          request.adminOpenid = botConfig.defaultTargetId;
          console.error(`[permission-relay] Sent to default target ${botConfig.defaultTargetId}`);
        }
      }
    }
    return { success: true, request_id: requestId };
  } catch (error) {
    console.error("[permission-relay] Failed to send permission request:", error);
    return { success: false, request_id: requestId };
  }
}
async function handlePermissionReply(content, senderOpenid) {
  const match = content.match(PERMISSION_REPLY_RE);
  if (!match) {
    return { handled: false };
  }
  const [, answer, requestId] = match;
  const approved = answer.toLowerCase() === "y" || answer.toLowerCase() === "yes";
  const request = pendingRequests.get(requestId);
  if (!request) {
    console.warn(`[permission-relay] Unknown request ID: ${requestId}`);
    return { handled: false };
  }
  if (request.expiresAt < Date.now()) {
    pendingRequests.delete(requestId);
    console.warn(`[permission-relay] Request ${requestId} already expired`);
    return { handled: false };
  }
  if (mcpServer) {
    try {
      await mcpServer.notification({
        method: "notifications/claude/channel/permission",
        params: {
          request_id: requestId,
          approved,
          responder: senderOpenid
        }
      });
      console.error(`[permission-relay] Sent verdict: ${approved ? "approved" : "denied"} for ${requestId}`);
    } catch (error) {
      console.error("[permission-relay] Failed to send verdict:", error);
    }
  }
  pendingRequests.delete(requestId);
  return { handled: true, request_id: requestId, approved };
}
function isPermissionReply(content) {
  return PERMISSION_REPLY_RE.test(content.trim());
}
function getPendingRequestCount() {
  cleanupExpiredRequests();
  return pendingRequests.size;
}
function getPendingRequests() {
  cleanupExpiredRequests();
  return Array.from(pendingRequests.values());
}
function setAdminOpenids(openids) {
  adminOpenids = openids;
  console.error(`[permission-relay] Admin list updated: ${openids.length} users`);
}
function getAdminOpenids() {
  return [...adminOpenids];
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  getAdminOpenids,
  getPendingRequestCount,
  getPendingRequests,
  handlePermissionReply,
  handlePermissionRequest,
  initPermissionRelay,
  isPermissionReply,
  setAdminOpenids
});
