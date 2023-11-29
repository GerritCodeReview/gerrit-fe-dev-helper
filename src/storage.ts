import {DEFAULT_RULES, Rule, isValidRule} from './utils';

type TabsEnabled = {[tabId: string]: boolean};

export enum StorageKey {
  RULES = 'rules',
  TABS_ENABLED = 'tabsEnabled',
}

/**
 * A utility that wraps all calls to `chrome.storage`.
 *
 * `chrome.storage` can be used by the service worker, the popup and the content
 * script.
 *
 * We are storing the user managed rules in `chrome.storage.sync` and the
 * currently enabled tabs in `chrome.storage.session`. Note that the content
 * script would require a `chrome.storage.session.setAccessLevel()` permission
 * change for accessing the `.session` storage, but it can access the `.sync`
 * storage just fine.
 */
export class StorageUtil {
  // RULES

  async getRules(): Promise<Rule[]> {
    const data = await chrome.storage.sync.get(StorageKey.RULES);
    return (data?.[StorageKey.RULES] as Rule[]) ?? [...DEFAULT_RULES];
  }

  async setRules(rules: Rule[]) {
    await chrome.storage.sync.set({rules});
  }

  async initRules() {
    const existingRules = await this.getRules();
    const validRules = existingRules.filter(isValidRule);
    if (!validRules.length) {
      await this.setRules([...DEFAULT_RULES]);
    } else if (validRules.length < existingRules.length) {
      await this.setRules(validRules);
    }
  }

  // TABS ENABLED

  private async getTabsEnabled(): Promise<TabsEnabled> {
    const data = await chrome.storage.session.get(StorageKey.TABS_ENABLED);
    return (data?.[StorageKey.TABS_ENABLED] as TabsEnabled) ?? {};
  }

  private async setTabsEnabled(tabsEnabled: TabsEnabled) {
    await chrome.storage.session.set({tabsEnabled});
  }

  async setTabEnabled(tabId: number) {
    const tabsEnabled: TabsEnabled = await this.getTabsEnabled();
    tabsEnabled[`${tabId}`] = true;
    await this.setTabsEnabled(tabsEnabled);
  }

  async setTabDisabled(tabId: number) {
    const tabsEnabled: TabsEnabled = await this.getTabsEnabled();
    delete tabsEnabled[`${tabId}`];
    await this.setTabsEnabled(tabsEnabled);
  }

  async isTabEnabled(tabId: number) {
    const tabsEnabled: TabsEnabled = await this.getTabsEnabled();
    return tabsEnabled[`${tabId}`] === true;
  }

  async getTabsEnabledIds(): Promise<number[]> {
    const tabs = await this.getTabsEnabled();
    return Object.keys(tabs).map(id => Number(id));
  }

  async initTabsEnabled() {
    await this.setTabsEnabled({});
  }
}
