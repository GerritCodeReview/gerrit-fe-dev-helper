import { isInjectRule, isRecognizedSite, Operator, Rule } from './utils';

const isInGerritSite = isRecognizedSite(location.href);

function nextTick(ts: number) {
  return new Promise(resolve => {
    setTimeout(resolve, ts);
  });
}

const onGerritReady = async () => {
  let importLinks = document.querySelectorAll("link[rel=import]");
  let gerritReady = importLinks && importLinks.length > 2;
  while (!gerritReady) {
    await nextTick(1000);
    importLinks = document.querySelectorAll("link[rel=import]");
    gerritReady = importLinks && importLinks.length > 2;
  }
  return true;
}

// Apply injection rules to Gerrit sites
if (isInGerritSite) {
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
            document.head.appendChild(link);
          });
        } else if (rule.operator === Operator.INJECT_JS_CODE) {
          const link = document.createElement('script');
          link.innerHTML = rule.destination;
          document.head.appendChild(link);
        }
      });

      // test redirect rules
      rules.filter(rule => !isInjectRule(rule)).forEach(rule => {
        if (rule.operator === Operator.REDIRECT && !rule.disabled) {
          let idx = 1;
          fetch(rule.destination).then(() => 0).catch(e => {
            const errorSnack = document.createElement('div');
            errorSnack.style.position = 'absolute';
            errorSnack.style.top = `${idx * 30}px`;
            errorSnack.style.right = '10px';
            errorSnack.style.backgroundColor = 'black';
            errorSnack.style.color = 'white';
            errorSnack.style.padding = '10px';
            errorSnack.style.zIndex = '100';
            errorSnack.innerHTML =
              `You may have an invalid redirect rule from ${rule.target} to ${
              rule.destination}`;
            document.body.appendChild(errorSnack);

            idx++;

            setTimeout(() => {
              errorSnack.remove();
              idx--;
            }, 10 * 1000);
          });
        }
      });
    });
  });
}