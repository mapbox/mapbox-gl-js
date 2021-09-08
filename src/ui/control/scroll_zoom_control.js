// @flow

import {extend, bindAll} from '../../util/util.js';
import {Evented} from '../../util/evented.js';
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
 * A scroll zoom control component.
 *
 * @implements {IControl}
 * @param {Object} [options]
 * @param {boolean} [options.showAlert=true] If `true`, an alert will appear when a user
 * attempts to scroll zoom without pressing ctrl or  ⌘ keys.
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
    _showAlert: any;
    _classList: Set<string>;

    constructor(options: Options) {
        super();
        this.options = extend({}, defaultOptions, options);

        bindAll(['_update', '_showAlert','_fadeOutAlert'], this);
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
        this._update();
        this._map.on('remove', this.remove);
        this._map.on('wheel', (e) => this.preventDefault(e));
        return this._container;
    }

    /**
     * Removes the scroll zoom control from the map it has been added to.
     *
     * @example
     * const scrollZoomControl = new mapboxgl.ScrollZoomControl();
     * map.addControl(scrollZoomControl);
     * scrollZoomControl.onRemove();
     * @returns {ScrollZoomControl} Returns itself to allow for method chaining.
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
            this._map.off('remove', this.remove);
            this._map.off('wheel', this.preventDefault);
            delete this._map;
        }

        return this._container;
    }

    preventDefault(e: MapWheelEvent) {
        if (!e.originalEvent.ctrlKey && !e.originalEvent.metaKey) {
            e.preventDefault();
            if (this.options.showAlert) {
                this._update();
                this._showAlert();
                this._fadeOutAlert();
            }
        }
    }

    getDefaultPosition() {
        return 'fullscreen';
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

        this._content.appendChild(htmlNode);
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

    _setOpacity(opacity: string) {
        if (this._content) this._content.style.opacity = opacity;
    }

    _showAlert() {
        this.removeClassName('mapboxgl-scroll-zoom-control-fade');
        this._container.style.visibility = 'visible';
        this._container.style.opacity = '1';
    }

    _fadeOutAlert() {
        setTimeout(() => {
            this.addClassName('mapboxgl-scroll-zoom-control-fade');
            this._container.style.opacity = '0';
        }, 2000);
    }

    _updateClassList() {
        const classes = [...this._classList];
        classes.push('mapboxgl-scroll-zoom-control');
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
