import {css, customElement, html, LitElement, property } from 'lit-element';

import {getDefaultRules, isInjectRule, Operator, Rule} from './utils';

const EMPTY_RULE = {
  disabled: false,
  target: '',
  operator: Operator.BLOCK,
  destination: '',
  isNew: true,
};

/**
 * GdhApp component.
 */
@customElement('gdh-app')
export class GdhApp extends LitElement {
  @property({type: Array, attribute: false}) rules: Rule[] = [];
  @property() changeId: string = '';
  @property() announcementText = 'To get latest rules, click `reset`.';
  @property({type: Boolean}) isImport = false;
  @property() rulesStr = '';
  @property() importError = '';

  constructor() {
    super();
    this.loadRules();
    const lastAnnouncement = window.localStorage.getItem('helper-announcement');
    if (!lastAnnouncement || lastAnnouncement !== this.announcementText) {
      window.localStorage.setItem('helper-announcement', this.announcementText);
      setTimeout(() => {
        this.announcementText = '';
      }, 3 * 1000);
    } else {
      // only show it once, if showed, don't show them again
      this.announcementText = '';
    }
  }

  private loadRules() {
    chrome.storage.sync.get(['rules', 'enabled'], (result) => {
      if (!result['rules']) return;
      this.rules =
          (result['rules'] as Rule[]).map(rule => (rule.isNew = false, rule));
      this.rulesStr = JSON.stringify(this.rules, null, 2);
    });
  }

  saveRules() {
    chrome.storage.sync.set({rules: this.rules.slice()});
    chrome.runtime.sendMessage(
        {type: 'updateRules', rules: this.rules.slice()});

    this.refresh();
  }

  addNewRule() {
    this.rules = [...this.rules, {...EMPTY_RULE}];
  }

  resetRules() {
    getDefaultRules().then(rules => {
      this.rules = [...rules];
      this.rulesStr = JSON.stringify(this.rules, null, 2);
      window.localStorage.removeItem('helper-announcement');
      this.requestUpdate();
    })
  }

  onRuleDeletion(event: CustomEvent<Rule>) {
    this.rules = this.rules.filter(r => r !== event.detail);
    this.rulesStr = JSON.stringify(this.rules, null, 2);
  }

  enableMeOnly(event: CustomEvent<Rule>) {
    this.rules = this.rules.map(rule => {
      const toggledRule = event.detail;
      rule.disabled = rule !== toggledRule;
      return {...rule};
    });
  }

  onRuleChanged(event: CustomEvent<Rule>) {
    this.rules = this.rules.map(rule => ({...rule}));
  }

  disableHelper() {
    this.refresh(tab => {
      chrome.runtime.sendMessage({type: 'disableHelper', tab});
      return null;
    });
    window.close();
  }

  private refresh(runBefore?: (tab: chrome.tabs.Tab) => null) {
    // refresh the tab now
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (!tabs[0] || !tabs[0].id) return;
      if (runBefore) runBefore(tabs[0]);
      chrome.tabs.update(tabs[0].id, {url: tabs[0].url});
    });
  }

  startImport() {
    this.isImport = true;
  }

  confirmImport() {
    try {
      const rules = JSON.parse(this.rulesStr);
      this.rules = rules;
      this.saveRules();
      this.isImport = false;
    } catch (e) {
      this.importError = e.message;
    }
  }

  cancelImport() {
    this.isImport = false;
  }

  handleRulesInputChange(e: Event) {
    this.rulesStr = (e.target as HTMLInputElement).value;
  }

  exportRules() {
    const dataStr = 'data:text/json;charset=utf-8,' +
        encodeURIComponent(JSON.stringify(this.rules));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute('href', dataStr);
    downloadAnchorNode.setAttribute('download', 'rules.json');
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }

  render() {
    return html`
        <p ?hidden=${!this.announcementText}>${this.announcementText}</p>
        <header>
          <button @click=${this.disableHelper}>Disable</button>
        </header>
        <div ?hidden=${this.isImport}>
          <gdh-rule-set
            @enable-me-only=${this.enableMeOnly}
            @rule-deleted=${this.onRuleDeletion}
            @rule-changed=${this.onRuleChanged}
            .rules=${this.rules}>
          </gdh-rule-set>
          <div class="buttons">
            <button @click=${this.saveRules}>Save</button>
            <button @click=${this.addNewRule}>Add</button>
            <button @click=${this.resetRules}>Reset</button>
            <button @click=${this.startImport}>Import</button>
            <button @click=${this.exportRules}>Export</button>
          </div>
        </div>
        <div ?hidden=${!this.isImport}>
          <p ?hidden=${!this.importError}>${this.importError}</p>
          <textarea
            name="rules"
            .value=${this.rulesStr}
            @input=${this.handleRulesInputChange}>
          </textarea>
          <div class="buttons">
            <button @click=${this.confirmImport}>Import</button>
            <button @click=${this.cancelImport}>Cancel</button>
            <button @click=${this.resetRules}>Reset</button>
          </div>
        </div>
        `;
  }

  static get styles() {
    return css`
        p {
          background: yellow;
          padding: 10px;
        }
        button {
          font-family: Roboto, sans-serif;
          font-size: .875rem;
          font-weight: 500;
          text-transform: uppercase;
          user-select: none;
          box-sizing: content-box;
          border-radius: 4px;
          border: 1px solid #333;
          padding: 5px;
          cursor: pointer;
          outline: none;
        }
        button:hover {
          background-color: #f4f0fa;
        }
        header {
          display: flex;
          flex-direction: row-reverse;
        }
        textarea {
          min-width: 500px;
          min-height: 500px;
        }
        `;
  }
}

/**
 * GdhRuleSet component.
 */
@customElement('gdh-rule-set')
export class GdhRuleSet extends LitElement {
  @property({type: Array, attribute: false}) rules: Rule[] = [];

  render() {
    return html`
        <ul>
          <li>
            <span></span>
            <span>Target</span>
            <span>Operator</span>
            <span>Destination</span>
          </li>
          ${
        this.rules.map(
            rule =>
                html`<li><gdh-rule-item .rule=${rule}></gdh-rule-item></li>`)}
        </ul>
        `;
  }

  static get styles() {
    return css`
        :host {
          position: relative;
          display: flex;
          flex-direction: row;
        }
        ul {
          list-style: none;
          margin: 0;
          padding: 10px;
          width: 100%;
        }
        ul li {
          display: flex;
          margin: 5px 0;
          width: 100%;
        }
        li span {
          text-align: center;
        }
        li span:nth-child(1) {
          flex-basis: 30px;
        }
        li span:nth-child(2) {
          flex-basis: 220px;
        }
        li span:nth-child(3) {
          flex-basis: 130px;
        }
        li span:nth-child(4) {
          flex: 1;
        }
        `;
  }
}

/**
 * GdhRuleItem component.
 */
@customElement('gdh-rule-item')
export class GdhRuleItem extends LitElement {
  @property({type: Object, attribute: false}) rule: Rule = {...EMPTY_RULE};

  operators = [
    Operator.BLOCK,
    Operator.REDIRECT,
    Operator.INJECT_HTML_PLUGIN,
    Operator.INJECT_HTML_CODE,
    Operator.INJECT_JS_PLUGIN,
    Operator.INJECT_JS_CODE,
  ];

  handleInputOnTarget(e: Event) {
    this.rule.target = (e.target as HTMLInputElement).value;
    this.requestUpdate();
  }

  handleInputOnDestination(e: Event) {
    this.rule.destination = (e.target as HTMLInputElement).value;
    this.requestUpdate();
  }

  onSelectedChange(e: CustomEvent<number>) {
    this.rule.operator = this.operators[e.detail];
    this.requestUpdate();
  }

  onRuleDeletion(rule: Rule) {
    this.dispatchEvent(new CustomEvent<Rule>('rule-deleted', {
      detail: rule,
      bubbles: true,
      composed: true,
    }));
  }

  toggleDisable(e: KeyboardEvent) {
    this.rule.disabled = !this.rule.disabled;
    // notify the change
    this.dispatchEvent(new CustomEvent<Rule>('rule-changed', {
      detail: this.rule,
      bubbles: true,
      composed: true,
    }));
  }

  enableOnlyMe(e: KeyboardEvent) {
    this.dispatchEvent(new CustomEvent<Rule>('enable-me-only', {
      detail: this.rule,
      bubbles: true,
      composed: true,
    }));
  }

  render() {
    return html`
        <input
          type="checkbox"
          .checked=${!this.rule.disabled}
          @dblclick=${this.enableOnlyMe}
          @click=${this.toggleDisable} />
        <input
          class="target"
          .disabled=${isInjectRule(this.rule)}
          type="text"
          .value=${this.rule.target}
          @input=${this.handleInputOnTarget} />
        <gdh-dropdown
          .selectedIndex=${this.operators.indexOf(this.rule.operator)}
          @select-changed=${this.onSelectedChange}
          .items=${this.operators}>
        </gdh-dropdown>
        <textarea
          name="destination"
          .value=${this.rule.destination}
          @input=${this.handleInputOnDestination}
          .disabled=${this.rule.operator === Operator.BLOCK}>
        </textarea>
        <span class="deleteBtn" @click=${
        this.onRuleDeletion.bind(this, this.rule)}>x</span>
        `;
  }

  static get styles() {
    return css`
        :host {
          position: relative;
          display: flex;
          flex-direction: row;
        }
        .deleteBtn {
          padding: 5px;
          font-size: 18px;
          cursor: pointer;
          flex-basis: 20px;
        }
        input[type="checkbox"] {
          margin: 10px;
          flex-basis: 20px;
        }
        input[type="text"],
        textarea {
          flex: 1;
          min-width: 220px;
          outline: none;
          border: none;
          border-bottom: 1px solid #ccc;
        }
        input[type="text"]:focus,
        textarea:focus {
          border-bottom: 1px solid #3c88fd;
          background: #9dc3fd;
        }
        input[disabled],
        textarea[disabled] {
          background: #ddd;
        }
        `;
  }
}

/**
 * GdhDropdown component.
 */
@customElement('gdh-dropdown')
export class GdhDropdown extends LitElement {
  @property({type: Array, attribute: false}) items: unknown[] = [];
  @property({type: Number}) selectedIndex: number = 0;
  @property({type: Boolean}) isVisible = false;

  handleSelect(idx: number) {
    this.selectedIndex = idx;
    this.dispatchEvent(new CustomEvent<number>('select-changed', {
      detail: idx,
      bubbles: true,
      composed: true,
    }));
    this.isVisible = false;
  }

  toggleVisible(e: Event) {
    this.isVisible = (e.target as HTMLInputElement).checked;
  }

  render() {
    return html`
        <label for="trigger" @click=${this.toggleVisible}>
          <div class="selected-value">${this.items[this.selectedIndex]}</div>
          <input
            .checked=${this.isVisible}
            @input=${this.toggleVisible}
            type="checkbox"
            name="trigger" />
          <ul class="options">
          ${this.items.map((item, i) => html`
            <li
              @click=${this.handleSelect.bind(this, i)}
              class="${i === this.selectedIndex ? 'active' : ''}">
              ${item}
            </li>
            `)}
          </ul>
          <i></i>
        </label>
        `;
  }

  static get styles() {
    return css`
        :host {
          position: relative;
          display: flex;
          flex-direction: column;
        }
        label {
          background-color: #f1f1f1;
          margin: 0 5px;
        }
        i {
          position: absolute;
          top: 10px;
          right: 15px;
          border: solid #555;
          border-width: 0 3px 3px 0;
          display: inline-block;
          padding: 3px;
          transform: rotate(45deg);
          -webkit-transform: rotate(45deg);
        }
        .selected-value {
          padding: 8px 15px;
          min-width: 100px;
        }
        ul {
          display: none;
          list-style: none;
          margin: 0;
          padding: 0;
          width: 100%;
          position: absolute;
          top: 100%;
          left: 0;
          background: #eee;
          z-index: 1;
        }
        input {
          opacity: 0;
          position: absolute;
          top: 0;
          width: 100%;
          height: 100%;
          cursor: pointer;
       }
        input:checked + ul {
          display: block;
          box-shadow: 0 2px 1px -1px rgba(0, 0, 0, 0.2),0 1px 1px 0 rgba(0, 0, 0, 0.14),0 1px 3px 0 rgba(0,0,0,.12);
        }
        input:checked + ul li:hover {
          background: #ddd;
        }
        input:checked + ul li {
          padding: 5px 10px;
          cursor: pointer;
        }
        input:checked + ul li.active,
        input:checked + ul li.active:hover {
          background-color: #fff;
        }
        input:checked + ul + i {
          transform: rotate(-135deg);
          -webkit-transform: rotate(-135deg);
        }
        `;
  }
}
