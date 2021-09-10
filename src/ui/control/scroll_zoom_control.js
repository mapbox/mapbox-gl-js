// @flow

import {extend, bindAll} from '../../util/util.js';
import DOM from '../../util/dom.js';
import window from '../../util/window.js';

import type Map from './../map.js';
import type {MapWheelEvent} from './../events.js';

const defaultOptions = {
    showAlert: true,
    className: ' '
};

export type Options = {
    showAlert?: boolean,
    className?: string
};

/**
 * A scroll zoom blocker control component.
 *
 * @implements {IControl}
 * @param {Object} [options]
 * @param {boolean} [options.showAlert=true] If `true`, an alert will appear when a user
 * attempts to scroll zoom without pressing ctrl or  ⌘ keys.
 * @param {string} [options.className] Space-separated CSS class names to add to scroll zoom blocker control container.
 * @example
 * const ScrollZoomBlockerControl = new mapboxgl.ScrollZoomBlockerControl();
 * map.addControl(scrollZoomBlockerControl);
 */
export default class ScrollZoomBlockerControl {
    _map: Map;
    options: Options;
    _content: HTMLElement;
    _container: HTMLElement;
    _classList: Set<string>;

    constructor(options: Options) {
        this.options = extend({}, defaultOptions, options);

        bindAll(['_showAlert', '_fadeOutAlert', '_setDefaultAlertHTML', '_update', '_updateClassList'], this);
        this._classList = new Set(options && options.className ?
            options.className.trim().split(/\s+/) : []);
    }

    /**
     * Adds the scroll zoom blocker control alert to a map.
     *
     * @param {Map} map The Mapbox GL JS map to add the scroll zoom blocker control to.
     * @returns {ScrollZoomBlockerControl} Returns itself to allow for method chaining.
     * @example
     * const ScrollZoomBlockerControl = new mapboxgl.ScrollZoomBlockerControl();
     * map.addControl(ScrollZoomBlockerControl);
     */
    onAdd(map: Map) {
        if (this._map) this.onRemove();

        this._map = map;

        this._update();

        if (!this._content) this._setDefaultAlertHTML();

        this._map.on('remove', this.onRemove);
        this._map.on('wheel', (e) => this.preventDefault(e));

        return this._container;
    }

    /**
     * Removes the scroll zoom blocker control from the map it has been added to.
     *
     * @example
     * const scrollZoomBlockerControl = new mapboxgl.ScrollZoomBlockerControl();
     * map.addControl(scrollZoomBlockerControl);
     * map.removeControl(scrollZoomBlockerControl);
     * @returns {ScrollZoomBlockerControl} Returns itself to allow for method chaining.
     */
    onRemove() {
        if (this._content) {
            DOM.remove(this._content);
            delete this._content;
        }

        if (this._container) {
            DOM.remove(this._container);
            delete this._container;
        }

        if (this._map) {
            this._map.off('remove', this.onRemove);
            delete this._map;
        }
    }

    preventDefault(e: MapWheelEvent) {
        //Can't remove wheel event listener once added, so also checks if container exists before preventing zoom
        if (!e.originalEvent.ctrlKey && !e.originalEvent.metaKey && !!this._container) {
            e.preventDefault();
            if (this.options.showAlert) {
                this._update();
                this._showAlert();
                this._fadeOutAlert();
            }
        }
    }

    getDefaultPosition() {
        return 'full-container';
    }

    /**
     * Returns the `ScrollZoomBlockerControl`'s HTML element.
     *
     * @example
     * // Change the `ScrollZoomBlockerControl` element's font size
     * const scrollZoomBlockerControl = new mapboxgl.ScrollZoomBlockerControl();
     * map.addControl(scrollZoomBlockerControl);
     * const scrollZoomBlockerControlElem = scrollZoomBlockerControl.getElement();
     * scrollZoomBlockerControl.style.fontSize = "25px";
     * @returns {HTMLElement} Returns container element.
     */
    getElement() {
        return this._container;
    }

    /**
     * Sets the scroll zoom blocker control's content to a string of text.
     *
     * This function creates a [Text](https://developer.mozilla.org/en-US/docs/Web/API/Text) node in the DOM,
     * so it cannot insert raw HTML. Use this method for security against XSS
     * if the scroll zoom blocker control content is user-provided.
     *
     * @param {string} text Textual content for the scroll zoom blocker control alert.
     * @returns {ScrollZoomBlockerControl} Returns itself to allow for method chaining.
     * @example
     * const scrollZoomBlockerControl = new mapboxgl.ScrollZoomBlockerControl()
     *     .setText('Hello, world!');
     * map.addControl(scrollZoomBlockerControl);
     */
    setText(text: string) {
        return this.setDOMContent(window.document.createTextNode(text));
    }

    /**
     * Sets the scroll zoom blocker control's content to the HTML provided as a string.
     *
     * This method does not perform HTML filtering or sanitization, and must be
     * used only with trusted content. Consider {@link ScrollZoomBlockerControl#setText} if
     * the content is an untrusted text string.
     *
     * @param {string} html A string representing HTML content for the scroll zoom blocker control.
     * @returns {ScrollZoomBlockerControl} Returns itself to allow for method chaining.
     * @example
     * const scrollZoomBlockerControl = new mapboxgl.ScrollZoomBlockerControl()
     *     .setHTML("<h1>Hello World!</h1>");
     * map.addControl(scrollZoomBlockerControl);
     */

    setHTML(html: string) {
        const frag = window.document.createDocumentFragment();
        const temp = window.document.createElement('body');
        let child;
        temp.innerHTML = html;
        while (true) {
            child = temp.firstChild;
            if (!child) break;
            frag.appendChild(child);
        }

        return this.setDOMContent(frag);
    }

    /**
     * Sets the scroll zoom blocker control's content to the element provided as a DOM node.
     *
     * @param {Element} htmlNode A DOM node to be used as content for the scroll zoom blocker control alert.
     * @returns {ScrollZoomBlockerControl} Returns itself to allow for method chaining.
     * @example
     * // create an element with the scroll zoom blocker control content
     * const div = window.document.createElement('div');
     * div.innerHTML = 'Hello World';
     * const scrollZoomBlockerControl = new mapboxgl.ScrollZoomBlockerControl()
     *     .setDOMContent(div);
     * map.addControl(scrollZoomBlockerControl);
     */
    setDOMContent(htmlNode: Node) {
        if (this._content) {
            // Clear out children first.
            while (this._content.hasChildNodes()) {
                if (this._content.firstChild) {
                    this._content.removeChild(this._content.firstChild);
                }
            }
        } else {
            this._content = DOM.create('div', 'mapboxgl-scroll-zoom-blocker-control-content', this._container);
        }

        this._content.appendChild(htmlNode);
        this._update();
        return this;
    }

    /**
     * Adds a CSS class to the scroll zoom blocker control container element.
     *
     * @param {string} className Non-empty string with CSS class name to add to scroll zoom blocker control container.
     * @returns {ScrollZoomBlockerControl} Returns itself to allow for method chaining.
     *
     * @example
     * const scrollZoomBlockerControl = new mapboxgl.ScrollZoomBlockerControl();
     * scrollZoomBlockerControl.addClassName('some-class');
     */
    addClassName(className: string) {
        this._classList.add(className);
        if (this._container) {
            this._updateClassList();
        }
        return this;
    }

    /**
     * Removes a CSS class from the scroll zoom blocker control container element.
     *
     * @param {string} className Non-empty string with CSS class name to remove from scroll zoom blocker control container.
     *
     * @returns {ScrollZoomBlockerControl} Returns itself to allow for method chaining.
     * @example
     * const scrollZoomBlockerControl = new mapboxgl.ScrollZoomBlockerControl({className: 'some classes'});
     * scrollZoomBlockerControl.removeClassName('some');
     */
    removeClassName(className: string) {
        this._classList.delete(className);
        if (this._container) {
            this._updateClassList();
        }
        return this;
    }

    /**
     * Add or remove the given CSS class on the scrollZoomBlockerControl container, depending on whether the container currently has that class.
     *
     * @param {string} className Non-empty string with CSS class name to add/remove.
     *
     * @returns {boolean} If the class was removed return `false`. If the class was added, then return `true`.
     *
     * @example
     * const scrollZoomBlockerControl = new mapboxgl.ScrollZoomBlockerControl();
     * scrollZoomBlockerControl.toggleClassName('highlighted');
     */
    toggleClassName(className: string) {
        let finalState: boolean;
        if (this._classList.delete(className)) {
            finalState = false;
        } else {
            this._classList.add(className);
            finalState = true;
        }
        if (this._container) {
            this._updateClassList();
        }
        return finalState;
    }

    _setDefaultAlertHTML() {
        // If setHTML isn't implemented by client, setHTML with corresponding default alert.
        if (window.navigator.platform.toUpperCase().indexOf('MAC') >= 0) {
            // If operating system is a mac, use alert with CMD key
            this.setHTML('Use ⌘ + scroll to zoom the map');
        } else {
            this.setHTML('Use CTRL + scroll to zoom the map');
        }
    }

    _showAlert() {
        this.removeClassName('mapboxgl-scroll-zoom-blocker-control-fade');
        this._container.style.visibility = 'visible';
        this._container.style.opacity = '1';
    }

    _fadeOutAlert() {
        setTimeout(() => {
            this.addClassName('mapboxgl-scroll-zoom-blocker-control-fade');
            this._container.style.opacity = '0';
        }, 1000);
    }

    _updateClassList() {
        const classes = [...this._classList];
        classes.push('mapboxgl-scroll-zoom-blocker-control');
        this._container.className = classes.join(' ');
    }

    _update() {
        if (!this._map || !this._content) { return; }

        if (!this._container) {
            this._container = DOM.create('div', 'mapboxgl-ctrl');
            this._container.append(this._content);
        }

        this._updateClassList();
    }

}
