#!/usr/bin/env node
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/mcp/channel-pusher.ts
var channel_pusher_exports = {};
__export(channel_pusher_exports, {
  fetchChannelMessages: () => fetchChannelMessages,
  getChannelInfo: () => getChannelInfo,
  getPusherStatus: () => getPusherStatus,
  isGatewayRegistered: () => isGatewayRegistered,
  isPusherRunning: () => isPusherRunning,
  registerChannel: () => registerChannel,
  startChannelPusher: () => startChannelPusher,
  stopChannelPusher: () => stopChannelPusher,
  triggerPush: () => triggerPush,
  unregisterChannel: () => unregisterChannel
});
module.exports = __toCommonJS(channel_pusher_exports);

// src/mcp/message-queue.ts
var messageQueues = /* @__PURE__ */ new Map();
function fetchAllUnreadTasks() {
  const allTasks = [];
  messageQueues.forEach((queue, botName) => {
    const unreadTasks = queue.filter((task) => !task.read);
    unreadTasks.forEach((task) => {
      task.read = true;
    });
    allTasks.push(...unreadTasks);
  });
  return allTasks;
}
function clearReadMessages(botName) {
  let cleared = 0;
  if (botName) {
    const queue = messageQueues.get(botName);
    if (queue) {
      const before = queue.length;
      const remaining = queue.filter((task) => !task.read);
      messageQueues.set(botName, remaining);
      cleared = before - remaining.length;
    }
  } else {
    messageQueues.forEach((queue, name) => {
      const before = queue.length;
      const remaining = queue.filter((task) => !task.read);
      messageQueues.set(name, remaining);
      cleared += before - remaining.length;
    });
  }
  return cleared;
}

// src/mcp/channel-pusher.ts
var GATEWAY_API_URL = process.env.QQBOT_GATEWAY_URL || "http://127.0.0.1:3310";
var DEFAULT_CONFIG = {
  interval: 1e3,
  mergeMessages: true,
  maxMergeCount: 5,
  registerToGateway: true
};
var pusherInterval = null;
var isRunning = false;
var mcpServer = null;
var config = DEFAULT_CONFIG;
var sessionId = null;
var projectPath = null;
var projectName = null;
var isRegisteredWithGateway = false;
function toChannelMessage(task) {
  const isGroup = task.sourceType === "group" || task.sourceType === "channel";
  const type = isGroup ? "group" : "user";
  let chatId = task.sourceId;
  if (!chatId.match(/^[GUC]_/)) {
    if (task.sourceType === "group") {
      chatId = `G_${chatId}`;
    } else if (task.sourceType === "c2c") {
      chatId = `U_${chatId}`;
    } else if (task.sourceType === "channel") {
      chatId = `C_${chatId}`;
    }
  }
  return {
    content: task.content,
    meta: {
      chat_id: chatId,
      sender: task.authorId || "Unknown",
      type,
      message_id: task.id,
      timestamp: task.timestamp
    }
  };
}
async function sendChannelNotification(server, params) {
  try {
    await server.notification({
      method: "notifications/claude/channel",
      params: {
        content: params.content,
        meta: params.meta
      }
    });
    console.error(`[channel-pusher] Sent to ${params.meta.chat_id} from ${params.meta.sender}`);
  } catch (error) {
    console.error("[channel-pusher] Failed to send notification:", error);
    throw error;
  }
}
async function sendBatchNotifications(server, tasks) {
  if (tasks.length === 0) return 0;
  if (config.mergeMessages && tasks.length > 1) {
    const grouped = groupMessagesByChat(tasks);
    for (const [chatId, msgs] of grouped.entries()) {
      if (msgs.length === 1) {
        await sendChannelNotification(server, toChannelMessage(msgs[0]));
      } else {
        const merged = mergeMessages(msgs);
        await sendChannelNotification(server, merged);
      }
    }
    return tasks.length;
  }
  for (const task of tasks) {
    await sendChannelNotification(server, toChannelMessage(task));
  }
  return tasks.length;
}
function groupMessagesByChat(tasks) {
  const grouped = /* @__PURE__ */ new Map();
  for (const task of tasks) {
    const chatId = task.sourceId;
    if (!grouped.has(chatId)) {
      grouped.set(chatId, []);
    }
    grouped.get(chatId).push(task);
  }
  return grouped;
}
function mergeMessages(tasks) {
  if (tasks.length === 0) {
    throw new Error("Cannot merge empty messages");
  }
  const first = tasks[0];
  const isGroup = first.sourceType === "group" || first.sourceType === "channel";
  const mergedContent = tasks.map((task) => {
    const sender = task.authorId || "User";
    if (tasks.length > 1 && tasks.some((t) => t.authorId !== first.authorId)) {
      return `[${sender}] ${task.content}`;
    }
    return task.content;
  }).join("\n---\n");
  let chatId = first.sourceId;
  if (!chatId.match(/^[GUC]_/)) {
    if (first.sourceType === "group") {
      chatId = `G_${chatId}`;
    } else if (first.sourceType === "c2c") {
      chatId = `U_${chatId}`;
    } else if (first.sourceType === "channel") {
      chatId = `C_${chatId}`;
    }
  }
  return {
    content: `\u{1F4EC} \u6536\u5230 ${tasks.length} \u6761\u6D88\u606F:

${mergedContent}`,
    meta: {
      chat_id: chatId,
      sender: first.authorId || "Multiple",
      type: isGroup ? "group" : "user",
      timestamp: Date.now()
    }
  };
}
async function checkAndPush() {
  if (!mcpServer || !isRunning) return;
  try {
    let totalSent = 0;
    const localTasks = fetchAllUnreadTasks();
    if (localTasks.length > 0) {
      console.error(`[channel-pusher] Processing ${localTasks.length} local messages`);
      const sentCount = await sendBatchNotifications(mcpServer, localTasks);
      if (sentCount > 0) {
        clearReadMessages();
        totalSent += sentCount;
      }
    }
    if (config.registerToGateway && isRegisteredWithGateway) {
      const gatewayMessages = await fetchChannelMessages(10);
      if (gatewayMessages.length > 0) {
        console.error(`[channel-pusher] Processing ${gatewayMessages.length} Gateway messages`);
        for (const msg of gatewayMessages) {
          await sendChannelNotification(mcpServer, msg);
          totalSent++;
        }
      }
    }
    if (totalSent > 0) {
      console.error(`[channel-pusher] Total sent: ${totalSent} messages`);
    }
  } catch (error) {
    console.error("[channel-pusher] Error in checkAndPush:", error);
  }
}
function startChannelPusher(server, customConfig) {
  if (isRunning) {
    console.warn("[channel-pusher] Already running");
    return;
  }
  if (customConfig) {
    config = { ...DEFAULT_CONFIG, ...customConfig };
  }
  mcpServer = server;
  isRunning = true;
  pusherInterval = setInterval(checkAndPush, config.interval);
  console.error(`[channel-pusher] Started (interval: ${config.interval}ms)`);
  if (config.registerToGateway && sessionId) {
    registerChannel(sessionId, projectPath ?? process.cwd(), projectName ?? void 0).then((success) => {
      if (success) {
        console.error("[channel-pusher] \u2705 Registered to Gateway successfully");
      } else {
        console.error("[channel-pusher] \u26A0\uFE0F Failed to register to Gateway");
      }
    }).catch((err) => {
      console.error(`[channel-pusher] \u274C Gateway registration error: ${err}`);
    });
  }
}
async function stopChannelPusher() {
  if (!isRunning) {
    return;
  }
  if (isRegisteredWithGateway) {
    await unregisterChannel();
  }
  if (pusherInterval) {
    clearInterval(pusherInterval);
    pusherInterval = null;
  }
  isRunning = false;
  mcpServer = null;
  console.error("[channel-pusher] Stopped");
}
function isPusherRunning() {
  return isRunning;
}
function getPusherStatus() {
  return {
    running: isRunning,
    interval: config.interval,
    mergeEnabled: config.mergeMessages
  };
}
async function triggerPush() {
  if (!mcpServer) {
    throw new Error("Pusher not initialized");
  }
  const tasks = fetchAllUnreadTasks();
  if (tasks.length === 0) return 0;
  return sendBatchNotifications(mcpServer, tasks);
}
async function registerChannel(sid, pPath, pName) {
  sessionId = sid;
  projectPath = pPath;
  projectName = pName || pPath.split("/").pop() || "unknown";
  if (!config.registerToGateway) {
    console.error("[channel-pusher] Gateway registration disabled by config");
    return false;
  }
  try {
    const response = await fetch(`${GATEWAY_API_URL}/api/channels/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        projectPath,
        projectName
      })
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const result = await response.json();
    if (result.status === "registered") {
      isRegisteredWithGateway = true;
      console.error(`[channel-pusher] \u2705 Channel \u5DF2\u6CE8\u518C\u5230 Gateway: ${sessionId}`);
      console.error(`[channel-pusher]    \u9879\u76EE: ${projectName}`);
      console.error(`[channel-pusher]    \u9ED8\u8BA4: ${result.isDefault ? "\u662F" : "\u5426"}`);
      console.error("");
      console.error("[channel-pusher] \u26A0\uFE0F Channel \u6A21\u5F0F\u5DF2\u6FC0\u6D3B\uFF0CQQ \u6D88\u606F\u5C06\u63A8\u9001\u5230\u5F53\u524D\u4F1A\u8BDD");
      console.error("[channel-pusher] \u5982\u6709\u591A\u4EBA\u4F1A\u8BDD\u8BF7\u6CE8\u610F\u6D88\u606F\u7BA1\u7406\uFF0C\u6216\u4F7F\u7528 unidirectional \u6A21\u5F0F");
      return true;
    }
    console.error(`[channel-pusher] \u274C \u6CE8\u518C\u5931\u8D25: ${result.error}`);
    return false;
  } catch (error) {
    console.error(`[channel-pusher] \u274C \u6CE8\u518C\u8BF7\u6C42\u5931\u8D25: ${error}`);
    return false;
  }
}
async function unregisterChannel() {
  if (!isRegisteredWithGateway || !sessionId) {
    return true;
  }
  try {
    const response = await fetch(
      `${GATEWAY_API_URL}/api/channels/${encodeURIComponent(sessionId)}`,
      { method: "DELETE" }
    );
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const result = await response.json();
    if (result.status === "unregistered") {
      console.error(`[channel-pusher] \u2705 Channel \u5DF2\u4ECE Gateway \u6CE8\u9500: ${sessionId}`);
      isRegisteredWithGateway = false;
      sessionId = null;
      projectPath = null;
      projectName = null;
      return true;
    }
    console.error(`[channel-pusher] \u274C \u6CE8\u9500\u5931\u8D25: ${result.error}`);
    return false;
  } catch (error) {
    console.error(`[channel-pusher] \u274C \u6CE8\u9500\u8BF7\u6C42\u5931\u8D25: ${error}`);
    return false;
  }
}
async function fetchChannelMessages(limit = 10) {
  if (!isRegisteredWithGateway || !sessionId) {
    return [];
  }
  try {
    const url = `${GATEWAY_API_URL}/api/messages?channel=${encodeURIComponent(sessionId)}&limit=${limit}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const result = await response.json();
    if (result.messages && result.messages.length > 0) {
      const messageIds = result.messages.map((m) => m.id);
      await markMessagesDelivered(messageIds);
      return result.messages.map((msg) => ({
        content: msg.content,
        meta: {
          chat_id: msg.sourceId,
          sender: msg.authorNickname || msg.authorId,
          type: msg.sourceType === "group" ? "group" : "user",
          message_id: msg.msgId,
          timestamp: msg.timestamp
        }
      }));
    }
    return [];
  } catch (error) {
    console.error(`[channel-pusher] \u274C \u83B7\u53D6\u6D88\u606F\u5931\u8D25: ${error}`);
    return [];
  }
}
async function markMessagesDelivered(messageIds) {
  if (!sessionId || messageIds.length === 0) return;
  try {
    const url = `${GATEWAY_API_URL}/api/messages?channel=${encodeURIComponent(sessionId)}&ids=${messageIds.join(",")}`;
    await fetch(url, { method: "DELETE" });
  } catch (error) {
    console.error(`[channel-pusher] \u26A0\uFE0F \u6807\u8BB0\u6D88\u606F\u5DF2\u8BFB\u5931\u8D25: ${error}`);
  }
}
function isGatewayRegistered() {
  return isRegisteredWithGateway;
}
function getChannelInfo() {
  return {
    sessionId,
    projectPath,
    projectName,
    isRegistered: isRegisteredWithGateway
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  fetchChannelMessages,
  getChannelInfo,
  getPusherStatus,
  isGatewayRegistered,
  isPusherRunning,
  registerChannel,
  startChannelPusher,
  stopChannelPusher,
  triggerPush,
  unregisterChannel
});
