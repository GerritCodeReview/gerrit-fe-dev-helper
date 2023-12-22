import * as _DEFAULT_RULES from '../data/rules.json';

export const DEFAULT_RULES: Rule[] = _DEFAULT_RULES as Rule[];

// Returns the content of the file `data/rules.json` as an object.
export function getDefaultRules() {
  return [...DEFAULT_RULES];
}

export function isValidRule(rule: Rule) {
  return (
    Object.values(Operator).includes(rule.operator) &&
    ((rule.operator === Operator.BLOCK && rule.target) ||
      (rule.operator === Operator.REDIRECT &&
        rule.target &&
        rule.destination) ||
      !!rule.destination)
  );
}

export function isInjectRule(rule: Rule) {
  return [
    Operator.INJECT_CSS,
    Operator.INJECT_HTML_CODE,
    Operator.INJECT_EXP,
  ].some(op => op === rule.operator);
}

export function getStaticRules(
  tabIds: number[]
): chrome.declarativeNetRequest.Rule[] {
  if (tabIds.length === 0) return [];
  return [
    {
      action: {
        requestHeaders: [
          {
            header: 'cache-control',
            value: 'max-age=0, no-cache, no-store, must-revalidate',
            operation: chrome.declarativeNetRequest.HeaderOperation.SET,
          },
          {
            header: 'x-google-cache-control',
            value: 'max-age=0, no-cache, no-store, must-revalidate',
            operation: chrome.declarativeNetRequest.HeaderOperation.SET,
          },
        ],
        type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
      },
      condition: {
        urlFilter: '*',
        tabIds,
      },
      // We just don't want to conflict with dynamic rule ids. They start counting from 1.
      id: 314159,
    },
  ];
}

export function toChromeRule(
  rule: Rule,
  tabIds: number[],
  ruleId: number
): chrome.declarativeNetRequest.Rule | undefined {
  if (rule.disabled) return undefined;
  if (tabIds.length === 0) return undefined;

  const action = convertRuleToAction(rule);
  if (!action) return undefined;
  return {
    action,
    condition: {
      regexFilter: rule.target,
      tabIds,
    },
    id: ruleId,
  };
}

function convertRuleToAction(
  rule: Rule
): chrome.declarativeNetRequest.RuleAction | undefined {
  switch (rule.operator) {
    case Operator.BLOCK:
      return {
        type: chrome.declarativeNetRequest.RuleActionType.BLOCK,
      };
    case Operator.ADD_RESPONSE_HEADER:
    case Operator.REMOVE_RESPONSE_HEADER:
      return {
        responseHeaders: headerInfos(rule),
        type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
      };
    case Operator.ADD_REQUEST_HEADER:
      return {
        requestHeaders: headerInfos(rule),
        type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
      };
    case Operator.REDIRECT:
      return {
        type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
        redirect: {regexSubstitution: rule.destination},
      };
    default:
      return undefined;
  }
}

function headerInfos(
  rule: Rule
): chrome.declarativeNetRequest.ModifyHeaderInfo[] | undefined {
  const operation =
    rule.operator === Operator.REMOVE_RESPONSE_HEADER
      ? chrome.declarativeNetRequest.HeaderOperation.REMOVE
      : chrome.declarativeNetRequest.HeaderOperation.SET;

  const headerInfos: chrome.declarativeNetRequest.ModifyHeaderInfo[] = [];
  const ruleHeaders = rule.destination.split('|');
  for (const header of ruleHeaders) {
    const partial = header.split('=');
    headerInfos.push({
      header: partial[0],
      operation,
      value: partial[1],
    });
  }
  return headerInfos;
}

export enum Operator {
  BLOCK = 'block',
  REDIRECT = 'redirect',
  INJECT_CSS = 'injectCss',
  INJECT_HTML_CODE = 'injectHtmlCode',
  REMOVE_RESPONSE_HEADER = 'rRespHeader',
  ADD_RESPONSE_HEADER = 'addRespHeader',
  ADD_REQUEST_HEADER = 'addReqHeader',
  INJECT_EXP = 'injectExp',
}

export interface Rule {
  disabled: boolean;
  target: string;
  operator: Operator;
  destination: string;
}

export function getUrlParameter(param: string) {
  const qs = window.location.search.substring(1);
  const partials = qs.split('&');
  const res = [];
  for (let i = 0; i < partials.length; i++) {
    const name = partials[i].split('=');
    if (name[0] == param) {
      res.push(name[1]);
    }
  }
  return res;
}

// Note that this does not work from a content script. It does not have access
// to the `chrome.tabs` API.
export async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const activeTabs = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  const activeTab = activeTabs[0];
  if (!activeTab?.id || !activeTab?.url) return undefined;
  return activeTab;
}
