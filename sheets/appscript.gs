/**
 * LinkedIn Profile Extractor - Google Sheets AI Analyzer (Apps Script)
 *
 * This script adds AI-powered networking analysis to your Google Sheet.
 * It reads profile data from columns A-K, calls Gemini API, and writes
 * an AI summary to column L.
 *
 * SETUP:
 * 1. Open your Google Sheet → Extensions → Apps Script
 * 2. Paste this entire file into the script editor
 * 3. Set your Gemini API key in the GEMINI_API_KEY variable below
 * 4. Create a "My Profile" tab with your profile info (see SETUP.md)
 * 5. Run setupTrigger() once to enable automatic processing
 * 6. Use the "AI Analyze" menu for manual runs
 */

// ===== CONFIGURATION =====
const GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY_HERE'; // Replace with your key
const GEMINI_MODEL = 'gemini-2.0-flash';
const DATA_SHEET_NAME = 'Sheet1'; // Must match your extension's sheet tab name
const MY_PROFILE_SHEET = 'My Profile';

/**
 * Adds a custom menu to the spreadsheet
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('AI Analyze')
    .addItem('Analyze all unprocessed rows', 'processAllRows')
    .addItem('Re-analyze selected row', 'reanalyzeSelectedRow')
    .addItem('Setup auto-trigger', 'setupTrigger')
    .addToUi();
}

/**
 * Installable trigger — runs when the sheet changes.
 * Finds rows where column L (AI Summary) is empty and processes them.
 */
function onSheetChange(e) {
  processAllRows();
}

/**
 * Process all rows that don't have an AI summary in column L
 */
function processAllRows() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DATA_SHEET_NAME);
  if (!sheet) {
    SpreadsheetApp.getUi().alert('Sheet "' + DATA_SHEET_NAME + '" not found.');
    return;
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return; // No data rows

  const dataRange = sheet.getRange(2, 1, lastRow - 1, 12); // A2:L{lastRow}
  const data = dataRange.getValues();

  let processed = 0;

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const name = row[1]; // Column B: Name
    const aiSummary = row[11]; // Column L: AI Summary

    // Skip rows without a name or that already have a summary
    if (!name || aiSummary) continue;

    const summary = processRow(row);
    if (summary) {
      sheet.getRange(i + 2, 12).setValue(summary); // Write to column L
      processed++;
    }

    // Avoid hitting rate limits
    if (processed > 0 && processed % 5 === 0) {
      Utilities.sleep(2000);
    }
  }

  if (processed > 0) {
    SpreadsheetApp.getActiveSpreadsheet().toast(
      processed + ' row(s) analyzed successfully.',
      'AI Analysis Complete'
    );
  }
}

/**
 * Re-analyze the currently selected row
 */
function reanalyzeSelectedRow() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const row = sheet.getActiveRange().getRow();

  if (row < 2) {
    SpreadsheetApp.getUi().alert('Please select a data row (not the header).');
    return;
  }

  const data = sheet.getRange(row, 1, 1, 11).getValues()[0]; // A:K
  const summary = processRow(data);

  if (summary) {
    sheet.getRange(row, 12).setValue(summary); // Write to column L
    SpreadsheetApp.getActiveSpreadsheet().toast('Row ' + row + ' analyzed.', 'Done');
  } else {
    SpreadsheetApp.getUi().alert('Failed to generate summary. Check your API key.');
  }
}

/**
 * Process a single row — reads profile data + My Profile, calls Gemini
 * @param {Array} row - Array of values from columns A-K
 * @returns {string|null} AI summary or null on failure
 */
function processRow(row) {
  const profileData = {
    timestamp: row[0],
    name: row[1],
    headline: row[2],
    company: row[3],
    title: row[4],
    location: row[5],
    country: row[6],
    about: row[7],
    profileUrl: row[8],
    notes: row[9],
    contactInfo: row[10]
  };

  // Get user's profile from "My Profile" tab
  const myProfile = getMyProfile();

  const prompt = `Given the profile below and MY background, write 2 sentences max on how this person could be helpful to have in my network. Write in third person (e.g. "They could help with..."). Be specific and brief.

MY BACKGROUND:
${myProfile}

THEIR PROFILE:
Name: ${profileData.name || 'N/A'}
Headline: ${profileData.headline || 'N/A'}
Company: ${profileData.company || 'N/A'}
Title: ${profileData.title || 'N/A'}
Location: ${profileData.location || 'N/A'}
About: ${profileData.about || 'N/A'}`;

  return callGemini(prompt);
}

/**
 * Read the user's profile from the "My Profile" sheet tab
 * Expected format: Column A = field name, Column B = value
 * @returns {string} Formatted profile summary
 */
function getMyProfile() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MY_PROFILE_SHEET);
    if (!sheet) return 'Not provided';

    const data = sheet.getDataRange().getValues();
    return data.map(row => `${row[0]}: ${row[1]}`).join('\n');
  } catch (e) {
    return 'Not provided';
  }
}

/**
 * Call Gemini API with a prompt
 * @param {string} prompt - The prompt to send
 * @returns {string|null} Generated text or null on failure
 */
function callGemini(prompt) {
  if (GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
    Logger.log('Gemini API key not configured. Set GEMINI_API_KEY in the script.');
    return null;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }]
  };

  try {
    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const status = response.getResponseCode();
    if (status !== 200) {
      Logger.log('Gemini API error: ' + response.getContentText());
      return null;
    }

    const result = JSON.parse(response.getContentText());
    return result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch (e) {
    Logger.log('Gemini API call failed: ' + e.message);
    return null;
  }
}

/**
 * Install the onChange trigger for automatic processing.
 * Run this once from the Apps Script editor.
 */
function setupTrigger() {
  // Remove existing triggers to avoid duplicates
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === 'onSheetChange') {
      ScriptApp.deleteTrigger(trigger);
    }
  }

  ScriptApp.newTrigger('onSheetChange')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onChange()
    .create();

  SpreadsheetApp.getUi().alert('Auto-trigger installed! New rows will be analyzed automatically.');
}
