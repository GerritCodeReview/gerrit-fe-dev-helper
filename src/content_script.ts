import {isInjectRule, Operator, Rule, getUrlParameter} from './utils';
import {Storage} from './storage';

declare global {
  interface Window {
    ENABLED_EXPERIMENGTS?: string[];
  }
}

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
function createSnackBar(message: string) {
  const errorSnack = document.createElement('div');
  errorSnack.style.position = 'absolute';
  errorSnack.style.top = `${numOfSnackBars * 40}px`;
  errorSnack.style.right = '10px';
  errorSnack.style.backgroundColor = 'black';
  errorSnack.style.color = 'white';
  errorSnack.style.padding = '10px';
  errorSnack.style.zIndex = '100';
  errorSnack.innerHTML = message;
  document.body.appendChild(errorSnack);
  numOfSnackBars++;
  return errorSnack;
}

// Apply injection rules to Gerrit sites if enabled
chrome.runtime.sendMessage({type: 'isEnabled'}, isEnabled => {
  if (!isEnabled) return;
  const storage = new Storage();
  const rules = storage.getRulesCached();

  // load
  rules.filter(isInjectRule).forEach(rule => {
    if (rule.disabled) return;
    if (rule.operator === Operator.INJECT_HTML_PLUGIN) {
      onGerritReady().then(() => {
        const link = document.createElement('link');
        link.href = rule.destination;
        link.rel = 'import';
        document.head.appendChild(link);
      });
    } else if (rule.operator === Operator.INJECT_HTML_CODE) {
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
    } else if (rule.operator === Operator.INJECT_JS_CODE) {
      const link = document.createElement('script');
      link.innerHTML = rule.destination;
      document.head.appendChild(link);
    } else if (rule.operator === Operator.INJECT_EXP) {
      const exps = getUrlParameter('experiment');
      const hasSeachString = !!window.location.search;
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
        window.location.href += hasSeachString
          ? `&${addedParams}`
          : `?${addedParams}`;
      }
    }
  });

  // test redirect rules
  rules
    .filter(rule => !isInjectRule(rule))
    .forEach(rule => {
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
            const errorSnack = createSnackBar(
              `You may have an invalid redirect rule from ${rule.target} to ${rule.destination}`
            );

            // in case body is unresolved
            document.body.style.display = 'block';
            document.body.style.opacity = '1';

            setTimeout(() => {
              errorSnack.remove();
              numOfSnackBars--;
            }, 10 * 1000);
          });
      }
    });
});
