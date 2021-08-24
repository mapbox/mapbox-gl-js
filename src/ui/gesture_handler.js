// @flow

import {extend, bindAll} from '../util/util.js';
import {Event, Evented} from '../util/evented.js';
import DOM from '../util/dom.js';
import window from '../util/window.js';

import type Map from './map.js';

const defaultOptions = {
    closeButton: false,
    className: '',
    maxWidth: 500
};

export type GestureHandlerOptions = {
    closeButton?: boolean,
    className?: string,
    maxWidth?: string
};

/**
 * A gesture handler component.
 *
 * @param {Object} [options]
 * @param {boolean} [options.closeButton=false] If `true`, a close button will appear in the
 *  top right corner of the gesture handler.
 * @param {string} [options.className] Space-separated CSS class names to add to gesture handler container.
 * @param {string} [options.maxWidth='240px'] -
 *  A string that sets the CSS property of the popup's maximum width (for example, `'300px'`).
 *  To ensure the popup resizes to fit its content, set this property to `'none'`.
 *  See the MDN documentation for the list of [available values](https://developer.mozilla.org/en-US/docs/Web/CSS/max-width).
 * @example
 * const gestureHandler = new mapboxgl.GestureHandler({className: 'my-class'})
 *     .setHTML("<h1>Hello World!</h1>")
 *     .setMaxWidth("300px")
 *     .addTo(map);
 */
export default class GestureHandler extends Evented {
    _map: Map;
    options: GestureHandlerOptions;
    _content: HTMLElement;
    _container: HTMLElement;
    _closeButton: HTMLElement;
    _classList: Set<string>;

    constructor(options: GestureHandlerOptions) {
        super();
        this.options = extend(Object.create(defaultOptions), options);
        bindAll(['_update', '_onClose', 'remove', '_onMouseMove', '_onMouseUp', '_onDrag'], this);
        this._classList = new Set(options && options.className ?
            options.className.trim().split(/\s+/) : []);
    }

    /**
     * Adds the gesture handler to a map.
     *
     * @param {Map} map The Mapbox GL JS map to add the gesture handler to.
     * @returns {GestureHandler} Returns itself to allow for method chaining.
     * @example
     * new mapboxgl.GestureHandler()
     *     .setHTML("<h1>Null Island</h1>")
     *     .addTo(map);
     */
    addTo(map: Map) {
        if (this._map) this.remove();

        this._map = map;

        this._map.on('zoomstart', this._onClose);
        this._map.on('remove', this.remove);
        this._update();

        this._map.on('move', this._update);

        /**
         * Fired when the gesture handler is opened manually or programatically.
         *
         * @event open
         * @memberof GestureHandler
         * @instance
         * @type {Object}
         * @property {GestureHandler} gestureHandler Object that was opened.
         *
         */
        this.fire(new Event('open'));

        return this;
    }

    /**
     * Checks if a gesture handler is open.
     *
     * @returns {boolean} `true` if the gesture handler is open, `false` if it is closed.
     * @example
     * const isGestureHandlerOpen = gestureHandler.isOpen();
     */
    isOpen() {
        return !!this._map;
    }

    /**
     * Removes the gesture handler from the map it has been added to.
     *
     * @example
     * const gestureHandler = new mapboxgl.GestureHandler().addTo(map);
     * gestureHandler.remove();
     * @returns {GestureHandler} Returns itself to allow for method chaining.
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
            this._map.off('zoomstart', this._onClose);
            this._map.off('remove', this.remove);
            delete this._map;
        }

        /**
         * Fired when the popup is closed manually or programatically.
         *
         * @event close
         * @memberof GestureHandler
         * @instance
         * @type {Object}
         * @property {GestureHandler} gestureHandler Object that was closed.
         *
         * @example
         * // Create a gesture handler
         * const gestureHandler = new mapboxgl.GestureHandler();
         * // Set an event listener that will fire
         * // any time the popup is closed
         * gestureHandler.on('close', () => {
         *     console.log('gesture handler was closed');
         * });
         *
         */
        this.fire(new Event('close'));

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

    /**
     * Sets the gesture handler's content to a string of text.
     *
     * This function creates a [Text](https://developer.mozilla.org/en-US/docs/Web/API/Text) node in the DOM,
     * so it cannot insert raw HTML. Use this method for security against XSS
     * if the gesture handler content is user-provided.
     *
     * @param {string} text Textual content for the gesture handler.
     * @returns {GestureHandler} Returns itself to allow for method chaining.
     * @example
     * const gestureHandler = new mapboxgl.GestureHandler()
     *     .setText('Hello, world!')
     *     .addTo(map);
     */
    setText(text: string) {
        return this.setDOMContent(window.document.createTextNode(text));
    }

    /**
     * Sets the gesture handler's content to the HTML provided as a string.
     *
     * This method does not perform HTML filtering or sanitization, and must be
     * used only with trusted content. Consider {@link GestureHandler#setText} if
     * the content is an untrusted text string.
     *
     * @param {string} html A string representing HTML content for the popup.
     * @returns {GestureHandler} Returns itself to allow for method chaining.
     * @example
     * const gestureHandler = new mapboxgl.GestureHandler()
     *     .setHTML("<h1>Hello World!</h1>")
     *     .addTo(map);
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
     * Returns the gesture handler's maximum width.
     *
     * @returns {string} The maximum width of the gesture handler.
     * @example
     * const maxWidth = popup.getMaxWidth();
     */
    getMaxWidth() {
        return this._container && this._container.style.maxWidth;
    }

    /**
     * Sets the gesture handler's maximum width. This is setting the CSS property `max-width`.
     * Available values can be found here: https://developer.mozilla.org/en-US/docs/Web/CSS/max-width.
     *
     * @param {string} maxWidth A string representing the value for the maximum width.
     * @returns {GestureHandler} Returns itself to allow for method chaining.
     * @example
     * gestureHandler.setMaxWidth('50');
     */
    setMaxWidth(maxWidth: string) {
        this.options.maxWidth = maxWidth;
        this._update();
        return this;
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

    /**
     * Adds a CSS class to the gesture handler container element.
     *
     * @param {string} className Non-empty string with CSS class name to add to gesture handler container.
     * @returns {GestureHandler} Returns itself to allow for method chaining.
     *
     * @example
     * const gestureHandler = new mapboxgl.GestureHandler();
     * popup.addClassName('some-class');
     */
    addClassName(className: string) {
        this._classList.add(className);
        if (this._container) {
            this._updateClassList();
        }
        return this;
    }

    /**
     * Removes a CSS class from the gesture handler container element.
     *
     * @param {string} className Non-empty string with CSS class name to remove from gesture handler container.
     *
     * @returns {GestureHandler} Returns itself to allow for method chaining.
     * @example
     * const gestureHandler = new mapboxgl.GestureHandler({className: 'some classes'});
     * gestureHandler.removeClassName('some');
     */
    removeClassName(className: string) {
        this._classList.delete(className);
        if (this._container) {
            this._updateClassList();
        }
        return this;
    }

    /**
     * Add or remove the given CSS class on the gestureHandler container, depending on whether the container currently has that class.
     *
     * @param {string} className Non-empty string with CSS class name to add/remove.
     *
     * @returns {boolean} If the class was removed return `false`. If the class was added, then return `true`.
     *
     * @example
     * const gestureHandler = new mapboxgl.GestureHandler();
     * gestureHandler.toggleClassName('highlighted');
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
            this._closeButton = DOM.create('button', 'mapboxgl-gesture-handler-close-button', this._content);
            this._closeButton.type = 'button';
            this._closeButton.setAttribute('aria-label', 'Close gesture handler');
            this._closeButton.innerHTML = '&#215;';
            this._closeButton.addEventListener('click', this._onClose);
        }
    }

    _updateClassList() {
        const classes = [...this._classList];
        classes.push('mapboxgl-gesture-handler');
        this._container.className = classes.join(' ');
    }

    _update() {
        if (!this._map || !this._content) { return; }

        if (!this._container) {
            this._container = DOM.create('div', 'mapboxgl-gesture-handler', this._map.getContainer());
            this._container.appendChild(this._content);
        }

        if (this.options.maxWidth && this._container.style.maxWidth !== this.options.maxWidth) {
            this._container.style.maxWidth = this.options.maxWidth;
        }

        this._updateClassList();
    }

    _onClose() {
        this.remove();
    }

    _setOpacity(opacity: string) {
        if (this._content) this._content.style.opacity = opacity;
    }
}
