# LinkedIn Profile Extractor

## Project Overview
Chrome Extension (Manifest V3) that extracts LinkedIn profile data from profile pages and saves it to Google Sheets for networking purposes.

## Tech Stack
- Chrome Extension APIs (Manifest V3)
- Vanilla JavaScript (no frameworks)
- Google Sheets API v4
- OAuth2 via `chrome.identity.launchWebAuthFlow`

## Project Structure
```
linkedin_extractor/
├── manifest.json          # Extension manifest (MV3)
├── popup/
│   ├── popup.html         # Extension popup UI
│   ├── popup.css          # Styling (LinkedIn blue #0077b5 theme)
│   └── popup.js           # Popup logic & event handlers
├── scripts/
│   ├── content.js         # LinkedIn DOM scraper (content script)
│   └── background.js      # Service worker (OAuth + Sheets API + Gemini AI)
├── sheets/
│   ├── appscript.gs       # Optional Apps Script for sheet-side AI analysis (column L)
│   └── SETUP.md           # Setup guide for AI features
├── icons/                 # Extension icons (16, 48, 128px) - placeholder blue circles
├── setup.js               # Node script to generate placeholder icons
└── generate-icons.html    # Browser-based icon generator
```

## Architecture
- **content.js** is injected into `linkedin.com/in/*` pages and scrapes profile data from the DOM
  - `extractProfileData()` — scrapes name, headline, location, current role/company, about from the DOM
  - `extractContactInfo()` — clicks the "Contact info" link, snapshots existing `[data-testid="lazy-column"]` elements, uses MutationObserver to detect new overlay content via `div[componentkey]` items, extracts structured label:value pairs, then closes overlay (5s timeout)
- **popup.js** communicates with content.js via `chrome.tabs.sendMessage` and with background.js via `chrome.runtime.sendMessage`
  - Auto-extracts profile data on popup open if on a LinkedIn profile page
  - Checks for duplicates automatically after extraction
- **background.js** handles OAuth2 authentication, Google Sheets API calls, and Gemini AI calls
  - Message actions: `authenticate`, `checkDuplicate`, `appendRow`, `updateRow`, `generateAISummary`
- Settings (Client ID, Sheet ID, tab name, access token, Gemini API key, user profile summary) are stored in `chrome.storage.local`
- **AI Feature:** After extraction, if Gemini API key is configured, calls Gemini 2.0 Flash to generate a networking relevance summary that pre-fills the Notes field

## Data Schema (Columns A-K)
A: Timestamp | B: Name | C: Headline | D: Company | E: Title | F: Location | G: Country | H: About | I: Profile URL | J: Notes | K: Contact Info

## Known Issues
- None currently tracked

## Conventions
- No build tools or bundlers — plain JS files loaded directly
- CSS uses LinkedIn blue (`#0077b5`) as the primary accent color
- DOM element references are cached in the `elements` object in popup.js
- All Sheets API calls go through background.js service worker
- Profile URL (column I) is the unique key for duplicate detection
- UI visibility is toggled via `.hidden` class (`display: none !important`)

## Setup Requirements
- A Google Cloud project with OAuth2 credentials (Chrome Extension type)
- The OAuth client ID is configured in `manifest.json` (`oauth2.client_id`) and can also be set via the extension settings popup
- A Google Sheet must be created and its ID configured in settings
- Load as an unpacked extension in `chrome://extensions` with Developer Mode enabled
