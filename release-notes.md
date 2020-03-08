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