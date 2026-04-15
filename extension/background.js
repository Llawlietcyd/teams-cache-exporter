function textToDataUrl(mimeType, text) {
  const bytes = new TextEncoder().encode(String(text));
  let binary = "";
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return `data:${mimeType};base64,${btoa(binary)}`;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "DOWNLOAD_FILES") return;

  (async () => {
    try {
      const files = Array.isArray(message.files) ? message.files : [];
      const ids = [];

      for (const file of files) {
        const downloadId = await chrome.downloads.download({
          url: textToDataUrl(file.mimeType || "text/plain;charset=utf-8", file.text || ""),
          filename: file.filename || "teams-export.txt",
          saveAs: false,
          conflictAction: "uniquify",
        });
        ids.push(downloadId);
      }

      sendResponse({ ok: true, ids });
    } catch (error) {
      sendResponse({ ok: false, error: error?.message || String(error) });
    }
  })();

  return true;
});
