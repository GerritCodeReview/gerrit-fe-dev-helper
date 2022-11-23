## Gerrit FE Dev Helper

Gerrit FE Dev helper is a Chrome extension that will focus on helping frontend developers on Gerrit development.

As mentioned in [readme from polygerrit-ui](https://gerrit.googlesource.com/gerrit/+/refs/heads/master/polygerrit-ui/),
we already support to start your local host for developing / debugging / testing, but it has quite a few restrictions:

1. No auth support
2. Restart needed to switch hosts
3. Not easy to test plugins

To solve these pain points, Tao Zhou created this Chrome extension. It proxies all assets requests or any requests to a local HTTP server, and has the ability to inject any plugins exposed by the local HTTP server.

### Features

See in [release notes](./release-notes.md) and [Features](#Features) below.

### Install

The easiest is to install from the [Chrome web store](https://chrome.google.com/webstore/category/extensions) here: https://chrome.google.com/webstore/detail/gerrit-fe-dev-helper/jimgomcnodkialnpmienbomamgomglkd.

After you have installed and enabled the extension, you should see something similar to [demo.png](./demo.png).

### BUILD

To build from source:

```
npm install
npm run build
```

Then you should have `gerrit_fe_dev_helper.zip` that you can test with.

### How to use

1. For Gerrit core development, start the local Gerrit dev server to host app code locally
```sh
yarn start
```
Or if you are developing a plugin, serve your plugin via a local HTTP server via any means.

Example:
```sh
npx http-server -c-1 --cors
```

2. Go to any Gerrit sites, enable the extension by clicking the icon
3. You should see a red notice show up in the bottom right of the page: `Gerrit dev helper is enabled`, and now your Gerrit assets should be loaded from your local HTTP server
4. Change files locally and refresh the page, you should have the changes immediately

The extension comes with a set of [default rules](./data/rules.json),
but you can change the rules by clicking the extension icon again.

The extension supports six different type of rules:
1. block: block a certain request
2. redirect: redirect a url to another url
3. injectHtmlCode: inject a piece of html code to the page
4. injectJsCode: inject any js code to the page
5. injectJsPlugin: inject a js plugin(url) to the site
6. injectHtmlPlugin: inject a html plugin(url) to the site
7. injectJsModule: inject a js module file to the site (type="module" will be added when load script)
8. addReqHeader: to add arbitrary header when you send a request
9. addRespHeader: to add arbitrary header when you receive a request
10. rRespHeader: to remove arbitrary header on any response

The two options to inject any plugins (`injectJsPlugin` and `injectHtmlPlugin`) are meant to help you develop your plugins for your Gerrit sites. As they are served from your local HTTP server, you do not need to deploy them on the target Gerrit server.

#### How to use dev helper with html plugins

Use `injectHtmlPlugin` rule or use `redirect` rule if its an existing html plugin.

#### How to use dev helper with js plugins

For single-file js plugins, use `injectJsPlugin` rule or use `redirect` if its an exising js plugin.

For multi-file modularized js plugins (you have import / export in source code), you have two options:

1. compile them and then treat it as single-file js plugin
2. or if you want to load source code as it is
  - use `injectJsModule`, this will load the js with `type="module"`, and due to restriction of `type="module"`, Gerrit won't be able to recognize the plugin without a proper url set when calling `Gerrit.install`, so you also need to tweak your code to call `Gerrit.install(callback, undefined, 'http://localhost:8081/plugins_/checks/gr-checks/gr-checks.js')` to let Gerrit treat it as a legit plugin
  - or you can create a temporary html plugin which loads the `http://localhost:8081/plugins_/checks/gr-checks/gr-checks.js` with `type="module"`, and then treat it as a html plugin

Either way, you need to `block` the existing plugin if its already on the page.

### Contact

Please don't hesitate to contact dhruvsri@google.com for support on this extension.
