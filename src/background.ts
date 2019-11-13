import {DEFAULT_RULES, isInjectRule, isRecognizedSite, isValidRule, Operator, Rule} from './utils';

let rules: Rule[] = [...DEFAULT_RULES];

// Enable / disable with one click and persist states per tab
const TAB_STATES = new Map();

// default configs and states
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(['rules'], (res) => {
    const existingRules: Rule[] = res['rules'] || [];
    const validRules = existingRules.filter(isValidRule);
    if (!validRules.length) {
      chrome.storage.sync.set({rules});
    } else {
      chrome.storage.sync.set({rules: validRules});
    }
  });
});

chrome.tabs.onActivated.addListener(() => {
  checkCurrentTab();
});

let lastFocusedWindow: chrome.tabs.Tab;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'updateRules') {
    rules = request.rules;
  } else if (request.type === 'disableHelper') {
    const tab = request.tab || {id: undefined};
    chrome.browserAction.disable(tab.id);
    chrome.browserAction.setIcon({tabId: tab.id, path: 'gray-32.png'});
    chrome.browserAction.setPopup({tabId: tab.id, popup: ''});
    TAB_STATES.delete(tab.id);
  } else if (request.type === 'isEnabled') {
    const tab = sender.tab || lastFocusedWindow || {id: undefined};
    sendResponse(TAB_STATES.has(tab.id));
  }
});

function onHeadersReceived(resp: chrome.webRequest.WebResponseHeadersDetails) {
  if (!resp || !resp.responseHeaders) return {};

  if (!TAB_STATES.has(resp.tabId)) {
    return {responseHeaders: resp.responseHeaders};
  }

  let len = resp.responseHeaders.length;
  if (len > 0) {
    while (--len) {
      const header = resp.responseHeaders[len];
      if (header.name.toUpperCase() === 'X-WEBKIT-CSP') {
        header.value = '*';
        break;
      } else if (header.name.toLowerCase() === 'access-control-allow-origin') {
        resp.responseHeaders[len].value = '*';
        break;
      } else if (
          header.name.toLowerCase() === 'cache-control' ||
          header.name.toLowerCase() === 'x-google-cache-control') {
        header.value = 'max-age=0, no-cache, no-store, must-revalidate';
      }
    }
  }

  // add cors and cache anyway
  resp.responseHeaders.push(
      {'name': 'Access-Control-Allow-Origin', 'value': '*'});
  resp.responseHeaders.push({
    'name': 'Cache-Control',
    'value': 'max-age=0, no-cache, no-store, must-revalidate'
  });
  return {responseHeaders: resp.responseHeaders};
}

function onBeforeRequest(details: chrome.webRequest.WebRequestBodyDetails) {
  if (!TAB_STATES.has(details.tabId)) {
    return {cancel: false};
  }

  const tabState = TAB_STATES.get(details.tabId)!;

  const match = rules.filter(isValidRule)
                    .find(
                        rule => !isInjectRule(rule) && !rule.disabled &&
                            new RegExp(rule.target).test(details.url));
  if (match) {
    if (match.operator === Operator.BLOCK) {
      return {cancel: true};
    }

    if (match.operator === Operator.REDIRECT) {
      return {
        redirectUrl:
            details.url.replace(new RegExp(match.target), match.destination),
      };
    }
  }
  return {cancel: false};
}

function onBeforeSendHeaders(
    details: chrome.webRequest.WebRequestHeadersDetails) {
  if (!details || !details.requestHeaders) return {};

  if (!TAB_STATES.has(details.tabId)) {
    return {requestHeaders: details.requestHeaders};
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

  return {requestHeaders: details.requestHeaders};
}

// remove csp
// add cors header to all response
function setUpListeners() {
  // if already registered, return
  if (chrome.webRequest.onHeadersReceived.hasListener(onHeadersReceived)) {
    return;
  }

  removeListeners();
  chrome.webRequest.onHeadersReceived.addListener(
      onHeadersReceived, {urls: ['<all_urls>']},
      ['blocking', 'responseHeaders']);

  // blocking or redirecting
  chrome.webRequest.onBeforeRequest.addListener(
      onBeforeRequest, {urls: ['<all_urls>']}, ['blocking']);

  // disabling cache
  chrome.webRequest.onBeforeSendHeaders.addListener(
      onBeforeSendHeaders, {urls: ['<all_urls>']},
      ['blocking', 'requestHeaders']);
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
  TAB_STATES.set(tab.id, {tab});
  setUpListeners();
}

function disableHelper(tab: chrome.tabs.Tab) {
  chrome.browserAction.setIcon({tabId: tab.id, path: 'gray-32.png'});
  chrome.browserAction.setPopup({tabId: tab.id, popup: ''});
  TAB_STATES.delete(tab.id);

  if (TAB_STATES.size === 0) {
    removeListeners();
  }
}

chrome.browserAction.onClicked.addListener((tab) => {
  if (isRecognizedSite(tab.url!)) {
    if (TAB_STATES.has(tab.id)) {
      // enable -> disable
      disableHelper(tab);
    } else {
      // disable -> enable
      enableHelper(tab);
      if (lastFocusedWindow) {
        chrome.tabs.update(lastFocusedWindow.id!, {url: lastFocusedWindow.url});
      }
    }
  } else {
    alert('extension only works for gerrit hosts');
  }
});

function checkCurrentTab() {
  // only enable for gerrit related sites
  chrome.tabs.query({'active': true, 'lastFocusedWindow': true}, ([tab]) => {
    if (lastFocusedWindow === tab) return;
    if (!tab || !tab.url) return;

    if (isRecognizedSite(tab.url)) {
      chrome.browserAction.enable(tab.id);
    } else {
      chrome.browserAction.disable(tab.id);
    }

    if (TAB_STATES.has(tab.id)) {
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

// keep polling in case people jump around in same tab
setInterval(() => checkCurrentTab(), 1000);

// when removed, clear
chrome.tabs.onRemoved.addListener(tabId => {
  TAB_STATES.delete(tabId);
  if (TAB_STATES.size === 0) {
    removeListeners();
  }
});
