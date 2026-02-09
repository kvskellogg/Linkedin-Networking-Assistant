# LinkedIn Networking Assistant

https://youtu.be/RkyirD5Lsjk


A Chrome extension that saves LinkedIn profiles to Google Sheets with one click. It also uses AI to tell you why someone could be a valuable connection.

## What It Does

1. **Extracts profile data** — Name, headline, company, title, location, about, and contact info
2. **Saves to Google Sheets** — All data goes into a spreadsheet you control
3. **Detects duplicates** — Warns you if you've already saved someone
4. **AI networking notes** — Optionally uses Google Gemini to write a brief note on how this person could be helpful in your network

## Setup

### Step 1: Install the Extension

1. Download or clone this repository
2. Open `chrome://extensions` in Chrome
3. Turn on **Developer mode** (top right toggle)
4. Click **Load unpacked** and select this folder

### Step 2: Create a Google Sheet

1. Create a new Google Sheet
2. Add these headers in row 1:

| A | B | C | D | E | F | G | H | I | J | K |
|---|---|---|---|---|---|---|---|---|---|---|
| Timestamp | Name | Headline | Company | Title | Location | Country | About | Profile URL | Notes | Contact Info |

3. Copy the **Sheet ID** from the URL — it's the long string between `/d/` and `/edit`

### Step 3: Get a Google OAuth Client ID

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use an existing one)
3. Go to **APIs & Services > Credentials**
4. Click **Create Credentials > OAuth client ID**
5. Choose **Chrome Extension** as the application type
6. Enter your extension's ID (find it on `chrome://extensions`)
7. Copy the **Client ID**

### Step 4: Configure the Extension

1. Click the extension icon in Chrome
2. Click the gear icon to open **Settings**
3. Paste your **Google Client ID** and **Sheet ID**
4. Click **Save Settings**
5. Click **Authenticate with Google** and sign in

## How to Use

1. Go to any LinkedIn profile page
2. Scroll to the bottom of the profile (so all sections load)
3. Click the extension icon
4. The profile data is extracted automatically
5. Add your own notes or edit the AI-generated ones
6. Click **Save to Sheet**

If the profile is already saved, you'll see a warning with the option to **Update Existing**.

## AI Networking Notes (Optional)

The extension can use Google Gemini to automatically write a brief note about how each person could be helpful in your network.

### Setup

1. Go to [Google AI Studio](https://aistudio.google.com/apikey) and create a free API key
2. Open extension **Settings**
3. Paste your **Gemini API Key**
4. Fill in **My Profile Summary** — describe yourself in 2-3 sentences (your role, goals, what connections you're looking for)
5. Click **Save Settings**

Now when you extract a profile, the Notes field will auto-fill with an AI-generated summary. You can edit it before saving.

## Data Saved

Each profile saves one row with these columns:

| Column | Data |
|--------|------|
| A | Timestamp |
| B | Name |
| C | Headline |
| D | Company |
| E | Title |
| F | Location |
| G | Country |
| H | About |
| I | Profile URL |
| J | Notes |
| K | Contact Info |

## Optional: Google Sheets AI Analysis

For an additional AI summary column (L) powered by Apps Script, see [sheets/SETUP.md](sheets/SETUP.md).

## Tech Stack

- Chrome Extension (Manifest V3)
- Vanilla JavaScript
- Google Sheets API v4
- Google Gemini 2.0 Flash API
