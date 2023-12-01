import {DEFAULT_RULES, Rule, isValidRule} from './utils';

type TabsEnabled = {[tabId: string]: boolean};

export class StorageUtil {
  // RULES

  async getRules(): Promise<Rule[]> {
    const data = await chrome.storage.sync.get('rules');
    return (data?.['rules'] as Rule[]) ?? [...DEFAULT_RULES];
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

  async getTabsEnabled(): Promise<TabsEnabled> {
    const data = await chrome.storage.session.get('tabsEnabled');
    return (data?.['tabsEnabled'] as TabsEnabled) ?? {};
  }

  async setTabsEnabled(tabsEnabled: TabsEnabled) {
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
}
