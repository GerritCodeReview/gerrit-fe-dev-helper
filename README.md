## Gerrit FE Dev Helper

Gerrit FE Dev helper is a chrome extension that will focus on helping frontend developers on Gerrit development.

As mentioned in [readme from polygerrit-ui]
](https://gerrit.googlesource.com/gerrit/+/refs/heads/master/polygerrit-ui/), we already support to start your local host for developing / debugging / testing, but it has quite a few restrictions:

1. No auth support
2. Restart needede to switch hosts
3. Not easy to test plugins

To solve these pain points, I created this chrome extension that basically just proxy all assets requests or any requests to local server, and you will have the ability to inject any plugins from local as well.

### Features

See in [release notes](./release-notes.md).

### BUILD

```
npm run build
```

Then you should have `gerrit_fe_dev_helper.zip` that you can test with, or download from [chrome web store](https://chrome.google.com/webstore/category/extensions) here: https://chrome.google.com/webstore/detail/gerrit-fe-dev-helper/jimgomcnodkialnpmienbomamgomglkd.

After you installed and enabled the extension, you should see something similar to [demo.png](./demo.png).

### Contact

Please don't hesitate to contact taoalpha@google.com for support on this extension.