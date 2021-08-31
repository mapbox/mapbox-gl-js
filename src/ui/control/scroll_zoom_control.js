// @flow

import {extend, bindAll} from '../../util/util.js';
import {Evented} from '../../util/evented.js';
import DOM from '../../util/dom.js';
import window from '../../util/window.js';

import type Map from './../map.js';

const defaultOptions = {
    closeButton: false,
    className: ' ',
    maxWidth: 500,
    closeFadeOut: true
};

export type Options = {
    closeButton?: boolean,
    className?: string,
    closeFadeOut?: boolean
};

/**
 * A scroll zoom control component.
 *
 * @param {Object} [options]
 * @param {boolean} [options.closeButton=false] If `true`, a close button will appear in the
 *  top right corner of the scroll zoom control alert.
 * @param {string} [options.className] Space-separated CSS class names to add to scroll zoom control container.
 * @example
 * const scrollZoomControl = new mapboxgl.ScrollZoomControl({closeButton: true})
 *     .setHTML("<h1>'Use ⌘ + scroll to zoom the map'</h1>")
 *     .addTo(map);
 */
export default class ScrollZoomControl extends Evented {
    _map: Map;
    options: Options;
    _content: HTMLElement;
    _container: HTMLElement;
    _closeButton: HTMLElement;
    _closeFadeOut: any;
    _classList: Set<string>;

    constructor(options: Options) {
        super();
        this.options = extend(Object.create(defaultOptions), options);
        bindAll(['_update', '_onClose', 'remove'], this);
        this._classList = new Set(options && options.className ?
            options.className.trim().split(/\s+/) : []);
    }

    /**
     * Adds the scroll zoom control alert to a map.
     *
     * @param {Map} map The Mapbox GL JS map to add the scroll zoom control to.
     * @returns {ScrollZoomControl} Returns itself to allow for method chaining.
     * @example
     * new mapboxgl.ScrollZoomControl().setHTML();
     * map.addControl(scrollZoomControl);
     */
    onAdd(map: Map) {
        if (this._map) this.remove();

        this._map = map;
        this._map.on('remove', this.remove);
        this._update();

        return this;
    }

    /**
     * Removes the scroll zoom control from the map it has been added to.
     *
     * @example
     * const scrollZoomControl = new mapboxgl.ScrollZoomControl();
     * map.addControl(scrollZoomControl);
     * scrollZoomControl.remove();
     * @returns {ScrollZoomControl} Returns itself to allow for method chaining.
     */
    remove() {
        if (this._content) {
            DOM.remove(this._content);
        }

        if (this._container) {
            DOM.remove(this._container);
            delete this._container;
        }

        if (this._map) {
            this._map.off('move', this._update);
            this._map.off('move', this._onClose);
            this._map.off('click', this._onClose);
            this._map.off('dblclick', this._onClose);
            this._map.off('remove', this.remove);
            delete this._map;
        }

        return this;
    }

    /**
     * Returns the `ScrollZoomControl`'s HTML element.
     *
     * @example
     * // Change the `ScrollZoomControl` element's font size
     * const scrollZoomControl = new mapboxgl.ScrollZoomControl()
     *     .setHTML("<p>Use ⌘ + scroll to zoom the map</p>");
     * map.addControl(scrollZoomControl);
     * const scrollZoomControlElem = scrollZoomControl.getElement();
     * scrollZoomControl.style.fontSize = "25px";
     * @returns {HTMLElement} Returns container element.
     */
    getElement() {
        return this._container;
    }

    /**
     * Sets the scroll zoom control's content to a string of text.
     *
     * This function creates a [Text](https://developer.mozilla.org/en-US/docs/Web/API/Text) node in the DOM,
     * so it cannot insert raw HTML. Use this method for security against XSS
     * if the scroll zoom control content is user-provided.
     *
     * @param {string} text Textual content for the scroll zoom control alert.
     * @returns {ScrollZoomControl} Returns itself to allow for method chaining.
     * @example
     * const scrollZoomControl = new mapboxgl.ScrollZoomControl()
     *     .setText('Hello, world!');
     * map.addControl(scrollZoomControl);
     */
    setText(text: string) {
        return this.setDOMContent(window.document.createTextNode(text));
    }

    /**
     * Sets the scroll zoom control's content to the HTML provided as a string.
     *
     * This method does not perform HTML filtering or sanitization, and must be
     * used only with trusted content. Consider {@link ScrollZoomControl#setText} if
     * the content is an untrusted text string.
     *
     * @param {string} html A string representing HTML content for the scroll zoom control.
     * @returns {ScrollZoomControl} Returns itself to allow for method chaining.
     * @example
     * const scrollZoomControl = new mapboxgl.ScrollZoomControl()
     *     .setHTML("<h1>Use ⌘ + scroll to zoom the map</h1>");
     * map.addControl(scrollZoomControl);
     */
    setHTML(html: string = 'Use ⌘ + scroll to zoom the map') {
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
     * Sets the scroll zoom control's content to the element provided as a DOM node.
     *
     * @param {Element} htmlNode A DOM node to be used as content for the scroll zoom control alert.
     * @returns {ScrollZoomControl} Returns itself to allow for method chaining.
     * @example
     * // create an element with the scroll zoom control content
     * const div = window.document.createElement('div');
     * div.innerHTML = 'Use ⌘ + scroll to zoom the map';
     * const scrollZoomControl = new mapboxgl.ScrollZoomControl()
     *     .setDOMContent(div);
     * map.addControl(scrollZoomControl);
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
            this._content = DOM.create('div', 'mapboxgl-scroll-zoom-control-content', this._container);
        }

        // The close button should be the last tabbable element inside the scroll zoom control for a good keyboard UX.
        this._content.appendChild(htmlNode);
        this._createCloseButton();
        this._update();
        return this;
    }

    /**
     * Adds a CSS class to the scroll zoom control container element.
     *
     * @param {string} className Non-empty string with CSS class name to add to scroll zoom control container.
     * @returns {ScrollZoomControl} Returns itself to allow for method chaining.
     *
     * @example
     * const scrollZoomControl = new mapboxgl.ScrollZoomControl();
     * scrollZoomControl.addClassName('some-class');
     */
    addClassName(className: string) {
        this._classList.add(className);
        if (this._container) {
            this._updateClassList();
        }
        return this;
    }

    /**
     * Removes a CSS class from the scroll zoom control container element.
     *
     * @param {string} className Non-empty string with CSS class name to remove from scroll zoom control container.
     *
     * @returns {ScrollZoomControl} Returns itself to allow for method chaining.
     * @example
     * const scrollZoomControl = new mapboxgl.ScrollZoomControl({className: 'some classes'});
     * scrollZoomControl.removeClassName('some');
     */
    removeClassName(className: string) {
        this._classList.delete(className);
        if (this._container) {
            this._updateClassList();
        }
        return this;
    }

    /**
     * Add or remove the given CSS class on the scrollZoomControl container, depending on whether the container currently has that class.
     *
     * @param {string} className Non-empty string with CSS class name to add/remove.
     *
     * @returns {boolean} If the class was removed return `false`. If the class was added, then return `true`.
     *
     * @example
     * const scrollZoomControl = new mapboxgl.ScrollZoomControl();
     * scrollZoomControl.toggleClassName('highlighted');
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

    _createCloseButton() {
        if (this.options.closeButton) {
            this._closeButton = DOM.create('button', 'mapboxgl-scroll-zoom-control-close-button', this._content);
            this._closeButton.type = 'button';
            this._closeButton.setAttribute('aria-label', 'Close scroll zoom control alert');
            this._closeButton.innerHTML = '&#215;';
            this._closeButton.addEventListener('click', this._onClose);
        }
    }

    _createFadeOut() {
        const that = this;

        if (this.options.closeFadeOut) {
            setTimeout(() => {
                // initial opacity
                let op = 1;
                const timer = setInterval(() => {
                    if (op <= 0.1) {
                        clearInterval(timer);
                        that._container.style.display = 'none';
                    }
                    that._container.style.opacity = op;
                    op -= op * 0.1;
                }, 30);
            }, 3000);
        }
    }

    _updateClassList() {
        const classes = [...this._classList];
        classes.push('mapboxgl-scroll-zoom-control');
        this._container.className = classes.join(' ');
    }

    _update() {
        if (!this._map || !this._content) { return; }

        if (!this._container) {
            this._container = DOM.create('div', 'mapboxgl-scroll-zoom-control', this._map.getContainer());
            this._container.appendChild(this._content);
        }
        this._updateClassList();

        this._createFadeOut();
    }

    _onClose() {
        this.remove();
    }

}
