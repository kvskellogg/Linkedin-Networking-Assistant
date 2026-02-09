// LinkedIn Profile Extractor - Content Script
// Extracts profile information from LinkedIn profile pages
// User must scroll to bottom of profile before extracting for full data

function extractProfileData() {
  const data = {
    name: '',
    headline: '',
    location: '',
    country: '',
    profileUrl: window.location.href.split('?')[0],
    currentCompany: '',
    currentTitle: '',
    about: '',
    contactInfo: ''
  };

  try {
    const mainEl = document.querySelector('main');
    if (!mainEl) return data;

    const topSection = mainEl.querySelector('section');
    if (!topSection) return data;

    // --- TOP CARD ---
    const nameEl = topSection.querySelector('h2');
    if (nameEl) {
      data.name = nameEl.textContent.trim();
    }

    const allP = [...topSection.querySelectorAll('p')].map(p => p.textContent.trim()).filter(t => t.length > 1);

    for (const text of allP) {
      if (!text.startsWith('\u00B7') && !text.startsWith('·') && text.length > 2) {
        data.headline = text;
        break;
      }
    }

    const innerLines = topSection.innerText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const contactIdx = innerLines.findIndex(l => l === 'Contact info');
    if (contactIdx > 0) {
      data.location = innerLines[contactIdx - 1];
      if (data.location === '·' || data.location === '\u00B7') {
        if (contactIdx > 1) data.location = innerLines[contactIdx - 2];
      }
      const parts = data.location.split(',');
      if (parts.length > 1) {
        data.country = parts[parts.length - 1].trim();
      }
    }

    // --- SECTIONS (About, Experience) ---
    const allSections = document.querySelectorAll('section');

    for (const section of allSections) {
      const heading = section.querySelector('h2') ||
                      section.querySelector('[role="heading"]') ||
                      section.querySelector('h3');
      if (!heading) continue;
      const headingText = heading.textContent.trim().toLowerCase();

      // About
      if (headingText === 'about' && !data.about) {
        const sectionText = section.innerText.trim();
        const headingFull = heading.textContent.trim();
        let aboutText = sectionText;
        if (aboutText.startsWith(headingFull)) {
          aboutText = aboutText.substring(headingFull.length).trim();
        }
        aboutText = aboutText.replace(/\s*(\.\.\.see more|Show less|see more|Show more|…see more|…\s*see more)\s*$/i, '').trim();
        if (aboutText) {
          data.about = aboutText.substring(0, 500);
        }
      }

      // Experience (current role only)
      if (headingText === 'experience' && !data.currentTitle) {
        const expText = section.innerText;
        const lines = expText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const datePattern = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}/;

        for (let i = 0; i < lines.length; i++) {
          if (datePattern.test(lines[i])) {
            const companyLine = lines[i - 1] || '';
            const titleLine = lines[i - 2] || '';

            if (!titleLine || titleLine === 'Experience' ||
                titleLine.includes('Show all') || titleLine.includes('see more')) {
              continue;
            }

            data.currentTitle = titleLine;
            data.currentCompany = companyLine.split('\u00B7')[0].split('·')[0].trim();
            break;
          }
        }
      }
    }

    // Fallback for company from top card
    if (!data.currentCompany && topSection) {
      const companyLink = topSection.querySelector('a[href*="/company/"]');
      if (companyLink) {
        data.currentCompany = companyLink.textContent.trim();
      }
    }

  } catch (error) {
    console.error('LinkedIn Extractor: Error extracting profile data', error);
  }

  return data;
}

// Close the contact info overlay
function closeContactOverlay() {
  const closeBtn = document.querySelector('button[aria-label*="Dismiss"]') ||
                   document.querySelector('button[aria-label*="Close"]') ||
                   document.querySelector('button[aria-label*="dismiss"]') ||
                   document.querySelector('button[aria-label*="close"]');
  if (closeBtn) {
    closeBtn.click();
  } else {
    window.history.back();
  }
}

// Extract structured label:value pairs from a lazy-column's componentkey items
function extractEntriesFromColumn(col) {
  const items = col.querySelectorAll('div[componentkey]');
  if (items.length === 0) return null;

  const entries = [];
  for (const item of items) {
    const paragraphs = item.querySelectorAll('p');
    if (paragraphs.length >= 2) {
      const label = paragraphs[0].textContent.trim();
      const value = paragraphs[1].textContent.trim();
      if (label && value) {
        entries.push(`${label}: ${value}`);
      }
    }
  }
  return entries.length > 0 ? entries.join('\n') : null;
}

// Extract contact info by clicking the Contact info link and reading the overlay
async function extractContactInfo() {
  return new Promise((resolve) => {
    const contactLink = document.querySelector('a[href*="/overlay/contact-info"]') ||
                        [...document.querySelectorAll('a')].find(a => a.textContent.trim() === 'Contact info');

    if (!contactLink) {
      console.log('LinkedIn Extractor: No contact info link found');
      resolve('');
      return;
    }

    // Snapshot all lazy-columns that exist BEFORE clicking so we can ignore them
    const preExisting = new Set(document.querySelectorAll('[data-testid="lazy-column"]'));

    contactLink.click();

    let resolved = false;

    // Look only at NEW lazy-columns added after the click (the overlay)
    function findNewContactColumn() {
      const allColumns = document.querySelectorAll('[data-testid="lazy-column"]');
      for (const col of allColumns) {
        if (preExisting.has(col)) continue;
        const text = extractEntriesFromColumn(col);
        if (text) return text;
      }
      return null;
    }

    const observer = new MutationObserver(() => {
      if (resolved) return;

      const text = findNewContactColumn();
      if (text) {
        resolved = true;
        observer.disconnect();
        setTimeout(() => closeContactOverlay(), 100);
        resolve(text);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Timeout after 5 seconds
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        observer.disconnect();
        const text = findNewContactColumn();
        if (text) {
          closeContactOverlay();
          resolve(text);
        } else {
          window.history.back();
          resolve('');
        }
      }
    }, 5000);
  });
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractProfile') {
    (async () => {
      const profileData = extractProfileData();
      profileData.contactInfo = await extractContactInfo();
      console.log('LinkedIn Extractor: Extracted data', profileData);
      sendResponse({ success: true, data: profileData });
    })();
  }
  return true;
});

console.log('LinkedIn Profile Extractor: Content script loaded');
