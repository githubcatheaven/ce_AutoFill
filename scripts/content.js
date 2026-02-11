// Content script - runs on every page at document_idle
// AutoFillUtils is available from lib/form-utils.js (loaded before this script)

(function () {
  const urlPattern = AutoFillUtils.normalizeUrl(window.location.href);

  // Fetch saved forms for this URL
  chrome.runtime.sendMessage(
    { action: 'getFormsForUrl', urlPattern },
    (forms) => {
      if (chrome.runtime.lastError || !forms) return;

      const autoFillForms = forms.filter(f => f.autoFill);
      const autoSubmitForm = forms.find(f => f.autoConfirm);

      if (autoFillForms.length === 0 && !autoSubmitForm) return;

      // Try immediately
      tick(autoFillForms, autoSubmitForm);

      // Keep polling — covers SPAs where form appears after user action
      let elapsed = 0;
      const timer = setInterval(() => {
        elapsed++;
        tick(autoFillForms, autoSubmitForm);
        if (elapsed >= 60) clearInterval(timer); // 30 seconds at 500ms
      }, 500);
    }
  );

  // Listen for messages from popup (Fill Now)
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'fillForm' && message.fields) {
      const filled = fillFields(message.fields);
      sendResponse({ success: true, filled });
    }
    if (message.action === 'clickSubmit') {
      const clicked = clickSubmitInPage();
      sendResponse({ success: clicked });
    }
  });

  let submitDone = false;

  function tick(autoFillForms, autoSubmitForm) {
    // Step 1: Check if the form fields are actually VISIBLE on the page
    //         If not visible yet (e.g. behind a "Get Started" step), do nothing
    const formReady = areFieldsVisible(autoFillForms);

    if (!formReady) return; // Don't do anything until the form is actually showing

    // Step 2: Form is visible — fill the fields
    if (autoFillForms.length > 0) {
      fillForms(autoFillForms);
    }

    // Step 3: After filling, try to submit (once)
    if (autoSubmitForm && !submitDone) {
      submitDone = true;
      // Delay to let the framework process the filled values
      setTimeout(() => trySubmit(), 1000);
    }
  }

  function isVisible(el) {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  // Check if at least half of the saved form fields are visible on the page
  function areFieldsVisible(autoFillForms) {
    for (const form of autoFillForms) {
      let total = 0;
      let visible = 0;
      for (const field of form.fields) {
        const el = AutoFillUtils.locateField(field);
        if (el) {
          total++;
          if (isVisible(el)) visible++;
        }
      }
      // At least half the fields must be visible to consider the form ready
      if (total > 0 && visible >= Math.ceil(total / 2)) return true;
    }
    return false;
  }

  function trySubmit() {
    // Search for submit button across all accessible documents (iframe support)
    const docs = getSearchDocs();
    console.log('[AutoFill] trySubmit: searching', docs.length, 'document(s), isIframe:', window.top !== window);

    const btn = findSubmitButton(docs);
    if (btn) {
      console.log('[AutoFill] Clicking submit:', btn.tagName, JSON.stringify((btn.innerText || btn.value || '').trim().substring(0, 40)));
      btn.click();
      return;
    }

    // If in iframe and can't access parent, ask background to relay to main page
    if (window.top !== window && docs.length === 1) {
      console.log('[AutoFill] In cross-origin iframe, asking background to click submit');
      chrome.runtime.sendMessage({ action: 'clickSubmitInMainPage' });
      return;
    }

    // Retry a few more times (button may appear with delay)
    let retries = 0;
    const retryTimer = setInterval(() => {
      retries++;
      const btn = findSubmitButton(docs);
      if (btn) {
        console.log('[AutoFill] Clicking submit (retry', retries, '):', btn.tagName, JSON.stringify((btn.innerText || btn.value || '').trim().substring(0, 40)));
        btn.click();
        clearInterval(retryTimer);
      } else if (retries >= 10) {
        console.log('[AutoFill] Could not find submit button after 10 retries');
        clearInterval(retryTimer);
      }
    }, 500);
  }

  function getSearchDocs() {
    const docs = [document];
    try {
      if (window.parent !== window && window.parent.document) {
        docs.push(window.parent.document);
      }
    } catch { /* cross-origin */ }
    try {
      if (window.top !== window && window.top !== window.parent && window.top.document) {
        docs.push(window.top.document);
      }
    } catch { /* cross-origin */ }
    return docs;
  }

  function findSubmitButton(docs) {
    for (const doc of docs) {
      const all = doc.querySelectorAll('button, input[type="submit"], input[type="button"], [role="button"]');

      // Priority 1: Look for "login" / "log in" text
      for (const el of all) {
        const text = (el.innerText || el.value || '').trim();
        if (/log\s*in/i.test(text) && isVisible(el)) return el;
      }

      // Priority 2: input[type="submit"] (skip "get started")
      for (const el of doc.querySelectorAll('input[type="submit"]')) {
        if (isVisible(el) && !/get\s*started/i.test(el.value)) return el;
      }

      // Priority 3: button[type="submit"] (skip "get started")
      for (const el of doc.querySelectorAll('button[type="submit"]')) {
        const text = (el.innerText || '').trim();
        if (isVisible(el) && !/get\s*started/i.test(text)) return el;
      }

      // Priority 4: Other submit-like text (skip "get started")
      const submitWords = /\b(submit|sign.?in|sign.?up|register|continue|next|confirm|send|search|proceed)\b/i;
      for (const el of all) {
        const text = (el.innerText || el.value || '').trim();
        if (/get\s*started/i.test(text)) continue;
        if (submitWords.test(text) && isVisible(el)) return el;
      }
    }
    return null;
  }

  function clickSubmitInPage() {
    const btn = findSubmitButton([document]);
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  }

  function fillForms(forms) {
    let total = 0;
    for (const form of forms) {
      total += fillFields(form.fields);
    }
    return total;
  }

  function fillFields(fields) {
    let filled = 0;
    for (const field of fields) {
      const element = AutoFillUtils.locateField(field);
      if (element) {
        AutoFillUtils.setFieldValue(element, field);
        filled++;
      }
    }
    return filled;
  }
})();
