import {
  isValidRule,
  Rule,
  toChromeRule,
  getStaticRules,
  getActiveTab,
} from './utils';
import {StorageUtil} from './storage';

const storage = new StorageUtil();

chrome.runtime.onInstalled.addListener(async () => {
  storage.setTabsEnabled({});
  storage.initRules();
});

chrome.tabs.onActivated.addListener((activeInfo: {tabId: number}) => {
  updateIconPopup(activeInfo.tabId);
});

chrome.tabs.onUpdated.addListener(
  (tabId: number, changeInfo: {status: string}) => {
    // We have to do this (in addition to onActiviated), because Chrome assigns
    // the default icon and popup *after* the tab is activated, just before the
    // tab enters 'complete' status.
    if (changeInfo.status === 'complete') {
      updateIconPopup(tabId);
    }
  }
);

chrome.tabs.onRemoved.addListener((tabId: number) => {
  storage.setTabDisabled(tabId);
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  const ruleUpdateRequired = Object.keys(changes).some(
    key => key === 'rules' || key === 'tabsEnabled'
  );
  if (ruleUpdateRequired) updateRules();

  const iconUpdateRequired = Object.keys(changes).some(
    key => key === 'tabsEnabled'
  );
  if (iconUpdateRequired) updateIconPopup();
});

// Communication channel between service worker and content_script (or popup).
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Note that a content script does not have access to its own tab id.
  // Otherwise we could use `chrome.storage.session.setAccessLevel()` to allow
  // the content script direct access to the storage of enabled tab ids.
  if (request.type === 'isEnabled') {
    // Note that the listener cannot be async, so we cannot await here.
    storage.isTabEnabled(sender.tab?.id).then(isEnabled => {
      sendResponse(isEnabled);
    });
    // Returning `true` tells Chrome that `sendResponse()` will be called async.
    return true;
  }
});

// This is a click on the extension icon.
chrome.action.onClicked.addListener(async (tab: chrome.tabs.Tab) => {
  const isEnabled = await storage.isTabEnabled(tab.id);
  if (isEnabled) {
    await storage.setTabDisabled(tab.id);
  } else {
    await storage.setTabEnabled(tab.id);
    chrome.tabs.reload(tab.id);
  }
});

/**
 * Fetches the user defined rules from the extension storage, translates them
 * to `declarativeNetRequest` rules and registers them. Must be called whenever
 * the rules or the active tabs change.
 */
async function updateRules() {
  const tabIds = Object.keys(await storage.getTabsEnabled()).map(id =>
    Number(id)
  );

  // Start with `staticRules` and then add all `storedRules`.
  const addRules = [...getStaticRules(tabIds)];
  // We are replacing all existing rules. So we can start at 1 every time.
  let ruleId = 1;
  for (const rule of await storage.getRules()) {
    if (rule.disabled || !isValidRule(rule)) continue;
    const chromeRule = toChromeRule(rule, tabIds, ruleId++);
    if (chromeRule) addRules.push(chromeRule);
  }

  // Replacing all existing rules is much easier than updating specific ones.
  const removeRuleIds = (
    await chrome.declarativeNetRequest.getSessionRules()
  ).map(r => r.id);
  await chrome.declarativeNetRequest.updateSessionRules({
    addRules,
    removeRuleIds,
  });
}

/**
 * Update the icon and the popup of the extension depending on whether the
 * extension is enabled for the given tab id. If not tab id is provided, then
 * the active tab is updated.
 *
 * Must be called when the user switches tabs or when the enabled state
 * changes.
 *
 * The icon just changes between gray and green.
 *
 * The popup is either enabled or disabled.
 */
async function updateIconPopup(tabId?: number) {
  if (!tabId) {
    const activeTab = await getActiveTab();
    if (!activeTab.id) return;
    tabId = activeTab.id;
  }
  const isEnabled = await storage.isTabEnabled(tabId);
  if (isEnabled) {
    chrome.action.setIcon({tabId, path: 'icon-32.png'});
    chrome.action.setPopup({tabId, popup: 'popup.html'});
  } else {
    chrome.action.setIcon({tabId, path: 'gray-32.png'});
    chrome.action.setPopup({tabId, popup: ''});
  }
}
