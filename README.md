# AutoFill - Chrome Extension

A lightweight Chrome Extension that saves form data from any webpage and auto-fills it on revisit. Built with Manifest V3, pure JavaScript, no frameworks, no build tools.

## Features

- **One-Click Save** — Click the extension icon and save all form fields on the current page
- **Auto-Fill** — Toggle per-form auto-fill; fields are restored automatically on page load
- **Auto-Submit** — Optionally auto-click the submit button after filling (supports multi-step pages)
- **Management Page** — View, search, edit, rename, and delete all saved forms in one place
- **Export / Import** — Backup and restore your saved forms as JSON
- **SPA Support** — Polling-based detection works with Angular, React, Vue, and other single-page apps
- **Iframe Support** — Cross-frame filling and submit for pages with embedded forms
- **100% Local** — All data is stored in `chrome.storage.local`. Nothing is sent to any server.

## Install

### From Source (Developer Mode)

1. Clone or download this repository
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select the project folder
5. The AutoFill icon appears in the toolbar

### From Chrome Web Store

*Coming soon*

## Usage

### Save a Form

1. Navigate to a page with a form (e.g., a login page)
2. Fill in the fields with the values you want to save
3. Click the AutoFill extension icon
4. Click **Save Current Page Forms**

### Auto-Fill

1. Open the extension popup on a page with a saved form
2. Click **Auto ON** to enable auto-fill for that form
3. On next visit, the fields are filled automatically

### Auto-Submit

1. Click **Submit ON** in the popup or management page
2. After auto-fill completes, the extension automatically clicks the submit button
3. Supports multi-step pages — waits for the form to be visible before acting

### Fill Now (Manual)

Click the **Fill** button in the popup to fill the form immediately without enabling auto-fill.

### Manage Forms

Click **Manage All Forms** in the popup footer (or go to the extension's Options page) to:

- Search and filter saved forms
- Rename forms (click the title)
- Edit field values
- Toggle auto-fill and auto-submit per form
- Export all forms as JSON backup
- Import forms from a JSON file
- Delete individual forms or all at once

## Project Structure

```
ce_AutoFill/
├── manifest.json          # Extension manifest (MV3)
├── icons/                 # Extension icons (16, 32, 48, 128px)
├── popup/
│   ├── popup.html         # Extension popup UI
│   ├── popup.css
│   └── popup.js
├── manage/
│   ├── manage.html        # Full-page management UI
│   ├── manage.css
│   └── manage.js
├── scripts/
│   ├── background.js      # Service worker (message routing, storage)
│   ├── content.js         # Auto-fill & auto-submit (runs on every page)
│   └── extractor.js       # Form extraction (injected on-demand)
└── lib/
    ├── storage.js         # Storage abstraction (chrome.storage.local)
    └── form-utils.js      # Shared utilities (field location, value setting)
```

## How It Works

| Component | Strategy |
|-----------|----------|
| **Form extraction** | Programmatically injected only when user clicks "Save" — no heavy processing on every page |
| **Auto-fill** | Static content script at `document_idle`, polls for 30 seconds to handle SPAs |
| **Field matching** | 4-level fallback: CSS selector → ID → name in form → name anywhere |
| **Value setting** | Native value setter + `input`/`change`/`blur` events for React/Angular/Vue compatibility |
| **Auto-submit** | Waits for form fields to be visible before acting; skips intro/landing buttons |
| **URL matching** | `origin + pathname` (ignores query params and hash) |

## Permissions

| Permission | Reason |
|------------|--------|
| `storage` | Save form data locally |
| `activeTab` | Read form fields on the current page when user clicks "Save" |
| `scripting` | Inject the form extractor script on demand |
| `<all_urls>` | Auto-fill content script needs to run on any page |

## Privacy

- All data is stored locally in `chrome.storage.local`
- No data is collected, transmitted, or shared with any third party
- No analytics, no tracking, no network requests
- Password fields are stored locally — use at your own discretion

## License

MIT
