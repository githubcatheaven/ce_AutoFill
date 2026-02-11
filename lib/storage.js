export class StorageManager {
  async _getData() {
    const result = await chrome.storage.local.get('savedForms');
    return result.savedForms || {};
  }

  async _setData(forms) {
    await chrome.storage.local.set({ savedForms: forms });
  }

  async getFormsForUrl(urlPattern) {
    const forms = await this._getData();
    return Object.values(forms).filter(f => f.urlPattern === urlPattern);
  }

  async getAllForms() {
    const forms = await this._getData();
    return Object.values(forms).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async saveForm(formRecord) {
    const forms = await this._getData();
    forms[formRecord.id] = formRecord;
    await this._setData(forms);
    return { success: true, id: formRecord.id };
  }

  async updateForm(id, updates) {
    const forms = await this._getData();
    if (!forms[id]) return { success: false, error: 'Not found' };
    forms[id] = { ...forms[id], ...updates, updatedAt: Date.now() };
    await this._setData(forms);
    return { success: true };
  }

  async deleteForm(id) {
    const forms = await this._getData();
    if (!forms[id]) return { success: false, error: 'Not found' };
    delete forms[id];
    await this._setData(forms);
    return { success: true };
  }

  async deleteAllForms() {
    await this._setData({});
    return { success: true };
  }
}
