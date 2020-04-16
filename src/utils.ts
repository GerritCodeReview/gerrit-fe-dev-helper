import * as _DEFAULT_RULES from "../data/rules.json";

/**
 * Default rules.
 */
export const DEFAULT_RULES: Rule[] = _DEFAULT_RULES as Rule[];

/**
 * Retrieves default rules from remote rules file, fallback to existing DEFAULT_RULES
 */
export async function getDefaultRules() {
    // try fetch from remote
    const remoteRulesUrl = 'https://gerrit.googlesource.com/gerrit-fe-dev-helper/+/refs/heads/master/data/rules.json?format=TEXT';
    try {
        const response = await fetch(remoteRulesUrl)
        const encodedText = await response.text();
        return JSON.parse(atob(encodedText));
    } catch(e) {
        console.log(e);
    }

    // fallback to existing default rules
    return DEFAULT_RULES;
}

/**
 * Returns if it's a valid rule (syntax only).
 */
export function isValidRule(rule: Rule) {
  return Object.values(Operator).includes(rule.operator) &&
    ((rule.operator === Operator.BLOCK && rule.target) ||
      (rule.operator === Operator.REDIRECT && rule.target &&
        rule.destination) ||
      !!rule.destination);
}

/**
 * Returns if it's a inject rule.
 */
export function isInjectRule(rule: Rule) {
  return [
    Operator.INJECT_JS_PLUGIN, Operator.INJECT_HTML_CODE,
    Operator.INJECT_HTML_PLUGIN, Operator.INJECT_JS_CODE
  ].some(op => op === rule.operator);
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
  INJECT_JS_CODE = 'injectJSCode',
  REMOVE_RESPONSE_HEADER = 'rRespHeader',
  ADD_RESPONSE_HEADER = 'addRespHeader',
  ADD_REQUEST_HEADER = 'addReqHeader',
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