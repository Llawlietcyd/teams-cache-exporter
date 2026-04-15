const includeRawEl = document.getElementById("includeRaw");
const exportBtn = document.getElementById("exportBtn");
const statusEl = document.getElementById("status");

function setStatus(text) {
  statusEl.textContent = text;
}

function isTeamsUrl(url) {
  return /^https:\/\/(.+\.)?(teams\.microsoft\.com|teams\.microsoft\.us|teams\.live\.com|cloud\.microsoft)\//i.test(url || "");
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

async function ensureContentScript(tabId) {
  try {
    const probe = await chrome.tabs.sendMessage(tabId, { type: "PING_EXPORTER" });
    if (probe?.ok) return;
  } catch {}

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"],
  });
}

async function sendExportRequest(tabId, includeRaw) {
  await ensureContentScript(tabId);
  return chrome.tabs.sendMessage(tabId, {
    type: "EXPORT_CURRENT_CHAT",
    includeRaw,
  });
}

async function loadSettings() {
  const stored = await chrome.storage.local.get(["includeRaw"]);
  includeRawEl.checked = Boolean(stored.includeRaw);
}

async function saveSettings() {
  await chrome.storage.local.set({ includeRaw: includeRawEl.checked });
}

includeRawEl.addEventListener("change", () => {
  void saveSettings();
});

exportBtn.addEventListener("click", async () => {
  exportBtn.disabled = true;
  setStatus("Exporting current chat...");

  try {
    const tab = await getActiveTab();
    if (!tab?.id || !isTeamsUrl(tab.url)) {
      throw new Error("Open a Teams web chat first.");
    }

    const response = await sendExportRequest(tab.id, includeRawEl.checked);

    if (!response?.ok) {
      throw new Error(response?.error || "Export failed.");
    }

    const lines = [
      `Done: ${response.title || "Current chat"}`,
      `Messages: ${response.count}`,
      `Participants: ${response.participantCount}`,
      "",
      ...response.files.map(name => `- ${name}`),
    ];
    setStatus(lines.join("\n"));
  } catch (error) {
    setStatus(error?.message || String(error));
  } finally {
    exportBtn.disabled = false;
  }
});

void loadSettings();
