document.addEventListener('DOMContentLoaded', init);

let currentUrlPattern = '';

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentUrlPattern = normalizeUrl(tab.url);

  document.getElementById('saveBtn').addEventListener('click', () => handleSave(tab));
  document.getElementById('openManage').addEventListener('click', openManagePage);
  document.getElementById('manageLink').addEventListener('click', openManagePage);

  await loadForms();
}

function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.origin + parsed.pathname;
  } catch {
    return url;
  }
}

function generateFormId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `form_${timestamp}_${random}`;
}

async function loadForms() {
  const forms = await chrome.runtime.sendMessage({
    action: 'getFormsForUrl',
    urlPattern: currentUrlPattern
  });

  const listEl = document.getElementById('formsList');
  const emptyEl = document.getElementById('emptyState');

  if (!forms || forms.length === 0) {
    listEl.innerHTML = '';
    emptyEl.style.display = 'flex';
    return;
  }

  emptyEl.style.display = 'none';
  listEl.innerHTML = forms.map(form => renderFormCard(form)).join('');

  // Bind events
  listEl.querySelectorAll('.form-card').forEach(card => {
    const id = card.dataset.id;
    const form = forms.find(f => f.id === id);

    // Rename
    const titleEl = card.querySelector('.form-title');
    titleEl.addEventListener('blur', () => handleRename(id, titleEl.textContent.trim()));
    titleEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); titleEl.blur(); }
      if (e.key === 'Escape') { titleEl.textContent = form.title; titleEl.blur(); }
    });

    // Fill now
    card.querySelector('.fill-btn').addEventListener('click', () => handleFill(form));

    // Toggle auto-fill (button)
    const autoBtn = card.querySelector('.auto-btn');
    autoBtn.addEventListener('click', async () => {
      const newState = !form.autoFill;
      form.autoFill = newState;
      await handleToggle(id, newState);
      autoBtn.classList.toggle('active', newState);
      autoBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
        Auto ${newState ? 'ON' : 'OFF'}
      `;
    });

    // Toggle auto-submit (button)
    const submitBtn = card.querySelector('.submit-btn');
    submitBtn.addEventListener('click', async () => {
      const newState = !form.autoConfirm;
      form.autoConfirm = newState;
      await chrome.runtime.sendMessage({
        action: 'updateForm', id,
        updates: { autoConfirm: newState }
      });
      submitBtn.classList.toggle('active', newState);
      submitBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        Submit ${newState ? 'ON' : 'OFF'}
      `;
      showToast(newState ? 'Auto-submit enabled' : 'Auto-submit disabled');
    });

    // Delete
    card.querySelector('.delete-btn').addEventListener('click', () => handleDelete(id));
  });
}

function renderFormCard(form) {
  const fieldCount = form.fields ? form.fields.length : 0;
  const date = new Date(form.updatedAt).toLocaleDateString();

  return `
    <div class="form-card" data-id="${form.id}">
      <div class="form-card-header">
        <span class="form-title" contenteditable="true" spellcheck="false">${escapeHtml(form.title)}</span>
        <span class="form-info">${fieldCount} field${fieldCount !== 1 ? 's' : ''} &middot; ${date}</span>
      </div>
      <div class="form-actions">
        <button class="action-btn fill-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          Fill
        </button>
        <button class="action-btn auto-btn ${form.autoFill ? 'active' : ''}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
          Auto ${form.autoFill ? 'ON' : 'OFF'}
        </button>
        <button class="action-btn submit-btn ${form.autoConfirm ? 'active' : ''}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          Submit ${form.autoConfirm ? 'ON' : 'OFF'}
        </button>
        <button class="action-btn delete-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          Delete
        </button>
      </div>
    </div>
  `;
}

async function handleSave(tab) {
  const saveBtn = document.getElementById('saveBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['scripts/extractor.js']
    });

    const extracted = results[0]?.result;
    if (!extracted || !extracted.fields || extracted.fields.length === 0) {
      showToast('No form fields found on this page', true);
      return;
    }

    const formRecord = {
      id: generateFormId(),
      url: tab.url,
      urlPattern: currentUrlPattern,
      title: tab.title || `Form on ${new URL(tab.url).hostname}`,
      autoFill: false,
      autoConfirm: false,
      submitSelector: extracted.submitSelector || null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      fields: extracted.fields
    };

    const response = await chrome.runtime.sendMessage({
      action: 'saveForm',
      formRecord
    });

    if (response.success) {
      saveBtn.classList.add('success');
      saveBtn.textContent = 'Saved!';
      setTimeout(() => {
        saveBtn.classList.remove('success');
      }, 1500);
      showToast('Form saved successfully');
      await loadForms();
    } else {
      showToast('Failed to save form', true);
    }
  } catch (err) {
    showToast('Cannot access this page', true);
  } finally {
    setTimeout(() => {
      saveBtn.disabled = false;
      saveBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
        </svg>
        Save Current Page Forms
      `;
    }, 1500);
  }
}

async function handleToggle(id, enabled) {
  await chrome.runtime.sendMessage({
    action: 'updateForm',
    id,
    updates: { autoFill: enabled }
  });
  showToast(enabled ? 'Auto-fill enabled' : 'Auto-fill disabled');
}

async function handleRename(id, newTitle) {
  if (!newTitle) return;
  await chrome.runtime.sendMessage({
    action: 'updateForm',
    id,
    updates: { title: newTitle }
  });
}

async function handleFill(form) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    await chrome.tabs.sendMessage(tab.id, {
      action: 'fillForm',
      fields: form.fields
    });
    showToast('Form filled');
  } catch {
    showToast('Could not fill form on this page', true);
  }
}

async function handleDelete(id) {
  const response = await chrome.runtime.sendMessage({
    action: 'deleteForm',
    id
  });
  if (response.success) {
    showToast('Form deleted');
    await loadForms();
  }
}

function openManagePage() {
  chrome.tabs.create({ url: chrome.runtime.getURL('manage/manage.html') });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast' + (isError ? ' error' : '');
  // Force reflow
  toast.offsetHeight;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}
