// Polymer is provided by Gerrit
// and you may put the definition of a component to a separate file
// and import it here
const template = Polymer.html`
  <style>
    div {
        display: block;
        border: 1px solid #ccc;
        background: #eee;
        color: black;
        padding: 0px 10px;
        cursor: pointer;
    }
    .red {
        color: red;
    }
  </style>
  <div class$="[[extraClass]]">
    [[content]]
  </div>
  `;

class TestComponent extends Polymer.Element {
    static get is() {
        return 'test-component';
    }

    static get template() {
        return template;
    }

    static get properties() {
        return {
            extraClass: {
                type: String,
                value: '',
                observer: '_extraClassChanged'
            },

            content: {
                type: String,
                value: 'button',
            }
        }
    }

    _extraClassChanged(value) {
        console.log(value);
    }
}

// Register the element with the browser
customElements.define('test-component', TestComponent);

// register the component with a gerrit endpoint
Gerrit.install(plugin => {
    plugin.registerCustomComponent('header-small-banner', 'test-component').onAttached(view => {
        view.content = "google";
        view.extraClass = "red";
        view.onclick = () => {
            location.href = "https://google.com";
        };
    });
});