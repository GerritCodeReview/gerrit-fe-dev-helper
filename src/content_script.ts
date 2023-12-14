import {Operator, getUrlParameter} from './utils';
import {StorageUtil} from './storage';

const link = document.createElement('script');
link.setAttribute('src', chrome.runtime.getURL('elements.js'));
document.head.appendChild(link);

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

// Apply injection rules to Gerrit sites if enabled
chrome.runtime.sendMessage({type: 'isEnabled'}, async isEnabled => {
  if (!isEnabled) return;

  console.log('Gerrit FE Dev Helper is enabled.');
  const tip = document.createElement('gdh-tip');
  document.body.appendChild(tip);

  const storage = new StorageUtil();
  const rules = await storage.getRules();

  for (const rule of rules) {
    if (rule.disabled) continue;
    if (rule.operator === Operator.INJECT_HTML_CODE) {
      const el = document.createElement('div');
      el.innerHTML = rule.destination;
      document.body.appendChild(el);
    } else if (rule.operator === Operator.INJECT_CSS) {
      onGerritReady().then(() => {
        const link = document.createElement('link');
        link.setAttribute('rel', 'stylesheet');
        link.setAttribute('href', rule.destination);
        document.head.appendChild(link);
      });
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
          const snackbar = document.createElement('gdh-snackbar');
          snackbar.id = id;
          snackbar.setAttribute('message', message);
          snackbar.setAttribute('position', `${numOfSnackBars}`);
          document.body.appendChild(snackbar);
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
