#### next release

- Add addRespHeader operator, thanks to Edward <ehmaldonado@google.com>

#### v0.0.7

- Fix the issue when multiple rule matches one url for onBeforeRequest
  - Block will always take the highest priority
  - Then Redirect
  - Ignore the rest
- Add a new operator as `injectJsModule`, with plugins moving to polymer 3, certain plugins will be written in modules, and to inject moduled js plugins, use this rule
  - This will basically add a `type="module"` to the script tag when load the script so we can use `import` inside
  - With `type="module"`, `document.currentScript` will become `null` so we won't be able to infer the plugin url, to workaround this, make sure you call `Gerrit.install` with the third parameter: `Gerrit.install(() => {}, undefined, 'the_url')` so Gerrit can treat it as a legit plugin
  - Keep using `injectJsPlugin` if its a single bundled js file

#### v0.0.6

- Add two new operators:
  - `addReqHeader` to add arbitrary header when you send a request
  - `rRespHeader` to remove arbitrary header on any response
- Modify default rules to show # of js errors in the helper tip
- Add a new default rule to send x-test-origin with gerrit-fe-dev-helper on all requests when enabled

#### v0.0.5

- set crossorigin to anonymous to help debug js error from plugin
- improve the ui on popup
- remove outdated rule of replacing gr-app-p2 with gr-app

#### v0.0.4

- A better way to wait for Gerrit when injecting html plugins

#### v0.0.3

- Hotfix

#### v0.0.2

- Remove restriction on gerrit sites (some features won't work if its not a valid gerrit site)
- Update README

#### v0.0.1

- Enable the extension with a single click
- Allow export / import rules
- Show a error for 5s if rule destination is invalid (can not reach)
- Show an announcement for the change for 3 seconds for first time users
- Persist enable / disable state per tab
- Support temporary disable rule without deleting it
- Move injection to document_end
- Support reset to reset rules to initial state
- Support proxy live requests to local on googlesource sites
- Support 6 types of rules: redirect, block, injectJS code/url, inject html code / url
- Support add / remove / modify rules