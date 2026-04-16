# Teams Cache Exporter

[中文说明](./README.zh-CN.md)

Export the **currently open** Microsoft Teams web chat from browser cache into readable files.

It is designed for Teams Web `v2` when normal export options are unavailable or incomplete.

## What It Does

1. Export the **currently open chat only**
2. Read cached history from Teams `IndexedDB`
3. Generate cleaned downloads directly in the browser
4. Optionally include the raw cache dump for debugging
5. Optionally hide system messages from the final export

## Project Layout

```text
teams-cache-exporter/
  README.md
  package.json
  LICENSE
  extension/
    manifest.json
    popup.html
    popup.css
    popup.js
    background.js
    content.js
  scripts/
    browser/
      export-current-chat-idb.js
    node/
      clean-export.js
```

## Requirements

- Microsoft Teams Web, already signed in
- A chat open in `https://teams.microsoft.com/v2/`
- Node.js `18+` for the cleaner

## Browser Script Export

This exports the **currently open chat only**.

1. Open the target chat in Teams Web.
2. Press `F12`.
3. Open the `Console` tab.
4. Paste the contents of:

   `scripts/browser/export-current-chat-idb.js`

5. Press `Enter`.

Expected console output:

```text
[Teams IDB Export] opening Teams cache...
[Teams IDB Export] extracting conversation id...
[Teams IDB Export] conversation: ...
[Teams IDB Export] matched replychains: ...
[Teams IDB Export] done: ... messages exported
```

The browser will download a raw JSON file such as:

```text
Stepsafe Tech team_idb_2026-04-15.json
```

## Extension Mode

If you want less manual work, load the `extension/` folder as an unpacked extension in Chrome or Edge.

### Load the extension

1. Open `chrome://extensions/` or `edge://extensions/`
2. Turn on **Developer mode**
3. Click **Load unpacked**
4. Select:

   `teams-cache-exporter/extension`

### Use the extension

1. Open the target Teams chat in the browser
2. Click the extension icon
3. Choose which outputs to generate
4. Optionally enable:
   - `Hide system messages`
   - `Include raw cache dump`
5. Click `Export current chat`

The extension automatically downloads:

- cleaned JSON if selected
- cleaned CSV if selected
- Markdown transcript if selected
- optional raw JSON cache dump

This is the lowest-friction path in the toolkit right now.

If the browser UI language is Chinese, the popup UI will automatically switch to Chinese.

## Clean the Raw Export

From the repository root:

```powershell
npm run clean -- --input "..\Stepsafe Tech team_idb_2026-04-15.json"
```

Optional arguments:

```powershell
npm run clean -- --input "..\Stepsafe Tech team_idb_2026-04-15.json" --outdir ".\exports"
npm run clean -- --input "..\Stepsafe Tech team_idb_2026-04-15.json" --basename "stepsafe-tech-team"
npm run clean -- --input "..\Stepsafe Tech team_idb_2026-04-15.json" --drop-system
```

Generated files:

- `<basename>.cleaned.json`
- `<basename>.cleaned.csv`
- `<basename>.transcript.md`

## Cleaner Features

- converts millisecond timestamps into ISO and local time
- strips Teams HTML markup into readable text
- converts many system messages into plain English
- extracts reply previews when present
- builds a participant list and summary stats
- exports flat CSV for Excel
- exports Markdown transcript for reading/sharing

## Known Limits

- It only exports data that Teams has cached locally for the current signed-in browser session.
- Some participant IDs in system messages may remain as `8:orgid:...` if no display name is available in cache.
- This is not an official Microsoft export path.
- Use it only where your organization or school policy allows.

## Product Notes

- The popup remembers the last selected export options.
- The popup will inject the content script into the active Teams tab if needed.
- Status text is preserved so the user can reopen the popup and still see the previous result summary.
- Popup language follows the browser UI language through Chrome/Edge extension localization, not the Teams page language.

## Packaging

Build a store upload zip from the repository root:

```powershell
npm run pack:extension
```

The packaged file will be written to:

```text
dist/teams-cache-exporter-v<version>.zip
```

## GitHub Pages

This repository includes static Pages files under `docs/`.

After enabling GitHub Pages for the `main` branch and `/docs` folder, the expected URLs will look like:

- `https://llawlietcyd.github.io/teams-cache-exporter/`
- `https://llawlietcyd.github.io/teams-cache-exporter/privacy-policy.html`
- `https://llawlietcyd.github.io/teams-cache-exporter/privacy-policy.zh-CN.html`

## Suggested GitHub Packaging

- commit the repository without personal exports
- do **not** commit personal chat exports by default
- keep raw and cleaned exports under an ignored `exports/` folder

## License

MIT
