## Gerrit FE Dev Helper

Gerrit FE Dev helper is a chrome extension that will focus on helping frontend developers on Gerrit development.

As mentioned in [readme from polygerrit-ui](https://gerrit.googlesource.com/gerrit/+/refs/heads/master/polygerrit-ui/),
we already support to start your local host for developing / debugging / testing, but it has quite a few restrictions:

1. No auth support
2. Restart needede to switch hosts
3. Not easy to test plugins

To solve these pain points, I created this chrome extension that basically just proxy all assets requests or any requests to local server, and you will have the ability to inject any plugins from local as well.

### Features

See in [release notes](./release-notes.md).

### BUILD

```
npm install
npm run build
```

Then you should have `gerrit_fe_dev_helper.zip` that you can test with, or download from [chrome web store](https://chrome.google.com/webstore/category/extensions) here: https://chrome.google.com/webstore/detail/gerrit-fe-dev-helper/jimgomcnodkialnpmienbomamgomglkd.

After you installed and enabled the extension, you should see something similar to [demo.png](./demo.png).

### How to use

1. Start the go server to host all assets locally
```sh
./polygerrit-ui/run-server.sh
```
2. Go to any gerrit sites, enable the extension by click the icon
3. You should see this red notice show up in the bottom right of the page (`Gerrit dev helper is enabled`),
and now your gerrit assets should be loaded from local server
4. Change files locally and refresh the page, you should have the changes immediately

The extension comes with a set of [default rules](./data/rules.json),
but you can change the rules by just clicking the extension icon again.

The extension supports six different type of rules:
1. block: block a certain request
2. redirect: redirect a url to another url
3. injectHtmlCode: inject a piece of html code to the page
4. injectJsCode: inject any js code to the page
5. injectJsPlugin: inject a js plugin(url) to the site
6. injectHtmlPlugin: inject a html plugin(url) to the site

The two options of injecting any plugins meant to help you develop your plugins for your gerrit sites.

### Contact

Please don't hesitate to contact taoalpha@google.com for support on this extension.