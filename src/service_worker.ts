import {isValidRule, Rule, toChromeRule, getStaticRules} from './utils';
import {Storage} from './storage';

const storage = new Storage();

chrome.runtime.onInstalled.addListener(async () => {
  storage.validateRules();
  updateRules();
});
chrome.tabs.onActivated.addListener(() => {
  checkActiveTab();
});
chrome.tabs.onUpdated.addListener(() => {
  checkActiveTab();
});
chrome.tabs.onRemoved.addListener((tabId: number) => {
  disableHelper(tabId);
});
chrome.storage.onChanged.addListener((changes, namespace) => {
  const requiresUpdate = Object.keys(changes).some(
    key => key === 'rules' || key === 'tabsEnabled'
  );
  if (requiresUpdate) updateRules();
});

/**
 * Fetches the user defined rules from the extension storage, translates them
 * to `declarativeNetRequest` rules and registers them. Must be called whenever
 * the rules or the active tabs change.
 */
async function updateRules() {
  const tabIds = Object.keys(await storage.getTabsEnabledAsync()).map(id =>
    Number(id)
  );
  const storedRules: Rule[] = (await storage.getRulesAsync()).filter(
    r => !r.disabled && isValidRule(r)
  );
  const staticRules: chrome.declarativeNetRequest.Rule[] =
    getStaticRules(tabIds);
  const installedRules: chrome.declarativeNetRequest.Rule[] =
    await chrome.declarativeNetRequest.getSessionRules();

  const addRules = [...staticRules];
  let ruleId = 1;
  for (const rule of storedRules) {
    const chromeRule = toChromeRule(rule, tabIds, ruleId++);
    if (chromeRule) addRules.push(chromeRule);
  }
  await chrome.declarativeNetRequest.updateSessionRules({
    addRules,
    removeRuleIds: installedRules.map(r => r.id),
  });
}

// Communication channel between service worker and content_script / popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // An alternative approach to sending a message would be to listen to to
  // storage updates (chrome.storage.onChanged.addListener). Then the popup
  // could just call `storage.setTabDisabled()`, and the service worker would
  // call `disableHelper()` in its event listener.
  if (request.type === 'disableHelper') {
    const tabId = request.tab?.id ?? 0;
    disableHelper(tabId);
  }
  // Note that a content script does not have access to its own tab id.
  if (request.type === 'isEnabled') {
    const activeTabId = storage.getActiveTabIdCached();
    const tabId = sender.tab?.id ?? activeTabId ?? 0;
    const isEnabled = storage.isTabEnabledCached(tabId);
    sendResponse(isEnabled);
  }
});

async function enableHelper(tabId: number) {
  chrome.action.enable(tabId);
  chrome.action.setIcon({tabId, path: 'icon-32.png'});
  chrome.action.setPopup({tabId, popup: 'popup.html'});
  await storage.setTabEnabled(tabId);
}

async function disableHelper(tabId: number) {
  chrome.action.disable(tabId);
  chrome.action.setIcon({tabId, path: 'gray-32.png'});
  chrome.action.setPopup({tabId, popup: ''});
  await storage.setTabDisabled(tabId);
}

chrome.action.onClicked.addListener((tab: chrome.tabs.Tab) => {
  const isEnabled = storage.isTabEnabledCached(tab.id);
  if (isEnabled) {
    disableHelper(tab.id);
  } else {
    enableHelper(tab.id);
    chrome.tabs.reload(tab.id);
  }
});

// Enable / disable the helper (icon and popup.html) based on state of this tab
// This will be called when tab was activated
async function checkActiveTab() {
  const activeTabs = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });
  const activeTab = activeTabs[0];
  const activeTabId = activeTab?.id ?? 0;
  if (!activeTab?.url) return;

  const currentActiveTabId = await storage.getActiveTabIdAsync();
  if (currentActiveTabId === activeTabId) return;

  const isEnabled = storage.isTabEnabledCached(activeTabId);
  if (isEnabled) {
    await enableHelper(activeTabId);
  } else {
    await disableHelper(activeTabId);
  }

  await storage.setActiveTabId(activeTabId);
}

// TODO: Find out whether listening to `chrome.tabs.onActivated/onUpdated` is sufficient.
// Note that 0.5 minutes is the smallest permitted value.
chrome.alarms.create('periodic-check', {periodInMinutes: 0.5});
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'periodic-check') checkActiveTab();
});
