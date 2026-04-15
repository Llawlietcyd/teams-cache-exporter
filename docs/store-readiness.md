# Store Readiness Checklist

This file is a practical checklist for publishing the extension to browser stores.

## Before Publishing

- choose a final repository name
- replace placeholder copyright and contact information
- verify the extension name is unique enough
- verify the icon set is final
- review all requested permissions
- confirm no personal export files are included in the repository

## Browser Store Requirements To Prepare

### Chrome Web Store

Prepare:

- final `manifest.json`
- extension icon
- screenshots
- short description
- long description
- privacy policy URL
- support URL or repository URL

### Microsoft Edge Add-ons

Prepare:

- same extension package
- privacy policy URL
- screenshots
- listing text

## Recommended Listing Language

Suggested short value proposition:

> Export the currently open Microsoft Teams web chat from browser cache into cleaned JSON, CSV, and Markdown.

## Review Risks

Potential review concerns:

- accessing Teams content may be considered sensitive enterprise data
- store reviewers may ask why host permissions for Teams domains are required
- reviewers may ask whether any data leaves the browser

Be ready to state clearly:

- the extension only exports the currently open chat
- processing happens locally
- no third-party backend is used
- downloaded files are created on the user's own device

## Suggested Improvements Before Store Submission

- add polished screenshots
- add a 128x128 and store listing artwork set
- add a support / issues URL
- add a changelog
- test on both Chrome and Edge
- test with multiple Teams tenants if possible
- add a simple "Export completed" toast or richer progress UI

## Optional Product Polish

- configurable output folder behavior is not possible in standard extension APIs, but messaging could be improved
- add separate toggles for JSON / CSV / Markdown / raw
- add a "drop system messages" option in the popup
- add better participant name resolution when cache contains additional profile data
