const fs = require("fs");
const path = require("path");

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

function parseArgs(argv) {
  const args = {
    input: "",
    outdir: "",
    basename: "",
    dropSystem: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--help" || token === "-h") args.help = true;
    else if (token === "--input" || token === "-i") args.input = argv[++i] || "";
    else if (token === "--outdir" || token === "-o") args.outdir = argv[++i] || "";
    else if (token === "--basename" || token === "-b") args.basename = argv[++i] || "";
    else if (token === "--drop-system") args.dropSystem = true;
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  node ./scripts/node/clean-export.js --input <raw-export.json> [--outdir <dir>] [--basename <name>] [--drop-system]

Examples:
  node ./scripts/node/clean-export.js --input "..\\Stepsafe Tech team_idb_2026-04-15.json"
  node ./scripts/node/clean-export.js --input "..\\Stepsafe Tech team_idb_2026-04-15.json" --outdir ".\\exports"
  node ./scripts/node/clean-export.js --input "..\\Stepsafe Tech team_idb_2026-04-15.json" --basename "stepsafe-tech-team"
  node ./scripts/node/clean-export.js --input "..\\Stepsafe Tech team_idb_2026-04-15.json" --drop-system`);
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

function buildTranscriptMarkdown(meta, cleanedMessages) {
  const lines = [];
  lines.push(`# ${meta.title || "Teams Chat Transcript"}`);
  lines.push("");
  lines.push(`- Conversation ID: \`${meta.conversation_id || ""}\``);
  lines.push(`- Export Source: \`${meta.source || ""}\``);
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

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.input) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  const inputPath = path.resolve(args.input);
  const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const messages = input.messages || [];
  const mriMap = buildMriMap(messages);

  let cleanedMessages = messages.map(msg => cleanMessage(msg, mriMap));
  cleanedMessages.sort((a, b) => {
    const ta = Date.parse(a.timestamp_iso || "") || 0;
    const tb = Date.parse(b.timestamp_iso || "") || 0;
    if (ta !== tb) return ta - tb;
    return String(a.id).localeCompare(String(b.id));
  });

  if (args.dropSystem) cleanedMessages = cleanedMessages.filter(msg => !msg.system);

  const summary = buildSummary(cleanedMessages);
  const base = safeName(args.basename || input.title || path.basename(inputPath, ".json"));
  const outdir = path.resolve(args.outdir || path.dirname(inputPath));
  fs.mkdirSync(outdir, { recursive: true });

  const jsonPath = path.join(outdir, `${base}.cleaned.json`);
  const csvPath = path.join(outdir, `${base}.cleaned.csv`);
  const mdPath = path.join(outdir, `${base}.transcript.md`);

  const cleanedPayload = {
    exported_at: input.exportedAt || "",
    source: input.source || "",
    title: input.title || "",
    url: input.url || "",
    conversation_id: input.conversationId || "",
    original_count: input.count || messages.length,
    cleaned_count: cleanedMessages.length,
    summary,
    messages: cleanedMessages,
  };

  fs.writeFileSync(jsonPath, JSON.stringify(cleanedPayload, null, 2), "utf8");

  const csvHeader = [
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
  const csvLines = [
    csvHeader.join(","),
    ...cleanedMessages.map(row => csvHeader.map(key => escapeCsv(row[key])).join(",")),
  ];
  fs.writeFileSync(csvPath, `${csvLines.join("\n")}\n`, "utf8");

  const transcript = buildTranscriptMarkdown(cleanedPayload, cleanedMessages);
  fs.writeFileSync(mdPath, transcript, "utf8");

  console.log(JSON.stringify({
    input: inputPath,
    outdir,
    json: jsonPath,
    csv: csvPath,
    markdown: mdPath,
    count: cleanedMessages.length,
    participants: summary.participant_count,
  }, null, 2));
}

main();
