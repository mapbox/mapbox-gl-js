// @flow

import * as DOM from '../util/dom.js';
import window from '../util/window.js';
import LngLat from '../geo/lng_lat.js';
import Point from '@mapbox/point-geometry';
import smartWrap from '../util/smart_wrap.js';
import {bindAll, extend, radToDeg, smoothstep} from '../util/util.js';
import {type Anchor, anchorTranslate} from './anchor.js';
import {Event, Evented} from '../util/evented.js';
import type Map from './map.js';
import type Popup from './popup.js';
import type {LngLatLike} from "../geo/lng_lat.js";
import type {MapMouseEvent, MapTouchEvent} from './events.js';
import type {PointLike} from '@mapbox/point-geometry';
import {globeTiltAtLngLat, globeCenterToScreenPoint, isLngLatBehindGlobe, GLOBE_ZOOM_THRESHOLD_MAX} from '../geo/projection/globe_util.js';
import assert from 'assert';

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
    pitchAlignment?: string,
    occludedOpacity?: number
};

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
 * @param {string} [options.pitchAlignment='auto'] `'map'` aligns the `Marker` to the plane of the map. `'viewport'` aligns the `Marker` to the plane of the viewport. `'auto'` automatically matches the value of `rotationAlignment`.
 * @param {string} [options.rotationAlignment='auto'] The alignment of the marker's rotation.`'map'` is aligned with the map plane, consistent with the cardinal directions as the map rotates. `'viewport'` is screenspace-aligned. `'horizon'` is aligned according to the nearest horizon, on non-globe projections it is equivalent to `'viewport'`. `'auto'` is equivalent to `'viewport'`.
 * @param {number} [options.occludedOpacity=0.2] The opacity of a marker that's occluded by 3D terrain.
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
    _map: ?Map;
    _anchor: Anchor;
    _offset: Point;
    _element: HTMLElement;
    _popup: ?Popup;
    _lngLat: LngLat;
    _pos: ?Point;
    _color: string;
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
    _updateFrameId: number;
    _updateMoving: () => void;
    _occludedOpacity: number;

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

        this._anchor = (options && options.anchor) || 'center';
        this._color = (options && options.color) || '#3FB1CE';
        this._scale = (options && options.scale) || 1;
        this._draggable = (options && options.draggable) || false;
        this._clickTolerance = (options && options.clickTolerance) || 0;
        this._isDragging = false;
        this._state = 'inactive';
        this._rotation = (options && options.rotation) || 0;
        this._rotationAlignment = (options && options.rotationAlignment) || 'auto';
        this._pitchAlignment = (options && options.pitchAlignment && options.pitchAlignment) || 'auto';
        this._updateMoving = () => this._update(true);
        this._occludedOpacity = (options && options.occludedOpacity) || 0.2;

        if (!options || !options.element) {
            this._defaultMarker = true;
            this._element = DOM.create('div');

            // create default map marker SVG

            const DEFAULT_HEIGHT = 41;
            const DEFAULT_WIDTH = 27;

            const svg = DOM.createSVG('svg', {
                display: 'block',
                height: `${DEFAULT_HEIGHT * this._scale}px`,
                width: `${DEFAULT_WIDTH * this._scale}px`,
                viewBox: `0 0 ${DEFAULT_WIDTH} ${DEFAULT_HEIGHT}`
            }, this._element);

            const gradient = DOM.createSVG('radialGradient', {id: 'shadowGradient'}, DOM.createSVG('defs', {}, svg));
            DOM.createSVG('stop', {offset: '10%', 'stop-opacity': 0.4}, gradient);
            DOM.createSVG('stop', {offset: '100%', 'stop-opacity': 0.05}, gradient);
            DOM.createSVG('ellipse', {cx: 13.5, cy: 34.8, rx: 10.5, ry: 5.25, fill: 'url(#shadowGradient)'}, svg); // shadow

            DOM.createSVG('path', { // marker shape
                fill: this._color,
                d: 'M27,13.5C27,19.07 20.25,27 14.75,34.5C14.02,35.5 12.98,35.5 12.25,34.5C6.75,27 0,19.22 0,13.5C0,6.04 6.04,0 13.5,0C20.96,0 27,6.04 27,13.5Z'
            }, svg);
            DOM.createSVG('path', { // border
                opacity: 0.25,
                d: 'M13.5,0C6.04,0 0,6.04 0,13.5C0,19.22 6.75,27 12.25,34.5C13,35.52 14.02,35.5 14.75,34.5C20.25,27 27,19.07 27,13.5C27,6.04 20.96,0 13.5,0ZM13.5,1C20.42,1 26,6.58 26,13.5C26,15.9 24.5,19.18 22.22,22.74C19.95,26.3 16.71,30.14 13.94,33.91C13.74,34.18 13.61,34.32 13.5,34.44C13.39,34.32 13.26,34.18 13.06,33.91C10.28,30.13 7.41,26.31 5.02,22.77C2.62,19.23 1,15.95 1,13.5C1,6.58 6.58,1 13.5,1Z'
            }, svg);

            DOM.createSVG('circle', {fill: 'white', cx: 13.5, cy: 13.5, r: 5.5}, svg); // circle

            // if no element and no offset option given apply an offset for the default marker
            // the -14 as the y value of the default marker offset was determined as follows
            //
            // the marker tip is at the center of the shadow ellipse from the default svg
            // the y value of the center of the shadow ellipse relative to the svg top left is 34.8
            // offset to the svg center "height (41 / 2)" gives 34.8 - (41 / 2) and rounded for an integer pixel offset gives 14
            // negative is used to move the marker up from the center so the tip is at the Marker lngLat
            this._offset = Point.convert((options && options.offset) || [0, -14]);
        } else {
            this._element = options.element;
            this._offset = Point.convert((options && options.offset) || [0, 0]);
        }

        if (!this._element.hasAttribute('aria-label')) this._element.setAttribute('aria-label', 'Map marker');
        this._element.classList.add('mapboxgl-marker');
        this._element.addEventListener('dragstart', (e: DragEvent) => {
            e.preventDefault();
        });
        this._element.addEventListener('mousedown', (e: MouseEvent) => {
            // prevent focusing on click
            e.preventDefault();
        });
        const classList = this._element.classList;
        for (const key in anchorTranslate) {
            classList.remove(`mapboxgl-marker-anchor-${key}`);
        }
        classList.add(`mapboxgl-marker-anchor-${this._anchor}`);

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
    addTo(map: Map): this {
        if (map === this._map) {
            return this;
        }
        this.remove();
        this._map = map;
        map.getCanvasContainer().appendChild(this._element);
        map.on('move', this._updateMoving);
        map.on('moveend', this._update);
        map.on('remove', this._clearFadeTimer);
        map._addMarker(this);
        this.setDraggable(this._draggable);
        this._update();

        // If we attached the `click` listener to the marker element, the popup
        // would close once the event propogated to `map` due to the
        // `Popup#_onClickClose` listener.
        map.on('click', this._onMapClick);

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
    remove(): this {
        const map = this._map;
        if (map) {
            map.off('click', this._onMapClick);
            map.off('move', this._updateMoving);
            map.off('moveend', this._update);
            map.off('mousedown', this._addDragHandler);
            map.off('touchstart', this._addDragHandler);
            map.off('mouseup', this._onUp);
            map.off('touchend', this._onUp);
            map.off('mousemove', this._onMove);
            map.off('touchmove', this._onMove);
            map.off('remove', this._clearFadeTimer);
            map._removeMarker(this);
            this._map = undefined;
        }
        this._clearFadeTimer();
        this._element.remove();
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
    getLngLat(): LngLat {
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
    setLngLat(lnglat: LngLatLike): this {
        this._lngLat = LngLat.convert(lnglat);
        this._pos = null;
        if (this._popup) this._popup.setLngLat(this._lngLat);
        this._update(true);
        return this;
    }

    /**
     * Returns the `Marker`'s HTML element.
     *
     * @returns {HTMLElement} Returns the marker element.
     * @example
     * const element = marker.getElement();
     */
    getElement(): HTMLElement {
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
    setPopup(popup: ?Popup): this {
        if (this._popup) {
            this._popup.remove();
            this._popup = null;
            this._element.removeAttribute('role');
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
            popup._marker = this;
            if (this._lngLat) this._popup.setLngLat(this._lngLat);

            this._element.setAttribute('role', 'button');
            this._originalTabIndex = this._element.getAttribute('tabindex');
            if (!this._originalTabIndex) {
                this._element.setAttribute('tabindex', '0');
            }
            this._element.addEventListener('keypress', this._onKeyPress);
            this._element.setAttribute('aria-expanded', 'false');
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
    getPopup(): ?Popup {
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
    togglePopup(): this {
        const popup = this._popup;
        if (!popup) {
            return this;
        } else if (popup.isOpen()) {
            popup.remove();
            this._element.setAttribute('aria-expanded', 'false');
        } else if (this._map) {
            popup.addTo(this._map);
            this._element.setAttribute('aria-expanded', 'true');
        }
        return this;
    }

    _behindTerrain(): boolean {
        const map = this._map;
        const pos = this._pos;
        if (!map || !pos) return false;
        const unprojected = map.unproject(pos);
        const camera = map.getFreeCameraOptions();
        if (!camera.position) return false;
        const cameraLngLat = camera.position.toLngLat();
        const toClosestSurface = cameraLngLat.distanceTo(unprojected);
        const toMarker = cameraLngLat.distanceTo(this._lngLat);
        return toClosestSurface < toMarker * 0.9;

    }

    _evaluateOpacity() {
        const map = this._map;
        if (!map) return;

        const pos = this._pos;

        if (!pos || pos.x < 0 || pos.x > map.transform.width || pos.y < 0 || pos.y > map.transform.height) {
            this._clearFadeTimer();
            return;
        }
        const mapLocation = map.unproject(pos);
        let opacity;
        if (map._showingGlobe() && isLngLatBehindGlobe(map.transform, this._lngLat)) {
            opacity = 0;
        } else {
            opacity = 1 - map._queryFogOpacity(mapLocation);
            if (map.transform._terrainEnabled() && map.getTerrain() && this._behindTerrain()) {
                opacity *= this._occludedOpacity;
            }
        }

        this._element.style.opacity = `${opacity}`;
        this._element.style.pointerEvents = opacity > 0 ? 'auto' : 'none';
        if (this._popup) {
            this._popup._setOpacity(opacity);
        }

        this._fadeTimer = null;
    }

    _clearFadeTimer() {
        if (this._fadeTimer) {
            clearTimeout(this._fadeTimer);
            this._fadeTimer = null;
        }
    }

    _updateDOM() {
        const pos = this._pos;
        const map = this._map;
        if (!pos || !map) { return; }

        const offset = this._offset.mult(this._scale);

        this._element.style.transform = `
            translate(${pos.x}px,${pos.y}px)
            ${anchorTranslate[this._anchor]}
            ${this._calculateXYTransform()} ${this._calculateZTransform()}
            translate(${offset.x}px,${offset.y}px)
        `;
    }

    _calculateXYTransform(): string {
        const pos = this._pos;
        const map = this._map;
        const alignment = this.getPitchAlignment();

        // `viewport', 'auto' and invalid arugments do no pitch transformation.
        if (!map || !pos || alignment !== 'map') {
            return ``;
        }
        // 'map' alignment on a flat map
        if (!map._showingGlobe()) {
            const pitch = map.getPitch();
            return pitch ? `rotateX(${pitch}deg)` : '';
        }
        // 'map' alignment on globe
        const tilt = radToDeg(globeTiltAtLngLat(map.transform, this._lngLat));
        const posFromCenter = pos.sub(globeCenterToScreenPoint(map.transform));
        const manhattanDistance = (Math.abs(posFromCenter.x) + Math.abs(posFromCenter.y));
        if (manhattanDistance === 0) { return ''; }

        const tiltOverDist =  tilt / manhattanDistance;
        const yTilt = posFromCenter.x * tiltOverDist;
        const xTilt = -posFromCenter.y * tiltOverDist;
        return `rotateX(${xTilt}deg) rotateY(${yTilt}deg)`;

    }

    _calculateZTransform(): string {

        const pos = this._pos;
        const map = this._map;
        if (!map || !pos) { return ''; }

        let rotation = 0;
        const alignment = this.getRotationAlignment();
        if (alignment === 'map') {
            if (map._showingGlobe()) {
                const north = map.project(new LngLat(this._lngLat.lng, this._lngLat.lat + .001));
                const south = map.project(new LngLat(this._lngLat.lng, this._lngLat.lat - .001));
                const diff = south.sub(north);
                rotation = radToDeg(Math.atan2(diff.y, diff.x)) - 90;
            } else {
                rotation = -map.getBearing();
            }
        } else if (alignment === 'horizon') {
            const ALIGN_TO_HORIZON_BELOW_ZOOM = 4;
            const ALIGN_TO_SCREEN_ABOVE_ZOOM = 6;
            assert(ALIGN_TO_SCREEN_ABOVE_ZOOM <= GLOBE_ZOOM_THRESHOLD_MAX, 'Horizon-oriented marker transition should be complete when globe switches to Mercator');
            assert(ALIGN_TO_HORIZON_BELOW_ZOOM <= ALIGN_TO_SCREEN_ABOVE_ZOOM);

            const smooth = smoothstep(ALIGN_TO_HORIZON_BELOW_ZOOM, ALIGN_TO_SCREEN_ABOVE_ZOOM, map.getZoom());

            const centerPoint = globeCenterToScreenPoint(map.transform);
            centerPoint.y += smooth * map.transform.height;
            const rel = pos.sub(centerPoint);
            const angle = radToDeg(Math.atan2(rel.y, rel.x));
            const up = angle > 90 ? angle - 270 : angle + 90;
            rotation = up * (1 - smooth);
        }

        rotation += this._rotation;
        return rotation ? `rotateZ(${rotation}deg)` : '';
    }

    _update(delaySnap?: boolean) {
        window.cancelAnimationFrame(this._updateFrameId);
        const map = this._map;
        if (!map) return;

        if (map.transform.renderWorldCopies) {
            this._lngLat = smartWrap(this._lngLat, this._pos, map.transform);
        }

        this._pos = map.project(this._lngLat);

        // because rounding the coordinates at every `move` event causes stuttered zooming
        // we only round them when _update is called with `moveend` or when its called with
        // no arguments (when the Marker is initialized or Marker#setLngLat is invoked).
        if (delaySnap === true) {
            this._updateFrameId = window.requestAnimationFrame(() => {
                if (this._element && this._pos && this._anchor) {
                    this._pos = this._pos.round();
                    this._updateDOM();
                }
            });
        } else {
            this._pos = this._pos.round();
        }

        map._requestDomTask(() => {
            if (!this._map) return;

            if (this._element && this._pos && this._anchor) {
                this._updateDOM();
            }

            if ((map._showingGlobe() || map.getTerrain() || map.getFog()) && !this._fadeTimer) {
                this._fadeTimer = setTimeout(this._evaluateOpacity.bind(this), 60);
            }
        });
    }

    /**
     * Get the marker's offset.
     *
     * @returns {Point} The marker's screen coordinates in pixels.
     * @example
     * const offset = marker.getOffset();
     */
    getOffset(): Point {
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
    setOffset(offset: PointLike): this {
        this._offset = Point.convert(offset);
        this._update();
        return this;
    }

    _onMove(e: MapMouseEvent | MapTouchEvent) {
        const map = this._map;
        if (!map) return;

        const startPos = this._pointerdownPos;
        const posDelta = this._positionDelta;
        if (!startPos || !posDelta) return;

        if (!this._isDragging) {
            const clickTolerance = this._clickTolerance || map._clickTolerance;
            if (e.point.dist(startPos) < clickTolerance) return;
            this._isDragging = true;
        }

        this._pos = e.point.sub(posDelta);
        this._lngLat = map.unproject(this._pos);
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

        const map = this._map;
        if (map) {
            map.off('mousemove', this._onMove);
            map.off('touchmove', this._onMove);
        }

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
        const map = this._map;
        const pos = this._pos;
        if (!map || !pos) return;

        if (this._element.contains((e.originalEvent.target: any))) {
            e.preventDefault();

            // We need to calculate the pixel distance between the click point
            // and the marker position, with the offset accounted for. Then we
            // can subtract this distance from the mousemove event's position
            // to calculate the new marker position.
            // If we don't do this, the marker 'jumps' to the click position
            // creating a jarring UX effect.
            this._positionDelta = e.point.sub(pos);
            this._pointerdownPos = e.point;

            this._state = 'pending';
            map.on('mousemove', this._onMove);
            map.on('touchmove', this._onMove);
            map.once('mouseup', this._onUp);
            map.once('touchend', this._onUp);
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
    setDraggable(shouldBeDraggable: boolean): this {
        this._draggable = !!shouldBeDraggable; // convert possible undefined value to false

        // handle case where map may not exist yet
        // for example, when setDraggable is called before addTo
        const map = this._map;
        if (map) {
            if (shouldBeDraggable) {
                map.on('mousedown', this._addDragHandler);
                map.on('touchstart', this._addDragHandler);
            } else {
                map.off('mousedown', this._addDragHandler);
                map.off('touchstart', this._addDragHandler);
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
    isDraggable(): boolean {
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
    setRotation(rotation: number): this {
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
    getRotation(): number {
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
    setRotationAlignment(alignment: string): this {
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
    getRotationAlignment(): string {
        if (this._rotationAlignment === 'auto')
            return 'viewport';
        if (this._rotationAlignment === 'horizon' && this._map && !this._map._showingGlobe())
            return 'viewport';
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
    setPitchAlignment(alignment: string): this {
        this._pitchAlignment = alignment || 'auto';
        this._update();
        return this;
    }

    /**
     * Returns the current `pitchAlignment` behavior of the marker.
     *
     * @returns {string} The current pitch alignment of the marker.
     * @example
     * const alignment = marker.getPitchAlignment();
     */
    getPitchAlignment(): string {
        if (this._pitchAlignment === 'auto') {
            return this.getRotationAlignment();
        }
        return this._pitchAlignment;
    }

    /**
     * Sets the `occludedOpacity` property of the marker.
     * This opacity is used on the marker when the marker is occluded by terrain.
     *
     * @param {number} [opacity=0.2] Sets the `occludedOpacity` property of the marker.
     * @returns {Marker} Returns itself to allow for method chaining.
     * @example
     * marker.setOccludedOpacity(0.3);
     */
    setOccludedOpacity(opacity: number): this {
        this._occludedOpacity = opacity || 0.2;
        this._update();
        return this;
    }

    /**
     * Returns the current `occludedOpacity` of the marker.
     *
     * @returns {number} The opacity of a terrain occluded marker.
     * @example
     * const opacity = marker.getOccludedOpacity();
     */
    getOccludedOpacity(): number {
        return this._occludedOpacity;
    }
}
