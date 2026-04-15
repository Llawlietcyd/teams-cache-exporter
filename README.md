# Teams Chat Export Toolkit

Minimal toolkit for exporting the **currently open** Microsoft Teams web chat from the browser cache and converting it into readable files.

It is designed for Teams Web `v2` when normal export options are unavailable or incomplete.

## What It Does

1. Run a browser script inside `https://teams.microsoft.com/v2/`
2. Read the current chat's cached history from Teams `IndexedDB`
3. Download a raw export JSON for that one conversation
4. Clean the raw JSON into:
   - readable JSON
   - CSV
   - Markdown transcript

## Project Layout

```text
teams-chat-export-toolkit/
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

## Browser Export

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

   `teams-chat-export-toolkit/extension`

### Use the extension

1. Open the target Teams chat in the browser
2. Click the extension icon
3. Optionally enable `Include raw cache dump`
4. Click `Export current chat`

The extension automatically downloads:

- cleaned JSON
- cleaned CSV
- Markdown transcript
- optional raw JSON cache dump

This is the lowest-friction path in the toolkit right now.

## Clean the Raw Export

From this toolkit directory:

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

## Suggested GitHub Packaging

- commit the toolkit directory
- do **not** commit personal chat exports by default
- keep raw and cleaned exports under an ignored `exports/` folder

## License

MIT
