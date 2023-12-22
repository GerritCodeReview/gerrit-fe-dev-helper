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

The extension supports different type of rules:

1. block: block a certain request
2. redirect: redirect a url to another url
3. injectHtmlCode: inject a piece of html code to the page
4. addReqHeader: to add arbitrary header when you send a request
5. addRespHeader: to add arbitrary header when you receive a request
6. rRespHeader: to remove arbitrary header on any response

#### How to use dev helper with js plugins

For existing plugins just `redirect` from the where the plugin is normally loaded from to
`http://localhost:8081/plugins/my-plugin.js` and put your local plugin file into the
`polygerrit-ui/app/plugins` folder.

For new plugins you also have to use a `redirect` rule, because the Chrome extension is not allowed
to inject JavaScript from arbitrary source by Content Security Policy. The easiest option is to
pick the most simple or irrelevant plugin that your Gerrit server has, and redirect from that.

### Testing a new version

- Execute `npm run build`.
- Go to chrome://extensions/.
- Turn on `Developer Mode`.
- Click `Load Unpacked`.
- Choose the `dist` directory.

As a Google developer you will have to add a `key` to the `manifest.json` in the `dist/` directory
as documented here: http://go/extension-identification#i%E2%80%99m-developing-a-chrome-extension-on-my-computer

### Publish a new version to the Chrome Webstore

This section is for members of Google's developer team only.

- Make sure that you are a member of the group g/gerrit-fe-dev-helper.
- Go to https://chrome.google.com/webstore/devconsole/d2ee4af0-3e6f-489c-97c9-fa14d84e2ffa/jimgomcnodkialnpmienbomamgomglkd/edit/package
- Make sure that you have updated the version in `manifest.json` and `package.json`.
- Produce a zip bundle of the extension by executing `npm run build`.
- Upload the bundle using the `Upload dogfood version` button.
- Submit the dogfood draft for review.
- Wait ~24h for the dogfood draft to be published.
- Upload the bundle using the `Upload new package` button.
- Submit the main draft for review.
- Wait ~24h for the main draft to be published.

### Contact

Please don't hesitate to contact dhruvsri@google.com for support on this extension.
