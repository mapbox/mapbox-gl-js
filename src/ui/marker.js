// @flow

import DOM from '../util/dom.js';
import window from '../util/window.js';
import LngLat from '../geo/lng_lat.js';
import Point from '@mapbox/point-geometry';
import smartWrap from '../util/smart_wrap.js';
import {bindAll, extend} from '../util/util.js';
import {type Anchor, anchorTranslate, applyAnchorClass} from './anchor.js';
import {Event, Evented} from '../util/evented.js';
import type Map from './map.js';
import type Popup from './popup.js';
import type {LngLatLike} from "../geo/lng_lat.js";
import type {MapMouseEvent, MapTouchEvent} from './events.js';
import type {PointLike} from '@mapbox/point-geometry';

type Options = {
    element?: HTMLElement,
    offset?: PointLike,
    anchor?: Anchor,
    color?: string,
    scale?: number,
    draggable?: boolean,
    clickTolerance?: number,
    rotation?: number,
    rotationAlignment?: string,
    pitchAlignment?: string
};

export const TERRAIN_OCCLUDED_OPACITY = 0.2;

/**
 * Creates a marker component.
 *
 * @param {Object} [options]
 * @param {HTMLElement} [options.element] DOM element to use as a marker. The default is a light blue, droplet-shaped SVG marker.
 * @param {string} [options.anchor='center'] A string indicating the part of the Marker that should be positioned closest to the coordinate set via {@link Marker#setLngLat}.
 *   Options are `'center'`, `'top'`, `'bottom'`, `'left'`, `'right'`, `'top-left'`, `'top-right'`, `'bottom-left'`, and `'bottom-right'`.
 * @param {PointLike} [options.offset] The offset in pixels as a {@link PointLike} object to apply relative to the element's center. Negatives indicate left and up.
 * @param {string} [options.color='#3FB1CE'] The color to use for the default marker if `options.element` is not provided. The default is light blue.
 * @param {number} [options.scale=1] The scale to use for the default marker if `options.element` is not provided. The default scale corresponds to a height of `41px` and a width of `27px`.
 * @param {boolean} [options.draggable=false] A boolean indicating whether or not a marker is able to be dragged to a new position on the map.
 * @param {number} [options.clickTolerance=0] The max number of pixels a user can shift the mouse pointer during a click on the marker for it to be considered a valid click (as opposed to a marker drag). The default is to inherit map's `clickTolerance`.
 * @param {number} [options.rotation=0] The rotation angle of the marker in degrees, relative to its respective `rotationAlignment` setting. A positive value will rotate the marker clockwise.
 * @param {string} [options.pitchAlignment='auto'] `map` aligns the `Marker` to the plane of the map. `viewport` aligns the `Marker` to the plane of the viewport. `auto` automatically matches the value of `rotationAlignment`.
 * @param {string} [options.rotationAlignment='auto'] `map` aligns the `Marker`'s rotation relative to the map, maintaining a bearing as the map rotates. `viewport` aligns the `Marker`'s rotation relative to the viewport, agnostic to map rotations. `auto` is equivalent to `viewport`.
 * @example
 * // Create a new marker.
 * const marker = new mapboxgl.Marker()
 *     .setLngLat([30.5, 50.5])
 *     .addTo(map);
 * @example
 * // Set marker options.
 * const marker = new mapboxgl.Marker({
 *     color: "#FFFFFF",
 *     draggable: true
 * }).setLngLat([30.5, 50.5])
 *     .addTo(map);
 * @see [Example: Add custom icons with Markers](https://www.mapbox.com/mapbox-gl-js/example/custom-marker-icons/)
 * @see [Example: Create a draggable Marker](https://www.mapbox.com/mapbox-gl-js/example/drag-a-marker/)
 */
export default class Marker extends Evented {
    _map: Map;
    _anchor: Anchor;
    _offset: Point;
    _element: HTMLElement;
    _popup: ?Popup;
    _lngLat: LngLat;
    _pos: ?Point;
    _color: ?string;
    _scale: number;
    _defaultMarker: boolean;
    _draggable: boolean;
    _clickTolerance: number;
    _isDragging: boolean;
    _state: 'inactive' | 'pending' | 'active'; // used for handling drag events
    _positionDelta: ?Point;
    _pointerdownPos: ?Point;
    _rotation: number;
    _pitchAlignment: string;
    _rotationAlignment: string;
    _originalTabIndex: ?string; // original tabindex of _element
    _fadeTimer: ?TimeoutID;

    constructor(options?: Options, legacyOptions?: Options) {
        super();
        // For backward compatibility -- the constructor used to accept the element as a
        // required first argument, before it was made optional.
        if (options instanceof window.HTMLElement || legacyOptions) {
            options = extend({element: options}, legacyOptions);
        }

        bindAll([
            '_update',
            '_onMove',
            '_onUp',
            '_addDragHandler',
            '_onMapClick',
            '_onKeyPress',
            '_clearFadeTimer'
        ], this);

        this._anchor = options && options.anchor || 'center';
        this._color = options && options.color || '#3FB1CE';
        this._scale = options && options.scale || 1;
        this._draggable = options && options.draggable || false;
        this._clickTolerance = options && options.clickTolerance || 0;
        this._isDragging = false;
        this._state = 'inactive';
        this._rotation = options && options.rotation || 0;
        this._rotationAlignment = options && options.rotationAlignment || 'auto';
        this._pitchAlignment = options && options.pitchAlignment && options.pitchAlignment !== 'auto' ?  options.pitchAlignment : this._rotationAlignment;

        if (!options || !options.element) {
            this._defaultMarker = true;
            this._element = DOM.create('div');
            this._element.setAttribute('aria-label', 'Map marker');

            // create default map marker SVG
            const svg = DOM.createNS('http://www.w3.org/2000/svg', 'svg');
            const defaultHeight = 41;
            const defaultWidth = 27;
            svg.setAttributeNS(null, 'display', 'block');
            svg.setAttributeNS(null, 'height', `${defaultHeight}px`);
            svg.setAttributeNS(null, 'width', `${defaultWidth}px`);
            svg.setAttributeNS(null, 'viewBox', `0 0 ${defaultWidth} ${defaultHeight}`);

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
            background.setAttributeNS(null, 'fill', this._color);

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

            svg.setAttributeNS(null, 'height', `${defaultHeight * this._scale}px`);
            svg.setAttributeNS(null, 'width', `${defaultWidth * this._scale}px`);

            this._element.appendChild(svg);

            // if no element and no offset option given apply an offset for the default marker
            // the -14 as the y value of the default marker offset was determined as follows
            //
            // the marker tip is at the center of the shadow ellipse from the default svg
            // the y value of the center of the shadow ellipse relative to the svg top left is "shadow transform translate-y (29.0) + ellipse cy (5.80029008)"
            // offset to the svg center "height (41 / 2)" gives (29.0 + 5.80029008) - (41 / 2) and rounded for an integer pixel offset gives 14
            // negative is used to move the marker up from the center so the tip is at the Marker lngLat
            this._offset = Point.convert(options && options.offset || [0, -14]);
        } else {
            this._element = options.element;
            this._offset = Point.convert(options && options.offset || [0, 0]);
        }

        this._element.classList.add('mapboxgl-marker');
        this._element.addEventListener('dragstart', (e: DragEvent) => {
            e.preventDefault();
        });
        this._element.addEventListener('mousedown', (e: MouseEvent) => {
            // prevent focusing on click
            e.preventDefault();
        });
        applyAnchorClass(this._element, this._anchor, 'marker');

        this._popup = null;
    }

    /**
     * Attaches the `Marker` to a `Map` object.
     *
     * @param {Map} map The Mapbox GL JS map to add the marker to.
     * @returns {Marker} Returns itself to allow for method chaining.
     * @example
     * const marker = new mapboxgl.Marker()
     *     .setLngLat([30.5, 50.5])
     *     .addTo(map); // add the marker to the map
     */
    addTo(map: Map) {
        this.remove();
        this._map = map;
        map.getCanvasContainer().appendChild(this._element);
        map.on('move', this._update);
        map.on('moveend', this._update);
        map.on('remove', this._clearFadeTimer);
        map._addMarker(this);
        this.setDraggable(this._draggable);
        this._update();

        // If we attached the `click` listener to the marker element, the popup
        // would close once the event propogated to `map` due to the
        // `Popup#_onClickClose` listener.
        this._map.on('click', this._onMapClick);

        return this;
    }

    /**
     * Removes the marker from a map.
     *
     * @example
     * const marker = new mapboxgl.Marker().addTo(map);
     * marker.remove();
     * @returns {Marker} Returns itself to allow for method chaining.
     */
    remove() {
        if (this._map) {
            this._map.off('click', this._onMapClick);
            this._map.off('move', this._update);
            this._map.off('moveend', this._update);
            this._map.off('mousedown', this._addDragHandler);
            this._map.off('touchstart', this._addDragHandler);
            this._map.off('mouseup', this._onUp);
            this._map.off('touchend', this._onUp);
            this._map.off('mousemove', this._onMove);
            this._map.off('touchmove', this._onMove);
            this._map.off('remove', this._clearFadeTimer);
            this._map._removeMarker(this);
            delete this._map;
        }
        this._clearFadeTimer();
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
     * @returns {LngLat} A {@link LngLat} describing the marker's location.
    * @example
    * // Store the marker's longitude and latitude coordinates in a variable
    * const lngLat = marker.getLngLat();
    * // Print the marker's longitude and latitude values in the console
    * console.log(`Longitude: ${lngLat.lng}, Latitude: ${lngLat.lat}`);
    * @see [Example: Create a draggable Marker](https://docs.mapbox.com/mapbox-gl-js/example/drag-a-marker/)
    */
    getLngLat() {
        return this._lngLat;
    }

    /**
    * Set the marker's geographical position and move it.
     *
    * @param {LngLat} lnglat A {@link LngLat} describing where the marker should be located.
    * @returns {Marker} Returns itself to allow for method chaining.
    * @example
    * // Create a new marker, set the longitude and latitude, and add it to the map.
    * new mapboxgl.Marker()
    *     .setLngLat([-65.017, -16.457])
    *     .addTo(map);
    * @see [Example: Add custom icons with Markers](https://docs.mapbox.com/mapbox-gl-js/example/custom-marker-icons/)
    * @see [Example: Create a draggable Marker](https://docs.mapbox.com/mapbox-gl-js/example/drag-a-marker/)
    * @see [Example: Add a marker using a place name](https://docs.mapbox.com/mapbox-gl-js/example/marker-from-geocode/)
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
     *
     * @returns {HTMLElement} Returns the marker element.
     * @example
     * const element = marker.getElement();
     */
    getElement() {
        return this._element;
    }

    /**
     * Binds a {@link Popup} to the {@link Marker}.
     *
     * @param {Popup | null} popup An instance of the {@link Popup} class. If undefined or null, any popup
     * set on this {@link Marker} instance is unset.
     * @returns {Marker} Returns itself to allow for method chaining.
     * @example
     * const marker = new mapboxgl.Marker()
     *     .setLngLat([0, 0])
     *     .setPopup(new mapboxgl.Popup().setHTML("<h1>Hello World!</h1>")) // add popup
     *     .addTo(map);
     * @see [Example: Attach a popup to a marker instance](https://docs.mapbox.com/mapbox-gl-js/example/set-popup/)
     */
    setPopup(popup: ?Popup) {
        if (this._popup) {
            this._popup.remove();
            this._popup = null;
            this._element.removeEventListener('keypress', this._onKeyPress);

            if (!this._originalTabIndex) {
                this._element.removeAttribute('tabindex');
            }
        }

        if (popup) {
            if (!('offset' in popup.options)) {
                const markerHeight = 41 - (5.8 / 2);
                const markerRadius = 13.5;
                const linearOffset = Math.sqrt(Math.pow(markerRadius, 2) / 2);
                popup.options.offset = this._defaultMarker ? {
                    'top': [0, 0],
                    'top-left': [0, 0],
                    'top-right': [0, 0],
                    'bottom': [0, -markerHeight],
                    'bottom-left': [linearOffset, (markerHeight - markerRadius + linearOffset) * -1],
                    'bottom-right': [-linearOffset, (markerHeight - markerRadius + linearOffset) * -1],
                    'left': [markerRadius, (markerHeight - markerRadius) * -1],
                    'right': [-markerRadius, (markerHeight - markerRadius) * -1]
                } : this._offset;
            }
            this._popup = popup;
            if (this._lngLat) this._popup.setLngLat(this._lngLat);

            this._originalTabIndex = this._element.getAttribute('tabindex');
            if (!this._originalTabIndex) {
                this._element.setAttribute('tabindex', '0');
            }
            this._element.addEventListener('keypress', this._onKeyPress);
        }

        return this;
    }

    _onKeyPress(e: KeyboardEvent) {
        const code = e.code;
        const legacyCode = e.charCode || e.keyCode;

        if (
            (code === 'Space') || (code === 'Enter') ||
            (legacyCode === 32) || (legacyCode === 13) // space or enter
        ) {
            this.togglePopup();
        }
    }

    _onMapClick(e: MapMouseEvent) {
        const targetElement = e.originalEvent.target;
        const element = this._element;

        if (this._popup && (targetElement === element || element.contains((targetElement: any)))) {
            this.togglePopup();
        }
    }

    /**
     * Returns the {@link Popup} instance that is bound to the {@link Marker}.
     *
     * @returns {Popup} Returns the popup.
     * @example
     * const marker = new mapboxgl.Marker()
     *     .setLngLat([0, 0])
     *     .setPopup(new mapboxgl.Popup().setHTML("<h1>Hello World!</h1>"))
     *     .addTo(map);
     *
     * console.log(marker.getPopup()); // return the popup instance
     */
    getPopup() {
        return this._popup;
    }

    /**
     * Opens or closes the {@link Popup} instance that is bound to the {@link Marker}, depending on the current state of the {@link Popup}.
     *
     * @returns {Marker} Returns itself to allow for method chaining.
     * @example
     * const marker = new mapboxgl.Marker()
     *     .setLngLat([0, 0])
     *     .setPopup(new mapboxgl.Popup().setHTML("<h1>Hello World!</h1>"))
     *     .addTo(map);
     *
     * marker.togglePopup(); // toggle popup open or closed
     */
    togglePopup() {
        const popup = this._popup;

        if (!popup) return this;
        else if (popup.isOpen()) popup.remove();
        else popup.addTo(this._map);
        return this;
    }

    _evaluateOpacity() {
        const position = this._pos ? this._pos.sub(this._transformedOffset()) : null;

        if (!this._withinScreenBounds(position)) {
            this._clearFadeTimer();
            return;
        }

        const mapLocation = this._map.unproject(position);

        let terrainOccluded = false;
        if (this._map.getTerrain()) {
            const camera = this._map.getFreeCameraOptions();
            if (camera.position) {
                const cameraPos = camera.position.toLngLat();
                // the distance to the marker lat/lng + marker offset location
                const offsetDistance = cameraPos.distanceTo(mapLocation);
                const distance = cameraPos.distanceTo(this._lngLat);
                terrainOccluded = offsetDistance < distance * 0.9;
            }
        }

        const fogOpacity = this._map._queryFogOpacity(mapLocation);
        const opacity = (1.0 - fogOpacity) * (terrainOccluded ? TERRAIN_OCCLUDED_OPACITY : 1.0);
        this._element.style.opacity = `${opacity}`;
        if (this._popup) this._popup._setOpacity(`${opacity}`);

        this._fadeTimer = null;
    }

    _clearFadeTimer() {
        if (this._fadeTimer) {
            clearTimeout(this._fadeTimer);
            this._fadeTimer = null;
        }
    }

    _withinScreenBounds(position: ?Point): boolean {
        const tr = this._map.transform;
        return !!position &&
            position.x >= 0 && position.x < tr.width &&
            position.y >= 0 && position.y < tr.height;
    }

    _update(e?: {type: 'move' | 'moveend'}) {
        if (!this._map) return;

        if (this._map.transform.renderWorldCopies) {
            this._lngLat = smartWrap(this._lngLat, this._pos, this._map.transform);
        }

        this._pos = this._map.project(this._lngLat)._add(this._transformedOffset());

        let rotation = "";
        if (this._rotationAlignment === "viewport" || this._rotationAlignment === "auto") {
            rotation = `rotateZ(${this._rotation}deg)`;
        } else if (this._rotationAlignment === "map") {
            rotation = `rotateZ(${this._rotation - this._map.getBearing()}deg)`;
        }

        let pitch = "";
        if (this._pitchAlignment === "viewport" || this._pitchAlignment === "auto") {
            pitch = "rotateX(0deg)";
        } else if (this._pitchAlignment === "map") {
            pitch = `rotateX(${this._map.getPitch()}deg)`;
        }

        // because rounding the coordinates at every `move` event causes stuttered zooming
        // we only round them when _update is called with `moveend` or when its called with
        // no arguments (when the Marker is initialized or Marker#setLngLat is invoked).
        if (!e || e.type === "moveend") {
            this._pos = this._pos.round();
        }

        this._map._requestDomTask(() => {
            if (!this._map) return;

            if (this._element && this._pos && this._anchor) {
                DOM.setTransform(this._element, `${anchorTranslate[this._anchor]} translate(${this._pos.x}px, ${this._pos.y}px) ${pitch} ${rotation}`);
            }

            if ((this._map.getTerrain() || this._map.getFog()) && !this._fadeTimer) {
                this._fadeTimer = setTimeout(this._evaluateOpacity.bind(this), 60);
            }
        });
    }

    /**
     * This is initially added to fix the behavior of default symbols only, in order
     * to prevent any regression for custom symbols in client code.
     * @private
     */
    _transformedOffset() {
        if (!this._defaultMarker) return this._offset;
        const tr = this._map.transform;
        const offset = this._offset.mult(this._scale);
        if (this._rotationAlignment === "map") offset._rotate(tr.angle);
        if (this._pitchAlignment === "map") offset.y *= Math.cos(tr._pitch);
        return offset;
    }

    /**
     * Get the marker's offset.
     *
     * @returns {Point} The marker's screen coordinates in pixels.
     * @example
     * const offset = marker.getOffset();
     */
    getOffset() {
        return this._offset;
    }

    /**
     * Sets the offset of the marker.
     *
     * @param {PointLike} offset The offset in pixels as a {@link PointLike} object to apply relative to the element's center. Negatives indicate left and up.
     * @returns {Marker} Returns itself to allow for method chaining.
     * @example
     * marker.setOffset([0, 1]);
     */
    setOffset(offset: PointLike) {
        this._offset = Point.convert(offset);
        this._update();
        return this;
    }

    _onMove(e: MapMouseEvent | MapTouchEvent) {
        if (!this._isDragging) {
            const clickTolerance = this._clickTolerance || this._map._clickTolerance;
            this._isDragging = e.point.dist(this._pointerdownPos) >= clickTolerance;
        }
        if (!this._isDragging) return;

        this._pos = e.point.sub(this._positionDelta);
        this._lngLat = this._map.unproject(this._pos);
        this.setLngLat(this._lngLat);
        // suppress click event so that popups don't toggle on drag
        this._element.style.pointerEvents = 'none';

        // make sure dragstart only fires on the first move event after mousedown.
        // this can't be on mousedown because that event doesn't necessarily
        // imply that a drag is about to happen.
        if (this._state === 'pending') {
            this._state = 'active';

            /**
             * Fired when dragging starts.
             *
             * @event dragstart
             * @memberof Marker
             * @instance
             * @type {Object}
             * @property {Marker} marker The object that is being dragged.
             */
            this.fire(new Event('dragstart'));
        }

        /**
         * Fired while dragging.
         *
         * @event drag
         * @memberof Marker
         * @instance
         * @type {Object}
         * @property {Marker} marker The object that is being dragged.
         */
        this.fire(new Event('drag'));
    }

    _onUp() {
        // revert to normal pointer event handling
        this._element.style.pointerEvents = 'auto';
        this._positionDelta = null;
        this._pointerdownPos = null;
        this._isDragging = false;
        this._map.off('mousemove', this._onMove);
        this._map.off('touchmove', this._onMove);

        // only fire dragend if it was preceded by at least one drag event
        if (this._state === 'active') {
            /**
            * Fired when the marker is finished being dragged.
            *
            * @event dragend
            * @memberof Marker
            * @instance
            * @type {Object}
            * @property {Marker} marker The object that was dragged.
            */
            this.fire(new Event('dragend'));
        }

        this._state = 'inactive';
    }

    _addDragHandler(e: MapMouseEvent | MapTouchEvent) {
        if (this._element.contains((e.originalEvent.target: any))) {
            e.preventDefault();

            // We need to calculate the pixel distance between the click point
            // and the marker position, with the offset accounted for. Then we
            // can subtract this distance from the mousemove event's position
            // to calculate the new marker position.
            // If we don't do this, the marker 'jumps' to the click position
            // creating a jarring UX effect.
            this._positionDelta = e.point.sub(this._pos).add(this._transformedOffset());

            this._pointerdownPos = e.point;

            this._state = 'pending';
            this._map.on('mousemove', this._onMove);
            this._map.on('touchmove', this._onMove);
            this._map.once('mouseup', this._onUp);
            this._map.once('touchend', this._onUp);
        }
    }

    /**
     * Sets the `draggable` property and functionality of the marker.
     *
     * @param {boolean} [shouldBeDraggable=false] Turns drag functionality on/off.
     * @returns {Marker} Returns itself to allow for method chaining.
     * @example
     * marker.setDraggable(true);
     */
    setDraggable(shouldBeDraggable: boolean) {
        this._draggable = !!shouldBeDraggable; // convert possible undefined value to false

        // handle case where map may not exist yet
        // for example, when setDraggable is called before addTo
        if (this._map) {
            if (shouldBeDraggable) {
                this._map.on('mousedown', this._addDragHandler);
                this._map.on('touchstart', this._addDragHandler);
            } else {
                this._map.off('mousedown', this._addDragHandler);
                this._map.off('touchstart', this._addDragHandler);
            }
        }

        return this;
    }

    /**
     * Returns true if the marker can be dragged.
     *
     * @returns {boolean} True if the marker is draggable.
     * @example
     * const isMarkerDraggable = marker.isDraggable();
     */
    isDraggable() {
        return this._draggable;
    }

    /**
     * Sets the `rotation` property of the marker.
     *
     * @param {number} [rotation=0] The rotation angle of the marker (clockwise, in degrees), relative to its respective {@link Marker#setRotationAlignment} setting.
     * @returns {Marker} Returns itself to allow for method chaining.
     * @example
     * marker.setRotation(45);
     */
    setRotation(rotation: number) {
        this._rotation = rotation || 0;
        this._update();
        return this;
    }

    /**
     * Returns the current rotation angle of the marker (in degrees).
     *
     * @returns {number} The current rotation angle of the marker.
     * @example
     * const rotation = marker.getRotation();
     */
    getRotation() {
        return this._rotation;
    }

    /**
     * Sets the `rotationAlignment` property of the marker.
     *
     * @param {string} [alignment='auto'] Sets the `rotationAlignment` property of the marker.
     * @returns {Marker} Returns itself to allow for method chaining.
     * @example
     * marker.setRotationAlignment('viewport');
     */
    setRotationAlignment(alignment: string) {
        this._rotationAlignment = alignment || 'auto';
        this._update();
        return this;
    }

    /**
     * Returns the current `rotationAlignment` property of the marker.
     *
     * @returns {string} The current rotational alignment of the marker.
     * @example
     * const alignment = marker.getRotationAlignment();
     */
    getRotationAlignment() {
        return this._rotationAlignment;
    }

    /**
     * Sets the `pitchAlignment` property of the marker.
     *
     * @param {string} [alignment] Sets the `pitchAlignment` property of the marker. If alignment is 'auto', it will automatically match `rotationAlignment`.
     * @returns {Marker} Returns itself to allow for method chaining.
     * @example
     * marker.setPitchAlignment('map');
     */
    setPitchAlignment(alignment: string) {
        this._pitchAlignment = alignment && alignment !== 'auto' ? alignment : this._rotationAlignment;
        this._update();
        return this;
    }

    /**
     * Returns the current `pitchAlignment` property of the marker.
     *
     * @returns {string} The current pitch alignment of the marker in degrees.
     * @example
     * const alignment = marker.getPitchAlignment();
     */
    getPitchAlignment() {
        return this._pitchAlignment;
    }
}
