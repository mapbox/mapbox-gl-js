// @flow

const DOM = require('../util/dom');
const util = require('../util/util');
const {bindAll} = require('../util/util');
const LngLat = require('../geo/lng_lat');
const Point = require('@mapbox/point-geometry');
const smartWrap = require('../util/smart_wrap');

import type Map from './map';
import type Popup from './popup';
import type {LngLatLike} from "../geo/lng_lat";
import type {MapMouseEvent} from './events';

const defaultOptions = {
    anchor: 'middle',
    offset: [0, 0]
};

export type Anchor = 'middle' | 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export type Offset = number | PointLike | {[Anchor]: PointLike};

export type MarkerOptions = {
    anchor: Anchor,
    offset: Offset
}

/**
 * Creates a marker component
 * @param {Object} [element] DOM element to use as a marker. If left unspecified a default SVG will be created as the DOM element to use.
 * @param {Object} [options]
 * @param {string} [options.anchor] - A string indicating the markers's location relative to
 *   the coordinate set via {@link Marker#setLngLat}.
 *   Options are `'middle'`, `'top'`, `'bottom'`, `'left'`, `'right'`, `'top-left'`, `'top-right'`, `'bottom-left'`, and `'bottom-right'`.
 *   If unset the anchor will be dynamically set to ensure the marker falls within the map container with a preference for `'middle'` by default
 * @param {number|PointLike|Object} [options.offset] The offset in pixels as a {@link PointLike} object to apply relative to the element's anchor.
 * @example
 * var markerRadius = 10;
 * var markerOptions = {
 *  anchor: 'middle',
 *  offset: [markerRadius/2, markerHeight/2]
 *  };
 * var marker = new mapboxgl.Marker()
 *   .setLngLat([30.5, 50.5])
 *   .addTo(map);
 * @see [Add custom icons with Markers](https://www.mapbox.com/mapbox-gl-js/example/custom-marker-icons/)
 */
class Marker {
    _map: Map;
    options: MarkerOptions;
    _anchor: Anchor;
    _offset: Offset;
    _element: HTMLElement;
    _popup: ?Popup;
    _lngLat: LngLat;
    _pos: ?Point;


    constructor(element: ?HTMLElement, options?: { anchor: string, offset: PointLike}) {

        this.options = util.extend(Object.create(defaultOptions), options);
        bindAll(['_update', '_onMapClick'], this);

        if (!element) {
            element = DOM.create('div');

            // create default map marker SVG
            const svg = DOM.createNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttributeNS(null, 'height', '41px');
            svg.setAttributeNS(null, 'width', '27px');
            svg.setAttributeNS(null, 'viewBox', '0 0 27 41');

            const markerLarge = DOM.createNS('http://www.w3.org/2000/svg', 'g');
            markerLarge.setAttributeNS(null, 'stroke', 'none');
            markerLarge.setAttributeNS(null, 'stroke-width', '1');
            markerLarge.setAttributeNS(null, 'fill', 'none');
            markerLarge.setAttributeNS(null, 'fill-rule', 'evenodd');

            const page1 = DOM.createNS('http://www.w3.org/2000/svg', 'g');
            page1.setAttributeNS(null, 'fill-rule', 'nonzero');

            const shadow = DOM.createNS('http://www.w3.org/2000/svg', 'g');
            shadow.setAttributeNS(null, 'transform', 'translate(3.0, 29.0)');
            shadow.setAttributeNS(null, 'fill', '#000000');

            const ellipses = [
                {'rx': '10.5', 'ry': '5.25002273'},
                {'rx': '10.5', 'ry': '5.25002273'},
                {'rx': '9.5', 'ry': '4.77275007'},
                {'rx': '8.5', 'ry': '4.29549936'},
                {'rx': '7.5', 'ry': '3.81822308'},
                {'rx': '6.5', 'ry': '3.34094679'},
                {'rx': '5.5', 'ry': '2.86367051'},
                {'rx': '4.5', 'ry': '2.38636864'}
            ];

            for (const data of ellipses) {
                const ellipse = DOM.createNS('http://www.w3.org/2000/svg', 'ellipse');
                ellipse.setAttributeNS(null, 'opacity', '0.04');
                ellipse.setAttributeNS(null, 'cx', '10.5');
                ellipse.setAttributeNS(null, 'cy', '5.80029008');
                ellipse.setAttributeNS(null, 'rx', data['rx']);
                ellipse.setAttributeNS(null, 'ry', data['ry']);
                shadow.appendChild(ellipse);
            }

            const background = DOM.createNS('http://www.w3.org/2000/svg', 'g');
            background.setAttributeNS(null, 'fill', '#3FB1CE');

            const bgPath = DOM.createNS('http://www.w3.org/2000/svg', 'path');
            bgPath.setAttributeNS(null, 'd', 'M27,13.5 C27,19.074644 20.250001,27.000002 14.75,34.500002 C14.016665,35.500004 12.983335,35.500004 12.25,34.500002 C6.7499993,27.000002 0,19.222562 0,13.5 C0,6.0441559 6.0441559,0 13.5,0 C20.955844,0 27,6.0441559 27,13.5 Z');

            background.appendChild(bgPath);

            const border = DOM.createNS('http://www.w3.org/2000/svg', 'g');
            border.setAttributeNS(null, 'opacity', '0.25');
            border.setAttributeNS(null, 'fill', '#000000');

            const borderPath = DOM.createNS('http://www.w3.org/2000/svg', 'path');
            borderPath.setAttributeNS(null, 'd', 'M13.5,0 C6.0441559,0 0,6.0441559 0,13.5 C0,19.222562 6.7499993,27 12.25,34.5 C13,35.522727 14.016664,35.500004 14.75,34.5 C20.250001,27 27,19.074644 27,13.5 C27,6.0441559 20.955844,0 13.5,0 Z M13.5,1 C20.415404,1 26,6.584596 26,13.5 C26,15.898657 24.495584,19.181431 22.220703,22.738281 C19.945823,26.295132 16.705119,30.142167 13.943359,33.908203 C13.743445,34.180814 13.612715,34.322738 13.5,34.441406 C13.387285,34.322738 13.256555,34.180814 13.056641,33.908203 C10.284481,30.127985 7.4148684,26.314159 5.015625,22.773438 C2.6163816,19.232715 1,15.953538 1,13.5 C1,6.584596 6.584596,1 13.5,1 Z');

            border.appendChild(borderPath);

            const maki = DOM.createNS('http://www.w3.org/2000/svg', 'g');
            maki.setAttributeNS(null, 'transform', 'translate(6.0, 7.0)');
            maki.setAttributeNS(null, 'fill', '#FFFFFF');

            const circleContainer = DOM.createNS('http://www.w3.org/2000/svg', 'g');
            circleContainer.setAttributeNS(null, 'transform', 'translate(8.0, 8.0)');

            const circle1 = DOM.createNS('http://www.w3.org/2000/svg', 'circle');
            circle1.setAttributeNS(null, 'fill', '#000000');
            circle1.setAttributeNS(null, 'opacity', '0.25');
            circle1.setAttributeNS(null, 'cx', '5.5');
            circle1.setAttributeNS(null, 'cy', '5.5');
            circle1.setAttributeNS(null, 'r', '5.4999962');

            const circle2 = DOM.createNS('http://www.w3.org/2000/svg', 'circle');
            circle2.setAttributeNS(null, 'fill', '#FFFFFF');
            circle2.setAttributeNS(null, 'cx', '5.5');
            circle2.setAttributeNS(null, 'cy', '5.5');
            circle2.setAttributeNS(null, 'r', '5.4999962');

            circleContainer.appendChild(circle1);
            circleContainer.appendChild(circle2);

            page1.appendChild(shadow);
            page1.appendChild(background);
            page1.appendChild(border);
            page1.appendChild(maki);
            page1.appendChild(circleContainer);

            svg.appendChild(page1);

            element.appendChild(svg);

            // if no element and no offset option given apply an offset for the default marker
            // the -14 as the y value of the default marker offset was determined as follows
            //
            // the marker tip is at the center of the shadow ellipse from the default svg
            // the y value of the center of the shadow ellipse relative to the svg top left is "shadow transform translate-y (29.0) + ellipse cy (5.80029008)"
            // offset to the svg center "height (41 / 2)" gives (29.0 + 5.80029008) - (41 / 2) and rounded for an integer pixel offset gives 14
            // negative is used to move the marker up from the center so the tip is at the Marker lngLat
            const defaultMarkerOffset = [0, -14];
            const defaultMarkerAnchor = 'middle';

            if (!(options && options.anchor && options.offset)) {
                if (!options) {
                    options = {
                        anchor: defaultMarkerAnchor,
                        offset: defaultMarkerOffset
                    };
                } else {
                    options.anchor = defaultMarkerAnchor;
                    options.offset = defaultMarkerOffset;
                }
            }
        }

        this._offset = Point.convert(options && options.offset || [0, 0]);

        element.classList.add('mapboxgl-marker');
        this._element = element;
        this._popup = null;
    }

    /**
     * Attaches the marker to a map
     * @param {Map} map
     * @returns {Marker} `this`
     */
    addTo(map: Map) {
        this.remove();
        this._map = map;
        map.getCanvasContainer().appendChild(this._element);
        map.on('move', this._update);
        map.on('moveend', this._update);
        this._update();

        // If we attached the `click` listener to the marker element, the popup
        // would close once the event propogated to `map` due to the
        // `Popup#_onClickClose` listener.
        this._map.on('click', this._onMapClick);

        return this;
    }

    /**
     * Removes the marker from a map
     * @example
     * var marker = new mapboxgl.Marker().addTo(map);
     * marker.remove();
     * @returns {Marker} `this`
     */
    remove() {
        if (this._map) {
            this._map.off('click', this._onMapClick);
            this._map.off('move', this._update);
            this._map.off('moveend', this._update);
            delete this._map;
        }
        DOM.remove(this._element);
        if (this._popup) this._popup.remove();
        return this;
    }

    /**
     * Get the marker's geographical location.
     *
     * The longitude of the result may differ by a multiple of 360 degrees from the longitude previously
     * set by `setLngLat` because `Marker` wraps the anchor longitude across copies of the world to keep
     * the marker on screen.
     *
     * @returns {LngLat}
     */
    getLngLat() {
        return this._lngLat;
    }

    /**
     * Set the marker's geographical position and move it.
     * @returns {Marker} `this`
     */
    setLngLat(lnglat: LngLatLike) {
        this._lngLat = LngLat.convert(lnglat);
        this._pos = null;
        if (this._popup) this._popup.setLngLat(this._lngLat);
        this._update();
        return this;
    }

    /**
     * Returns the `Marker`'s HTML element.
     * @returns {HTMLElement} element
     */
    getElement() {
        return this._element;
    }

    /**
     * Binds a Popup to the Marker
     * @param popup an instance of the `Popup` class. If undefined or null, any popup
     * set on this `Marker` instance is unset
     * @returns {Marker} `this`
     */
    setPopup(popup: ?Popup) {
        if (this._popup) {
            this._popup.remove();
            this._popup = null;
        }

        if (popup) {
            if (!('offset' in popup.options)) {
                popup.options.offset = this._offset;
            }
            this._popup = popup;
            if (this._lngLat) this._popup.setLngLat(this._lngLat);
        }

        return this;
    }

    _onMapClick(event: MapMouseEvent) {
        const targetElement = event.originalEvent.target;
        const element = this._element;

        if (this._popup && (targetElement === element || element.contains((targetElement: any)))) {
            this.togglePopup();
        }
    }

    /**
     * Returns the Popup instance that is bound to the Marker
     * @returns {Popup} popup
     */
    getPopup() {
        return this._popup;
    }

    /**
     * Opens or closes the bound popup, depending on the current state
     * @returns {Marker} `this`
     */
    togglePopup() {
        const popup = this._popup;

        if (!popup) return this;
        else if (popup.isOpen()) popup.remove();
        else popup.addTo(this._map);
        return this;
    }

    _update(e?: {type: 'move' | 'moveend'}) {
        if (!this._map || this._lngLat || !this._options) { return; }

        if (this._map.transform.renderWorldCopies) {
            this._lngLat = smartWrap(this._lngLat, this._pos, this._map.transform);
        }

        const pos = this._pos = this._map.project(this._lngLat);


        let anchor = this.options.anchor || 'middle';
        const offset = normalizeOffset(this.options && this.options.offset || [0, 0]);

        if (!anchor) {
            const width = this._element.offsetWidth,
                height = this._element.offsetHeight;

            if (pos.y + offset.bottom.y < height) {
                anchor = ['top'];
            } else if (pos.y > this._map.transform.height - height) {
                anchor = ['bottom'];
            } else {
                anchor = [];
            }

            if (pos.x < width / 2) {
                anchor.push('left');
            } else if (pos.x > this._map.transform.width - width / 2) {
                anchor.push('right');
            }

            if (anchor.length === 0) {
                anchor = 'middle';
            } else {
                anchor = anchor.join('-');
            }
        }

        const offsetedPos = pos.add(offset[anchor]);

        // because rounding the coordinates at every `move` event causes stuttered zooming
        // we only round them when _update is called with `moveend` or when its called with
        // no arguments (when the Marker is initialized or Marker#setLngLat is invoked).
        if (!e || e.type === "moveend") {
            this._pos = offsetedPos.round();
        }

        const anchorTranslate = {
            'middle': 'translate(-50%,-50%)',
            'top': 'translate(-50%,0)',
            'top-left': 'translate(0,0)',
            'top-right': 'translate(-100%,0)',
            'bottom': 'translate(-50%,-100%)',
            'bottom-left': 'translate(0,-100%)',
            'bottom-right': 'translate(-100%,-100%)',
            'left': 'translate(0,-50%)',
            'right': 'translate(-100%,-50%)'
        };

        const classList = this._element.classList;
        for (const key in anchorTranslate) {
            classList.remove(`mapboxgl-marker-anchor-${key}`);
        }
        classList.add(`mapboxgl-marker-anchor-${anchor}`);

        DOM.setTransform(this._element, `${anchorTranslate[anchor]} translate(${offsetedPos.x}px,${offsetedPos.y}px)`);
    }

    /**
     * Get the marker's anchor.
     * @returns {string}
     */
    getAnchor() {
        return this.options.anchor;
    }

    /**
     * Sets the anchor of the marker
     * @param {PointLike} [anchor] The anchor in pixels as a {@link PointLike} object to apply relative to the element's center. Negatives indicate left and up.
     * @returns {Marker} `this`
     */
    setAnchor(anchor: ?PointLike) {
        this._anchor = Point.convert(anchor);
        this._update();
        return this;
    }

    /**
     * Get the marker's offset.
     * @returns {number|PointLike|Object}
     */
    getOffset() {
        return this.options.offset;
    }

    /**
     * Sets the offset of the marker
     * @param {number|PointLike|Object} [offset] The offset in pixels as a {@link PointLike} object to apply relative to the element's center. Negatives indicate left and up.
     * @returns {Marker} `this`
     */
    setOffset(offset: number | PointLike | Object) {
        this._offset = Point.convert(offset);
        this._update();
        return this;
    }
}

function normalizeOffset(offset: ?Offset) {

    if (!offset) {
        return normalizeOffset(new Point(0, 0));
    } else if (typeof offset === 'number') {
        // input specifies a radius from which to calculate offsets at all positions
        const cornerOffset = Math.round(Math.sqrt(0.5 * Math.pow(offset, 2)));
        return {
            'middle': new Point(0, 0),
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
            'middle': convertedOffset,
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
            'middle': Point.convert(offset['middle'] || [0, 0]),
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

module.exports = Marker;
