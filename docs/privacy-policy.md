# Privacy Policy

Last updated: 2026-04-15

## Summary

Teams Cache Exporter processes Microsoft Teams chat data locally in the user's browser in order to export the currently open chat.

The extension is designed so that exported content stays on the user's machine unless the user manually moves or uploads the files somewhere else.

## What Data the Extension Accesses

The extension may access:

- the currently open Microsoft Teams web page
- locally cached Teams chat data stored in the browser's IndexedDB
- the visible Teams chat currently open in the active tab

It may generate export files containing:

- message text
- message timestamps
- sender display names when available in cache
- reply previews
- system events such as member adds, topic changes, and calls

## What the Extension Does Not Do

The extension does not intentionally:

- send chat content to any third-party server
- upload exported files to a remote backend
- collect analytics or telemetry
- sell data
- run ads

## Local Processing

All export generation is intended to happen locally inside the browser context and extension runtime.

Downloads are created directly on the user's device through the browser download API.

## User Control

The user controls:

- which Teams chat is open
- when an export is triggered
- whether the raw cache dump is included
- what happens to downloaded files afterward

## Data Retention

The extension itself is designed not to retain exported chat content outside the files created by the browser download flow.

If the user downloads files, those files remain on the user's device until the user deletes or moves them.

## Security

The extension requests only the permissions needed to:

- access Teams pages
- read the current chat context
- generate file downloads
- store small extension settings such as export options

## Policy Note

Users are responsible for complying with their organization's, school's, and Microsoft's policies before exporting any Teams content.

## Contact

Repository maintainers should replace this section with a real contact email or issue tracker URL before public release.
