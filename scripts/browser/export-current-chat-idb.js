(() => {
  const CONFIG = {
    includeRawReplychains: true,
    maxFileNameLength: 80,
  };

  function safeName(name) {
    return String(name || "TeamsChat")
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, CONFIG.maxFileNameLength);
  }

  function downloadJson(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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

  function formatTimestamp(raw) {
    const value = String(raw || "").trim();
    const numeric = /^\d{10,}$/.test(value) ? Number(value) : Number.NaN;
    const ms = Number.isFinite(numeric) ? numeric : Date.parse(value);
    return Number.isFinite(ms) ? new Date(ms).toISOString() : "";
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
    if (!mids.length) throw new Error("No visible data-mid values found in current chat.");

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
    const id =
      raw.id ||
      raw.messageId ||
      raw.clientmessageid ||
      raw.clientMessageId ||
      raw.mid ||
      key;

    const author =
      raw.imDisplayName ||
      raw.imdisplayname ||
      raw.displayName ||
      raw.author ||
      raw.fromDisplayNameInToken ||
      raw.from ||
      "";

    const timestamp =
      raw.originalArrivalTime ||
      raw.originalarrivaltime ||
      raw.composeTime ||
      raw.composetime ||
      raw.createdTime ||
      raw.timestamp ||
      "";

    const html =
      raw.content ||
      raw.messageContent ||
      raw.contentHtml ||
      raw.html ||
      "";

    return {
      id: String(id || ""),
      replyChainId: String(chain.replyChainId || ""),
      conversationId: String(chain.conversationId || ""),
      author: String(author || ""),
      timestamp: String(timestamp || ""),
      timestampIso: formatTimestamp(timestamp),
      text: String(html || ""),
      raw,
    };
  }

  (async () => {
    console.log("[Teams IDB Export] opening Teams cache...");
    const dbInfo = await findReplychainDbInfo();
    const db = await openDb(dbInfo.name);

    try {
      console.log("[Teams IDB Export] extracting conversation id...");
      const conversationId = await extractConversationIdFromReplychains(db);
      if (!conversationId) {
        throw new Error("conversationId not found from replychains cache.");
      }

      console.log(`[Teams IDB Export] conversation: ${conversationId}`);

      const tx = db.transaction("replychains", "readonly");
      const allReplychains = await getAll(tx.objectStore("replychains"));
      const chains = allReplychains.filter(rec => rec.conversationId === conversationId);

      console.log(`[Teams IDB Export] matched replychains: ${chains.length}`);

      const normalized = [];
      const typeCounts = new Map();

      for (const chain of chains) {
        for (const [key, value] of Object.entries(chain.messageMap || {})) {
          const msg = normalizeMessageEntry(chain, key, value);
          normalized.push(msg);
          const messageType = msg.raw?.messageType || "(missing)";
          typeCounts.set(messageType, (typeCounts.get(messageType) || 0) + 1);
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

      deduped.sort((a, b) => {
        const ta = Date.parse(a.timestampIso || "") || 0;
        const tb = Date.parse(b.timestampIso || "") || 0;
        return ta - tb;
      });

      const participants = [...new Set(deduped.map(msg => msg.author).filter(Boolean))].sort();
      const payload = {
        exportedAt: new Date().toISOString(),
        source: "indexeddb-replychains",
        dbName: dbInfo.name,
        title: getTitle(),
        url: location.href,
        conversationId,
        replychainCount: chains.length,
        count: deduped.length,
        participantCount: participants.length,
        participants,
        messageTypeCounts: Object.fromEntries([...typeCounts.entries()].sort((a, b) => b[1] - a[1])),
        messages: deduped,
      };

      if (CONFIG.includeRawReplychains) {
        payload.rawReplychains = chains;
      }

      const filename = `${safeName(payload.title)}_idb_${new Date().toISOString().slice(0, 10)}.json`;
      window.__teamsChatExportLastResult = payload;
      downloadJson(filename, payload);
      console.log(`[Teams IDB Export] done: ${deduped.length} messages exported`);
      console.log("[Teams IDB Export] participants:", participants);
    } finally {
      db.close();
    }
  })().catch(err => {
    console.error("[Teams IDB Export] failed:", err);
    alert(`IDB export failed: ${err.message || err}`);
  });
})();
