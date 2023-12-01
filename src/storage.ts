import {DEFAULT_RULES, Rule, isValidRule} from './utils';

type TabsEnabled = {[tabId: string]: boolean};

export class StorageUtil {
  // RULES

  async getRulesAsync(): Promise<Rule[]> {
    const data = await chrome.storage.sync.get('rules');
    return (data?.['rules'] as Rule[]) ?? [...DEFAULT_RULES];
  }

  async setRules(rules: Rule[]) {
    console.log(`setRules ${rules.length}`);
    await chrome.storage.sync.set({rules});
  }

  async validateRules() {
    const existingRules = await this.getRulesAsync();
    const validRules = existingRules.filter(isValidRule);
    if (!validRules.length) {
      await this.setRules([...DEFAULT_RULES]);
    } else if (validRules.length < existingRules.length) {
      await this.setRules(validRules);
    }
  }

  // TABS ENABLED

  async getTabsEnabledAsync(): Promise<TabsEnabled> {
    const data = await chrome.storage.session.get('tabsEnabled');
    return (data?.['tabsEnabled'] as TabsEnabled) ?? {};
  }

  async setTabsEnabled(tabsEnabled: TabsEnabled) {
    await chrome.storage.session.set({tabsEnabled});
    console.log(`setTabsEnabled ${Object.keys(tabsEnabled).length}`);
  }

  async setTabEnabled(tabId: number) {
    const tabsEnabled: TabsEnabled = await this.getTabsEnabledAsync();
    tabsEnabled[`${tabId}`] = true;
    await this.setTabsEnabled(tabsEnabled);
  }

  async setTabDisabled(tabId: number) {
    const tabsEnabled: TabsEnabled = await this.getTabsEnabledAsync();
    delete tabsEnabled[`${tabId}`];
    await this.setTabsEnabled(tabsEnabled);
  }

  async isTabEnabledAsync(tabId: number) {
    const tabsEnabled: TabsEnabled = await this.getTabsEnabledAsync();
    return tabsEnabled[`${tabId}`] === true;
  }
}
