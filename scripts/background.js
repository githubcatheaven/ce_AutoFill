import { StorageManager } from '../lib/storage.js';

const storage = new StorageManager();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Relay: iframe content script asks main page to click submit
  if (message.action === 'clickSubmitInMainPage' && sender.tab) {
    chrome.tabs.sendMessage(sender.tab.id, { action: 'clickSubmit' }, { frameId: 0 })
      .then(r => sendResponse(r))
      .catch(() => sendResponse({ success: false }));
    return true;
  }

  handleMessage(message).then(sendResponse);
  return true;
});

async function handleMessage(message) {
  try {
    switch (message.action) {
      case 'getFormsForUrl':
        return await storage.getFormsForUrl(message.urlPattern);
      case 'getAllForms':
        return await storage.getAllForms();
      case 'saveForm':
        return await storage.saveForm(message.formRecord);
      case 'updateForm':
        return await storage.updateForm(message.id, message.updates);
      case 'deleteForm':
        return await storage.deleteForm(message.id);
      case 'deleteAllForms':
        return await storage.deleteAllForms();
      default:
        return { error: 'Unknown action' };
    }
  } catch (err) {
    return { error: err.message };
  }
}
