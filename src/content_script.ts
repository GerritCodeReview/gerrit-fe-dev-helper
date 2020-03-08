import { isInjectRule, Operator, Rule } from './utils';

function nextTick(ts: number) {
  return new Promise(resolve => {
    setTimeout(resolve, ts);
  });
}

// Since content-script can not access window.Gerrit,
// here checks the readiness based on #mainHeader element
const onGerritReady = async () => {
  let header;
  try {
    header = document.querySelector("#app").shadowRoot.querySelector("#app-element").shadowRoot.querySelector("#mainHeader");
  } catch (e) { }

  while (!header) {
    await nextTick(1000);
    try {
      header = document.querySelector("#app").shadowRoot.querySelector("#app-element").shadowRoot.querySelector("#mainHeader");
    } catch (e) { }
  }
  return true;
}

// Apply injection rules to Gerrit sites if enabled
chrome.runtime.sendMessage({ type: 'isEnabled' }, (isEnabled) => {
  if (!isEnabled) return;

  chrome.storage.sync.get(['rules'], (result) => {
    if (!result['rules']) return;
    const rules = result['rules'] as Rule[];

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
      } else if (rule.operator === Operator.INJECT_JS_CODE) {
        const link = document.createElement('script');
        link.innerHTML = rule.destination;
        document.head.appendChild(link);
      }
    });

    // test redirect rules
    let idx = 0;
    rules.filter(rule => !isInjectRule(rule)).forEach(rule => {
      if (rule.operator === Operator.REDIRECT && !rule.disabled) {
        fetch(rule.destination).then(res => {
          if (res.status < 200 || res.status >= 300) throw new Error("Resource not found");
        }).catch(e => {
          const errorSnack = document.createElement('div');
          errorSnack.style.position = 'absolute';
          errorSnack.style.top = `${idx++ * 40}px`;
          errorSnack.style.right = '10px';
          errorSnack.style.backgroundColor = 'black';
          errorSnack.style.color = 'white';
          errorSnack.style.padding = '10px';
          errorSnack.style.zIndex = '100';
          errorSnack.innerHTML =
            `You may have an invalid redirect rule from ${rule.target} to ${
            rule.destination}`;
          document.body.appendChild(errorSnack);

          // in case body is unresolved
          document.body.style.display = "block";
          document.body.style.opacity = "1";

          setTimeout(() => {
            errorSnack.remove();
            idx--;
          }, 10 * 1000);
        });
      }
    });
  });
});