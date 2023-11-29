import {DEFAULT_RULES, Rule, isValidRule} from './utils';

type TabsEnabled = {[tabId: string]: boolean};

export class Storage {
  private cachedActiveTabId: number = 0;
  private cachedTabsEnabled: TabsEnabled = {};
  private cachedRules: Rule[] = [...DEFAULT_RULES];

  constructor() {
    this.init();
  }

  private async init() {
    this.cachedActiveTabId = await this.getActiveTabIdAsync();
    this.cachedTabsEnabled = await this.getTabsEnabledAsync();
    this.cachedRules = await this.getRulesAsync();

    chrome.storage.onChanged.addListener((changes, namespace) => {
      for (let [key, {oldValue, newValue}] of Object.entries(changes)) {
        if (namespace === 'sync' && key === 'rules') {
          this.cachedRules = newValue;
        }
        if (namespace === 'session' && key === 'tabsEnabled') {
          this.cachedTabsEnabled = newValue;
        }
        if (namespace === 'session' && key === 'activeTabId') {
          this.cachedActiveTabId = newValue;
        }
        console.log(
          `Storage key "${key}" in namespace "${namespace}" changed.`,
          `Old value was "${oldValue}", new value is "${newValue}".`
        );
      }
    });
  }

  // ACTIVE TAB ID

  getActiveTabIdCached(): number {
    return this.cachedActiveTabId;
  }

  async getActiveTabIdAsync(): Promise<number> {
    const data = await chrome.storage.session.get('activeTabId');
    return (data?.['activeTabId'] as number) ?? 0;
  }

  async setActiveTabId(activeTabId: number) {
    await chrome.storage.session.set({activeTabId});
  }

  // RULES

  getRulesCached(): Rule[] {
    return this.cachedRules;
  }

  async getRulesAsync(): Promise<Rule[]> {
    const data = await chrome.storage.sync.get('rules');
    return (data?.['rules'] as Rule[]) ?? [...DEFAULT_RULES];
  }

  async setRules(rules: Rule[]) {
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

  private async setTabsEnabled(tabsEnabled: TabsEnabled) {
    await chrome.storage.session.set({tabsEnabled});
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

  async isTabEnabledCached(tabId: number) {
    return this.cachedTabsEnabled[`${tabId}`] === true;
  }
}
