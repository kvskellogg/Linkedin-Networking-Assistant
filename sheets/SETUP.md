# AI Networking Analyzer - Setup Guide

## Part 1: Extension-Side AI (Recommended)

The extension can generate AI-powered networking notes using Google's Gemini API, pre-filling the Notes field so you can review and edit before saving.

### Step 1: Get a Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Sign in with your Google account
3. Click **Create API key**
4. Copy the key

### Step 2: Configure the Extension

1. Click the extension icon → click the gear icon (Settings)
2. Paste your **Gemini API Key** in the field
3. Fill in **My Profile Summary** — describe yourself in 2-3 sentences:
   - Your current role and company
   - What you're looking for (PM roles, entrepreneurial ventures, etc.)
   - Key skills or interests
4. Click **Save Settings**

### Step 3: Use It

1. Navigate to any LinkedIn profile
2. Click the extension icon — it auto-extracts the profile
3. The Notes field will populate with an AI-generated networking summary
4. Edit the notes as needed, then click **Save to Sheet**

---

## Part 2: Google Sheets AI (Optional)

For users who want a separate AI analysis column (L) in their spreadsheet, you can set up Apps Script to auto-analyze rows.

### Step 1: Create a "My Profile" Tab

In your Google Sheet, create a new tab called **My Profile** with this structure:

| A (Field) | B (Value) |
|-----------|-----------|
| Name | Your Name |
| Headline | Your LinkedIn Headline |
| Company | Your Current Company |
| Location | Your City, Country |
| About | Brief professional summary |
| Goals | PM roles, entrepreneurial ventures |
| Skills | Product strategy, user research, etc. |

### Step 2: Set Up Apps Script

1. Open your Google Sheet
2. Go to **Extensions → Apps Script**
3. Delete any existing code in the editor
4. Copy the entire contents of `appscript.gs` and paste it in
5. Replace `YOUR_GEMINI_API_KEY_HERE` with your actual Gemini API key
6. Update `DATA_SHEET_NAME` if your data tab isn't named "Sheet1"
7. Click **Save** (disk icon)

### Step 3: Install the Auto-Trigger

1. In the Apps Script editor, select `setupTrigger` from the function dropdown
2. Click **Run**
3. Grant the necessary permissions when prompted
4. You'll see a confirmation dialog

### Step 4: Add Column L Header

In your data sheet, add **AI Summary** as the header in cell L1.

### Usage

- **Automatic:** New rows saved by the extension will be analyzed automatically
- **Manual:** Use the **AI Analyze** menu in your spreadsheet:
  - *Analyze all unprocessed rows* — fills column L for any row missing a summary
  - *Re-analyze selected row* — regenerates the summary for the selected row

### Costs

Gemini 2.0 Flash is very affordable. Each profile analysis uses roughly 500-800 tokens, costing fractions of a cent per call.
