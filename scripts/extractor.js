(function () {
  const SUPPORTED_TAGS = ['INPUT', 'SELECT', 'TEXTAREA'];
  const SKIP_TYPES = ['submit', 'button', 'reset', 'image', 'file', 'hidden'];

  function looksRandom(str) {
    return /[0-9a-f]{8,}/i.test(str) || /^[0-9]+$/.test(str);
  }

  function getFormIndex(element) {
    const form = element.closest('form');
    if (!form) return -1;
    const forms = Array.from(document.querySelectorAll('form'));
    return forms.indexOf(form);
  }

  function generateSelector(element) {
    // Priority 1: ID (if stable)
    if (element.id && !looksRandom(element.id)) {
      return `#${CSS.escape(element.id)}`;
    }

    // Priority 2: name attribute
    if (element.name) {
      const formIndex = getFormIndex(element);
      if (formIndex >= 0) {
        const sel = `form:nth-of-type(${formIndex + 1}) [name="${CSS.escape(element.name)}"]`;
        try {
          if (document.querySelector(sel) === element) return sel;
        } catch { /* fall through */ }
      }
      const sel = `[name="${CSS.escape(element.name)}"]`;
      try {
        if (document.querySelector(sel) === element) return sel;
      } catch { /* fall through */ }
    }

    // Priority 3: Build nth-child path
    return buildNthChildPath(element);
  }

  function buildNthChildPath(element) {
    const parts = [];
    let current = element;
    while (current && current !== document.body && current !== document.documentElement) {
      const parent = current.parentElement;
      if (!parent) break;
      const siblings = Array.from(parent.children);
      const index = siblings.indexOf(current) + 1;
      const tag = current.tagName.toLowerCase();
      parts.unshift(`${tag}:nth-child(${index})`);
      current = parent;
    }
    return parts.join(' > ');
  }

  function humanize(str) {
    return str
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
      .trim();
  }

  function getFieldLabel(element) {
    // 1. Explicit <label for="...">
    if (element.id) {
      const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
      if (label) return label.textContent.trim().replace(/[:\*]$/, '').trim();
    }

    // 2. Parent <label>
    const parentLabel = element.closest('label');
    if (parentLabel) {
      const text = parentLabel.textContent.trim().replace(/[:\*]$/, '').trim();
      if (text) return text;
    }

    // 3. aria-label
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel.trim();

    // 4. Placeholder
    if (element.placeholder) return element.placeholder.trim();

    // 5. Name attribute, humanized
    if (element.name) return humanize(element.name);

    // 6. Type as last resort
    if (element.type) return humanize(element.type);

    return 'Unknown field';
  }

  function getFieldValue(element) {
    const type = (element.type || '').toLowerCase();

    if (type === 'checkbox' || type === 'radio') {
      return element.checked;
    }

    if (element.tagName === 'SELECT') {
      return element.value;
    }

    return element.value || '';
  }

  function isFieldVisible(element) {
    if (element.type === 'hidden') return false;
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  }

  function findSubmitButton() {
    // 1. <input type="submit"> or <button type="submit">
    const submitInputs = document.querySelectorAll(
      'input[type="submit"], button[type="submit"]'
    );
    for (const el of submitInputs) {
      if (isFieldVisible(el)) return generateSelector(el);
    }

    // 2. <button> inside a <form> without explicit type (defaults to submit)
    const formButtons = document.querySelectorAll('form button:not([type])');
    for (const el of formButtons) {
      if (isFieldVisible(el)) return generateSelector(el);
    }

    // 3. Any clickable element with submit-like text
    const allButtons = document.querySelectorAll(
      'button, [role="button"], input[type="button"], a.btn, a.button, [class*="btn"], [class*="button"], [class*="submit"]'
    );
    const submitWords = /^(submit|log\s?in|sign\s?in|sign\s?up|register|continue|next|confirm|send|go|enter|ok|search|book|get\s+started|proceed|start)$/i;
    for (const el of allButtons) {
      const text = (el.textContent || el.value || '').trim();
      if (submitWords.test(text) && isFieldVisible(el)) {
        return generateSelector(el);
      }
    }

    return null;
  }

  function extractFields() {
    const fields = [];
    const seen = new Set();

    // Gather all form fields (inside forms + orphans)
    const elements = document.querySelectorAll('input, select, textarea');

    for (const el of elements) {
      // Skip unsupported types
      const type = (el.type || '').toLowerCase();
      if (SKIP_TYPES.includes(type)) continue;

      // Skip invisible fields
      if (!isFieldVisible(el)) continue;

      // Skip duplicates
      if (seen.has(el)) continue;
      seen.add(el);

      fields.push({
        selector: generateSelector(el),
        name: el.name || '',
        id: el.id || '',
        type: el.tagName === 'SELECT' ? 'select-one' : (el.type || 'text'),
        label: getFieldLabel(el),
        value: getFieldValue(el),
        formIndex: getFormIndex(el)
      });
    }

    return { fields, submitSelector: findSubmitButton() };
  }

  return extractFields();
})();
