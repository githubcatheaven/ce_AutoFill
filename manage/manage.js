document.addEventListener('DOMContentLoaded', init);

let allForms = [];

async function init() {
  document.getElementById('searchInput').addEventListener('input', handleSearch);
  document.getElementById('exportBtn').addEventListener('click', handleExport);
  document.getElementById('importFile').addEventListener('change', handleImport);
  document.getElementById('deleteAllBtn').addEventListener('click', handleDeleteAll);

  await loadForms();
}

async function loadForms() {
  allForms = await chrome.runtime.sendMessage({ action: 'getAllForms' });
  if (!Array.isArray(allForms)) allForms = [];
  renderForms(allForms);
}

function handleSearch(e) {
  const query = e.target.value.toLowerCase().trim();
  if (!query) {
    renderForms(allForms);
    return;
  }
  const filtered = allForms.filter(f =>
    f.title.toLowerCase().includes(query) ||
    f.url.toLowerCase().includes(query) ||
    f.urlPattern.toLowerCase().includes(query) ||
    f.fields.some(field => field.label.toLowerCase().includes(query))
  );
  renderForms(filtered);
}

function renderForms(forms) {
  const container = document.getElementById('formGroups');
  const emptyState = document.getElementById('emptyState');

  if (!forms || forms.length === 0) {
    container.innerHTML = '';
    emptyState.style.display = 'flex';
    return;
  }

  emptyState.style.display = 'none';

  // Group by urlPattern
  const groups = {};
  for (const form of forms) {
    if (!groups[form.urlPattern]) {
      groups[form.urlPattern] = [];
    }
    groups[form.urlPattern].push(form);
  }

  container.innerHTML = Object.entries(groups).map(([url, groupForms]) => `
    <div class="url-group">
      <div class="url-group-header">
        <span class="url-group-url" title="${escapeHtml(url)}">${escapeHtml(url)}</span>
        <span class="url-group-count">${groupForms.length} form${groupForms.length !== 1 ? 's' : ''}</span>
      </div>
      ${groupForms.map(form => renderFormItem(form)).join('')}
    </div>
  `).join('');

  bindEvents();
}

function renderFormItem(form) {
  const fieldCount = form.fields ? form.fields.length : 0;
  const date = new Date(form.updatedAt).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric'
  });

  return `
    <div class="form-item" data-id="${form.id}">
      <div class="form-item-header">
        <span class="form-item-title" contenteditable="true" spellcheck="false">${escapeHtml(form.title)}</span>
        <span class="form-item-meta">${fieldCount} field${fieldCount !== 1 ? 's' : ''} &middot; ${date}</span>
      </div>
      <div class="form-item-actions">
        <button class="action-btn fill-btn toggle-fields-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
          Fields
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
      <div class="fields-panel" style="display:none;">
        <div class="fields-panel-header">
          <span class="fields-panel-title">Form Fields</span>
          <button class="btn btn-outline btn-sm save-fields-btn">Save Changes</button>
        </div>
        ${form.fields.map((field, i) => `
          <div class="field-row" data-field-index="${i}">
            <span class="field-label" title="${escapeHtml(field.label)}">${escapeHtml(field.label)}</span>
            ${field.type === 'password'
              ? `<input type="password" class="field-value" value="${escapeHtml(String(field.value))}" data-field-index="${i}">`
              : field.type === 'checkbox' || field.type === 'radio'
                ? `<label class="toggle" style="width:36px;height:20px;"><input type="checkbox" class="field-value-check" ${field.value ? 'checked' : ''} data-field-index="${i}"><span class="slider"></span></label>`
                : `<input type="text" class="field-value" value="${escapeHtml(String(field.value))}" data-field-index="${i}">`
            }
            <span class="field-type">${escapeHtml(field.type)}</span>
            ${field.type === 'password' ? '<span class="password-badge">password</span>' : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function bindEvents() {
  document.querySelectorAll('.form-item').forEach(item => {
    const id = item.dataset.id;
    const form = allForms.find(f => f.id === id);
    if (!form) return;

    // Rename
    const titleEl = item.querySelector('.form-item-title');
    titleEl.addEventListener('blur', async () => {
      const newTitle = titleEl.textContent.trim();
      if (newTitle && newTitle !== form.title) {
        await chrome.runtime.sendMessage({
          action: 'updateForm', id, updates: { title: newTitle }
        });
        form.title = newTitle;
        showToast('Title updated');
      }
    });
    titleEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); titleEl.blur(); }
      if (e.key === 'Escape') { titleEl.textContent = form.title; titleEl.blur(); }
    });

    // Toggle auto-fill (button)
    const autoBtn = item.querySelector('.auto-btn');
    autoBtn.addEventListener('click', async () => {
      const newState = !form.autoFill;
      form.autoFill = newState;
      await chrome.runtime.sendMessage({
        action: 'updateForm', id, updates: { autoFill: newState }
      });
      autoBtn.classList.toggle('active', newState);
      autoBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
        Auto ${newState ? 'ON' : 'OFF'}
      `;
      showToast(newState ? 'Auto-fill enabled' : 'Auto-fill disabled');
    });

    // Toggle auto-submit (button)
    const submitBtn = item.querySelector('.submit-btn');
    submitBtn.addEventListener('click', async () => {
      const newState = !form.autoConfirm;
      form.autoConfirm = newState;
      await chrome.runtime.sendMessage({
        action: 'updateForm', id, updates: { autoConfirm: newState }
      });
      submitBtn.classList.toggle('active', newState);
      submitBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        Submit ${newState ? 'ON' : 'OFF'}
      `;
      showToast(newState ? 'Auto-submit enabled' : 'Auto-submit disabled');
    });

    // Toggle fields panel
    const fieldsBtn = item.querySelector('.toggle-fields-btn');
    const fieldsPanel = item.querySelector('.fields-panel');
    fieldsBtn.addEventListener('click', () => {
      const visible = fieldsPanel.style.display !== 'none';
      fieldsPanel.style.display = visible ? 'none' : 'block';
    });

    // Save field changes
    const saveFieldsBtn = item.querySelector('.save-fields-btn');
    saveFieldsBtn.addEventListener('click', async () => {
      const updatedFields = [...form.fields];

      item.querySelectorAll('.field-value').forEach(input => {
        const idx = parseInt(input.dataset.fieldIndex);
        updatedFields[idx] = { ...updatedFields[idx], value: input.value };
      });

      item.querySelectorAll('.field-value-check').forEach(input => {
        const idx = parseInt(input.dataset.fieldIndex);
        updatedFields[idx] = { ...updatedFields[idx], value: input.checked };
      });

      await chrome.runtime.sendMessage({
        action: 'updateForm', id, updates: { fields: updatedFields }
      });
      form.fields = updatedFields;
      showToast('Fields updated');
    });

    // Delete
    const deleteBtn = item.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', () => {
      showConfirm(
        'Delete Form',
        `Are you sure you want to delete "${escapeHtml(form.title)}"?`,
        async () => {
          await chrome.runtime.sendMessage({ action: 'deleteForm', id });
          showToast('Form deleted');
          await loadForms();
        }
      );
    });
  });
}

// Export
async function handleExport() {
  const forms = await chrome.runtime.sendMessage({ action: 'getAllForms' });
  const data = JSON.stringify(forms, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `autofill-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Exported successfully');
}

// Import
async function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const imported = JSON.parse(text);

    if (!Array.isArray(imported)) {
      showToast('Invalid file format', true);
      return;
    }

    // Validate basic structure
    for (const form of imported) {
      if (!form.id || !form.urlPattern || !form.fields) {
        showToast('Invalid form data in file', true);
        return;
      }
    }

    // Save each form
    let count = 0;
    for (const form of imported) {
      await chrome.runtime.sendMessage({ action: 'saveForm', formRecord: form });
      count++;
    }

    showToast(`Imported ${count} form${count !== 1 ? 's' : ''}`);
    await loadForms();
  } catch {
    showToast('Failed to import file', true);
  }

  // Reset file input
  e.target.value = '';
}

// Delete All
function handleDeleteAll() {
  if (allForms.length === 0) {
    showToast('No forms to delete');
    return;
  }

  showConfirm(
    'Delete All Forms',
    `This will permanently delete all ${allForms.length} saved form${allForms.length !== 1 ? 's' : ''}. This cannot be undone.`,
    async () => {
      await chrome.runtime.sendMessage({ action: 'deleteAllForms' });
      showToast('All forms deleted');
      await loadForms();
    }
  );
}

// Confirm modal
function showConfirm(title, message, onConfirm) {
  const overlay = document.getElementById('confirmModal');
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMessage').textContent = message;
  overlay.style.display = 'flex';

  const cancel = document.getElementById('confirmCancel');
  const ok = document.getElementById('confirmOk');

  function cleanup() {
    overlay.style.display = 'none';
    cancel.removeEventListener('click', handleCancel);
    ok.removeEventListener('click', handleOk);
    overlay.removeEventListener('click', handleOverlay);
  }

  function handleCancel() { cleanup(); }
  function handleOk() { cleanup(); onConfirm(); }
  function handleOverlay(e) { if (e.target === overlay) cleanup(); }

  cancel.addEventListener('click', handleCancel);
  ok.addEventListener('click', handleOk);
  overlay.addEventListener('click', handleOverlay);
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
  toast.offsetHeight; // Force reflow
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}
