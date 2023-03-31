// @flow

import {extend, bindAll} from '../util/util.js';
import {Event, Evented} from '../util/evented.js';
import {MapMouseEvent} from '../ui/events.js';
import * as DOM from '../util/dom.js';
import LngLat from '../geo/lng_lat.js';
import Point from '@mapbox/point-geometry';
import window from '../util/window.js';
import smartWrap from '../util/smart_wrap.js';
import {type Anchor, anchorTranslate} from './anchor.js';
import {isLngLatBehindGlobe} from '../geo/projection/globe_util.js';

import type Map from './map.js';
import type {LngLatLike} from '../geo/lng_lat.js';
import type {PointLike} from '@mapbox/point-geometry';
import type Marker from './marker.js';

const defaultOptions = {
    closeButton: true,
    closeOnClick: true,
    focusAfterOpen: true,
    className: '',
    maxWidth: "240px"
};

export type Offset = number | PointLike | {[_: Anchor]: PointLike};

export type PopupOptions = {
    closeButton?: boolean,
    closeOnClick?: boolean,
    closeOnMove?: boolean,
    focusAfterOpen?: boolean,
    anchor?: Anchor,
    offset?: Offset,
    className?: string,
    maxWidth?: string
};

const focusQuerySelector = [
    "a[href]",
    "[tabindex]:not([tabindex='-1'])",
    "[contenteditable]:not([contenteditable='false'])",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
].join(", ");

/**
 * A popup component.
 *
 * @param {Object} [options]
 * @param {boolean} [options.closeButton=true] If `true`, a close button will appear in the
 *   top right corner of the popup.
 * @param {boolean} [options.closeOnClick=true] If `true`, the popup will close when the
 *   map is clicked.
 * @param {boolean} [options.closeOnMove=false] If `true`, the popup will close when the
 *   map moves.
 * @param {boolean} [options.focusAfterOpen=true] If `true`, the popup will try to focus the
 *   first focusable element inside the popup.
 * @param {string} [options.anchor] - A string indicating the part of the popup that should
 *   be positioned closest to the coordinate, set via {@link Popup#setLngLat}.
 *   Options are `'center'`, `'top'`, `'bottom'`, `'left'`, `'right'`, `'top-left'`,
 *   `'top-right'`, `'bottom-left'`, and `'bottom-right'`. If unset, the anchor will be
 *   dynamically set to ensure the popup falls within the map container with a preference
 *   for `'bottom'`.
 * @param {number | PointLike | Object} [options.offset] -
 *  A pixel offset applied to the popup's location specified as:
 *   - a single number specifying a distance from the popup's location
 *   - a {@link PointLike} specifying a constant offset
 *   - an object of {@link Point}s specifing an offset for each anchor position.
 *
 *  Negative offsets indicate left and up.
 * @param {string} [options.className] Space-separated CSS class names to add to popup container.
 * @param {string} [options.maxWidth='240px'] -
 *  A string that sets the CSS property of the popup's maximum width (for example, `'300px'`).
 *  To ensure the popup resizes to fit its content, set this property to `'none'`.
 *  See the MDN documentation for the list of [available values](https://developer.mozilla.org/en-US/docs/Web/CSS/max-width).
 * @example
 * const markerHeight = 50;
 * const markerRadius = 10;
 * const linearOffset = 25;
 * const popupOffsets = {
 *     'top': [0, 0],
 *     'top-left': [0, 0],
 *     'top-right': [0, 0],
 *     'bottom': [0, -markerHeight],
 *     'bottom-left': [linearOffset, (markerHeight - markerRadius + linearOffset) * -1],
 *     'bottom-right': [-linearOffset, (markerHeight - markerRadius + linearOffset) * -1],
 *     'left': [markerRadius, (markerHeight - markerRadius) * -1],
 *     'right': [-markerRadius, (markerHeight - markerRadius) * -1]
 * };
 * const popup = new mapboxgl.Popup({offset: popupOffsets, className: 'my-class'})
 *     .setLngLat(e.lngLat)
 *     .setHTML("<h1>Hello World!</h1>")
 *     .setMaxWidth("300px")
 *     .addTo(map);
 * @see [Example: Display a popup](https://www.mapbox.com/mapbox-gl-js/example/popup/)
 * @see [Example: Display a popup on hover](https://www.mapbox.com/mapbox-gl-js/example/popup-on-hover/)
 * @see [Example: Display a popup on click](https://www.mapbox.com/mapbox-gl-js/example/popup-on-click/)
 * @see [Example: Attach a popup to a marker instance](https://www.mapbox.com/mapbox-gl-js/example/set-popup/)
 */
export default class Popup extends Evented {
    _map: ?Map;
    options: PopupOptions;
    _content: ?HTMLElement;
    _container: ?HTMLElement;
    _closeButton: ?HTMLElement;
    _tip: ?HTMLElement;
    _lngLat: LngLat;
    _trackPointer: boolean;
    _pos: ?Point;
    _anchor: Anchor;
    _classList: Set<string>;
    _marker: ?Marker;

    constructor(options: PopupOptions) {
        super();
        this.options = extend(Object.create(defaultOptions), options);
        bindAll(['_update', '_onClose', 'remove', '_onMouseEvent'], this);
        this._classList = new Set(options && options.className ?
            options.className.trim().split(/\s+/) : []);
    }

    /**
     * Adds the popup to a map.
     *
     * @param {Map} map The Mapbox GL JS map to add the popup to.
     * @returns {Popup} Returns itself to allow for method chaining.
     * @example
     * new mapboxgl.Popup()
     *     .setLngLat([0, 0])
     *     .setHTML("<h1>Null Island</h1>")
     *     .addTo(map);
     * @see [Example: Display a popup](https://docs.mapbox.com/mapbox-gl-js/example/popup/)
     * @see [Example: Display a popup on hover](https://docs.mapbox.com/mapbox-gl-js/example/popup-on-hover/)
     * @see [Example: Display a popup on click](https://docs.mapbox.com/mapbox-gl-js/example/popup-on-click/)
     * @see [Example: Show polygon information on click](https://docs.mapbox.com/mapbox-gl-js/example/polygon-popup-on-click/)
     */
    addTo(map: Map): this {
        if (this._map) this.remove();

        this._map = map;
        if (this.options.closeOnClick) {
            // $FlowFixMe[method-unbinding]
            map.on('preclick', this._onClose);
        }

        if (this.options.closeOnMove) {
            // $FlowFixMe[method-unbinding]
            map.on('move', this._onClose);
        }

        // $FlowFixMe[method-unbinding]
        map.on('remove', this.remove);
        this._update();
        map._addPopup(this);
        this._focusFirstElement();

        if (this._trackPointer) {
            // $FlowFixMe[method-unbinding]
            map.on('mousemove', this._onMouseEvent);
            // $FlowFixMe[method-unbinding]
            map.on('mouseup', this._onMouseEvent);
            map._canvasContainer.classList.add('mapboxgl-track-pointer');
        } else {
            // $FlowFixMe[method-unbinding]
            map.on('move', this._update);
        }

        /**
         * Fired when the popup is opened manually or programatically.
         *
         * @event open
         * @memberof Popup
         * @instance
         * @type {Object}
         * @property {Popup} popup Object that was opened.
         *
         * @example
         * // Create a popup
         * const popup = new mapboxgl.Popup();
         * // Set an event listener that will fire
         * // any time the popup is opened
         * popup.on('open', () => {
         *     console.log('popup was opened');
         * });
         *
         */
        this.fire(new Event('open'));

        return this;
    }

    /**
     * Checks if a popup is open.
     *
     * @returns {boolean} `true` if the popup is open, `false` if it is closed.
     * @example
     * const isPopupOpen = popup.isOpen();
     */
    isOpen(): boolean {
        return !!this._map;
    }

    /**
     * Removes the popup from the map it has been added to.
     *
     * @example
     * const popup = new mapboxgl.Popup().addTo(map);
     * popup.remove();
     * @returns {Popup} Returns itself to allow for method chaining.
     */
    remove(): this {
        if (this._content) {
            this._content.remove();
        }

        if (this._container) {
            this._container.remove();
            this._container = undefined;
        }

        const map = this._map;
        if (map) {
            // $FlowFixMe[method-unbinding]
            map.off('move', this._update);
            // $FlowFixMe[method-unbinding]
            map.off('move', this._onClose);
            // $FlowFixMe[method-unbinding]
            map.off('preclick', this._onClose);
            // $FlowFixMe[method-unbinding]
            map.off('click', this._onClose);
            // $FlowFixMe[method-unbinding]
            map.off('remove', this.remove);
            // $FlowFixMe[method-unbinding]
            map.off('mousemove', this._onMouseEvent);
            // $FlowFixMe[method-unbinding]
            map.off('mouseup', this._onMouseEvent);
            // $FlowFixMe[method-unbinding]
            map.off('drag', this._onMouseEvent);
            if (map._canvasContainer) {
                map._canvasContainer.classList.remove('mapboxgl-track-pointer');
            }
            map._removePopup(this);
            this._map = undefined;
        }

        /**
         * Fired when the popup is closed manually or programatically.
         *
         * @event close
         * @memberof Popup
         * @instance
         * @type {Object}
         * @property {Popup} popup Object that was closed.
         *
         * @example
         * // Create a popup
         * const popup = new mapboxgl.Popup();
         * // Set an event listener that will fire
         * // any time the popup is closed
         * popup.on('close', () => {
         *     console.log('popup was closed');
         * });
         *
         */
        this.fire(new Event('close'));

        return this;
    }

    /**
     * Returns the geographical location of the popup's anchor.
     *
     * The longitude of the result may differ by a multiple of 360 degrees from the longitude previously
     * set by `setLngLat` because `Popup` wraps the anchor longitude across copies of the world to keep
     * the popup on screen.
     *
     * @returns {LngLat} The geographical location of the popup's anchor.
     * @example
     * const lngLat = popup.getLngLat();
     */
    getLngLat(): LngLat {
        return this._lngLat;
    }

    /**
     * Sets the geographical location of the popup's anchor, and moves the popup to it. Replaces trackPointer() behavior.
     *
     * @param {LngLatLike} lnglat The geographical location to set as the popup's anchor.
     * @returns {Popup} Returns itself to allow for method chaining.
     * @example
     * popup.setLngLat([-122.4194, 37.7749]);
     */
    setLngLat(lnglat: LngLatLike): this {
        this._lngLat = LngLat.convert(lnglat);
        this._pos = null;

        this._trackPointer = false;

        this._update();

        const map = this._map;
        if (map) {
            // $FlowFixMe[method-unbinding]
            map.on('move', this._update);
            // $FlowFixMe[method-unbinding]
            map.off('mousemove', this._onMouseEvent);
            map._canvasContainer.classList.remove('mapboxgl-track-pointer');
        }

        return this;
    }

    /**
     * Tracks the popup anchor to the cursor position on screens with a pointer device (it will be hidden on touchscreens). Replaces the `setLngLat` behavior.
     * For most use cases, set `closeOnClick` and `closeButton` to `false`.
     *
     * @example
     * const popup = new mapboxgl.Popup({closeOnClick: false, closeButton: false})
     *     .setHTML("<h1>Hello World!</h1>")
     *     .trackPointer()
     *     .addTo(map);
     * @returns {Popup} Returns itself to allow for method chaining.
     */
    trackPointer(): this {
        this._trackPointer = true;
        this._pos = null;
        this._update();
        const map = this._map;
        if (map) {
            // $FlowFixMe[method-unbinding]
            map.off('move', this._update);
            // $FlowFixMe[method-unbinding]
            map.on('mousemove', this._onMouseEvent);
            // $FlowFixMe[method-unbinding]
            map.on('drag', this._onMouseEvent);
            map._canvasContainer.classList.add('mapboxgl-track-pointer');
        }

        return this;

    }

    /**
     * Returns the `Popup`'s HTML element.
     *
     * @example
     * // Change the `Popup` element's font size
     * const popup = new mapboxgl.Popup()
     *     .setLngLat([-96, 37.8])
     *     .setHTML("<p>Hello World!</p>")
     *     .addTo(map);
     * const popupElem = popup.getElement();
     * popupElem.style.fontSize = "25px";
     * @returns {HTMLElement} Returns container element.
     */
    getElement(): ?HTMLElement {
        return this._container;
    }

    /**
     * Sets the popup's content to a string of text.
     *
     * This function creates a [Text](https://developer.mozilla.org/en-US/docs/Web/API/Text) node in the DOM,
     * so it cannot insert raw HTML. Use this method for security against XSS
     * if the popup content is user-provided.
     *
     * @param {string} text Textual content for the popup.
     * @returns {Popup} Returns itself to allow for method chaining.
     * @example
     * const popup = new mapboxgl.Popup()
     *     .setLngLat(e.lngLat)
     *     .setText('Hello, world!')
     *     .addTo(map);
     */
    setText(text: string): this {
        return this.setDOMContent(window.document.createTextNode(text));
    }

    /**
     * Sets the popup's content to the HTML provided as a string.
     *
     * This method does not perform HTML filtering or sanitization, and must be
     * used only with trusted content. Consider {@link Popup#setText} if
     * the content is an untrusted text string.
     *
     * @param {string} html A string representing HTML content for the popup.
     * @returns {Popup} Returns itself to allow for method chaining.
     * @example
     * const popup = new mapboxgl.Popup()
     *     .setLngLat(e.lngLat)
     *     .setHTML("<h1>Hello World!</h1>")
     *     .addTo(map);
     * @see [Example: Display a popup](https://docs.mapbox.com/mapbox-gl-js/example/popup/)
     * @see [Example: Display a popup on hover](https://docs.mapbox.com/mapbox-gl-js/example/popup-on-hover/)
     * @see [Example: Display a popup on click](https://docs.mapbox.com/mapbox-gl-js/example/popup-on-click/)
     * @see [Example: Attach a popup to a marker instance](https://docs.mapbox.com/mapbox-gl-js/example/set-popup/)
     */
    setHTML(html: string): this {
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
     * Returns the popup's maximum width.
     *
     * @returns {string} The maximum width of the popup.
     * @example
     * const maxWidth = popup.getMaxWidth();
     */
    getMaxWidth(): ?string {
        return this._container && this._container.style.maxWidth;
    }

    /**
     * Sets the popup's maximum width. This is setting the CSS property `max-width`.
     * Available values can be found here: https://developer.mozilla.org/en-US/docs/Web/CSS/max-width.
     *
     * @param {string} maxWidth A string representing the value for the maximum width.
     * @returns {Popup} Returns itself to allow for method chaining.
     * @example
     * popup.setMaxWidth('50');
     */
    setMaxWidth(maxWidth: string): this {
        this.options.maxWidth = maxWidth;
        this._update();
        return this;
    }

    /**
     * Sets the popup's content to the element provided as a DOM node.
     *
     * @param {Element} htmlNode A DOM node to be used as content for the popup.
     * @returns {Popup} Returns itself to allow for method chaining.
     * @example
     * // create an element with the popup content
     * const div = window.document.createElement('div');
     * div.innerHTML = 'Hello, world!';
     * const popup = new mapboxgl.Popup()
     *     .setLngLat(e.lngLat)
     *     .setDOMContent(div)
     *     .addTo(map);
     */
    setDOMContent(htmlNode: Node): this {
        let content = this._content;
        if (content) {
            // Clear out children first.
            while (content.hasChildNodes()) {
                if (content.firstChild) {
                    content.removeChild(content.firstChild);
                }
            }
        } else {
            content = this._content = DOM.create('div', 'mapboxgl-popup-content', this._container || undefined);
        }

        // The close button should be the last tabbable element inside the popup for a good keyboard UX.
        content.appendChild(htmlNode);

        if (this.options.closeButton) {
            const button = this._closeButton = DOM.create('button', 'mapboxgl-popup-close-button', content);
            button.type = 'button';
            button.setAttribute('aria-label', 'Close popup');
            button.setAttribute('aria-hidden', 'true');
            button.innerHTML = '&#215;';
            // $FlowFixMe[method-unbinding]
            button.addEventListener('click', this._onClose);
        }
        this._update();
        this._focusFirstElement();
        return this;
    }

    /**
     * Adds a CSS class to the popup container element.
     *
     * @param {string} className Non-empty string with CSS class name to add to popup container.
     * @returns {Popup} Returns itself to allow for method chaining.
     *
     * @example
     * const popup = new mapboxgl.Popup();
     * popup.addClassName('some-class');
     */
    addClassName(className: string): this {
        this._classList.add(className);
        this._updateClassList();
        return this;
    }

    /**
     * Removes a CSS class from the popup container element.
     *
     * @param {string} className Non-empty string with CSS class name to remove from popup container.
     *
     * @returns {Popup} Returns itself to allow for method chaining.
     * @example
     * const popup = new mapboxgl.Popup({className: 'some classes'});
     * popup.removeClassName('some');
     */
    removeClassName(className: string): this {
        this._classList.delete(className);
        this._updateClassList();
        return this;
    }

    /**
     * Sets the popup's offset.
     *
     * @param {number | PointLike | Object} offset Sets the popup's offset. The `Object` is of the following structure
     * {
     *    'center': ?PointLike,
     *    'top': ?PointLike,
     *    'bottom': ?PointLike,
     *    'left': ?PointLike,
     *    'right': ?PointLike,
     *    'top-left': ?PointLike,
     *    'top-right': ?PointLike,
     *    'bottom-left': ?PointLike,
     *    'bottom-right': ?PointLike
     * }.
     *
     * @returns {Popup} `this`.
     * @example
     * popup.setOffset(10);
     */
    setOffset (offset?: Offset): this {
        this.options.offset = offset;
        this._update();
        return this;
    }

    /**
     * Add or remove the given CSS class on the popup container, depending on whether the container currently has that class.
     *
     * @param {string} className Non-empty string with CSS class name to add/remove.
     *
     * @returns {boolean} If the class was removed return `false`. If the class was added, then return `true`.
     *
     * @example
     * const popup = new mapboxgl.Popup();
     * popup.toggleClassName('highlighted');
     */
    toggleClassName(className: string): boolean {
        let finalState: boolean;
        if (this._classList.delete(className)) {
            finalState = false;
        } else {
            this._classList.add(className);
            finalState = true;
        }
        this._updateClassList();
        return finalState;
    }

    _onMouseEvent(event: MapMouseEvent) {
        this._update(event.point);
    }

    _getAnchor(bottomY: number): Anchor {
        if (this.options.anchor) { return this.options.anchor; }

        const map = this._map;
        const container = this._container;
        const pos = this._pos;

        if (!map || !container || !pos) return 'bottom';

        const width = container.offsetWidth;
        const height = container.offsetHeight;

        const isTop = pos.y + bottomY < height;
        const isBottom = pos.y > map.transform.height - height;
        const isLeft = pos.x < width / 2;
        const isRight = pos.x > map.transform.width - width / 2;

        if (isTop) {
            if (isLeft) return 'top-left';
            if (isRight) return 'top-right';
            return 'top';
        }
        if (isBottom) {
            if (isLeft) return 'bottom-left';
            if (isRight) return 'bottom-right';
        }
        if (isLeft) return 'left';
        if (isRight) return 'right';

        return 'bottom';
    }

    _updateClassList() {
        const container = this._container;
        if (!container) return;

        const classes = [...this._classList];
        classes.push('mapboxgl-popup');
        if (this._anchor) {
            classes.push(`mapboxgl-popup-anchor-${this._anchor}`);
        }
        if (this._trackPointer) {
            classes.push('mapboxgl-popup-track-pointer');
        }
        container.className = classes.join(' ');
    }

    _update(cursor?: Point) {
        const hasPosition = this._lngLat || this._trackPointer;
        const map = this._map;
        const content = this._content;

        if (!map || !hasPosition || !content) { return; }

        let container = this._container;

        if (!container) {
            container = this._container = DOM.create('div', 'mapboxgl-popup', map.getContainer());
            this._tip = DOM.create('div', 'mapboxgl-popup-tip', container);
            container.appendChild(content);
        }

        if (this.options.maxWidth && container.style.maxWidth !== this.options.maxWidth) {
            container.style.maxWidth = this.options.maxWidth;
        }

        if (map.transform.renderWorldCopies && !this._trackPointer) {
            this._lngLat = smartWrap(this._lngLat, this._pos, map.transform);
        }

        if (!this._trackPointer || cursor) {
            const pos = this._pos = this._trackPointer && cursor ? cursor : map.project(this._lngLat);

            const offsetBottom = normalizeOffset(this.options.offset);
            const anchor = this._anchor = this._getAnchor(offsetBottom.y);
            const offset = normalizeOffset(this.options.offset, anchor);

            const offsetedPos = pos.add(offset).round();
            map._requestDomTask(() => {
                if (this._container && anchor) {
                    this._container.style.transform = `${anchorTranslate[anchor]} translate(${offsetedPos.x}px,${offsetedPos.y}px)`;
                }
            });
        }

        if (!this._marker && map._showingGlobe()) {
            const opacity = isLngLatBehindGlobe(map.transform, this._lngLat) ? 0 : 1;
            this._setOpacity(opacity);
        }

        this._updateClassList();
    }

    _focusFirstElement() {
        if (!this.options.focusAfterOpen || !this._container) return;

        const firstFocusable = this._container.querySelector(focusQuerySelector);

        if (firstFocusable) firstFocusable.focus();
    }

    _onClose() {
        this.remove();
    }

    _setOpacity(opacity: number) {
        if (this._container) {
            this._container.style.opacity = `${opacity}`;
        }
        if (this._content) {
            this._content.style.pointerEvents = opacity ? 'auto' : 'none';
        }
    }
}

// returns a normalized offset for a given anchor
function normalizeOffset(offset: Offset = new Point(0, 0), anchor: Anchor = 'bottom'): Point {
    if (typeof offset === 'number') {
        // input specifies a radius from which to calculate offsets at all positions
        const cornerOffset = Math.round(Math.sqrt(0.5 * Math.pow(offset, 2)));
        switch (anchor) {
        case 'top': return new Point(0, offset);
        case 'top-left': return new Point(cornerOffset, cornerOffset);
        case 'top-right': return new Point(-cornerOffset, cornerOffset);
        case 'bottom': return new Point(0, -offset);
        case 'bottom-left': return new Point(cornerOffset, -cornerOffset);
        case 'bottom-right': return new Point(-cornerOffset, -cornerOffset);
        case 'left': return new Point(offset, 0);
        case 'right': return new Point(-offset, 0);
        }
        return new Point(0, 0);
    }

    if (offset instanceof Point || Array.isArray(offset)) {
        // input specifies a single offset to be applied to all positions
        return Point.convert(offset);
    }

    // input specifies an offset per position
    // $FlowFixMe we know offset is an object at this point but Flow can't refine it for some reason
    return Point.convert(offset[anchor] || [0, 0]);
}
