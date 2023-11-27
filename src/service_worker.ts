import {isInjectRule, isValidRule, Operator, getActiveTab} from './utils';
import {StorageUtil} from './storage';

const storage = new StorageUtil();

chrome.runtime.onInstalled.addListener(async () => {
  storage.initTabsEnabled();
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

async function onHeadersReceived(
  resp: chrome.webRequest.WebResponseHeadersDetails
) {
  if (!resp || !resp.responseHeaders) return {};
  const isEnabled = await storage.isTabEnabled(resp.tabId);
  if (!isEnabled) {
    return {responseHeaders: resp.responseHeaders};
  }

  const matches = (await storage.getRules())
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
  const addMatches = (await storage.getRules())
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

async function onBeforeRequest(
  details: chrome.webRequest.WebRequestBodyDetails
) {
  const isEnabled = await storage.isTabEnabled(details.tabId);
  if (!isEnabled) {
    return {cancel: false};
  }

  const matches = (await storage.getRules())
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

async function onBeforeSendHeaders(
  details: chrome.webRequest.WebRequestHeadersDetails
) {
  if (!details || !details.requestHeaders) return {};
  const isEnabled = await storage.isTabEnabled(details.tabId);
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

  const matches = (await storage.getRules())
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
