// LinkedIn Profile Extractor - Popup Script

let currentProfileData = null;
let existingRowNumber = null;

// DOM Elements
const elements = {
  settingsBtn: document.getElementById('settingsBtn'),
  settingsPanel: document.getElementById('settingsPanel'),
  mainPanel: document.getElementById('mainPanel'),
  notLinkedIn: document.getElementById('notLinkedIn'),
  scrollReminder: document.getElementById('scrollReminder'),
  profileData: document.getElementById('profileData'),
  duplicateWarning: document.getElementById('duplicateWarning'),
  loading: document.getElementById('loading'),
  status: document.getElementById('status'),

  // Settings
  clientId: document.getElementById('clientId'),
  sheetId: document.getElementById('sheetId'),
  sheetName: document.getElementById('sheetName'),
  geminiApiKey: document.getElementById('geminiApiKey'),
  userProfileSummary: document.getElementById('userProfileSummary'),
  saveSettings: document.getElementById('saveSettings'),
  authBtn: document.getElementById('authBtn'),
  authStatus: document.getElementById('authStatus'),

  // Profile display
  profileName: document.getElementById('profileName'),
  profileHeadline: document.getElementById('profileHeadline'),
  currentRole: document.getElementById('currentRole'),
  currentCompany: document.getElementById('currentCompany'),
  profileLocation: document.getElementById('profileLocation'),
  profileAbout: document.getElementById('profileAbout'),
  contactInfo: document.getElementById('contactInfo'),
  aiIndicator: document.getElementById('aiIndicator'),
  notes: document.getElementById('notes'),

  // Buttons
  extractBtn: document.getElementById('extractBtn'),
  saveBtn: document.getElementById('saveBtn'),
  updateBtn: document.getElementById('updateBtn'),
  cancelBtn: document.getElementById('cancelBtn'),
  duplicateInfo: document.getElementById('duplicateInfo')
};

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await checkCurrentTab();
});

// Load saved settings
async function loadSettings() {
  const settings = await chrome.storage.local.get(['clientId', 'sheetId', 'sheetName', 'accessToken', 'geminiApiKey', 'userProfileSummary']);
  if (settings.clientId) elements.clientId.value = settings.clientId;
  if (settings.sheetId) elements.sheetId.value = settings.sheetId;
  if (settings.sheetName) elements.sheetName.value = settings.sheetName;
  if (settings.geminiApiKey) elements.geminiApiKey.value = settings.geminiApiKey;
  if (settings.userProfileSummary) elements.userProfileSummary.value = settings.userProfileSummary;

  if (settings.accessToken) {
    elements.authStatus.textContent = 'Authenticated';
    elements.authStatus.className = 'status success';
    elements.authStatus.classList.remove('hidden');
  }
}

// Check if we're on a LinkedIn profile page
async function checkCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab.url && tab.url.includes('linkedin.com/in/')) {
      elements.notLinkedIn.classList.add('hidden');
      elements.scrollReminder.classList.remove('hidden');
      elements.profileData.classList.remove('hidden');
      await extractProfile();
    } else {
      elements.notLinkedIn.classList.remove('hidden');
      elements.profileData.classList.add('hidden');
    }
  } catch (error) {
    showStatus('Error checking current tab', 'error');
  }
}

// Extract profile data from LinkedIn page
async function extractProfile() {
  showLoading(true);

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractProfile' });

    if (response && response.success) {
      currentProfileData = response.data;
      displayProfileData(currentProfileData);

      // Check for duplicates
      await checkForDuplicate(currentProfileData.profileUrl);

      // Generate AI summary (non-blocking)
      generateAINotesIfConfigured(currentProfileData);
    } else {
      showStatus('Failed to extract profile data. Try refreshing the page.', 'error');
    }
  } catch (error) {
    console.error('Extract error:', error);
    showStatus('Error: Content script not loaded. Refresh the LinkedIn page.', 'error');
  }

  showLoading(false);
}

// Display extracted profile data
function displayProfileData(data) {
  elements.profileName.textContent = data.name || '-';
  elements.profileHeadline.textContent = data.headline || '-';
  elements.currentRole.textContent = data.currentTitle || '-';
  elements.currentCompany.textContent = data.currentCompany || '-';
  elements.profileLocation.textContent = `${data.location || '-'}`;
  elements.profileAbout.textContent = data.about || '-';
  elements.contactInfo.textContent = data.contactInfo || '-';
}

// Generate AI summary if Gemini is configured
async function generateAINotesIfConfigured(profileData) {
  const settings = await chrome.storage.local.get(['geminiApiKey', 'userProfileSummary']);

  if (!settings.geminiApiKey) {
    return; // AI not configured, skip silently
  }

  // Show indicator
  elements.aiIndicator.classList.remove('hidden');

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'generateAISummary',
      profileData: profileData
    });

    if (response && response.success) {
      elements.notes.value = response.summary;
    } else {
      showStatus('AI summary failed: ' + (response?.error || 'Unknown error'), 'error');
    }
  } catch (error) {
    showStatus('AI summary error: ' + error.message, 'error');
  }

  // Hide indicator
  elements.aiIndicator.classList.add('hidden');
}

// Check for duplicate entry
async function checkForDuplicate(profileUrl) {
  const settings = await chrome.storage.local.get(['sheetId', 'sheetName', 'accessToken']);

  if (!settings.accessToken || !settings.sheetId) {
    return; // Can't check without auth
  }

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'checkDuplicate',
      profileUrl: profileUrl
    });

    if (response && response.found) {
      existingRowNumber = response.rowNumber;
      elements.duplicateInfo.textContent = `Saved on: ${response.savedDate} (Row ${response.rowNumber})`;
      elements.duplicateWarning.classList.remove('hidden');
      elements.saveBtn.classList.add('hidden');
    } else {
      elements.duplicateWarning.classList.add('hidden');
      elements.saveBtn.classList.remove('hidden');
    }
  } catch (error) {
    console.error('Duplicate check error:', error);
  }
}

// Save to Google Sheet
async function saveToSheet(isUpdate = false) {
  const settings = await chrome.storage.local.get(['clientId', 'sheetId', 'accessToken']);

  if (!settings.clientId || !settings.sheetId) {
    showStatus('Please configure settings first', 'error');
    toggleSettings(true);
    return;
  }

  if (!settings.accessToken) {
    showStatus('Please authenticate with Google first', 'error');
    toggleSettings(true);
    return;
  }

  if (!currentProfileData) {
    showStatus('No profile data to save', 'error');
    return;
  }

  showLoading(true);

  try {
    const dataToSave = {
      ...currentProfileData,
      notes: elements.notes.value,
      timestamp: new Date().toISOString()
    };

    const response = await chrome.runtime.sendMessage({
      action: isUpdate ? 'updateRow' : 'appendRow',
      data: dataToSave,
      rowNumber: existingRowNumber
    });

    if (response && response.success) {
      showStatus(isUpdate ? 'Profile updated successfully!' : 'Profile saved successfully!', 'success');
      elements.duplicateWarning.classList.add('hidden');
      elements.saveBtn.classList.remove('hidden');
    } else {
      showStatus(response?.error || 'Failed to save', 'error');
    }
  } catch (error) {
    console.error('Save error:', error);
    showStatus('Error saving to sheet: ' + error.message, 'error');
  }

  showLoading(false);
}

// Toggle settings panel
function toggleSettings(show) {
  if (show === undefined) {
    show = elements.settingsPanel.classList.contains('hidden');
  }

  if (show) {
    elements.settingsPanel.classList.remove('hidden');
    elements.mainPanel.classList.add('hidden');
  } else {
    elements.settingsPanel.classList.add('hidden');
    elements.mainPanel.classList.remove('hidden');
  }
}

// Save settings
async function saveSettingsHandler() {
  const clientId = elements.clientId.value.trim();
  const sheetId = elements.sheetId.value.trim();
  const sheetName = elements.sheetName.value.trim() || 'Sheet1';
  const geminiApiKey = elements.geminiApiKey.value.trim();
  const userProfileSummary = elements.userProfileSummary.value.trim();

  if (!clientId || !sheetId) {
    showStatus('Please fill in Client ID and Sheet ID', 'error');
    return;
  }

  await chrome.storage.local.set({ clientId, sheetId, sheetName, geminiApiKey, userProfileSummary });
  showStatus('Settings saved!', 'success');
}

// Authenticate with Google
async function authenticate() {
  showLoading(true);

  try {
    const response = await chrome.runtime.sendMessage({ action: 'authenticate' });

    if (response && response.success) {
      elements.authStatus.textContent = 'Authenticated successfully!';
      elements.authStatus.className = 'status success';
      showStatus('Authenticated with Google!', 'success');
    } else {
      elements.authStatus.textContent = 'Authentication failed';
      elements.authStatus.className = 'status error';
      showStatus(response?.error || 'Authentication failed', 'error');
    }
  } catch (error) {
    console.error('Auth error:', error);
    showStatus('Authentication error: ' + error.message, 'error');
  }

  elements.authStatus.classList.remove('hidden');
  showLoading(false);
}

// UI Helpers
function showLoading(show) {
  if (show) {
    elements.loading.classList.remove('hidden');
  } else {
    elements.loading.classList.add('hidden');
  }
}

function showStatus(message, type) {
  elements.status.textContent = message;
  elements.status.className = `status ${type}`;
  elements.status.classList.remove('hidden');

  setTimeout(() => {
    elements.status.classList.add('hidden');
  }, 5000);
}

// Event Listeners
elements.settingsBtn.addEventListener('click', () => toggleSettings());
elements.saveSettings.addEventListener('click', saveSettingsHandler);
elements.authBtn.addEventListener('click', authenticate);
elements.extractBtn.addEventListener('click', extractProfile);
elements.saveBtn.addEventListener('click', () => saveToSheet(false));
elements.updateBtn.addEventListener('click', () => saveToSheet(true));
elements.cancelBtn.addEventListener('click', () => {
  elements.duplicateWarning.classList.add('hidden');
  elements.saveBtn.classList.remove('hidden');
});
