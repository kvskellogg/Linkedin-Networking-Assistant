// LinkedIn Profile Extractor - Background Service Worker
// Handles OAuth and Google Sheets API calls

const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';
const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request, sender)
    .then(sendResponse)
    .catch(error => sendResponse({ success: false, error: error.message }));
  return true; // Keep message channel open for async response
});

async function handleMessage(request, sender) {
  switch (request.action) {
    case 'authenticate':
      return await authenticate();
    case 'checkDuplicate':
      return await checkDuplicate(request.profileUrl);
    case 'appendRow':
      return await appendRow(request.data);
    case 'updateRow':
      return await updateRow(request.data, request.rowNumber);
    case 'generateAISummary':
      return await generateAISummary(request.profileData);
    default:
      return { success: false, error: 'Unknown action' };
  }
}

// OAuth Authentication
async function authenticate() {
  try {
    const settings = await chrome.storage.local.get(['clientId']);

    if (!settings.clientId) {
      return { success: false, error: 'Client ID not configured' };
    }

    const redirectUrl = chrome.identity.getRedirectURL();
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', settings.clientId);
    authUrl.searchParams.set('redirect_uri', redirectUrl);
    authUrl.searchParams.set('response_type', 'token');
    authUrl.searchParams.set('scope', SCOPES);
    authUrl.searchParams.set('prompt', 'consent');

    const responseUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl.toString(),
      interactive: true
    });

    // Extract access token from response URL
    const url = new URL(responseUrl);
    const hashParams = new URLSearchParams(url.hash.substring(1));
    const accessToken = hashParams.get('access_token');

    if (accessToken) {
      await chrome.storage.local.set({ accessToken });
      return { success: true };
    } else {
      return { success: false, error: 'No access token received' };
    }
  } catch (error) {
    console.error('Auth error:', error);
    return { success: false, error: error.message };
  }
}

// Get access token (with potential refresh)
async function getAccessToken() {
  const settings = await chrome.storage.local.get(['accessToken']);
  return settings.accessToken;
}

// Check for duplicate profile
async function checkDuplicate(profileUrl) {
  try {
    const settings = await chrome.storage.local.get(['sheetId', 'sheetName', 'accessToken']);

    if (!settings.accessToken) {
      return { found: false };
    }

    const sheetName = settings.sheetName || 'Sheet1';
    const range = `${sheetName}!I:J`; // Profile URL is in column I, we also get notes in J

    const response = await fetch(
      `${SHEETS_API_BASE}/${settings.sheetId}/values/${encodeURIComponent(range)}`,
      {
        headers: {
          'Authorization': `Bearer ${settings.accessToken}`
        }
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('Sheets API error:', error);
      return { found: false };
    }

    const data = await response.json();
    const values = data.values || [];

    // Search for matching profile URL (skip header row)
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] && values[i][0] === profileUrl) {
        // Found duplicate - get timestamp from column A
        const timestampRange = `${sheetName}!A${i + 1}`;
        const timestampResponse = await fetch(
          `${SHEETS_API_BASE}/${settings.sheetId}/values/${encodeURIComponent(timestampRange)}`,
          {
            headers: {
              'Authorization': `Bearer ${settings.accessToken}`
            }
          }
        );

        let savedDate = 'Unknown';
        if (timestampResponse.ok) {
          const timestampData = await timestampResponse.json();
          if (timestampData.values && timestampData.values[0]) {
            savedDate = new Date(timestampData.values[0][0]).toLocaleDateString();
          }
        }

        return {
          found: true,
          rowNumber: i + 1,
          savedDate: savedDate
        };
      }
    }

    return { found: false };
  } catch (error) {
    console.error('Duplicate check error:', error);
    return { found: false };
  }
}

// Append new row to sheet
async function appendRow(data) {
  try {
    const settings = await chrome.storage.local.get(['sheetId', 'sheetName', 'accessToken']);

    if (!settings.accessToken) {
      return { success: false, error: 'Not authenticated' };
    }

    const sheetName = settings.sheetName || 'Sheet1';
    const range = `${sheetName}!A:K`;

    // Format row data according to sheet structure (A-K)
    const rowData = [
      data.timestamp,
      data.name,
      data.headline,
      data.currentCompany,
      data.currentTitle,
      data.location,
      data.country,
      data.about,
      data.profileUrl,
      data.notes,
      data.contactInfo
    ];

    const response = await fetch(
      `${SHEETS_API_BASE}/${settings.sheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${settings.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: [rowData]
        })
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('Append error:', error);
      return { success: false, error: error.error?.message || 'Failed to append row' };
    }

    return { success: true };
  } catch (error) {
    console.error('Append row error:', error);
    return { success: false, error: error.message };
  }
}

// Update existing row
async function updateRow(data, rowNumber) {
  try {
    const settings = await chrome.storage.local.get(['sheetId', 'sheetName', 'accessToken']);

    if (!settings.accessToken) {
      return { success: false, error: 'Not authenticated' };
    }

    const sheetName = settings.sheetName || 'Sheet1';
    const range = `${sheetName}!A${rowNumber}:K${rowNumber}`;

    // Format row data (must match appendRow column order A-K)
    const rowData = [
      data.timestamp,
      data.name,
      data.headline,
      data.currentCompany,
      data.currentTitle,
      data.location,
      data.country,
      data.about,
      data.profileUrl,
      data.notes,
      data.contactInfo
    ];

    const response = await fetch(
      `${SHEETS_API_BASE}/${settings.sheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${settings.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: [rowData]
        })
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('Update error:', error);
      return { success: false, error: error.error?.message || 'Failed to update row' };
    }

    return { success: true };
  } catch (error) {
    console.error('Update row error:', error);
    return { success: false, error: error.message };
  }
}

// Generate AI networking summary via Gemini API
async function generateAISummary(profileData) {
  try {
    const settings = await chrome.storage.local.get(['geminiApiKey', 'userProfileSummary']);

    if (!settings.geminiApiKey) {
      return { success: false, error: 'Gemini API key not configured' };
    }

    const userProfile = settings.userProfileSummary || 'Not provided';

    const prompt = `Given the profile below and MY background, write 2 sentences max on how this person could be helpful to have in my network. Write in third person (e.g. "They could help with..."). Be specific and brief.

MY BACKGROUND: ${userProfile}

THEIR PROFILE:
Name: ${profileData.name || 'N/A'}
Headline: ${profileData.headline || 'N/A'}
Company: ${profileData.currentCompany || 'N/A'}
Title: ${profileData.currentTitle || 'N/A'}
Location: ${profileData.location || 'N/A'}
About: ${profileData.about || 'N/A'}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${settings.geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('Gemini API error:', error);
      return { success: false, error: error.error?.message || 'Gemini API call failed' };
    }

    const result = await response.json();
    const summary = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (summary) {
      return { success: true, summary: summary.trim() };
    } else {
      return { success: false, error: 'No summary generated' };
    }
  } catch (error) {
    console.error('AI summary error:', error);
    return { success: false, error: error.message };
  }
}

// Initialize - create headers if needed
chrome.runtime.onInstalled.addListener(async () => {
  console.log('LinkedIn Profile Extractor installed');
});
