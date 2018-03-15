// @flow

const util = require('../util/util');
const interpolate = require('../style-spec/util/interpolate').number;
const browser = require('../util/browser');
const LngLat = require('../geo/lng_lat');
const LngLatBounds = require('../geo/lng_lat_bounds');
const Point = require('@mapbox/point-geometry');
const Evented = require('../util/evented');

import type Transform from '../geo/transform';
import type {LngLatLike} from '../geo/lng_lat';
import type {LngLatBoundsLike} from '../geo/lng_lat_bounds';

/**
 * Options common to {@link Map#jumpTo}, {@link Map#easeTo}, and {@link Map#flyTo}, controlling the desired location,
 * zoom, bearing, and pitch of the camera. All properties are optional, and when a property is omitted, the current
 * camera value for that property will remain unchanged.
 *
 * @typedef {Object} CameraOptions
 * @property {LngLatLike} center The desired center.
 * @property {number} zoom The desired zoom level.
 * @property {number} bearing The desired bearing, in degrees. The bearing is the compass direction that
 * is "up"; for example, a bearing of 90° orients the map so that east is up.
 * @property {number} pitch The desired pitch, in degrees.
 * @property {LngLatLike} around If `zoom` is specified, `around` determines the point around which the zoom is centered.
 */
type CameraOptions = {
    center?: LngLatLike,
    zoom?: number,
    bearing?: number,
    pitch?: number,
    around?: LngLatLike
};

/**
 * Options common to map movement methods that involve animation, such as {@link Map#panBy} and
 * {@link Map#easeTo}, controlling the duration and easing function of the animation. All properties
 * are optional.
 *
 * @typedef {Object} AnimationOptions
 * @property {number} duration The animation's duration, measured in milliseconds.
 * @property {Function} easing A function taking a time in the range 0..1 and returning a number where 0 is
 *   the initial state and 1 is the final state.
 * @property {PointLike} offset of the target center relative to real map container center at the end of animation.
 * @property {boolean} animate If `false`, no animation will occur.
 */
type AnimationOptions = {
    duration?: number,
    easing?: (number) => number,
    offset?: PointLike,
    animate?: boolean
};

/**
 * Options for setting padding on a call to {@link Map#fitBounds}. All properties of this object must be
 * non-negative integers.
 *
 * @typedef {Object} PaddingOptions
 * @property {number} top Padding in pixels from the top of the map canvas.
 * @property {number} bottom Padding in pixels from the bottom of the map canvas.
 * @property {number} left Padding in pixels from the left of the map canvas.
 * @property {number} right Padding in pixels from the right of the map canvas.
 */

class Camera extends Evented {
    transform: Transform;
    moving: boolean;
    zooming: boolean;
    rotating: boolean;
    pitching: boolean;

    _bearingSnap: number;
    _onEaseEnd: number;
    _easeStart: number;
    _isEasing: boolean;
    _easeOptions: {duration: number, easing: (number) => number};

    _onFrame: (Transform) => void;
    _finishFn: () => void;
    +_update: () => void;

    constructor(transform: Transform, options: {bearingSnap: number}) {
        super();
        this.moving = false;
        this.transform = transform;
        this._bearingSnap = options.bearingSnap;
    }

    /**
     * Returns the map's geographical centerpoint.
     *
     * @memberof Map#
     * @returns The map's geographical centerpoint.
     */
    getCenter(): LngLat { return this.transform.center; }

    /**
     * Sets the map's geographical centerpoint. Equivalent to `jumpTo({center: center})`.
     *
     * @memberof Map#
     * @param center The centerpoint to set.
     * @param eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires movestart
     * @fires moveend
     * @returns {Map} `this`
     * @example
     * map.setCenter([-74, 38]);
     * @see [Move symbol with the keyboard](https://www.mapbox.com/mapbox-gl-js/example/rotating-controllable-marker/)
     */
    setCenter(center: LngLatLike, eventData?: Object) {
        return this.jumpTo({center: center}, eventData);
    }

    /**
     * Pans the map by the specified offest.
     *
     * @memberof Map#
     * @param offset `x` and `y` coordinates by which to pan the map.
     * @param options
     * @param eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires movestart
     * @fires moveend
     * @returns {Map} `this`
     * @see [Navigate the map with game-like controls](https://www.mapbox.com/mapbox-gl-js/example/game-controls/)
     */
    panBy(offset: PointLike, options?: AnimationOptions, eventData?: Object) {
        offset = Point.convert(offset).mult(-1);
        return this.panTo(this.transform.center, util.extend({offset}, options), eventData);
    }

    /**
     * Pans the map to the specified location, with an animated transition.
     *
     * @memberof Map#
     * @param lnglat The location to pan the map to.
     * @param options
     * @param eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires movestart
     * @fires moveend
     * @returns {Map} `this`
     */
    panTo(lnglat: LngLatLike, options?: AnimationOptions, eventData?: Object) {
        return this.easeTo(util.extend({
            center: lnglat
        }, options), eventData);
    }

    /**
     * Returns the map's current zoom level.
     *
     * @memberof Map#
     * @returns The map's current zoom level.
     */
    getZoom(): number { return this.transform.zoom; }

    /**
     * Sets the map's zoom level. Equivalent to `jumpTo({zoom: zoom})`.
     *
     * @memberof Map#
     * @param zoom The zoom level to set (0-20).
     * @param eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires movestart
     * @fires zoomstart
     * @fires move
     * @fires zoom
     * @fires moveend
     * @fires zoomend
     * @returns {Map} `this`
     * @example
     * // zoom the map to 5
     * map.setZoom(5);
     */
    setZoom(zoom: number, eventData?: Object) {
        this.jumpTo({zoom: zoom}, eventData);
        return this;
    }

    /**
     * Zooms the map to the specified zoom level, with an animated transition.
     *
     * @memberof Map#
     * @param zoom The zoom level to transition to.
     * @param options
     * @param eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires movestart
     * @fires zoomstart
     * @fires move
     * @fires zoom
     * @fires moveend
     * @fires zoomend
     * @returns {Map} `this`
     */
    zoomTo(zoom: number, options: ? AnimationOptions, eventData?: Object) {
        return this.easeTo(util.extend({
            zoom: zoom
        }, options), eventData);
    }

    /**
     * Increases the map's zoom level by 1.
     *
     * @memberof Map#
     * @param options
     * @param eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires movestart
     * @fires zoomstart
     * @fires move
     * @fires zoom
     * @fires moveend
     * @fires zoomend
     * @returns {Map} `this`
     */
    zoomIn(options?: AnimationOptions, eventData?: Object) {
        this.zoomTo(this.getZoom() + 1, options, eventData);
        return this;
    }

    /**
     * Decreases the map's zoom level by 1.
     *
     * @memberof Map#
     * @param options
     * @param eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires movestart
     * @fires zoomstart
     * @fires move
     * @fires zoom
     * @fires moveend
     * @fires zoomend
     * @returns {Map} `this`
     */
    zoomOut(options?: AnimationOptions, eventData?: Object) {
        this.zoomTo(this.getZoom() - 1, options, eventData);
        return this;
    }

    /**
     * Returns the map's current bearing. The bearing is the compass direction that is \"up\"; for example, a bearing
     * of 90° orients the map so that east is up.
     *
     * @memberof Map#
     * @returns The map's current bearing.
     * @see [Navigate the map with game-like controls](https://www.mapbox.com/mapbox-gl-js/example/game-controls/)
     */
    getBearing(): number { return this.transform.bearing; }

    /**
     * Sets the map's bearing (rotation). The bearing is the compass direction that is \"up\"; for example, a bearing
     * of 90° orients the map so that east is up.
     *
     * Equivalent to `jumpTo({bearing: bearing})`.
     *
     * @memberof Map#
     * @param bearing The desired bearing.
     * @param eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires movestart
     * @fires moveend
     * @returns {Map} `this`
     * @example
     * // rotate the map to 90 degrees
     * map.setBearing(90);
     */
    setBearing(bearing: number, eventData?: Object) {
        this.jumpTo({bearing: bearing}, eventData);
        return this;
    }

    /**
     * Rotates the map to the specified bearing, with an animated transition. The bearing is the compass direction
     * that is \"up\"; for example, a bearing of 90° orients the map so that east is up.
     *
     * @memberof Map#
     * @param bearing The desired bearing.
     * @param options
     * @param eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires movestart
     * @fires moveend
     * @returns {Map} `this`
     */
    rotateTo(bearing: number, options?: AnimationOptions, eventData?: Object) {
        return this.easeTo(util.extend({
            bearing: bearing
        }, options), eventData);
    }

    /**
     * Rotates the map so that north is up (0° bearing), with an animated transition.
     *
     * @memberof Map#
     * @param options
     * @param eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires movestart
     * @fires moveend
     * @returns {Map} `this`
     */
    resetNorth(options?: AnimationOptions, eventData?: Object) {
        this.rotateTo(0, util.extend({duration: 1000}, options), eventData);
        return this;
    }

    /**
     * Snaps the map so that north is up (0° bearing), if the current bearing is close enough to it (i.e. within the
     * `bearingSnap` threshold).
     *
     * @memberof Map#
     * @param options
     * @param eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires movestart
     * @fires moveend
     * @returns {Map} `this`
     */
    snapToNorth(options?: AnimationOptions, eventData?: Object) {
        if (Math.abs(this.getBearing()) < this._bearingSnap) {
            return this.resetNorth(options, eventData);
        }
        return this;
    }

    /**
     * Returns the map's current pitch (tilt).
     *
     * @memberof Map#
     * @returns The map's current pitch, measured in degrees away from the plane of the screen.
     */
    getPitch(): number { return this.transform.pitch; }

    /**
     * Sets the map's pitch (tilt). Equivalent to `jumpTo({pitch: pitch})`.
     *
     * @memberof Map#
     * @param pitch The pitch to set, measured in degrees away from the plane of the screen (0-60).
     * @param eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires pitchstart
     * @fires movestart
     * @fires moveend
     * @returns {Map} `this`
     */
    setPitch(pitch: number, eventData?: Object) {
        this.jumpTo({pitch: pitch}, eventData);
        return this;
    }


    /**
     * Pans and zooms the map to contain its visible area within the specified geographical bounds.
     * This function will also reset the map's bearing to 0 if bearing is nonzero.
     *
     * @memberof Map#
     * @param bounds Center these bounds in the viewport and use the highest
     *      zoom level up to and including `Map#getMaxZoom()` that fits them in the viewport.
     * @param options
     * @param {number | PaddingOptions} [options.padding] The amount of padding in pixels to add to the given bounds.
     * @param {boolean} [options.linear=false] If `true`, the map transitions using
     *     {@link Map#easeTo}. If `false`, the map transitions using {@link Map#flyTo}. See
     *     those functions and {@link AnimationOptions} for information about options available.
     * @param {Function} [options.easing] An easing function for the animated transition. See {@link AnimationOptions}.
     * @param {PointLike} [options.offset=[0, 0]] The center of the given bounds relative to the map's center, measured in pixels.
     * @param {number} [options.maxZoom] The maximum zoom level to allow when the map view transitions to the specified bounds.
     * @param eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires movestart
     * @fires moveend
     * @returns {Map} `this`
	 * @example
     * var bbox = [[-79, 43], [-73, 45]];
     * map.fitBounds(bbox, {
     *   padding: {top: 10, bottom:25, left: 15, right: 5}
     * });
     * @see [Fit a map to a bounding box](https://www.mapbox.com/mapbox-gl-js/example/fitbounds/)
     */
    fitBounds(bounds: LngLatBoundsLike, options?: AnimationOptions & CameraOptions, eventData?: Object) {

        options = util.extend({
            padding: {
                top: 0,
                bottom: 0,
                right: 0,
                left: 0
            },
            offset: [0, 0],
            maxZoom: this.transform.maxZoom
        }, options);

        if (typeof options.padding === 'number') {
            const p = options.padding;
            options.padding = {
                top: p,
                bottom: p,
                right: p,
                left: p
            };
        }
        if (!util.deepEqual(Object.keys(options.padding).sort((a, b) => {
            if (a < b) return -1;
            if (a > b) return 1;
            return 0;
        }), ["bottom", "left", "right", "top"])) {
            util.warnOnce("options.padding must be a positive number, or an Object with keys 'bottom', 'left', 'right', 'top'");
            return this;
        }

        bounds = LngLatBounds.convert(bounds);

        // we separate the passed padding option into two parts, the part that does not affect the map's center
        // (lateral and vertical padding), and the part that does (paddingOffset). We add the padding offset
        // to the options `offset` object where it can alter the map's center in the subsequent calls to
        // `easeTo` and `flyTo`.
        const paddingOffset = [(options.padding.left - options.padding.right) / 2, (options.padding.top - options.padding.bottom) / 2],
            lateralPadding = Math.min(options.padding.right, options.padding.left),
            verticalPadding = Math.min(options.padding.top, options.padding.bottom);
        options.offset = [options.offset[0] + paddingOffset[0], options.offset[1] + paddingOffset[1]];

        const offset = Point.convert(options.offset),
            tr = this.transform,
            nw = tr.project(bounds.getNorthWest()),
            se = tr.project(bounds.getSouthEast()),
            size = se.sub(nw),
            scaleX = (tr.width - lateralPadding * 2 - Math.abs(offset.x) * 2) / size.x,
            scaleY = (tr.height - verticalPadding * 2 - Math.abs(offset.y) * 2) / size.y;

        if (scaleY < 0 || scaleX < 0) {
            util.warnOnce('Map cannot fit within canvas with the given bounds, padding, and/or offset.');
            return this;
        }

        options.center = tr.unproject(nw.add(se).div(2));
        options.zoom = Math.min(tr.scaleZoom(tr.scale * Math.min(scaleX, scaleY)), options.maxZoom);
        options.bearing = 0;

        return options.linear ?
            this.easeTo(options, eventData) :
            this.flyTo(options, eventData);
    }

    /**
     * Changes any combination of center, zoom, bearing, and pitch, without
     * an animated transition. The map will retain its current values for any
     * details not specified in `options`.
     *
     * @memberof Map#
     * @param options
     * @param eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires movestart
     * @fires zoomstart
     * @fires pitchstart
     * @fires rotate
     * @fires move
     * @fires zoom
     * @fires pitch
     * @fires moveend
     * @fires zoomend
     * @fires pitchend
     * @returns {Map} `this`
     */
    jumpTo(options: CameraOptions, eventData?: Object) {
        this.stop();

        const tr = this.transform;
        let zoomChanged = false,
            bearingChanged = false,
            pitchChanged = false;

        if ('zoom' in options && tr.zoom !== +options.zoom) {
            zoomChanged = true;
            tr.zoom = +options.zoom;
        }

        if (options.center !== undefined) {
            tr.center = LngLat.convert(options.center);
        }

        if ('bearing' in options && tr.bearing !== +options.bearing) {
            bearingChanged = true;
            tr.bearing = +options.bearing;
        }

        if ('pitch' in options && tr.pitch !== +options.pitch) {
            pitchChanged = true;
            tr.pitch = +options.pitch;
        }

        this.fire('movestart', eventData)
            .fire('move', eventData);

        if (zoomChanged) {
            this.fire('zoomstart', eventData)
                .fire('zoom', eventData)
                .fire('zoomend', eventData);
        }

        if (bearingChanged) {
            this.fire('rotate', eventData);
        }

        if (pitchChanged) {
            this.fire('pitchstart', eventData)
                .fire('pitch', eventData)
                .fire('pitchend', eventData);
        }

        return this.fire('moveend', eventData);
    }

    /**
     * Changes any combination of center, zoom, bearing, and pitch, with an animated transition
     * between old and new values. The map will retain its current values for any
     * details not specified in `options`.
     *
     * @memberof Map#
     * @param options Options describing the destination and animation of the transition.
     *            Accepts {@link CameraOptions} and {@link AnimationOptions}.
     * @param eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires movestart
     * @fires zoomstart
     * @fires pitchstart
     * @fires rotate
     * @fires move
     * @fires zoom
     * @fires pitch
     * @fires moveend
     * @fires zoomend
     * @fires pitchend
     * @returns {Map} `this`
     * @see [Navigate the map with game-like controls](https://www.mapbox.com/mapbox-gl-js/example/game-controls/)
     */
    easeTo(options: CameraOptions & AnimationOptions & {delayEndEvents?: number}, eventData?: Object) {
        this.stop();

        options = util.extend({
            offset: [0, 0],
            duration: 500,
            easing: util.ease
        }, options);

        if (options.animate === false) options.duration = 0;

        const tr = this.transform,
            startZoom = this.getZoom(),
            startBearing = this.getBearing(),
            startPitch = this.getPitch(),

            zoom = 'zoom' in options ? +options.zoom : startZoom,
            bearing = 'bearing' in options ? this._normalizeBearing(options.bearing, startBearing) : startBearing,
            pitch = 'pitch' in options ? +options.pitch : startPitch;

        const pointAtOffset = tr.centerPoint.add(Point.convert(options.offset));
        const locationAtOffset = tr.pointLocation(pointAtOffset);
        const center = LngLat.convert(options.center || locationAtOffset);
        this._normalizeCenter(center);

        const from = tr.project(locationAtOffset);
        const delta = tr.project(center).sub(from);
        const finalScale = tr.zoomScale(zoom - startZoom);

        let around, aroundPoint;

        if (options.around) {
            around = LngLat.convert(options.around);
            aroundPoint = tr.locationPoint(around);
        }

        this.zooming = (zoom !== startZoom);
        this.rotating = (startBearing !== bearing);
        this.pitching = (pitch !== startPitch);

        this._prepareEase(eventData, options.noMoveStart);

        clearTimeout(this._onEaseEnd);

        this._ease((k) => {
            if (this.zooming) {
                tr.zoom = interpolate(startZoom, zoom, k);
            }
            if (this.rotating) {
                tr.bearing = interpolate(startBearing, bearing, k);
            }
            if (this.pitching) {
                tr.pitch = interpolate(startPitch, pitch, k);
            }

            if (around) {
                tr.setLocationAtPoint(around, aroundPoint);
            } else {
                const scale = tr.zoomScale(tr.zoom - startZoom);
                const base = zoom > startZoom ?
                    Math.min(2, finalScale) :
                    Math.max(0.5, finalScale);
                const speedup = Math.pow(base, 1 - k);
                const newCenter = tr.unproject(from.add(delta.mult(k * speedup)).mult(scale));
                tr.setLocationAtPoint(tr.renderWorldCopies ? newCenter.wrap() : newCenter, pointAtOffset);
            }

            this._fireMoveEvents(eventData);

        }, () => {
            if (options.delayEndEvents) {
                this._onEaseEnd = setTimeout(() => this._afterEase(eventData), options.delayEndEvents);
            } else {
                this._afterEase(eventData);
            }
        }, options);

        return this;
    }

    _prepareEase(eventData?: Object, noMoveStart: boolean) {
        this.moving = true;

        if (!noMoveStart) {
            this.fire('movestart', eventData);
        }
        if (this.zooming) {
            this.fire('zoomstart', eventData);
        }
        if (this.pitching) {
            this.fire('pitchstart', eventData);
        }
    }

    _fireMoveEvents(eventData?: Object) {
        this.fire('move', eventData);
        if (this.zooming) {
            this.fire('zoom', eventData);
        }
        if (this.rotating) {
            this.fire('rotate', eventData);
        }
        if (this.pitching) {
            this.fire('pitch', eventData);
        }
    }

    _afterEase(eventData?: Object) {
        const wasZooming = this.zooming;
        const wasPitching = this.pitching;
        this.moving = false;
        this.zooming = false;
        this.rotating = false;
        this.pitching = false;

        if (wasZooming) {
            this.fire('zoomend', eventData);
        }
        if (wasPitching) {
            this.fire('pitchend', eventData);
        }
        this.fire('moveend', eventData);
    }

    /**
     * Changes any combination of center, zoom, bearing, and pitch, animating the transition along a curve that
     * evokes flight. The animation seamlessly incorporates zooming and panning to help
     * the user maintain her bearings even after traversing a great distance.
     *
     * @memberof Map#
     * @param {Object} options Options describing the destination and animation of the transition.
     *     Accepts {@link CameraOptions}, {@link AnimationOptions},
     *     and the following additional options.
     * @param {number} [options.curve=1.42] The zooming "curve" that will occur along the
     *     flight path. A high value maximizes zooming for an exaggerated animation, while a low
     *     value minimizes zooming for an effect closer to {@link Map#easeTo}. 1.42 is the average
     *     value selected by participants in the user study discussed in
     *     [van Wijk (2003)](https://www.win.tue.nl/~vanwijk/zoompan.pdf). A value of
     *     `Math.pow(6, 0.25)` would be equivalent to the root mean squared average velocity. A
     *     value of 1 would produce a circular motion.
     * @param {number} [options.minZoom] The zero-based zoom level at the peak of the flight path. If
     *     `options.curve` is specified, this option is ignored.
     * @param {number} [options.speed=1.2] The average speed of the animation defined in relation to
     *     `options.curve`. A speed of 1.2 means that the map appears to move along the flight path
     *     by 1.2 times `options.curve` screenfuls every second. A _screenful_ is the map's visible span.
     *     It does not correspond to a fixed physical distance, but varies by zoom level.
     * @param {number} [options.screenSpeed] The average speed of the animation measured in screenfuls
     *     per second, assuming a linear timing curve. If `options.speed` is specified, this option is ignored.
     * @param {number} [options.maxDuration] The animation's maximum duration, measured in milliseconds.
     *     If duration exceeds maximum duration, it resets to 0.
     * @param eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires movestart
     * @fires zoomstart
     * @fires pitchstart
     * @fires move
     * @fires zoom
     * @fires rotate
     * @fires pitch
     * @fires moveend
     * @fires zoomend
     * @fires pitchend
     * @returns {Map} `this`
     * @example
     * // fly with default options to null island
     * map.flyTo({center: [0, 0], zoom: 9});
     * // using flyTo options
     * map.flyTo({
     *   center: [0, 0],
     *   zoom: 9,
     *   speed: 0.2,
     *   curve: 1,
     *   easing(t) {
     *     return t;
     *   }
     * });
     * @see [Fly to a location](https://www.mapbox.com/mapbox-gl-js/example/flyto/)
     * @see [Slowly fly to a location](https://www.mapbox.com/mapbox-gl-js/example/flyto-options/)
     * @see [Fly to a location based on scroll position](https://www.mapbox.com/mapbox-gl-js/example/scroll-fly-to/)
     */
    flyTo(options, eventData?: Object) {
        // This method implements an “optimal path” animation, as detailed in:
        //
        // Van Wijk, Jarke J.; Nuij, Wim A. A. “Smooth and efficient zooming and panning.” INFOVIS
        //   ’03. pp. 15–22. <https://www.win.tue.nl/~vanwijk/zoompan.pdf#page=5>.
        //
        // Where applicable, local variable documentation begins with the associated variable or
        // function in van Wijk (2003).

        this.stop();

        options = util.extend({
            offset: [0, 0],
            speed: 1.2,
            curve: 1.42,
            easing: util.ease
        }, options);

        const tr = this.transform,
            startZoom = this.getZoom(),
            startBearing = this.getBearing(),
            startPitch = this.getPitch();

        const zoom = 'zoom' in options ? util.clamp(+options.zoom, tr.minZoom, tr.maxZoom) : startZoom;
        const bearing = 'bearing' in options ? this._normalizeBearing(options.bearing, startBearing) : startBearing;
        const pitch = 'pitch' in options ? +options.pitch : startPitch;

        const scale = tr.zoomScale(zoom - startZoom);
        const pointAtOffset = tr.centerPoint.add(Point.convert(options.offset));
        const locationAtOffset = tr.pointLocation(pointAtOffset);
        const center = LngLat.convert(options.center || locationAtOffset);
        this._normalizeCenter(center);

        const from = tr.project(locationAtOffset);
        const delta = tr.project(center).sub(from);

        let rho = options.curve;

        // w₀: Initial visible span, measured in pixels at the initial scale.
        const w0 = Math.max(tr.width, tr.height),
            // w₁: Final visible span, measured in pixels with respect to the initial scale.
            w1 = w0 / scale,
            // Length of the flight path as projected onto the ground plane, measured in pixels from
            // the world image origin at the initial scale.
            u1 = delta.mag();

        if ('minZoom' in options) {
            const minZoom = util.clamp(Math.min(options.minZoom, startZoom, zoom), tr.minZoom, tr.maxZoom);
            // w<sub>m</sub>: Maximum visible span, measured in pixels with respect to the initial
            // scale.
            const wMax = w0 / tr.zoomScale(minZoom - startZoom);
            rho = Math.sqrt(wMax / u1 * 2);
        }

        // ρ²
        const rho2 = rho * rho;

        /**
         * rᵢ: Returns the zoom-out factor at one end of the animation.
         *
         * @param i 0 for the ascent or 1 for the descent.
         * @private
         */
        function r(i) {
            const b = (w1 * w1 - w0 * w0 + (i ? -1 : 1) * rho2 * rho2 * u1 * u1) / (2 * (i ? w1 : w0) * rho2 * u1);
            return Math.log(Math.sqrt(b * b + 1) - b);
        }

        function sinh(n) { return (Math.exp(n) - Math.exp(-n)) / 2; }
        function cosh(n) { return (Math.exp(n) + Math.exp(-n)) / 2; }
        function tanh(n) { return sinh(n) / cosh(n); }

        // r₀: Zoom-out factor during ascent.
        const r0 = r(0);

        // w(s): Returns the visible span on the ground, measured in pixels with respect to the
        // initial scale. Assumes an angular field of view of 2 arctan ½ ≈ 53°.
        let w: (number) => number = function (s) {
            return (cosh(r0) / cosh(r0 + rho * s));
        };

        // u(s): Returns the distance along the flight path as projected onto the ground plane,
        // measured in pixels from the world image origin at the initial scale.
        let u: (number) => number = function (s) {
            return w0 * ((cosh(r0) * tanh(r0 + rho * s) - sinh(r0)) / rho2) / u1;
        };

        // S: Total length of the flight path, measured in ρ-screenfuls.
        let S = (r(1) - r0) / rho;

        // When u₀ = u₁, the optimal path doesn’t require both ascent and descent.
        if (Math.abs(u1) < 0.000001 || !isFinite(S)) {
            // Perform a more or less instantaneous transition if the path is too short.
            if (Math.abs(w0 - w1) < 0.000001) return this.easeTo(options, eventData);

            const k = w1 < w0 ? -1 : 1;
            S = Math.abs(Math.log(w1 / w0)) / rho;

            u = function() { return 0; };
            w = function(s) { return Math.exp(k * rho * s); };
        }

        if ('duration' in options) {
            options.duration = +options.duration;
        } else {
            const V = 'screenSpeed' in options ? +options.screenSpeed / rho : +options.speed;
            options.duration = 1000 * S / V;
        }

        if (options.maxDuration && options.duration > options.maxDuration) {
            options.duration = 0;
        }

        this.zooming = true;
        this.rotating = (startBearing !== bearing);
        this.pitching = (pitch !== startPitch);

        this._prepareEase(eventData, false);

        this._ease((k) => {
            // s: The distance traveled along the flight path, measured in ρ-screenfuls.
            const s = k * S;
            const scale = 1 / w(s);
            tr.zoom = startZoom + tr.scaleZoom(scale);

            if (this.rotating) {
                tr.bearing = interpolate(startBearing, bearing, k);
            }
            if (this.pitching) {
                tr.pitch = interpolate(startPitch, pitch, k);
            }

            const newCenter = tr.unproject(from.add(delta.mult(u(s))).mult(scale));
            tr.setLocationAtPoint(tr.renderWorldCopies ? newCenter.wrap() : newCenter, pointAtOffset);

            this._fireMoveEvents(eventData);

        }, () => this._afterEase(eventData), options);

        return this;
    }

    isEasing() {
        return !!this._isEasing;
    }

    /**
     * Returns a Boolean indicating whether the camera is moving.
     *
     * @memberof Map#
     * @returns A Boolean indicating whether the camera is moving.
     */
    isMoving(): boolean {
        return this.moving;
    }

    /**
     * Stops any animated transition underway.
     *
     * @memberof Map#
     * @returns {Map} `this`
     */
    stop(): this {
        if (this._onFrame) {
            this._finishAnimation();
        }
        return this;
    }

    _ease(frame: (number) => void,
          finish: () => void,
          options: {animate: boolean, duration: number, easing: (number) => number}) {
        if (options.animate === false || options.duration === 0) {
            frame(1);
            finish();
        } else {
            this._easeStart = browser.now();
            this._isEasing = true;
            this._easeOptions = options;
            this._startAnimation((_) => {
                const t = Math.min((browser.now() - this._easeStart) / this._easeOptions.duration, 1);
                frame(this._easeOptions.easing(t));
                if (t === 1) this.stop();
            }, () => {
                this._isEasing = false;
                finish();
            });
        }
    }

    /*
     * Should be called at the top of the render loop to update camera position
     * and orientation before they're read by any rendering logic.
     */
    _updateCamera() {
        if (this._onFrame) {
            this._onFrame(this.transform);
        }
    }

    /*
     * Start the camera animation using the given onFrame callback.
     *
     * @param onFrame A callback responsible for updating the transform to reflect the desired camera position and orientation, and also for firing any relevant camera movement events.
     * @param finish A callback that is called when this animation is stopped (i.e., when `Camera#stop()` is called).
     */
    _startAnimation(onFrame: (Transform) => void,
                    finish: () => void = () => {}): this {
        this.stop();
        this._onFrame = onFrame;
        this._finishFn = finish;
        this._update();
        return this;
    }

    _finishAnimation() {
        delete this._onFrame;
        // The finish function might emit events which trigger new animation,
        // which sets a new _finishFn. Ensure we don't delete it
        // unintentionally.
        const finish = this._finishFn;
        delete this._finishFn;
        finish.call(this);
    }

    // convert bearing so that it's numerically close to the current one so that it interpolates properly
    _normalizeBearing(bearing: number, currentBearing: number) {
        bearing = util.wrap(bearing, -180, 180);
        const diff = Math.abs(bearing - currentBearing);
        if (Math.abs(bearing - 360 - currentBearing) < diff) bearing -= 360;
        if (Math.abs(bearing + 360 - currentBearing) < diff) bearing += 360;
        return bearing;
    }

    // If a path crossing the antimeridian would be shorter, extend the final coordinate so that
    // interpolating between the two endpoints will cross it.
    _normalizeCenter(center: LngLat) {
        const tr = this.transform;
        if (!tr.renderWorldCopies || tr.lngRange) return;

        const delta = center.lng - tr.center.lng;
        center.lng +=
            delta > 180 ? -360 :
            delta < -180 ? 360 : 0;
    }
}

module.exports = Camera;
