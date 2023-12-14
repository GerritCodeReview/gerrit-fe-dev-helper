import {LitElement, html, css} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';

@customElement('gdh-snackbar')
export class HelperSnackbar extends LitElement {
  @property({type: String}) message = '';

  @property({type: Number}) position = 0;

  render() {
    this.style.top = `${this.position * 40}px`;
    return html`<div>${this.message}</div>`;
  }

  static get styles() {
    return css`
      :host {
        position: absolute;
        top: 0px;
        right: 0px;
        background-color: black;
        color: white;
        padding: 10px;
        z-index: 100;
      }
    `;
  }
}

@customElement('gdh-tip')
export class HelperTip extends LitElement {
  @state() numErrors = 0;

  constructor() {
    super();
    this.interceptErrors();
  }

  interceptErrors() {
    let original = console.error;
    console.error = (...args) => {
      original(...args);
      this.numErrors++;
    };
  }

  render() {
    const errors = this.numErrors > 0 ? ` (${this.numErrors} js errors)` : '';
    return html`<div>Gerrit dev helper is enabled ${errors}</div>`;
  }

  static get styles() {
    return css`
      :host {
        z-index: 10000;
        display: block;
        position: fixed;
        bottom: 0;
        right: 0;
        background-color: red;
      }
      div {
        color: white;
        font-weight: bold;
        padding: 10px;
      }
    `;
  }
}
