var AutoFillUtils = (function () {
  function normalizeUrl(url) {
    try {
      const parsed = new URL(url);
      return parsed.origin + parsed.pathname;
    } catch {
      return url;
    }
  }

  function locateField(field) {
    // 1. Try stored CSS selector
    try {
      const el = document.querySelector(field.selector);
      if (el) return el;
    } catch { /* invalid selector */ }

    // 2. Try by ID
    if (field.id) {
      const el = document.getElementById(field.id);
      if (el) return el;
    }

    // 3. Try by name within the same form
    if (field.name) {
      const forms = document.querySelectorAll('form');
      if (field.formIndex >= 0 && forms[field.formIndex]) {
        const el = forms[field.formIndex].querySelector(`[name="${CSS.escape(field.name)}"]`);
        if (el) return el;
      }
    }

    // 4. Try by name anywhere on page
    if (field.name) {
      const el = document.querySelector(`[name="${CSS.escape(field.name)}"]`);
      if (el) return el;
    }

    return null;
  }

  function setFieldValue(element, field) {
    const type = field.type;

    if (type === 'checkbox' || type === 'radio') {
      element.checked = !!field.value;
    } else {
      // Use native setter for React/Vue compatibility
      const descriptor = Object.getOwnPropertyDescriptor(
        type === 'select-one' || type === 'select-multiple'
          ? HTMLSelectElement.prototype
          : type === 'textarea'
            ? HTMLTextAreaElement.prototype
            : HTMLInputElement.prototype,
        'value'
      );
      if (descriptor && descriptor.set) {
        descriptor.set.call(element, field.value);
      } else {
        element.value = field.value;
      }
    }

    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  function generateFormId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `form_${timestamp}_${random}`;
  }

  return { normalizeUrl, locateField, setFieldValue, generateFormId };
})();
