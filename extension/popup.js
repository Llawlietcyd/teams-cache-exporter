const outputJsonEl = document.getElementById("outputJson");
const outputCsvEl = document.getElementById("outputCsv");
const outputMarkdownEl = document.getElementById("outputMarkdown");
const includeRawEl = document.getElementById("includeRaw");
const dropSystemEl = document.getElementById("dropSystem");
const exportBtn = document.getElementById("exportBtn");
const statusEl = document.getElementById("status");
const titleEl = document.getElementById("appTitle");
const subtitleEl = document.getElementById("subtitle");
const outputGroupTitleEl = document.getElementById("outputGroupTitle");
const outputJsonLabelEl = document.getElementById("outputJsonLabel");
const outputCsvLabelEl = document.getElementById("outputCsvLabel");
const outputMarkdownLabelEl = document.getElementById("outputMarkdownLabel");
const optionsGroupTitleEl = document.getElementById("optionsGroupTitle");
const dropSystemLabelEl = document.getElementById("dropSystemLabel");
const includeRawLabelEl = document.getElementById("includeRawLabel");

function setStatus(text) {
  statusEl.textContent = text;
}

function t(key, substitutions) {
  return chrome.i18n.getMessage(key, substitutions) || "";
}

const DEFAULT_SETTINGS = {
  includeRaw: false,
  dropSystem: false,
  outputs: {
    json: true,
    csv: true,
    markdown: true,
  },
  lastStatus: "",
};

function localizeStaticText() {
  document.documentElement.lang = chrome.i18n.getUILanguage().startsWith("zh") ? "zh-CN" : "en";
  document.title = t("extName");
  titleEl.textContent = t("extName");
  subtitleEl.textContent = t("popupSubtitle");
  outputGroupTitleEl.textContent = t("outputGroupTitle");
  outputJsonLabelEl.textContent = t("outputJsonLabel");
  outputCsvLabelEl.textContent = t("outputCsvLabel");
  outputMarkdownLabelEl.textContent = t("outputMarkdownLabel");
  optionsGroupTitleEl.textContent = t("optionsGroupTitle");
  dropSystemLabelEl.textContent = t("dropSystemLabel");
  includeRawLabelEl.textContent = t("includeRawLabel");
  exportBtn.textContent = t("exportButton");
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

async function sendExportRequest(tabId, options) {
  await ensureContentScript(tabId);
  return chrome.tabs.sendMessage(tabId, {
    type: "EXPORT_CURRENT_CHAT",
    options,
  });
}

async function loadSettings() {
  const stored = await chrome.storage.local.get(["includeRaw", "dropSystem", "outputs", "lastStatus"]);
  const outputs = stored.outputs || DEFAULT_SETTINGS.outputs;

  outputJsonEl.checked = outputs.json !== false;
  outputCsvEl.checked = outputs.csv !== false;
  outputMarkdownEl.checked = outputs.markdown !== false;
  includeRawEl.checked = Boolean(stored.includeRaw);
  dropSystemEl.checked = Boolean(stored.dropSystem);
  setStatus(stored.lastStatus || t("statusReady"));
}

async function saveSettings() {
  await chrome.storage.local.set({
    includeRaw: includeRawEl.checked,
    dropSystem: dropSystemEl.checked,
    outputs: {
      json: outputJsonEl.checked,
      csv: outputCsvEl.checked,
      markdown: outputMarkdownEl.checked,
    },
  });
}

async function saveStatus(text) {
  setStatus(text);
  await chrome.storage.local.set({ lastStatus: text });
}

function getExportOptions() {
  return {
    includeRaw: includeRawEl.checked,
    dropSystem: dropSystemEl.checked,
    outputs: {
      json: outputJsonEl.checked,
      csv: outputCsvEl.checked,
      markdown: outputMarkdownEl.checked,
    },
  };
}

function hasSelectedOutput(options) {
  return Object.values(options.outputs || {}).some(Boolean);
}

for (const el of [outputJsonEl, outputCsvEl, outputMarkdownEl, includeRawEl, dropSystemEl]) {
  el.addEventListener("change", () => {
    void saveSettings();
  });
}

exportBtn.addEventListener("click", async () => {
  const exportOptions = getExportOptions();

  if (!hasSelectedOutput(exportOptions)) {
    await saveStatus(t("errorSelectOutput"));
    return;
  }

  exportBtn.disabled = true;
  await saveStatus(t("statusExporting"));

  try {
    const tab = await getActiveTab();
    if (!tab?.id || !isTeamsUrl(tab.url)) {
      throw new Error(t("errorOpenTeamsChat"));
    }

    const response = await sendExportRequest(tab.id, exportOptions);

    if (!response?.ok) {
      throw new Error(response?.error || t("errorExportFailed"));
    }

    const lines = [
      `${t("statusDonePrefix")} ${response.title || t("currentChatLabel")}`,
      `${t("statusMessagesPrefix")} ${response.count}`,
      `${t("statusParticipantsPrefix")} ${response.participantCount}`,
      response.systemMessageCount ? `${t("statusSystemHiddenPrefix")} ${response.systemMessageCount}` : "",
      "",
      ...response.files.map(name => `- ${name}`),
    ].filter(Boolean);
    await saveStatus(lines.join("\n"));
  } catch (error) {
    await saveStatus(error?.message || String(error));
  } finally {
    exportBtn.disabled = false;
  }
});

localizeStaticText();
void loadSettings();
