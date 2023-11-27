import { DEFAULT_RULES, isInjectRule, isValidRule, Operator, Rule } from './utils';

let rules: Rule[] = [...DEFAULT_RULES];

/**
 * We are keeping track of which browser tabs have the extension enabled.
 * We store a map from tab id to tab object in `chrome.storage.session`.
 */
interface TabState {
  tab: chrome.tabs.Tab;
}
async function getTabStates(): Promise<Map<number, TabState>> {
  return (await chrome.storage.session.get('tabStates')) ?? new Map<number, TabState>();
}
async function setTabStates(tabStates: Map<number, TabState>) {
  await chrome.storage.session.set({ tabStates });
}
async function setTabEnabled(tab: chrome.tabs.Tab) {
  const tabStates = await getTabStates();
  tabStates.set(tab.id, { tab });
  await setTabStates(tabStates);
}
async function setTabDisabled(tabId: number) {
  const tabStates = await getTabStates();
  tabStates.delete(tabId);
  await setTabStates(tabStates);
}
async function isTabEnabled(tabId: number) {
  const tabStates = await getTabStates();
  return tabStates.has(tabId);
}

// Load default configs and states when install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(['rules'], (res) => {
    const existingRules: Rule[] = res['rules'] || [];
    const validRules = existingRules.filter(isValidRule);
    if (!validRules.length) {
      chrome.storage.sync.set({ rules });
    } else {
      chrome.storage.sync.set({ rules: validRules });
    }
  });
});

// Check if we should enable or disable the extension when activated tab changed
chrome.tabs.onActivated.addListener(() => {
  checkCurrentTab();
});

// keep a reference to lastFocusedWindow
let lastFocusedWindow: chrome.tabs.Tab;

// Communication channel between background and content_script / popup
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.type === 'updateRules') {
    rules = request.rules;
  } else if (request.type === 'disableHelper') {
    const tab = request.tab || { id: undefined };
    chrome.browserAction.disable(tab.id);
    disableHelper(tab.id);
  } else if (request.type === 'isEnabled') {
    const tab = sender.tab || lastFocusedWindow || { id: undefined };
    const isEnabled = await isTabEnabled(tab.id);
    sendResponse(isEnabled);
  }
});

async function onHeadersReceived(resp: chrome.webRequest.WebResponseHeadersDetails) {
  if (!resp || !resp.responseHeaders) return {};
  const isEnabled = await isTabEnabled(resp.tabId);
  if (!isEnabled) {
    return { responseHeaders: resp.responseHeaders };
  }

  const matches = rules.filter(isValidRule)
    .filter(
      rule => rule.operator === Operator.REMOVE_RESPONSE_HEADER
        && !rule.disabled
        && new RegExp(rule.target).test(resp.url));
  matches.forEach(rule => {
    const removedHeaders = rule.destination.split(",").map(name => name.toLowerCase());
    resp.responseHeaders = resp.responseHeaders
      .filter(h => !removedHeaders.includes(h.name.toLowerCase()));
  });
  const addMatches = rules.filter(isValidRule)
    .filter(
      rule => rule.operator === Operator.ADD_RESPONSE_HEADER
        && !rule.disabled
        && new RegExp(rule.target).test(resp.url));
  addMatches.forEach(rule => {
    const addedHeaders = rule.destination.split("|")
    addedHeaders.forEach(addedHeader => {
      const partial = addedHeader.split("=");
      if (partial.length === 2) {
        resp.responseHeaders.push({
          'name': partial[0],
          'value': partial[1]
        });
      }
    });
  });
  return { responseHeaders: resp.responseHeaders };
}

async function onBeforeRequest(details: chrome.webRequest.WebRequestBodyDetails) {
  const isEnabled = await isTabEnabled(details.tabId);
  if (!isEnabled) {
    return { cancel: false };
  }

  const matches = rules.filter(isValidRule)
    .filter(
      rule => !isInjectRule(rule) && !rule.disabled &&
        new RegExp(rule.target).test(details.url));

  const blockMatch = matches.find(rule => rule.operator === Operator.BLOCK);
  const redirectMatch = matches.find(rule => rule.operator === Operator.REDIRECT);

  // block match takes highest priority
  if (blockMatch) {
    return { cancel: true };
  }

  // then redirect
  if (redirectMatch) {
    return {
      redirectUrl:
        details.url.replace(new RegExp(redirectMatch.target), redirectMatch.destination),
    };
  }

  // otherwise, don't do anything
  return { cancel: false };
}

async function onBeforeSendHeaders(
  details: chrome.webRequest.WebRequestHeadersDetails) {
  if (!details || !details.requestHeaders) return {};
  const isEnabled = await isTabEnabled(details.tabId);
  if (!isEnabled) {
    return { requestHeaders: details.requestHeaders };
  }

  let len = details.requestHeaders.length;
  let added = false;
  while (--len) {
    const header = details.requestHeaders[len];
    if (header.name.toLowerCase() === 'cache-control' ||
      header.name.toLowerCase() === 'x-google-cache-control') {
      header.value = 'max-age=0, no-cache, no-store, must-revalidate';
      added = true;
    }
  }
  if (!added) {
    details.requestHeaders.push({
      'name': 'Cache-Control',
      'value': 'max-age=0, no-cache, no-store, must-revalidate'
    });
  }

  const matches = rules.filter(isValidRule)
    .filter(
      rule => rule.operator === Operator.ADD_REQUEST_HEADER
        && !rule.disabled
        && new RegExp(rule.target).test(details.url));
  matches.forEach(rule => {
    const addedHeaders = rule.destination.split(",")
    addedHeaders.forEach(addedHeader => {
      const partial = addedHeader.split("=");
      if (partial.length === 2) {
        details.requestHeaders.push({
          'name': partial[0],
          'value': partial[1]
        });
      }
    });
  });

  return { requestHeaders: details.requestHeaders };
}

chrome.webRequest.onHeadersReceived.addListener(
  onHeadersReceived, { urls: ['<all_urls>'] },
  ['blocking', 'responseHeaders']);

chrome.webRequest.onBeforeRequest.addListener(
  onBeforeRequest, { urls: ['<all_urls>'] }, ['blocking', 'extraHeaders']);

chrome.webRequest.onBeforeSendHeaders.addListener(
  onBeforeSendHeaders, { urls: ['<all_urls>'] },
  ['blocking', 'requestHeaders']);

async function enableHelper(tab: chrome.tabs.Tab) {
  chrome.browserAction.setIcon({ tabId: tab.id, path: 'icon-32.png' });
  chrome.browserAction.setPopup({ tabId: tab.id, popup: 'popup.html' });
  await setTabEnabled(tab);
}

async function disableHelper(tab: chrome.tabs.Tab) {
  chrome.browserAction.setIcon({ tabId: tab.id, path: 'gray-32.png' });
  chrome.browserAction.setPopup({ tabId: tab.id, popup: '' });
  await setTabDisabled(tab.id);
}

chrome.browserAction.onClicked.addListener(async (tab: chrome.tabs.Tab) => {
  const isEnabled = await isTabEnabled(tab.id);
  if (isEnabled) {
    await disableHelper(tab);
  } else {
    await enableHelper(tab);
    if (lastFocusedWindow) {
      chrome.tabs.update(lastFocusedWindow.id!, { url: lastFocusedWindow.url });
    }
  }
});

// Enable / disable the helper based on state of this tab
// This will be called when tab was activated
async function checkCurrentTab() {
  chrome.tabs.query({ 'active': true, 'lastFocusedWindow': true }, ([tab]) => {
    if (lastFocusedWindow === tab) return;
    if (!tab || !tab.url) return;

    const isEnabled = await isTabEnabled(tab.id);
    if (isEnabled) {
      enableHelper(tab);
    } else {
      disableHelper(tab);
    }

    lastFocusedWindow = tab;

    // read the latest states and rules
    chrome.storage.sync.get(['rules'], (res) => {
      rules = res['rules'] || [];
    });
  });
}

// check this so extension always have the right status
// even after page refreshes / reloads etc
setInterval(() => checkCurrentTab(), 1000);

// when removed, clear
chrome.tabs.onRemoved.addListener(async (tabId: number) => {
  await setTabDisabled(tabId);
});
