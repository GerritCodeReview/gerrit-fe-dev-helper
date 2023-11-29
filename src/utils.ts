import * as _DEFAULT_RULES from '../data/rules.json';

export const DEFAULT_RULES: Rule[] = _DEFAULT_RULES as Rule[];

/**
 * Retrieves default rules from remote rules file, fallback to existing DEFAULT_RULES
 */
export async function getDefaultRules() {
  // try fetch from remote
  const remoteRulesUrl =
    'https://gerrit.googlesource.com/gerrit-fe-dev-helper/+/refs/heads/master/data/rules.json?format=TEXT';
  try {
    const response = await fetch(remoteRulesUrl);
    const encodedText = await response.text();
    return JSON.parse(atob(encodedText));
  } catch (e) {
    console.log(e);
  }

  return DEFAULT_RULES;
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
    Operator.INJECT_JS_MODULE_PLUGIN,
    Operator.INJECT_JS_PLUGIN,
    Operator.INJECT_HTML_CODE,
    Operator.INJECT_HTML_PLUGIN,
    Operator.INJECT_JS_CODE,
    Operator.INJECT_EXP,
  ].some(op => op === rule.operator);
}

const STATIC_RULES: chrome.declarativeNetRequest.Rule[] = [
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
    },
    id: 314159,
  },
];

export function getStaticRules(
  tabIds: number[]
): chrome.declarativeNetRequest.Rule[] {
  if (tabIds.length === 0) return [];
  return STATIC_RULES.map(rule => {
    return {...rule, condition: {...rule.condition, tabIds}};
  });
}

export function toChromeRule(
  rule: Rule,
  tabIds: number[],
  ruleId: number
): chrome.declarativeNetRequest.Rule | undefined {
  if (rule.disabled) return undefined;
  if (tabIds.length === 0) return undefined;
  const type = convertOperatorToType(rule.operator);
  if (!type) return undefined;
  const redirect =
    type === chrome.declarativeNetRequest.RuleActionType.REDIRECT
      ? {url: rule.destination}
      : undefined;
  return {
    action: {
      redirect,
      requestHeaders: requestHeaders(rule),
      responseHeaders: responseHeaders(rule),
      type,
    },
    condition: {
      regexFilter: rule.target,
      tabIds,
    },
    id: ruleId,
  };
}

function requestHeaders(
  rule: Rule
): chrome.declarativeNetRequest.ModifyHeaderInfo[] | undefined {
  if (rule.operator !== Operator.ADD_REQUEST_HEADER) {
    return undefined;
  }
  return headerInfos(rule);
}

function responseHeaders(
  rule: Rule
): chrome.declarativeNetRequest.ModifyHeaderInfo[] | undefined {
  if (
    rule.operator !== Operator.ADD_RESPONSE_HEADER &&
    rule.operator !== Operator.REMOVE_RESPONSE_HEADER
  ) {
    return undefined;
  }
  return headerInfos(rule);
}

function headerInfos(
  rule: Rule
): chrome.declarativeNetRequest.ModifyHeaderInfo[] | undefined {
  if (
    rule.operator !== Operator.ADD_REQUEST_HEADER &&
    rule.operator !== Operator.ADD_RESPONSE_HEADER &&
    rule.operator !== Operator.REMOVE_RESPONSE_HEADER
  ) {
    return undefined;
  }
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

export function convertOperatorToType(
  op: Operator
): chrome.declarativeNetRequest.RuleActionType | undefined {
  if (op === Operator.BLOCK) {
    return chrome.declarativeNetRequest.RuleActionType.BLOCK;
  }
  if (op === Operator.ADD_REQUEST_HEADER) {
    return chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS;
  }
  if (op === Operator.REMOVE_RESPONSE_HEADER) {
    return chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS;
  }
  if (op === Operator.REDIRECT) {
    return chrome.declarativeNetRequest.RuleActionType.REDIRECT;
  }
  return undefined;
}

/**
 * Supported operators.
 */
export enum Operator {
  BLOCK = 'block',
  REDIRECT = 'redirect',
  INJECT_HTML_PLUGIN = 'injectHtmlPlugin',
  INJECT_HTML_CODE = 'injectHtmlCode',
  INJECT_JS_PLUGIN = 'injectJSPlugin',
  INJECT_JS_MODULE_PLUGIN = 'injectJSModule',
  INJECT_JS_CODE = 'injectJSCode',
  REMOVE_RESPONSE_HEADER = 'rRespHeader',
  ADD_RESPONSE_HEADER = 'addRespHeader',
  ADD_REQUEST_HEADER = 'addReqHeader',
  INJECT_EXP = 'injectExp',
}

/**
 * Rule type.
 */
export interface Rule {
  disabled: boolean;
  target: string;
  operator: Operator;
  destination: string;
  isNew?: boolean;
}

/**
 * Util to get url parameters
 */
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
