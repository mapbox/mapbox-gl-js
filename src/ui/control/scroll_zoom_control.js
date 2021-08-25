// @flow

import DOM from '../util/dom.js';
import {extend, bindAll} from '../util/util.js';
import {Event} from '../util/evented.js';
import window from '../util/window.js';

import type Map from './map.js';

type Options = {
    closeButton?: boolean
};

const defaultOptions = {
    closeButton: false
};


/**
 * A scroll zoom control component. Displays a warning on screen to use ⌘ + scroll to zoom.
 * Add this control to a map using {@link Map#addControl}.
 * 
 * @implements {IControl}
 * @param {Object} [options]
 * @param {boolean} [options.closeButton=false] If `true`, a close button will appear in the
 *  top right corner of the scroll zoom warning.
 * @example
 * const scrollZoomControl = new mapboxgl.ScrollZoomControl({closeButton: false})
 * map.addControl(scrollZoomControl);
 */
class ScrollZoomControl {
    _map: Map;
    options: Options;
    _content: HTMLElement;
    _container: HTMLElement;
    _closeButton: HTMLElement;

    constructor(options: Options) {
        this.options = extend({}, defaultOptions, options);
        // this._container = DOM.create('div', 'mapboxgl-ctrl mapboxgl-ctrl-group');
        bindAll(['_update', '_onClose', 'remove'], this);
    }

    onAdd(map: Map) {
        if (this._map) this.remove();

        this._map = map;

        // this._map.on('click', this._onClose);
        // event listener needs to be for interacting with map 
        this._map._container.addEventListener('click', this._onClose);
        this._map.on('remove', this.remove);
        this._update();

        if (this.options.closeButton) {
            //do close button
        }
        // this._map.on('move', this._update);

        return this._container;
    }

    onRemove() {
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
            this._map.off('remove', this.remove);
            delete this._map;
        }

        return this;
    }

    /**
     * Returns the `GestureHandler`'s HTML element.
     *
     * @example
     * // Change the `GestureHandler` element's font size
     * const gestureHandler = new mapboxgl.GestureHandler()
     *     .setHTML("<p>Hello World!</p>")
     *     .addTo(map);
     * const gestureHandlerElem = gestureHandler.getElement();
     * gestureHandlerElem.style.fontSize = "25px";
     * @returns {HTMLElement} Returns container element.
     */
    getElement() {
        return this._container;
    }

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
     * Sets the gesture handler's content to the element provided as a DOM node.
     *
     * @param {Element} htmlNode A DOM node to be used as content for the gesture handler.
     * @returns {Popup} Returns itself to allow for method chaining.
     * @example
     * // create an element with the gesture handler content
     * const div = window.document.createElement('div');
     * div.innerHTML = 'Hello, world!';
     * const gestureHandler = new mapboxgl.GestureHandler()
     *     .setDOMContent(div)
     *     .addTo(map);
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
            this._content = DOM.create('div', 'mapboxgl-gesture-handler-content', this._container);
        }

        // The close button should be the last tabbable element inside the gesture handler for a good keyboard UX.
        this._content.appendChild(htmlNode);
        this._createCloseButton();
        this._update();
        return this;
    }

    _createCloseButton() {
        if (this.options.closeButton) {
            this._closeButton = DOM.create('button', 'mapboxgl-gesture-handler-close-button', this._content);
            this._closeButton.type = 'button';
            this._closeButton.setAttribute('aria-label', 'Close gesture handler');
            this._closeButton.innerHTML = '&#215;';
            this._closeButton.addEventListener('click', this._onClose);
        }
    }

    _update() {
        if (!this._map || !this._content) { return; }

        if (!this._container) {
            this._container = DOM.create('div', 'mapboxgl-gesture-handler', this._map.getContainer());
            this._container.appendChild(this._content);
        }
    }

    _onClose() {
        this.remove();
    }
}

export default ScrollZoomControl;
