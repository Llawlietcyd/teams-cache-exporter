function safeName(name) {
  return String(name || "TeamsChat")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function decodeEntities(text) {
  return String(text || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function stripTags(html) {
  let text = String(html || "");
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/p>\s*<p[^>]*>/gi, "\n\n");
  text = text.replace(/<\/div>\s*<div[^>]*>/gi, "\n");
  text = text.replace(/<\/li>\s*<li[^>]*>/gi, "\n");
  text = text.replace(/<li[^>]*>/gi, "- ");
  text = text.replace(/<blockquote[^>]*>/gi, "\n> ");
  text = text.replace(/<\/blockquote>/gi, "\n");
  text = text.replace(/<[^>]+>/g, "");
  text = decodeEntities(text);
  text = text.replace(/\r/g, "");
  text = text.replace(/[ \t]+\n/g, "\n");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}

function xmlText(xml, tag) {
  const match = String(xml || "").match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? match[1].trim() : "";
}

function xmlTextAll(xml, tag) {
  const matches = [];
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "gi");
  let m;
  while ((m = re.exec(String(xml || ""))) !== null) matches.push(m[1].trim());
  return matches;
}

function formatTimestamp(raw) {
  const value = String(raw || "").trim();
  if (!value) return { raw: "", iso: "", local: "", ms: 0 };

  const numeric = /^\d{10,}$/.test(value) ? Number(value) : Number.NaN;
  const ms = Number.isFinite(numeric) ? numeric : Date.parse(value);
  if (!Number.isFinite(ms)) return { raw: value, iso: value, local: value, ms: 0 };

  const date = new Date(ms);
  return {
    raw: value,
    iso: date.toISOString(),
    local: date.toLocaleString("en-US", { hour12: false }),
    ms,
  };
}

function escapeCsv(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function getTitle() {
  const h = document.querySelector('[id^="chat-header-"] h2');
  if (h?.textContent?.trim()) return h.textContent.trim();

  const p = document.querySelector('[id^="chat-topic-person-"]');
  if (p?.textContent?.trim()) return p.textContent.trim();

  return (document.title || "Teams Chat")
    .replace(/^\(\d+\)\s*/, "")
    .replace(/\s*\|\s*Microsoft Teams\s*$/, "")
    .split("|")[0]
    .trim();
}

async function openDb(name) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name);
    req.onerror = () => reject(req.error || new Error(`Failed to open DB: ${name}`));
    req.onsuccess = () => resolve(req.result);
  });
}

async function getAll(store) {
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onerror = () => reject(req.error || new Error(`Failed to read store: ${store.name}`));
    req.onsuccess = () => resolve(req.result || []);
  });
}

function getVisibleMids() {
  return Array.from(document.querySelectorAll("[data-mid]"))
    .map(el => el.getAttribute("data-mid"))
    .filter(Boolean);
}

async function findReplychainDbInfo() {
  if (typeof indexedDB.databases !== "function") {
    throw new Error("This browser doesn't expose indexedDB.databases().");
  }
  const dbs = await indexedDB.databases();
  const dbInfo = dbs.find(d => d.name && d.name.includes("replychain-manager:react-web-client"));
  if (!dbInfo?.name) throw new Error("replychain-manager DB not found.");
  return dbInfo;
}

async function extractConversationIdFromReplychains(db) {
  const mids = getVisibleMids();
  if (!mids.length) throw new Error("No visible messages found in the current Teams chat.");

  const tx = db.transaction("replychains", "readonly");
  const records = await getAll(tx.objectStore("replychains"));
  const midSet = new Set(mids);

  for (const rec of records) {
    if (midSet.has(rec.replyChainId)) return rec.conversationId || null;
  }

  for (const rec of records) {
    for (const key of Object.keys(rec.messageMap || {})) {
      for (const mid of mids) {
        if (key.includes(mid)) return rec.conversationId || null;
      }
    }
  }

  return null;
}

function normalizeMessageEntry(chain, key, value) {
  const raw = value && typeof value === "object" ? value : { value };
  const id = raw.id || raw.messageId || raw.clientmessageid || raw.clientMessageId || raw.mid || key;
  const author = raw.imDisplayName || raw.imdisplayname || raw.displayName || raw.author || raw.fromDisplayNameInToken || raw.from || "";
  const timestamp = raw.originalArrivalTime || raw.originalarrivaltime || raw.composeTime || raw.composetime || raw.createdTime || raw.timestamp || "";
  const html = raw.content || raw.messageContent || raw.contentHtml || raw.html || "";

  return {
    id: String(id || ""),
    replyChainId: String(chain.replyChainId || ""),
    conversationId: String(chain.conversationId || ""),
    author: String(author || ""),
    timestamp: String(timestamp || ""),
    text: String(html || ""),
    raw,
  };
}

function buildMriMap(messages) {
  const map = new Map();

  function remember(key, name) {
    const cleanKey = String(key || "").trim();
    const cleanName = String(name || "").trim();
    if (!cleanKey || !cleanName) return;
    if (!map.has(cleanKey)) map.set(cleanKey, cleanName);
  }

  for (const msg of messages) {
    const raw = msg.raw || {};
    const name =
      msg.author ||
      raw.imDisplayName ||
      raw.fromDisplayNameInToken ||
      [raw.fromGivenNameInToken, raw.fromFamilyNameInToken].filter(Boolean).join(" ").trim();

    remember(raw.creator, name);
    remember(raw.from, name);

    if (raw.creator) {
      const uuid = String(raw.creator).match(/([a-f0-9-]{36})/i)?.[1];
      if (uuid) {
        remember(`8:orgid:${uuid}`, name);
        remember(`gid:${uuid}`, name);
        remember(uuid, name);
      }
    }
  }

  return map;
}

function resolveName(value, mriMap) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (!raw.includes(":")) return raw;
  if (mriMap.has(raw)) return mriMap.get(raw);

  const uuid = raw.match(/([a-f0-9-]{36})/i)?.[1];
  if (uuid) {
    if (mriMap.has(uuid)) return mriMap.get(uuid);
    if (mriMap.has(`8:orgid:${uuid}`)) return mriMap.get(`8:orgid:${uuid}`);
    if (mriMap.has(`gid:${uuid}`)) return mriMap.get(`gid:${uuid}`);
  }

  return raw;
}

function getSystemAuthor(raw, mriMap) {
  const type = raw.messageType || "";
  const content = String(raw.content || "");

  if (
    type === "ThreadActivity/AddMember" ||
    type === "ThreadActivity/DeleteMember" ||
    type === "ThreadActivity/TopicUpdate"
  ) {
    return resolveName(xmlText(content, "initiator"), mriMap);
  }

  if (type === "Event/Call") {
    return xmlTextAll(content, "displayName").filter(Boolean)[0] || "";
  }

  return "";
}

function parseSystemMessage(raw, mriMap) {
  const type = raw.messageType || "";
  const content = String(raw.content || "");

  if (type === "ThreadActivity/AddMember") {
    const initiator = resolveName(xmlText(content, "initiator"), mriMap);
    const targets = xmlTextAll(content, "target").map(v => resolveName(v, mriMap));
    const uniqueTargets = [...new Set(targets.filter(Boolean))];
    return uniqueTargets.length ? `${initiator || "Someone"} added ${uniqueTargets.join(", ")}` : `${initiator || "Someone"} added members`;
  }

  if (type === "ThreadActivity/DeleteMember") {
    const initiator = resolveName(xmlText(content, "initiator"), mriMap);
    const targets = xmlTextAll(content, "target").map(v => resolveName(v, mriMap));
    const uniqueTargets = [...new Set(targets.filter(Boolean))];
    return uniqueTargets.length ? `${initiator || "Someone"} removed ${uniqueTargets.join(", ")}` : `${initiator || "Someone"} removed members`;
  }

  if (type === "ThreadActivity/TopicUpdate") {
    const initiator = resolveName(xmlText(content, "initiator"), mriMap);
    const value = xmlText(content, "value");
    return value ? `${initiator || "Someone"} changed the topic to "${value}"` : `${initiator || "Someone"} updated the topic`;
  }

  if (type === "ThreadActivity/PinnedItemsUpdate") return "Pinned items updated";

  if (type === "Event/Call") {
    const names = xmlTextAll(content, "displayName").filter(Boolean);
    const ended = /<ended\b/i.test(content);
    const started = /callStarted/i.test(content);
    if (names.length) {
      if (ended) return `Call with ${names.join(", ")} ended`;
      if (started) return `${names[0]} started a call`;
      return `Call with ${names.join(", ")}`;
    }
    return ended ? "Call ended" : "Call started";
  }

  return stripTags(content.replace(/<[^>]+>/g, " "));
}

function extractReplyPreview(html) {
  const match = String(html || "").match(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/i);
  return match ? stripTags(match[1]) : "";
}

function cleanMessage(msg, mriMap) {
  const raw = msg.raw || {};
  const type = raw.messageType || raw.contentType || "";
  const ts = formatTimestamp(msg.timestamp || raw.originalArrivalTime || raw.composeTime);
  const isSystem = /^ThreadActivity\//.test(type) || type === "Event/Call";
  const html = raw.content || msg.text || "";

  const defaultAuthor =
    msg.author ||
    raw.imDisplayName ||
    raw.fromDisplayNameInToken ||
    resolveName(raw.creator, mriMap) ||
    "";

  const author = isSystem
    ? getSystemAuthor(raw, mriMap) || (/@thread\./i.test(defaultAuthor) ? "" : defaultAuthor)
    : defaultAuthor;

  return {
    id: msg.id || raw.id || "",
    sequence_id: raw.sequenceId ?? "",
    message_type: type,
    content_type: raw.contentType || "",
    system: isSystem,
    author,
    timestamp_raw: ts.raw,
    timestamp_iso: ts.iso,
    timestamp_local: ts.local,
    reply_chain_id: msg.replyChainId || raw.parentMessageId || "",
    reply_preview: extractReplyPreview(html),
    text: isSystem ? parseSystemMessage(raw, mriMap) : stripTags(html),
  };
}

function buildSummary(cleanedMessages) {
  const participants = [...new Set(cleanedMessages.map(msg => msg.author).filter(Boolean))].sort();
  const messageTypeCounts = {};
  let firstMessageIso = "";
  let lastMessageIso = "";

  for (const msg of cleanedMessages) {
    messageTypeCounts[msg.message_type] = (messageTypeCounts[msg.message_type] || 0) + 1;
    if (!firstMessageIso && msg.timestamp_iso) firstMessageIso = msg.timestamp_iso;
    if (msg.timestamp_iso) lastMessageIso = msg.timestamp_iso;
  }

  return {
    participant_count: participants.length,
    participants,
    system_message_count: cleanedMessages.filter(msg => msg.system).length,
    user_message_count: cleanedMessages.filter(msg => !msg.system).length,
    first_message_iso: firstMessageIso,
    last_message_iso: lastMessageIso,
    message_type_counts: messageTypeCounts,
  };
}

function buildCsv(cleanedMessages) {
  const header = [
    "id",
    "sequence_id",
    "message_type",
    "content_type",
    "system",
    "author",
    "timestamp_raw",
    "timestamp_iso",
    "timestamp_local",
    "reply_chain_id",
    "reply_preview",
    "text",
  ];

  return [
    header.join(","),
    ...cleanedMessages.map(row => header.map(key => escapeCsv(row[key])).join(",")),
  ].join("\n");
}

function buildTranscriptMarkdown(meta, cleanedMessages) {
  const lines = [];
  lines.push(`# ${meta.title || "Teams Chat Transcript"}`);
  lines.push("");
  lines.push(`- Conversation ID: \`${meta.conversation_id || ""}\``);
  lines.push(`- Total Messages: ${meta.cleaned_count || cleanedMessages.length}`);
  lines.push(`- Participants: ${meta.summary.participants.join(", ") || "Unknown"}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  for (const msg of cleanedMessages) {
    const who = msg.author || "Unknown";
    const when = msg.timestamp_local || msg.timestamp_iso || msg.timestamp_raw || "";
    const prefix = msg.system ? "[system] " : "";

    lines.push(`## ${prefix}${who} (${when})`);
    lines.push("");

    if (msg.reply_preview) {
      lines.push("> Reply preview:");
      for (const line of String(msg.reply_preview).split("\n")) {
        lines.push(`> ${line}`);
      }
      lines.push("");
    }

    lines.push(msg.text || "");
    lines.push("");
  }

  return `${lines.join("\n").trim()}\n`;
}

async function exportCurrentChat(includeRaw) {
  const dbInfo = await findReplychainDbInfo();
  const db = await openDb(dbInfo.name);

  try {
    const conversationId = await extractConversationIdFromReplychains(db);
    if (!conversationId) throw new Error("Current Teams chat could not be identified from cache.");

    const tx = db.transaction("replychains", "readonly");
    const allReplychains = await getAll(tx.objectStore("replychains"));
    const chains = allReplychains.filter(rec => rec.conversationId === conversationId);

    const normalized = [];
    for (const chain of chains) {
      for (const [key, value] of Object.entries(chain.messageMap || {})) {
        normalized.push(normalizeMessageEntry(chain, key, value));
      }
    }

    const deduped = [];
    const seen = new Set();
    for (const msg of normalized) {
      const dedupeKey = `${msg.id}::${msg.timestamp}::${msg.text}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      deduped.push(msg);
    }

    const mriMap = buildMriMap(deduped);
    const cleanedMessages = deduped.map(msg => cleanMessage(msg, mriMap)).sort((a, b) => {
      const ta = Date.parse(a.timestamp_iso || "") || 0;
      const tb = Date.parse(b.timestamp_iso || "") || 0;
      if (ta !== tb) return ta - tb;
      return String(a.id).localeCompare(String(b.id));
    });

    const summary = buildSummary(cleanedMessages);
    const title = getTitle();
    const dateStr = new Date().toISOString().slice(0, 10);
    const base = safeName(title);

    const cleanedPayload = {
      exported_at: new Date().toISOString(),
      source: "indexeddb-replychains",
      title,
      url: location.href,
      conversation_id: conversationId,
      original_count: deduped.length,
      cleaned_count: cleanedMessages.length,
      summary,
      messages: cleanedMessages,
    };

    const files = [
      {
        filename: `${base}_${dateStr}.cleaned.json`,
        mimeType: "application/json;charset=utf-8",
        text: JSON.stringify(cleanedPayload, null, 2),
      },
      {
        filename: `${base}_${dateStr}.cleaned.csv`,
        mimeType: "text/csv;charset=utf-8",
        text: `${buildCsv(cleanedMessages)}\n`,
      },
      {
        filename: `${base}_${dateStr}.transcript.md`,
        mimeType: "text/markdown;charset=utf-8",
        text: buildTranscriptMarkdown(cleanedPayload, cleanedMessages),
      },
    ];

    if (includeRaw) {
      const rawPayload = {
        exportedAt: new Date().toISOString(),
        source: "indexeddb-replychains",
        dbName: dbInfo.name,
        title,
        url: location.href,
        conversationId,
        replychainCount: chains.length,
        count: deduped.length,
        participantCount: summary.participant_count,
        participants: summary.participants,
        messageTypeCounts: summary.message_type_counts,
        messages: deduped,
        rawReplychains: chains,
      };

      files.push({
        filename: `${base}_${dateStr}.raw.json`,
        mimeType: "application/json;charset=utf-8",
        text: JSON.stringify(rawPayload, null, 2),
      });
    }

    const downloadResult = await chrome.runtime.sendMessage({
      type: "DOWNLOAD_FILES",
      files,
    });

    if (!downloadResult?.ok) {
      throw new Error(downloadResult?.error || "Download step failed.");
    }

    return {
      ok: true,
      title,
      conversationId,
      count: cleanedMessages.length,
      participantCount: summary.participant_count,
      files: files.map(file => file.filename),
    };
  } finally {
    db.close();
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "PING_EXPORTER") {
    sendResponse({ ok: true });
    return;
  }

  if (!message || message.type !== "EXPORT_CURRENT_CHAT") return;

  (async () => {
    try {
      const result = await exportCurrentChat(Boolean(message.includeRaw));
      sendResponse(result);
    } catch (error) {
      sendResponse({ ok: false, error: error?.message || String(error) });
    }
  })();

  return true;
});
