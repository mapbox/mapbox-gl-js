// @flow

import {extend, bindAll} from '../util/util.js';
import {Event, Evented} from '../util/evented.js';
import {MapMouseEvent} from '../ui/events.js';
import DOM from '../util/dom.js';
import LngLat from '../geo/lng_lat.js';
import Point from '@mapbox/point-geometry';
import window from '../util/window.js';
import smartWrap from '../util/smart_wrap.js';
import {type Anchor, anchorTranslate, applyAnchorClass} from './anchor.js';

import type Map from './map.js';
import type {LngLatLike} from '../geo/lng_lat.js';
import type {PointLike} from '@mapbox/point-geometry';

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
 * @param {boolean} [options.closeOnClick=true] If `true`, the popup will closed when the
 *   map is clicked.
 * @param {boolean} [options.closeOnMove=false] If `true`, the popup will closed when the
 *   map moves.
 * @param {boolean} [options.focusAfterOpen=true] If `true`, the popup will try to focus the
 *   first focusable element inside the popup.
 * @param {string} [options.anchor] - A string indicating the part of the Popup that should
 *   be positioned closest to the coordinate set via {@link Popup#setLngLat}.
 *   Options are `'center'`, `'top'`, `'bottom'`, `'left'`, `'right'`, `'top-left'`,
 *   `'top-right'`, `'bottom-left'`, and `'bottom-right'`. If unset the anchor will be
 *   dynamically set to ensure the popup falls within the map container with a preference
 *   for `'bottom'`.
 * @param {number|PointLike|Object} [options.offset] -
 *  A pixel offset applied to the popup's location specified as:
 *   - a single number specifying a distance from the popup's location
 *   - a {@link PointLike} specifying a constant offset
 *   - an object of {@link Point}s specifing an offset for each anchor position
 *  Negative offsets indicate left and up.
 * @param {string} [options.className] Space-separated CSS class names to add to popup container
 * @param {string} [options.maxWidth='240px'] -
 *  A string that sets the CSS property of the popup's maximum width, eg `'300px'`.
 *  To ensure the popup resizes to fit its content, set this property to `'none'`.
 *  Available values can be found here: https://developer.mozilla.org/en-US/docs/Web/CSS/max-width
 * @example
 * var markerHeight = 50, markerRadius = 10, linearOffset = 25;
 * var popupOffsets = {
 *  'top': [0, 0],
 *  'top-left': [0,0],
 *  'top-right': [0,0],
 *  'bottom': [0, -markerHeight],
 *  'bottom-left': [linearOffset, (markerHeight - markerRadius + linearOffset) * -1],
 *  'bottom-right': [-linearOffset, (markerHeight - markerRadius + linearOffset) * -1],
 *  'left': [markerRadius, (markerHeight - markerRadius) * -1],
 *  'right': [-markerRadius, (markerHeight - markerRadius) * -1]
 *  };
 * var popup = new mapboxgl.Popup({offset: popupOffsets, className: 'my-class'})
 *   .setLngLat(e.lngLat)
 *   .setHTML("<h1>Hello World!</h1>")
 *   .setMaxWidth("300px")
 *   .addTo(map);
 * @see [Display a popup](https://www.mapbox.com/mapbox-gl-js/example/popup/)
 * @see [Display a popup on hover](https://www.mapbox.com/mapbox-gl-js/example/popup-on-hover/)
 * @see [Display a popup on click](https://www.mapbox.com/mapbox-gl-js/example/popup-on-click/)
 * @see [Attach a popup to a marker instance](https://www.mapbox.com/mapbox-gl-js/example/set-popup/)
 */
export default class Popup extends Evented {
    _map: Map;
    options: PopupOptions;
    _content: HTMLElement;
    _container: HTMLElement;
    _closeButton: HTMLElement;
    _tip: HTMLElement;
    _lngLat: LngLat;
    _trackPointer: boolean;
    _pos: ?Point;

    constructor(options: PopupOptions) {
        super();
        this.options = extend(Object.create(defaultOptions), options);
        bindAll(['_update', '_onClose', 'remove', '_onMouseMove', '_onMouseUp', '_onDrag'], this);
    }

    /**
     * Adds the popup to a map.
     *
     * @param {Map} map The Mapbox GL JS map to add the popup to.
     * @returns {Popup} `this`
     * @example
     * new mapboxgl.Popup()
     *   .setLngLat([0, 0])
     *   .setHTML("<h1>Null Island</h1>")
     *   .addTo(map);
     * @see [Display a popup](https://docs.mapbox.com/mapbox-gl-js/example/popup/)
     * @see [Display a popup on hover](https://docs.mapbox.com/mapbox-gl-js/example/popup-on-hover/)
     * @see [Display a popup on click](https://docs.mapbox.com/mapbox-gl-js/example/popup-on-click/)
     * @see [Show polygon information on click](https://docs.mapbox.com/mapbox-gl-js/example/polygon-popup-on-click/)
     */
    addTo(map: Map) {
        if (this._map) this.remove();

        this._map = map;
        if (this.options.closeOnClick) {
            this._map.on('click', this._onClose);
        }

        if (this.options.closeOnMove) {
            this._map.on('move', this._onClose);
        }

        this._map.on('remove', this.remove);
        this._update();
        this._focusFirstElement();

        if (this._trackPointer) {
            this._map.on('mousemove', this._onMouseMove);
            this._map.on('mouseup', this._onMouseUp);
            if (this._container) {
                this._container.classList.add('mapboxgl-popup-track-pointer');
            }
            this._map._canvasContainer.classList.add('mapboxgl-track-pointer');
        } else {
            this._map.on('move', this._update);
        }

        /**
         * Fired when the popup is opened manually or programatically.
         *
         * @event open
         * @memberof Popup
         * @instance
         * @type {Object}
         * @property {Popup} popup object that was opened
         *
         * @example
         * // Create a popup
         * var popup = new mapboxgl.Popup();
         * // Set an event listener that will fire
         * // any time the popup is opened
         * popup.on('open', function(){
         *   console.log('popup was opened');
         * });
         *
         */
        this.fire(new Event('open'));

        return this;
    }

    /**
     * @returns {boolean} `true` if the popup is open, `false` if it is closed.
     */
    isOpen() {
        return !!this._map;
    }

    /**
     * Removes the popup from the map it has been added to.
     *
     * @example
     * var popup = new mapboxgl.Popup().addTo(map);
     * popup.remove();
     * @returns {Popup} `this`
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
            this._map.off('remove', this.remove);
            this._map.off('mousemove', this._onMouseMove);
            this._map.off('mouseup', this._onMouseUp);
            this._map.off('drag', this._onDrag);
            delete this._map;
        }

        /**
         * Fired when the popup is closed manually or programatically.
         *
         * @event close
         * @memberof Popup
         * @instance
         * @type {Object}
         * @property {Popup} popup object that was closed
         *
         * @example
         * // Create a popup
         * var popup = new mapboxgl.Popup();
         * // Set an event listener that will fire
         * // any time the popup is closed
         * popup.on('close', function(){
         *   console.log('popup was closed');
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
     */
    getLngLat() {
        return this._lngLat;
    }

    /**
     * Sets the geographical location of the popup's anchor, and moves the popup to it. Replaces trackPointer() behavior.
     *
     * @param lnglat The geographical location to set as the popup's anchor.
     * @returns {Popup} `this`
     */
    setLngLat(lnglat: LngLatLike) {
        this._lngLat = LngLat.convert(lnglat);
        this._pos = null;

        this._trackPointer = false;

        this._update();

        if (this._map) {
            this._map.on('move', this._update);
            this._map.off('mousemove', this._onMouseMove);
            if (this._container) {
                this._container.classList.remove('mapboxgl-popup-track-pointer');
            }
            this._map._canvasContainer.classList.remove('mapboxgl-track-pointer');
        }

        return this;
    }

    /**
     * Tracks the popup anchor to the cursor position on screens with a pointer device (it will be hidden on touchscreens). Replaces the `setLngLat` behavior.
     * For most use cases, set `closeOnClick` and `closeButton` to `false`.
     * @example
     * var popup = new mapboxgl.Popup({ closeOnClick: false, closeButton: false })
     *   .setHTML("<h1>Hello World!</h1>")
     *   .trackPointer()
     *   .addTo(map);
     * @returns {Popup} `this`
     */
    trackPointer() {
        this._trackPointer = true;
        this._pos = null;
        this._update();
        if (this._map) {
            this._map.off('move', this._update);
            this._map.on('mousemove', this._onMouseMove);
            this._map.on('drag', this._onDrag);
            if (this._container) {
                this._container.classList.add('mapboxgl-popup-track-pointer');
            }
            this._map._canvasContainer.classList.add('mapboxgl-track-pointer');
        }

        return this;

    }

    /**
     * Returns the `Popup`'s HTML element.
     * @example
     * // Change the `Popup` element's font size
     * var popup = new mapboxgl.Popup()
     *   .setLngLat([-96, 37.8])
     *   .setHTML("<p>Hello World!</p>")
     *   .addTo(map);
     * var popupElem = popup.getElement();
     * popupElem.style.fontSize = "25px";
     * @returns {HTMLElement} element
     */
    getElement() {
        return this._container;
    }

    /**
     * Sets the popup's content to a string of text.
     *
     * This function creates a [Text](https://developer.mozilla.org/en-US/docs/Web/API/Text) node in the DOM,
     * so it cannot insert raw HTML. Use this method for security against XSS
     * if the popup content is user-provided.
     *
     * @param text Textual content for the popup.
     * @returns {Popup} `this`
     * @example
     * var popup = new mapboxgl.Popup()
     *   .setLngLat(e.lngLat)
     *   .setText('Hello, world!')
     *   .addTo(map);
     */
    setText(text: string) {
        return this.setDOMContent(window.document.createTextNode(text));
    }

    /**
     * Sets the popup's content to the HTML provided as a string.
     *
     * This method does not perform HTML filtering or sanitization, and must be
     * used only with trusted content. Consider {@link Popup#setText} if
     * the content is an untrusted text string.
     *
     * @param html A string representing HTML content for the popup.
     * @returns {Popup} `this`
     * @example
     * var popup = new mapboxgl.Popup()
     *   .setLngLat(e.lngLat)
     *   .setHTML("<h1>Hello World!</h1>")
     *   .addTo(map);
     * @see [Display a popup](https://docs.mapbox.com/mapbox-gl-js/example/popup/)
     * @see [Display a popup on hover](https://docs.mapbox.com/mapbox-gl-js/example/popup-on-hover/)
     * @see [Display a popup on click](https://docs.mapbox.com/mapbox-gl-js/example/popup-on-click/)
     * @see [Attach a popup to a marker instance](https://docs.mapbox.com/mapbox-gl-js/example/set-popup/)
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
     * Returns the popup's maximum width.
     *
     * @returns {string} The maximum width of the popup.
     */
    getMaxWidth() {
        return this._container && this._container.style.maxWidth;
    }

    /**
     * Sets the popup's maximum width. This is setting the CSS property `max-width`.
     * Available values can be found here: https://developer.mozilla.org/en-US/docs/Web/CSS/max-width
     *
     * @param maxWidth A string representing the value for the maximum width.
     * @returns {Popup} `this`
     */
    setMaxWidth(maxWidth: string) {
        this.options.maxWidth = maxWidth;
        this._update();
        return this;
    }

    /**
     * Sets the popup's content to the element provided as a DOM node.
     *
     * @param htmlNode A DOM node to be used as content for the popup.
     * @returns {Popup} `this`
     * @example
     * // create an element with the popup content
     * var div = window.document.createElement('div');
     * div.innerHTML = 'Hello, world!';
     * var popup = new mapboxgl.Popup()
     *   .setLngLat(e.lngLat)
     *   .setDOMContent(div)
     *   .addTo(map);
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
            this._content = DOM.create('div', 'mapboxgl-popup-content', this._container);
        }

        // The close button should be the last tabbable element inside the popup for a good keyboard UX.
        this._content.appendChild(htmlNode);
        this._createCloseButton();
        this._update();
        this._focusFirstElement();
        return this;
    }

    /**
     * Adds a CSS class to the popup container element.
     *
     * @param {string} className Non-empty string with CSS class name to add to popup container
     *
     * @example
     * let popup = new mapboxgl.Popup()
     * popup.addClassName('some-class')
     */
    addClassName(className: string) {
        if (this._container) {
            this._container.classList.add(className);
        }
    }

    /**
     * Removes a CSS class from the popup container element.
     *
     * @param {string} className Non-empty string with CSS class name to remove from popup container
     *
     * @example
     * let popup = new mapboxgl.Popup()
     * popup.removeClassName('some-class')
     */
    removeClassName(className: string) {
        if (this._container) {
            this._container.classList.remove(className);
        }
    }

    /**
     * Sets the popup's offset.
     *
     * @param offset Sets the popup's offset.
     * @returns {Popup} `this`
     */
    setOffset (offset?: Offset) {
        this.options.offset = offset;
        this._update();
        return this;
    }

    /**
     * Add or remove the given CSS class on the popup container, depending on whether the container currently has that class.
     *
     * @param {string} className Non-empty string with CSS class name to add/remove
     *
     * @returns {boolean} if the class was removed return false, if class was added, then return true
     *
     * @example
     * let popup = new mapboxgl.Popup()
     * popup.toggleClassName('toggleClass')
     */
    toggleClassName(className: string) {
        if (this._container) {
            return this._container.classList.toggle(className);
        }
    }

    _createCloseButton() {
        if (this.options.closeButton) {
            this._closeButton = DOM.create('button', 'mapboxgl-popup-close-button', this._content);
            this._closeButton.type = 'button';
            this._closeButton.setAttribute('aria-label', 'Close popup');
            this._closeButton.innerHTML = '&#215;';
            this._closeButton.addEventListener('click', this._onClose);
        }
    }

    _onMouseUp(event: MapMouseEvent) {
        this._update(event.point);
    }

    _onMouseMove(event: MapMouseEvent) {
        this._update(event.point);
    }

    _onDrag(event: MapMouseEvent) {
        this._update(event.point);
    }

    _update(cursor: ?PointLike) {
        const hasPosition = this._lngLat || this._trackPointer;

        if (!this._map || !hasPosition || !this._content) { return; }

        if (!this._container) {
            this._container = DOM.create('div', 'mapboxgl-popup', this._map.getContainer());
            this._tip       = DOM.create('div', 'mapboxgl-popup-tip', this._container);
            this._container.appendChild(this._content);
            if (this.options.className) {
                this.options.className.split(' ').forEach(name =>
                    this._container.classList.add(name));
            }

            if (this._trackPointer) {
                this._container.classList.add('mapboxgl-popup-track-pointer');
            }
        }

        if (this.options.maxWidth && this._container.style.maxWidth !== this.options.maxWidth) {
            this._container.style.maxWidth = this.options.maxWidth;
        }

        if (this._map.transform.renderWorldCopies && !this._trackPointer) {
            this._lngLat = smartWrap(this._lngLat, this._pos, this._map.transform);
        }

        if (this._trackPointer && !cursor) return;

        const pos = this._pos = this._trackPointer && cursor ? cursor : this._map.project(this._lngLat);

        let anchor: ?Anchor = this.options.anchor;
        const offset = normalizeOffset(this.options.offset);

        if (!anchor) {
            const width = this._container.offsetWidth;
            const height = this._container.offsetHeight;
            let anchorComponents;

            if (pos.y + offset.bottom.y < height) {
                anchorComponents = ['top'];
            } else if (pos.y > this._map.transform.height - height) {
                anchorComponents = ['bottom'];
            } else {
                anchorComponents = [];
            }

            if (pos.x < width / 2) {
                anchorComponents.push('left');
            } else if (pos.x > this._map.transform.width - width / 2) {
                anchorComponents.push('right');
            }

            if (anchorComponents.length === 0) {
                anchor = 'bottom';
            } else {
                anchor = (anchorComponents.join('-'): any);
            }
        }

        const offsetedPos = pos.add(offset[anchor]).round();
        DOM.setTransform(this._container, `${anchorTranslate[anchor]} translate(${offsetedPos.x}px,${offsetedPos.y}px)`);
        applyAnchorClass(this._container, anchor, 'popup');
    }

    _focusFirstElement() {
        if (!this.options.focusAfterOpen || !this._container) return;

        const firstFocusable = this._container.querySelector(focusQuerySelector);

        if (firstFocusable) firstFocusable.focus();
    }

    _onClose() {
        this.remove();
    }
}

function normalizeOffset(offset: ?Offset) {
    if (!offset) {
        return normalizeOffset(new Point(0, 0));

    } else if (typeof offset === 'number') {
        // input specifies a radius from which to calculate offsets at all positions
        const cornerOffset = Math.round(Math.sqrt(0.5 * Math.pow(offset, 2)));
        return {
            'center': new Point(0, 0),
            'top': new Point(0, offset),
            'top-left': new Point(cornerOffset, cornerOffset),
            'top-right': new Point(-cornerOffset, cornerOffset),
            'bottom': new Point(0, -offset),
            'bottom-left': new Point(cornerOffset, -cornerOffset),
            'bottom-right': new Point(-cornerOffset, -cornerOffset),
            'left': new Point(offset, 0),
            'right': new Point(-offset, 0)
        };

    } else if (offset instanceof Point || Array.isArray(offset)) {
        // input specifies a single offset to be applied to all positions
        const convertedOffset = Point.convert(offset);
        return {
            'center': convertedOffset,
            'top': convertedOffset,
            'top-left': convertedOffset,
            'top-right': convertedOffset,
            'bottom': convertedOffset,
            'bottom-left': convertedOffset,
            'bottom-right': convertedOffset,
            'left': convertedOffset,
            'right': convertedOffset
        };

    } else {
        // input specifies an offset per position
        return {
            'center': Point.convert(offset['center'] || [0, 0]),
            'top': Point.convert(offset['top'] || [0, 0]),
            'top-left': Point.convert(offset['top-left'] || [0, 0]),
            'top-right': Point.convert(offset['top-right'] || [0, 0]),
            'bottom': Point.convert(offset['bottom'] || [0, 0]),
            'bottom-left': Point.convert(offset['bottom-left'] || [0, 0]),
            'bottom-right': Point.convert(offset['bottom-right'] || [0, 0]),
            'left': Point.convert(offset['left'] || [0, 0]),
            'right': Point.convert(offset['right'] || [0, 0])
        };
    }
}
