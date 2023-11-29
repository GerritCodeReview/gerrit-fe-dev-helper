import {
  DEFAULT_RULES,
  isInjectRule,
  isValidRule,
  Operator,
  Rule,
} from './utils';

let rules: Rule[] = [...DEFAULT_RULES];

interface TabState {
  tab: chrome.tabs.Tab;
}

// Enable / disable with one click and persist states per tab
const TabStates = new Map<number, TabState>();

// Load default configs and states when install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(['rules'], res => {
    const existingRules: Rule[] = res['rules'] || [];
    const validRules = existingRules.filter(isValidRule);
    if (!validRules.length) {
      chrome.storage.sync.set({rules});
    } else {
      chrome.storage.sync.set({rules: validRules});
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
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'updateRules') {
    rules = request.rules;
  } else if (request.type === 'disableHelper') {
    const tab = request.tab || {id: undefined};
    chrome.browserAction.disable(tab.id);
    chrome.browserAction.setIcon({tabId: tab.id, path: 'gray-32.png'});
    chrome.browserAction.setPopup({tabId: tab.id, popup: ''});
    TabStates.delete(tab.id);
  } else if (request.type === 'isEnabled') {
    const tab = sender.tab || lastFocusedWindow || {id: undefined};
    sendResponse(TabStates.has(tab.id));
  }
});

function onHeadersReceived(resp: chrome.webRequest.WebResponseHeadersDetails) {
  if (!resp || !resp.responseHeaders) return {};

  if (!TabStates.has(resp.tabId)) {
    return {responseHeaders: resp.responseHeaders};
  }
  const matches = rules
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
  const addMatches = rules
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
  if (!TabStates.has(details.tabId)) {
    return {cancel: false};
  }

  const matches = rules
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

  if (!TabStates.has(details.tabId)) {
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

  const matches = rules
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

// remove csp
// add cors header to all response
function setUpListeners() {
  // if already registered, return
  if (chrome.webRequest.onHeadersReceived.hasListener(onHeadersReceived)) {
    return;
  }

  // in case any listeners already set up, remove them first
  removeListeners();
  chrome.webRequest.onHeadersReceived.addListener(
    onHeadersReceived,
    {urls: ['<all_urls>']},
    ['blocking', 'responseHeaders']
  );

  // blocking or redirecting
  chrome.webRequest.onBeforeRequest.addListener(
    onBeforeRequest,
    {urls: ['<all_urls>']},
    ['blocking', 'extraHeaders']
  );

  // disabling cache
  chrome.webRequest.onBeforeSendHeaders.addListener(
    onBeforeSendHeaders,
    {urls: ['<all_urls>']},
    ['blocking', 'requestHeaders']
  );
}

function removeListeners() {
  if (chrome.webRequest.onHeadersReceived.hasListener(onHeadersReceived)) {
    chrome.webRequest.onHeadersReceived.removeListener(onHeadersReceived);
  }

  if (chrome.webRequest.onBeforeRequest.hasListener(onBeforeRequest)) {
    chrome.webRequest.onBeforeRequest.removeListener(onBeforeRequest);
  }

  if (chrome.webRequest.onBeforeSendHeaders.hasListener(onBeforeSendHeaders)) {
    chrome.webRequest.onBeforeSendHeaders.removeListener(onBeforeSendHeaders);
  }
}

function enableHelper(tab: chrome.tabs.Tab) {
  // disable -> enable
  chrome.browserAction.setIcon({tabId: tab.id, path: 'icon-32.png'});
  chrome.browserAction.setPopup({tabId: tab.id, popup: 'popup.html'});
  TabStates.set(tab.id, {tab});

  // set up listeners
  setUpListeners();
}

function disableHelper(tab: chrome.tabs.Tab) {
  chrome.browserAction.setIcon({tabId: tab.id, path: 'gray-32.png'});
  chrome.browserAction.setPopup({tabId: tab.id, popup: ''});
  TabStates.delete(tab.id);

  // Remove listeners if no tab enabled
  if (TabStates.size === 0) {
    removeListeners();
  }
}

chrome.browserAction.onClicked.addListener(tab => {
  if (TabStates.has(tab.id)) {
    // enable -> disable
    disableHelper(tab);
  } else {
    // disable -> enable
    enableHelper(tab);
    if (lastFocusedWindow) {
      chrome.tabs.update(lastFocusedWindow.id!, {url: lastFocusedWindow.url});
    }
  }
});

// Enable / disable the helper based on state of this tab
// This will be called when tab was activated
function checkCurrentTab() {
  chrome.tabs.query({active: true, lastFocusedWindow: true}, ([tab]) => {
    if (lastFocusedWindow === tab) return;
    if (!tab || !tab.url) return;

    if (TabStates.has(tab.id)) {
      enableHelper(tab);
    } else {
      disableHelper(tab);
    }

    lastFocusedWindow = tab;

    // read the latest states and rules
    chrome.storage.sync.get(['rules'], res => {
      rules = res['rules'] || [];
    });
  });
}

// check this so extension always have the right status
// even after page refreshes / reloads etc
setInterval(() => checkCurrentTab(), 1000);

// when removed, clear
chrome.tabs.onRemoved.addListener(tabId => {
  TabStates.delete(tabId);
  if (TabStates.size === 0) {
    removeListeners();
  }
});
