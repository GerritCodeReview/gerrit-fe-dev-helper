## v1

#### v1.0.1

- Fix rules to also work with non-Google hosted Gerrit
- Add a `inject css` rule
- P1 fix: Continue rules processing after first disabled one

#### v1.0.0

- Migrate to Manifest V3
  - Restrict the permissions to only run on a specific list of hosts
  - Migrate the background script to a service worker
  - Migrate request/response manipulation to `chrome.declarativeNetRequest` API
- New default rules
- Remove support for INJECT_HTML_PLUGIN (obsolete)
- Remove support for INJECT_JS_CODE (unsupported by Manifest V3)
- Convert HTML snippets to Lit elements
- Add prettier config and reformat all files

## v0

#### v0.0.13/14

- Fix `content_scripts.matches` patterns

#### v0.0.12

- Restrict the extension to only work for Google hosted Gerrit
- Add documentation about testing and publishing the extension

#### v0.0.11

- Fix CORS preflight interception
- Update npm deps
- Make the extension look a bit nicer

#### v0.0.10

- Bumped lit version to 2.2.3

#### v0.0.9

- Move cors / cache override to rules, so user can disable it from the popup
- Change header value separator from `,` to `|`, as `,` can be part of the value while `|` is unlikely
- Fix `onGerritReady` to use tag name instead of id and max at 5s ;)

#### v0.0.8

- **BREAKING CHNAGE**: Gerrit is moving to `gr-app.js` only, so `gr-app.html` will no longer exists, we have updated default rules to forward to `gr-app.js` as well, in case you are still using `gr-app.html`, please modify that redirect rule by changing `gr-app.js` to `gr-app.html`
- Add `addRespHeader` operator, thanks to Edward <ehmaldonado@google.com>
- Add `injectExp` operator, as gerrit now supports experiments, this is a quick way to force enabling certain experiments, experiments should be separated by `,`

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
