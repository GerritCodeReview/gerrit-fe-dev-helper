import {isInjectRule, Operator, Rule, getUrlParameter} from './utils';
import {LitElement, html, css, render} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';

function nextTick(ts: number) {
  return new Promise(resolve => {
    setTimeout(resolve, ts);
  });
}

// Since content-script can not access window.Gerrit,
// here checks the readiness based on #mainHeader element
// Wait at most 5s before considering it as loaded.
const MAX_WAIT_TIME = 5000;
const getHeaderEl = () => {
  if (document.querySelector('#app')) {
    return document
      .querySelector('#app')
      .shadowRoot.querySelector('#app-element')
      .shadowRoot.querySelector('#mainHeader');
  } else {
    return document
      .querySelector('gr-app')
      .shadowRoot.querySelector('gr-app-element')
      .shadowRoot.querySelector('gr-main-header');
  }
};

const onGerritReady = async () => {
  let header;
  try {
    header = getHeaderEl();
  } catch (e) {}

  let waitTime = 0;
  while (!header) {
    if (waitTime > MAX_WAIT_TIME) break;
    waitTime += 1000;
    await nextTick(1000);
    try {
      header = getHeaderEl();
    } catch (e) {}
  }
  return true;
};

let numOfSnackBars = 0;

@customElement('gdh-snackbar')
export class HelperSnackbar extends LitElement {
  @property({type: String}) message = '';

  @property({type: Number}) position = 0;

  render() {
    this.style.top = `${this.position * 40}px`;
    return html`<div>${this.message}</div>`;
  }

  static get styles() {
    return css`
      :host {
        position: absolute;
        top: 0px;
        right: 0px;
        background-color: black;
        color: white;
        padding: 10px;
        z-index: 100;
      }
    `;
  }
}

@customElement('gdh-tip')
export class HelperTip extends LitElement {
  @state() numErrors = 0;

  constructor() {
    super();
    this.interceptErrors();
  }

  interceptErrors() {
    let original = console.error;
    console.error = (...args) => {
      original.call(console, ...args);
      this.numErrors++;
    };
  }

  render() {
    const errors = this.numErrors > 0 ? ` (${this.numErrors} js errors)` : '';
    return html`<div>Gerrit dev helper is enabled ${errors}</div>`;
  }

  static get styles() {
    return css`
      :host {
        z-index: 10000;
        display: block;
        position: fixed;
        bottom: 0;
        right: 0;
        background-color: red;
      }
      div {
        color: white;
        font-weight: bold;
        padding: 10px;
      }
    `;
  }
}

// Apply injection rules to Gerrit sites if enabled
chrome.runtime.sendMessage({type: 'isEnabled'}, async isEnabled => {
  if (!isEnabled) return;

  console.log('Gerrit FE Dev Helper is enabled.');
  render(html`<gdh-tip></gdh-tip>`, document.body);

  const data = await chrome.storage.sync.get('rules');
  const rules = (data?.['rules'] as Rule[]) ?? [];

  for (const rule of rules) {
    if (rule.disabled) return;
    if (rule.operator === Operator.INJECT_HTML_CODE) {
      const el = document.createElement('div');
      el.innerHTML = rule.destination;
      document.body.appendChild(el);
    } else if (rule.operator === Operator.INJECT_JS_PLUGIN) {
      onGerritReady().then(() => {
        const link = document.createElement('script');
        link.setAttribute('src', rule.destination);
        link.setAttribute('crossorigin', 'anonymous');
        document.head.appendChild(link);
      });
    } else if (rule.operator === Operator.INJECT_JS_MODULE_PLUGIN) {
      onGerritReady().then(() => {
        const link = document.createElement('script');
        link.setAttribute('type', 'module');
        link.setAttribute('src', rule.destination);
        link.setAttribute('crossorigin', 'anonymous');
        document.head.appendChild(link);
      });
    } else if (rule.operator === Operator.INJECT_EXP) {
      const exps = getUrlParameter('experiment');
      const hasSearchString = !!window.location.search;
      const injectedExpNotInExps = new Set(
        rule.destination
          .trim()
          .split(',')
          .filter(exp => !exps.includes(exp.trim()))
      );
      if (injectedExpNotInExps.size) {
        const addedParams = [...injectedExpNotInExps].reduce(
          (str, exp) => (str += `experiment=${exp}&`),
          ''
        );
        window.location.href += hasSearchString
          ? `&${addedParams}`
          : `?${addedParams}`;
      }
    }
  }

  // Test redirect rules. Show a warning, if they are obviously not working as intended.
  for (const rule of rules) {
    if (
      rule.operator === Operator.REDIRECT &&
      !rule.disabled &&
      // only test for js/html
      /\.(js|html)+$/.test(rule.destination)
    ) {
      fetch(rule.destination)
        .then(res => {
          if (res.status < 200 || res.status >= 300)
            throw new Error('Resource not found');
        })
        .catch(e => {
          const message = `You may have an invalid redirect rule from ${rule.target} to ${rule.destination}`;
          const id = `snack-${numOfSnackBars}`;
          render(
            html`
              <gdh-snackbar
                id=${id}
                .message=${message}
                .position=${numOfSnackBars}
              ></gdh-snackbar>
            `,
            document.body
          );
          numOfSnackBars++;

          // in case body is unresolved
          document.body.style.display = 'block';
          document.body.style.opacity = '1';

          setTimeout(() => {
            document.getElementById(id)?.remove();
            numOfSnackBars--;
          }, 10 * 1000);
        });
    }
  }
});
