import {isInjectRule, isValidRule, Operator, Rule} from './utils';
import {Storage} from './storage';

const storage = new Storage();

chrome.runtime.onInstalled.addListener(() => {
  storage.validateRules();
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

// Communication channel between service worker and content_script / popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'disableHelper') {
    const tabId = request.tab?.id ?? 0;
    disableHelper(tabId);
  }
  if (request.type === 'isEnabled') {
    const activeTabId = storage.getActiveTabIdCached();
    const tabId = sender.tab?.id ?? activeTabId ?? 0;
    const isEnabled = storage.isTabEnabledCached(tabId);
    sendResponse(isEnabled);
  }
});

function onHeadersReceived(resp: chrome.webRequest.WebResponseHeadersDetails) {
  if (!resp || !resp.responseHeaders) return {};
  const isEnabled = storage.isTabEnabledCached(resp.tabId);
  if (!isEnabled) {
    return {responseHeaders: resp.responseHeaders};
  }

  const matches = storage
    .getRulesCached()
    .filter(isValidRule)
    .filter(
      rule =>
        rule.operator === Operator.REMOVE_RESPONSE_HEADER &&
        !rule.disabled &&
        new RegExp(rule.target).test(resp.url)
    );
  matches.forEach(rule => {
    const removedHeaders = rule.destination
      .split(',')
      .map(name => name.toLowerCase());
    resp.responseHeaders = resp.responseHeaders.filter(
      h => !removedHeaders.includes(h.name.toLowerCase())
    );
  });
  const addMatches = storage
    .getRulesCached()
    .filter(isValidRule)
    .filter(
      rule =>
        rule.operator === Operator.ADD_RESPONSE_HEADER &&
        !rule.disabled &&
        new RegExp(rule.target).test(resp.url)
    );
  addMatches.forEach(rule => {
    const addedHeaders = rule.destination.split('|');
    addedHeaders.forEach(addedHeader => {
      const partial = addedHeader.split('=');
      if (partial.length === 2) {
        resp.responseHeaders.push({
          name: partial[0],
          value: partial[1],
        });
      }
    });
  });
  return {responseHeaders: resp.responseHeaders};
}

function onBeforeRequest(details: chrome.webRequest.WebRequestBodyDetails) {
  const isEnabled = storage.isTabEnabledCached(details.tabId);
  if (!isEnabled) {
    return {cancel: false};
  }

  const matches = storage
    .getRulesCached()
    .filter(isValidRule)
    .filter(
      rule =>
        !isInjectRule(rule) &&
        !rule.disabled &&
        new RegExp(rule.target).test(details.url)
    );

  const blockMatch = matches.find(rule => rule.operator === Operator.BLOCK);
  const redirectMatch = matches.find(
    rule => rule.operator === Operator.REDIRECT
  );

  // block match takes highest priority
  if (blockMatch) {
    return {cancel: true};
  }

  // then redirect
  if (redirectMatch) {
    return {
      redirectUrl: details.url.replace(
        new RegExp(redirectMatch.target),
        redirectMatch.destination
      ),
    };
  }

  // otherwise, don't do anything
  return {cancel: false};
}

function onBeforeSendHeaders(
  details: chrome.webRequest.WebRequestHeadersDetails
) {
  if (!details || !details.requestHeaders) return {};
  const isEnabled = storage.isTabEnabledCached(details.tabId);
  if (!isEnabled) {
    return {requestHeaders: details.requestHeaders};
  }

  let len = details.requestHeaders.length;
  let added = false;
  while (--len) {
    const header = details.requestHeaders[len];
    if (
      header.name.toLowerCase() === 'cache-control' ||
      header.name.toLowerCase() === 'x-google-cache-control'
    ) {
      header.value = 'max-age=0, no-cache, no-store, must-revalidate';
      added = true;
    }
  }
  if (!added) {
    details.requestHeaders.push({
      name: 'Cache-Control',
      value: 'max-age=0, no-cache, no-store, must-revalidate',
    });
  }

  const matches = storage
    .getRulesCached()
    .filter(isValidRule)
    .filter(
      rule =>
        rule.operator === Operator.ADD_REQUEST_HEADER &&
        !rule.disabled &&
        new RegExp(rule.target).test(details.url)
    );
  matches.forEach(rule => {
    const addedHeaders = rule.destination.split(',');
    addedHeaders.forEach(addedHeader => {
      const partial = addedHeader.split('=');
      if (partial.length === 2) {
        details.requestHeaders.push({
          name: partial[0],
          value: partial[1],
        });
      }
    });
  });

  return {requestHeaders: details.requestHeaders};
}

chrome.webRequest.onHeadersReceived.addListener(
  onHeadersReceived,
  {urls: ['<all_urls>']},
  ['blocking', 'responseHeaders']
);
chrome.webRequest.onBeforeRequest.addListener(
  onBeforeRequest,
  {urls: ['<all_urls>']},
  ['blocking', 'extraHeaders']
);
chrome.webRequest.onBeforeSendHeaders.addListener(
  onBeforeSendHeaders,
  {urls: ['<all_urls>']},
  ['blocking', 'requestHeaders']
);

async function enableHelper(tabId: number) {
  chrome.browserAction.enable(tabId);
  chrome.browserAction.setIcon({tabId, path: 'icon-32.png'});
  chrome.browserAction.setPopup({tabId, popup: 'popup.html'});
  await storage.setTabEnabled(tabId);
}

async function disableHelper(tabId: number) {
  chrome.browserAction.disable(tabId);
  chrome.browserAction.setIcon({tabId, path: 'gray-32.png'});
  chrome.browserAction.setPopup({tabId, popup: ''});
  await storage.setTabDisabled(tabId);
}

chrome.browserAction.onClicked.addListener((tab: chrome.tabs.Tab) => {
  const isEnabled = storage.isTabEnabledCached(tab.id);
  const activeTabId = storage.getActiveTabIdCached();
  if (isEnabled) {
    disableHelper(tab.id);
  } else {
    enableHelper(tab.id);
    if (activeTabId) {
      chrome.tabs.reload(activeTabId);
    }
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
