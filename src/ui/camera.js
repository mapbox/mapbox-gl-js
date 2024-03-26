// @flow

import {
    bindAll,
    extend,
    warnOnce,
    clamp,
    wrap,
    ease as defaultEasing,
    pick,
    degToRad
} from '../util/util.js';
import {number as interpolate} from '../style-spec/util/interpolate.js';
import browser from '../util/browser.js';
import LngLat, {earthRadius, latLngToECEF, ecefToLatLng, LngLatBounds} from '../geo/lng_lat.js';
import {
    GLOBE_RADIUS,
    GLOBE_ZOOM_THRESHOLD_MAX,
    GLOBE_ZOOM_THRESHOLD_MIN
} from '../geo/projection/globe_constants.js';
import Point from '@mapbox/point-geometry';
import {Event, Evented} from '../util/evented.js';
import assert from 'assert';
import {Debug} from '../util/debug.js';
import MercatorCoordinate, {
    mercatorZfromAltitude,
    mercatorXfromLng,
    mercatorYfromLat,
    latFromMercatorY,
    lngFromMercatorX
} from '../geo/mercator_coordinate.js';
import {vec3, vec4, mat4} from 'gl-matrix';
import type {FreeCameraOptions} from './free_camera.js';
import type Transform from '../geo/transform.js';
import type {LngLatLike, LngLatBoundsLike} from '../geo/lng_lat.js';
import type {ElevationQueryOptions} from '../terrain/elevation.js';
import type {TaskID} from '../util/task_queue.js';
import type {Callback} from '../types/callback.js';
import type {PointLike} from '@mapbox/point-geometry';
import {Aabb} from '../util/primitives.js';
import type {PaddingOptions} from '../geo/edge_insets.js';
import type {MapEvent} from './events.js';

/**
 * A helper type: converts all Object type values to non-maybe types.
 */
type Required<T> = $ObjMap<T, <V>(v: V) => $NonMaybeType<V>>;

/**
 * Options common to {@link Map#jumpTo}, {@link Map#easeTo}, and {@link Map#flyTo}, controlling the desired location,
 * zoom, bearing, and pitch of the camera. All properties are optional, and when a property is omitted, the current
 * camera value for that property will remain unchanged.
 *
 * @typedef {Object} CameraOptions
 * @property {LngLatLike} center The location to place at the screen center.
 * @property {number} zoom The desired zoom level.
 * @property {number} bearing The desired bearing in degrees. The bearing is the compass direction that
 *     is "up". For example, `bearing: 90` orients the map so that east is up.
 * @property {number} pitch The desired pitch in degrees. The pitch is the angle towards the horizon
 *     measured in degrees with a range between 0 and 85 degrees. For example, pitch: 0 provides the appearance
 *     of looking straight down at the map, while pitch: 60 tilts the user's perspective towards the horizon.
 *     Increasing the pitch value is often used to display 3D objects.
 * @property {LngLatLike} around The location serving as the origin for a change in `zoom`, `pitch` and/or `bearing`.
 *     This location will remain at the same screen position following the transform.
 *     This is useful for drawing attention to a location that is not in the screen center.
 *     `center` is ignored if `around` is included.
 * @property {PaddingOptions} padding Dimensions in pixels applied on each side of the viewport for shifting the vanishing point.
 * @example
 * // set the map's initial perspective with CameraOptions
 * const map = new mapboxgl.Map({
 *     container: 'map',
 *     style: 'mapbox://styles/mapbox/streets-v11',
 *     center: [-73.5804, 45.53483],
 *     pitch: 60,
 *     bearing: -60,
 *     zoom: 10
 * });
 * @see [Example: Set pitch and bearing](https://docs.mapbox.com/mapbox-gl-js/example/set-perspective/)
 * @see [Example: Jump to a series of locations](https://docs.mapbox.com/mapbox-gl-js/example/jump-to/)
 * @see [Example: Fly to a location](https://docs.mapbox.com/mapbox-gl-js/example/flyto/)
 * @see [Example: Display buildings in 3D](https://docs.mapbox.com/mapbox-gl-js/example/3d-buildings/)
 */
export type CameraOptions = {
    center?: LngLatLike,
    zoom?: number,
    bearing?: number,
    pitch?: number,
    around?: LngLatLike,
    padding?: PaddingOptions
};

export type FullCameraOptions = {
    maxZoom: number,
    offset: PointLike,
    padding: Required<PaddingOptions>
} & CameraOptions

/**
 * Options common to map movement methods that involve animation, such as {@link Map#panBy} and
 * {@link Map#easeTo}, controlling the duration and easing function of the animation. All properties
 * are optional.
 *
 * @typedef {Object} AnimationOptions
 * @property {number} duration The animation's duration, measured in milliseconds.
 * @property {Function} easing A function taking a time in the range 0..1 and returning a number where 0 is
 *     the initial state and 1 is the final state.
 * @property {PointLike} offset The target center's offset relative to real map container center at the end of animation.
 * @property {boolean} animate If `false`, no animation will occur.
 * @property {boolean} essential If `true`, then the animation is considered essential and will not be affected by
 *     [`prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion).
 * @property {boolean} preloadOnly If `true`, it will trigger tiles loading across the animation path, but no animation will occur.
 * @property {number} curve The zooming "curve" that will occur along the
 *     flight path. A high value maximizes zooming for an exaggerated animation, while a low
 *     value minimizes zooming for an effect closer to {@link Map#easeTo}. 1.42 is the average
 *     value selected by participants in the user study discussed in
 *     [van Wijk (2003)](https://www.win.tue.nl/~vanwijk/zoompan.pdf). A value of
 *     `Math.pow(6, 0.25)` would be equivalent to the root mean squared average velocity. A
 *     value of 1 would produce a circular motion. If `minZoom` is specified, this option will be ignored.
 * @property {number} minZoom The zero-based zoom level at the peak of the flight path. If
 *     this option is specified, `curve` will be ignored.
 * @property {number} speed The average speed of the animation defined in relation to
 *     `curve`. A speed of 1.2 means that the map appears to move along the flight path
 *     by 1.2 times `curve` screenfuls every second. A _screenful_ is the map's visible span.
 *     It does not correspond to a fixed physical distance, but varies by zoom level.
 * @property {number} screenSpeed The average speed of the animation measured in screenfuls
 *     per second, assuming a linear timing curve. If `speed` is specified, this option is ignored.
 * @property {number} maxDuration The animation's maximum duration, measured in milliseconds.
 *     If duration exceeds maximum duration, it resets to 0.
 * @see [Example: Slowly fly to a location](https://docs.mapbox.com/mapbox-gl-js/example/flyto-options/)
 * @see [Example: Customize camera animations](https://docs.mapbox.com/mapbox-gl-js/example/camera-animation/)
 * @see [Example: Navigate the map with game-like controls](https://docs.mapbox.com/mapbox-gl-js/example/game-controls/)
*/
export type AnimationOptions = {
    duration?: number,
    easing?: (_: number) => number,
    offset?: PointLike,
    animate?: boolean,
    essential?: boolean,
    preloadOnly?: boolean
};

export type EasingOptions = CameraOptions & AnimationOptions;

export type ElevationBoxRaycast = {
    minLngLat: LngLat,
    maxLngLat: LngLat,
    minAltitude: number,
    maxAltitude: number
};

const freeCameraNotSupportedWarning = 'map.setFreeCameraOptions(...) and map.getFreeCameraOptions() are not yet supported for non-mercator projections.';

/**
 * Options for setting padding on calls to methods such as {@link Map#fitBounds}, {@link Map#fitScreenCoordinates}, and {@link Map#setPadding}. Adjust these options to set the amount of padding in pixels added to the edges of the canvas. Set a uniform padding on all edges or individual values for each edge. All properties of this object must be
 * non-negative integers.
 *
 * @typedef {Object} PaddingOptions
 * @property {number} top Padding in pixels from the top of the map canvas.
 * @property {number} bottom Padding in pixels from the bottom of the map canvas.
 * @property {number} left Padding in pixels from the left of the map canvas.
 * @property {number} right Padding in pixels from the right of the map canvas.
 *
 * @example
 * const bbox = [[-79, 43], [-73, 45]];
 * map.fitBounds(bbox, {
 *     padding: {top: 10, bottom: 25, left: 15, right: 5}
 * });
 *
 * @example
 * const bbox = [[-79, 43], [-73, 45]];
 * map.fitBounds(bbox, {
 *     padding: 20
 * });
 * @see [Example: Fit to the bounds of a LineString](https://docs.mapbox.com/mapbox-gl-js/example/zoomto-linestring/)
 * @see [Example: Fit a map to a bounding box](https://docs.mapbox.com/mapbox-gl-js/example/fitbounds/)
 */

class Camera extends Evented {
    transform: Transform;
    _moving: boolean;
    _zooming: boolean;
    _rotating: boolean;
    _pitching: boolean;

    _bearingSnap: number;
    _easeStart: number;
    _easeOptions: {duration: number, easing: (_: number) => number};
    _easeId: string | void;
    _respectPrefersReducedMotion: boolean;

    _onEaseFrame: ?(_: number) => Transform | void;
    _onEaseEnd: ?(easeId?: string) => void;
    _easeFrameId: ?TaskID;

    +_requestRenderFrame: (() => void) => TaskID;
    +_cancelRenderFrame: (_: TaskID) => void;

    +_preloadTiles: (transform: Transform | Array<Transform>, callback?: Callback<any>) => any;

    constructor(transform: Transform, options: {bearingSnap: number, respectPrefersReducedMotion?: boolean}) {
        super();
        this._moving = false;
        this._zooming = false;
        this.transform = transform;
        this._bearingSnap = options.bearingSnap;
        this._respectPrefersReducedMotion = options.respectPrefersReducedMotion !== false;

        bindAll(['_renderFrameCallback'], this);

        //addAssertions(this);
    }

    /** @section {Camera}
     * @method
     * @instance
     * @memberof Map */

    /**
     * Returns the map's geographical centerpoint.
     *
     * @memberof Map#
     * @returns {LngLat} The map's geographical centerpoint.
     * @example
     * // Return a LngLat object such as {lng: 0, lat: 0}.
     * const center = map.getCenter();
     * // Access longitude and latitude values directly.
     * const {lng, lat} = map.getCenter();
     * @see [Tutorial: Use Mapbox GL JS in a React app](https://docs.mapbox.com/help/tutorials/use-mapbox-gl-js-with-react/#store-the-new-coordinates)
     */
    getCenter(): LngLat { return new LngLat(this.transform.center.lng, this.transform.center.lat); }

    /**
     * Sets the map's geographical centerpoint. Equivalent to `jumpTo({center: center})`.
     *
     * @memberof Map#
     * @param {LngLatLike} center The centerpoint to set.
     * @param {Object | null} eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires Map.event:movestart
     * @fires Map.event:moveend
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * map.setCenter([-74, 38]);
     */
    setCenter(center: LngLatLike, eventData?: Object): this {
        return this.jumpTo({center}, eventData);
    }

    /**
     * Pans the map by the specified offset.
     *
     * @memberof Map#
     * @param {PointLike} offset The `x` and `y` coordinates by which to pan the map.
     * @param {AnimationOptions | null} options An options object describing the destination and animation of the transition. We do not recommend using `options.offset` since this value will override the value of the `offset` parameter.
     * @param {Object | null} eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires Map.event:movestart
     * @fires Map.event:moveend
     * @returns {Map} `this` Returns itself to allow for method chaining.
     * @example
     * map.panBy([-74, 38]);
     * @example
     * // panBy with an animation of 5 seconds.
     * map.panBy([-74, 38], {duration: 5000});
     * @see [Example: Navigate the map with game-like controls](https://www.mapbox.com/mapbox-gl-js/example/game-controls/)
     */
    panBy(offset: PointLike, options?: AnimationOptions, eventData?: Object): this {
        offset = Point.convert(offset).mult(-1);
        return this.panTo(this.transform.center, extend({offset}, options), eventData);
    }

    /**
     * Pans the map to the specified location with an animated transition.
     *
     * @memberof Map#
     * @param {LngLatLike} lnglat The location to pan the map to.
     * @param {AnimationOptions | null} options Options describing the destination and animation of the transition.
     * @param {Object | null} eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires Map.event:movestart
     * @fires Map.event:moveend
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * map.panTo([-74, 38]);
     * @example
     * // Specify that the panTo animation should last 5000 milliseconds.
     * map.panTo([-74, 38], {duration: 5000});
     * @see [Example: Update a feature in realtime](https://docs.mapbox.com/mapbox-gl-js/example/live-update-feature/)
     */
    panTo(lnglat: LngLatLike, options?: AnimationOptions, eventData?: Object): this {
        return this.easeTo(extend({
            center: lnglat
        }, options), eventData);
    }

    /**
     * Returns the map's current zoom level.
     *
     * @memberof Map#
     * @returns {number} The map's current zoom level.
     * @example
     * map.getZoom();
     */
    getZoom(): number { return this.transform.zoom; }

    /**
     * Sets the map's zoom level. Equivalent to `jumpTo({zoom: zoom})`.
     *
     * @memberof Map#
     * @param {number} zoom The zoom level to set (0-20).
     * @param {Object | null} eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires Map.event:movestart
     * @fires Map.event:zoomstart
     * @fires Map.event:move
     * @fires Map.event:zoom
     * @fires Map.event:moveend
     * @fires Map.event:zoomend
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * // Zoom to the zoom level 5 without an animated transition
     * map.setZoom(5);
     */
    setZoom(zoom: number, eventData?: Object): this {
        this.jumpTo({zoom}, eventData);
        return this;
    }

    /**
     * Zooms the map to the specified zoom level, with an animated transition.
     *
     * @memberof Map#
     * @param {number} zoom The zoom level to transition to.
     * @param {AnimationOptions | null} options Options object.
     * @param {Object | null} eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires Map.event:movestart
     * @fires Map.event:zoomstart
     * @fires Map.event:move
     * @fires Map.event:zoom
     * @fires Map.event:moveend
     * @fires Map.event:zoomend
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * // Zoom to the zoom level 5 without an animated transition
     * map.zoomTo(5);
     * // Zoom to the zoom level 8 with an animated transition
     * map.zoomTo(8, {
     *     duration: 2000,
     *     offset: [100, 50]
     * });
     */
    zoomTo(zoom: number, options: ? AnimationOptions, eventData?: Object): this {
        return this.easeTo(extend({
            zoom
        }, options), eventData);
    }

    /**
     * Increases the map's zoom level by 1.
     *
     * @memberof Map#
     * @param {AnimationOptions | null} options Options object.
     * @param {Object | null} eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires Map.event:movestart
     * @fires Map.event:zoomstart
     * @fires Map.event:move
     * @fires Map.event:zoom
     * @fires Map.event:moveend
     * @fires Map.event:zoomend
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * // zoom the map in one level with a custom animation duration
     * map.zoomIn({duration: 1000});
     */
    zoomIn(options?: AnimationOptions, eventData?: Object): this {
        this.zoomTo(this.getZoom() + 1, options, eventData);
        return this;
    }

    /**
     * Decreases the map's zoom level by 1.
     *
     * @memberof Map#
     * @param {AnimationOptions | null} options Options object.
     * @param {Object | null} eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires Map.event:movestart
     * @fires Map.event:zoomstart
     * @fires Map.event:move
     * @fires Map.event:zoom
     * @fires Map.event:moveend
     * @fires Map.event:zoomend
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * // zoom the map out one level with a custom animation offset
     * map.zoomOut({offset: [80, 60]});
     */
    zoomOut(options?: AnimationOptions, eventData?: Object): this {
        this.zoomTo(this.getZoom() - 1, options, eventData);
        return this;
    }

    /**
     * Returns the map's current bearing. The bearing is the compass direction that is "up"; for example, a bearing
     * of 90° orients the map so that east is up.
     *
     * @memberof Map#
     * @returns {number} The map's current bearing.
     * @example
     * const bearing = map.getBearing();
     * @see [Example: Navigate the map with game-like controls](https://www.mapbox.com/mapbox-gl-js/example/game-controls/)
     */
    getBearing(): number {
        return this.transform.bearing;
    }

    /**
     * Sets the map's bearing (rotation). The bearing is the compass direction that is "up"; for example, a bearing
     * of 90° orients the map so that east is up.
     *
     * Equivalent to `jumpTo({bearing: bearing})`.
     *
     * @memberof Map#
     * @param {number} bearing The desired bearing.
     * @param {Object | null} eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires Map.event:movestart
     * @fires Map.event:moveend
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * // Rotate the map to 90 degrees.
     * map.setBearing(90);
     */
    setBearing(bearing: number, eventData?: Object): this {
        this.jumpTo({bearing}, eventData);
        return this;
    }

    /**
     * Returns the current padding applied around the map viewport.
     *
     * @memberof Map#
     * @returns {PaddingOptions} The current padding around the map viewport.
     * @example
     * const padding = map.getPadding();
     */
    getPadding(): PaddingOptions { return this.transform.padding; }

    /**
     * Sets the padding in pixels around the viewport.
     *
     * Equivalent to `jumpTo({padding: padding})`.
     *
     * @memberof Map#
     * @param {PaddingOptions} padding The desired padding. Format: {left: number, right: number, top: number, bottom: number}.
     * @param {Object | null} eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires Map.event:movestart
     * @fires Map.event:moveend
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * // Sets a left padding of 300px, and a top padding of 50px
     * map.setPadding({left: 300, top: 50});
     */
    setPadding(padding: PaddingOptions, eventData?: Object): this {
        this.jumpTo({padding}, eventData);
        return this;
    }

    /**
     * Rotates the map to the specified bearing, with an animated transition. The bearing is the compass direction
     * that is \"up\"; for example, a bearing of 90° orients the map so that east is up.
     *
     * @memberof Map#
     * @param {number} bearing The desired bearing.
     * @param {EasingOptions | null} options Options describing the destination and animation of the transition.
     *     Accepts {@link CameraOptions} and {@link AnimationOptions}.
     * @param {Object | null} eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires Map.event:movestart
     * @fires Map.event:moveend
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * map.rotateTo(30);
     * @example
     * // rotateTo with an animation of 2 seconds.
     * map.rotateTo(30, {duration: 2000});
     */
    rotateTo(bearing: number, options?: EasingOptions, eventData?: Object): this {
        return this.easeTo(extend({
            bearing
        }, options), eventData);
    }

    /**
     * Rotates the map so that north is up (0° bearing), with an animated transition.
     *
     * @memberof Map#
     * @param {EasingOptions | null} options Options describing the destination and animation of the transition.
     *     Accepts {@link CameraOptions} and {@link AnimationOptions}.
     * @param {Object | null} eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires Map.event:movestart
     * @fires Map.event:moveend
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * // resetNorth with an animation of 2 seconds.
     * map.resetNorth({duration: 2000});
     */
    resetNorth(options?: EasingOptions, eventData?: Object): this {
        this.rotateTo(0, extend({duration: 1000}, options), eventData);
        return this;
    }

    /**
     * Rotates and pitches the map so that north is up (0° bearing) and pitch is 0°, with an animated transition.
     *
     * @memberof Map#
     * @param {EasingOptions | null} options Options describing the destination and animation of the transition.
     *     Accepts {@link CameraOptions} and {@link AnimationOptions}.
     * @param {Object | null} eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires Map.event:movestart
     * @fires Map.event:moveend
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * // resetNorthPitch with an animation of 2 seconds.
     * map.resetNorthPitch({duration: 2000});
     */
    resetNorthPitch(options?: EasingOptions, eventData?: Object): this {
        this.easeTo(extend({
            bearing: 0,
            pitch: 0,
            duration: 1000
        }, options), eventData);
        return this;
    }

    /**
     * Snaps the map so that north is up (0° bearing), if the current bearing is
     * close enough to it (within the `bearingSnap` threshold).
     *
     * @memberof Map#
     * @param {EasingOptions | null} options Options describing the destination and animation of the transition.
     *     Accepts {@link CameraOptions} and {@link AnimationOptions}.
     * @param {Object | null} eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires Map.event:movestart
     * @fires Map.event:moveend
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * // snapToNorth with an animation of 2 seconds.
     * map.snapToNorth({duration: 2000});
     */
    snapToNorth(options?: EasingOptions, eventData?: Object): this {
        if (Math.abs(this.getBearing()) < this._bearingSnap) {
            return this.resetNorth(options, eventData);
        }
        return this;
    }

    /**
     * Returns the map's current [pitch](https://docs.mapbox.com/help/glossary/camera/) (tilt).
     *
     * @memberof Map#
     * @returns {number} The map's current pitch, measured in degrees away from the plane of the screen.
     * @example
     * const pitch = map.getPitch();
     */
    getPitch(): number { return this.transform.pitch; }

    /**
     * Sets the map's [pitch](https://docs.mapbox.com/help/glossary/camera/) (tilt). Equivalent to `jumpTo({pitch: pitch})`.
     *
     * @memberof Map#
     * @param {number} pitch The pitch to set, measured in degrees away from the plane of the screen (0-60).
     * @param {Object | null} eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires Map.event:pitchstart
     * @fires Map.event:movestart
     * @fires Map.event:moveend
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * // setPitch with an animation of 2 seconds.
     * map.setPitch(80, {duration: 2000});
     */
    setPitch(pitch: number, eventData?: Object): this {
        this.jumpTo({pitch}, eventData);
        return this;
    }

    /**
     * Returns a {@link CameraOptions} object for the highest zoom level
     * up to and including `Map#getMaxZoom()` that fits the bounds
     * in the viewport at the specified bearing.
     *
     * @memberof Map#
     * @param {LngLatBoundsLike} bounds Calculate the center for these bounds in the viewport and use
     *     the highest zoom level up to and including `Map#getMaxZoom()` that fits
     *     in the viewport. LngLatBounds represent a box that is always axis-aligned with bearing 0.
     * @param {CameraOptions | null} options Options object.
     * @param {number | PaddingOptions} [options.padding] The amount of padding in pixels to add to the given bounds.
     * @param {number} [options.bearing=0] Desired map bearing at end of animation, in degrees.
     * @param {number} [options.pitch=0] Desired map pitch at end of animation, in degrees.
     * @param {PointLike} [options.offset=[0, 0]] The center of the given bounds relative to the map's center, measured in pixels.
     * @param {number} [options.maxZoom] The maximum zoom level to allow when the camera would transition to the specified bounds.
     * @returns {CameraOptions | void} If map is able to fit to provided bounds, returns `CameraOptions` with
     *     `center`, `zoom`, and `bearing`. If map is unable to fit, method will warn and return undefined.
     * @example
     * const bbox = [[-79, 43], [-73, 45]];
     * const newCameraTransform = map.cameraForBounds(bbox, {
     *     padding: {top: 10, bottom:25, left: 15, right: 5}
     * });
     */
    cameraForBounds(bounds: LngLatBoundsLike, options?: CameraOptions): ?EasingOptions {
        bounds = LngLatBounds.convert(bounds);
        const bearing = (options && options.bearing) || 0;
        const pitch = (options && options.pitch) || 0;
        const lnglat0 = bounds.getNorthWest();
        const lnglat1 = bounds.getSouthEast();
        return this._cameraForBounds(this.transform, lnglat0, lnglat1, bearing, pitch, options);
    }

    _extendCameraOptions(options?: CameraOptions): FullCameraOptions {
        const defaultPadding = {
            top: 0,
            bottom: 0,
            right: 0,
            left: 0
        };
        options = extend({
            padding: defaultPadding,
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
        options.padding = extend(defaultPadding, options.padding);
        return options;
    }

    _minimumAABBFrustumDistance(tr: Transform, aabb: Aabb): number {
        const aabbW = aabb.max[0] - aabb.min[0];
        const aabbH = aabb.max[1] - aabb.min[1];
        const aabbAspectRatio = aabbW / aabbH;
        const selectXAxis = aabbAspectRatio > tr.aspect;

        const minimumDistance = selectXAxis ?
            aabbW / (2 * Math.tan(tr.fovX * 0.5) * tr.aspect) :
            aabbH / (2 * Math.tan(tr.fovY * 0.5) * tr.aspect);

        return minimumDistance;
    }

    _cameraForBoundsOnGlobe(transform: Transform, p0: LngLatLike, p1: LngLatLike, bearing: number, pitch: number, options?: CameraOptions): ?EasingOptions {
        const tr = transform.clone();
        const eOptions = this._extendCameraOptions(options);

        tr.bearing = bearing;
        tr.pitch = pitch;

        const coord0 = LngLat.convert(p0);
        const coord1 = LngLat.convert(p1);

        const midLat = (coord0.lat + coord1.lat) * 0.5;
        const midLng = (coord0.lng + coord1.lng) * 0.5;

        const origin = latLngToECEF(midLat, midLng);

        const zAxis = vec3.normalize([], origin);
        const xAxis = vec3.normalize([], vec3.cross([], zAxis, [0, 1, 0]));
        const yAxis = vec3.cross([], xAxis, zAxis);

        const aabbOrientation = [
            xAxis[0], xAxis[1], xAxis[2], 0,
            yAxis[0], yAxis[1], yAxis[2], 0,
            zAxis[0], zAxis[1], zAxis[2], 0,
            0, 0, 0, 1
        ];

        const ecefCoords = [
            origin,

            latLngToECEF(coord0.lat, coord0.lng),
            latLngToECEF(coord1.lat, coord0.lng),
            latLngToECEF(coord1.lat, coord1.lng),
            latLngToECEF(coord0.lat, coord1.lng),

            latLngToECEF(midLat, coord0.lng),
            latLngToECEF(midLat, coord1.lng),
            latLngToECEF(coord0.lat, midLng),
            latLngToECEF(coord1.lat, midLng),
        ];

        let aabb = Aabb.fromPoints(ecefCoords.map(p => [vec3.dot(xAxis, p), vec3.dot(yAxis, p), vec3.dot(zAxis, p)]));

        const center = vec3.transformMat4([], aabb.center, aabbOrientation);

        if (vec3.squaredLength(center) === 0) {
            vec3.set(center, 0, 0, 1);
        }

        vec3.normalize(center, center);
        vec3.scale(center, center, GLOBE_RADIUS);
        tr.center = ecefToLatLng(center);

        const worldToCamera = tr.getWorldToCameraMatrix();
        const cameraToWorld = mat4.invert(new Float64Array(16), worldToCamera);

        aabb = Aabb.applyTransform(aabb, mat4.multiply([], worldToCamera, aabbOrientation));

        vec3.transformMat4(center, center, worldToCamera);

        const aabbHalfExtentZ = (aabb.max[2] - aabb.min[2]) * 0.5;
        const frustumDistance = this._minimumAABBFrustumDistance(tr, aabb);

        const offsetZ = vec3.scale([], [0, 0, 1], aabbHalfExtentZ);
        const aabbClosestPoint = vec3.add(offsetZ, center, offsetZ);
        const offsetDistance = frustumDistance + (tr.pitch === 0 ? 0 : vec3.distance(center, aabbClosestPoint));

        const globeCenter = tr.globeCenterInViewSpace;
        const normal = vec3.sub([], center, [globeCenter[0], globeCenter[1], globeCenter[2]]);
        vec3.normalize(normal, normal);
        vec3.scale(normal, normal, offsetDistance);

        const cameraPosition = vec3.add([], center, normal);

        vec3.transformMat4(cameraPosition, cameraPosition, cameraToWorld);

        const meterPerECEF = earthRadius / GLOBE_RADIUS;
        const altitudeECEF = vec3.length(cameraPosition);
        const altitudeMeter = altitudeECEF * meterPerECEF - earthRadius;
        const mercatorZ = mercatorZfromAltitude(Math.max(altitudeMeter, Number.EPSILON), 0);

        const zoom = Math.min(tr.zoomFromMercatorZAdjusted(mercatorZ), eOptions.maxZoom);

        const halfZoomTransition = (GLOBE_ZOOM_THRESHOLD_MIN + GLOBE_ZOOM_THRESHOLD_MAX) * 0.5;
        if (zoom > halfZoomTransition) {
            tr.setProjection({name: 'mercator'});
            tr.zoom = zoom;
            return this._cameraForBounds(tr, p0, p1, bearing, pitch, options);
        }

        return {center: tr.center, zoom, bearing, pitch};
    }

    /** @section {Querying features} */

    /**
     * Queries the currently loaded data for elevation at a geographical location. The elevation is returned in `meters` relative to mean sea-level.
     * Returns `null` if `terrain` is disabled or if terrain data for the location hasn't been loaded yet.
     *
     * In order to guarantee that the terrain data is loaded ensure that the geographical location is visible and wait for the `idle` event to occur.
     *
     * @memberof Map#
     * @param {LngLatLike} lnglat The geographical location at which to query.
     * @param {ElevationQueryOptions} [options] Options object.
     * @param {boolean} [options.exaggerated=true] When `true` returns the terrain elevation with the value of `exaggeration` from the style already applied.
     *     When `false`, returns the raw value of the underlying data without styling applied.
     * @returns {number | null} The elevation in meters.
     * @example
     * const coordinate = [-122.420679, 37.772537];
     * const elevation = map.queryTerrainElevation(coordinate);
     * @see [Example: Query terrain elevation](https://docs.mapbox.com/mapbox-gl-js/example/query-terrain-elevation/)
     */
    queryTerrainElevation(lnglat: LngLatLike, options: ?ElevationQueryOptions): ?number {
        const elevation = this.transform.elevation;
        if (elevation) {
            options = extend({}, {exaggerated: true}, options);
            return elevation.getAtPoint(MercatorCoordinate.fromLngLat(lnglat), null, options.exaggerated);
        }
        return null;
    }

    /**
     * Calculate the center of these two points in the viewport and use
     * the highest zoom level up to and including `Map#getMaxZoom()` that fits
     * the points in the viewport at the specified bearing.
     * @memberof Map#
     * @param {LngLatLike} p0 First point
     * @param {LngLatLike} p1 Second point
     * @param {number} bearing Desired map bearing at end of animation, in degrees
     * @param {number} pitch Desired map pitch at end of animation, in degrees
     * @param {CameraOptions | null} options
     * @param {number | PaddingOptions} [options.padding] The amount of padding in pixels to add to the given bounds.
     * @param {PointLike} [options.offset=[0, 0]] The center of the given bounds relative to the map's center, measured in pixels.
     * @param {number} [options.maxZoom] The maximum zoom level to allow when the camera would transition to the specified bounds.
     * @returns {CameraOptions | void} If map is able to fit to provided bounds, returns `CameraOptions` with
     *      `center`, `zoom`, and `bearing`. If map is unable to fit, method will warn and return undefined.
     * @private
     * @example
     * var p0 = [-79, 43];
     * var p1 = [-73, 45];
     * var bearing = 90;
     * var newCameraTransform = map._cameraForBounds(p0, p1, bearing, pitch, {
     *   padding: {top: 10, bottom:25, left: 15, right: 5}
     * });
     */
    _cameraForBounds(transform: Transform, p0: LngLatLike, p1: LngLatLike, bearing: number, pitch: number, options?: CameraOptions): ?EasingOptions {
        if (transform.projection.name === 'globe') {
            return this._cameraForBoundsOnGlobe(transform, p0, p1, bearing, pitch, options);
        }

        const tr = transform.clone();
        const eOptions = this._extendCameraOptions(options);
        const edgePadding = tr.padding;

        tr.bearing = bearing;
        tr.pitch = pitch;

        const coord0 = LngLat.convert(p0);
        const coord1 = LngLat.convert(p1);
        const coord2 = new LngLat(coord0.lng, coord1.lat);
        const coord3 = new LngLat(coord1.lng, coord0.lat);

        const p0world = tr.project(coord0);
        const p1world = tr.project(coord1);

        const z0 = this.queryTerrainElevation(coord0);
        const z1 = this.queryTerrainElevation(coord1);
        const z2 = this.queryTerrainElevation(coord2);
        const z3 = this.queryTerrainElevation(coord3);

        const worldCoords = [
            [p0world.x, p0world.y, Math.min(z0 || 0, z1 || 0, z2 || 0, z3 || 0)],
            [p1world.x, p1world.y, Math.max(z0 || 0, z1 || 0, z2 || 0, z3 || 0)]
        ];

        let aabb = Aabb.fromPoints(worldCoords);

        const worldToCamera = tr.getWorldToCameraMatrix();
        const cameraToWorld = mat4.invert(new Float64Array(16), worldToCamera);

        aabb = Aabb.applyTransform(aabb, worldToCamera);

        const size = vec3.sub([], aabb.max, aabb.min);

        const screenPadL = edgePadding.left || 0;
        const screenPadR = edgePadding.right || 0;
        const screenPadB = edgePadding.bottom || 0;
        const screenPadT = edgePadding.top || 0;

        const {left: padL, right: padR, top: padT, bottom: padB} = eOptions.padding;

        const halfScreenPadX = (screenPadL + screenPadR) * 0.5;
        const halfScreenPadY = (screenPadT + screenPadB) * 0.5;

        const scaleX = (tr.width - (screenPadL + screenPadR + padL + padR)) / size[0];
        const scaleY = (tr.height - (screenPadB + screenPadT + padB + padT)) / size[1];

        const zoomRef = Math.min(tr.scaleZoom(tr.scale * Math.min(scaleX, scaleY)), eOptions.maxZoom);

        const scaleRatio = tr.scale / tr.zoomScale(zoomRef);

        aabb = new Aabb(
            [aabb.min[0] - (padL + halfScreenPadX) * scaleRatio, aabb.min[1] - (padB + halfScreenPadY) * scaleRatio, aabb.min[2]],
            [aabb.max[0] + (padR + halfScreenPadX) * scaleRatio, aabb.max[1] + (padT + halfScreenPadY) * scaleRatio, aabb.max[2]]);

        const aabbHalfExtentZ = size[2] * 0.5;
        const frustumDistance = this._minimumAABBFrustumDistance(tr, aabb);

        const normalZ = [0, 0, 1, 0];

        vec4.transformMat4(normalZ, normalZ, worldToCamera);
        vec4.normalize(normalZ, normalZ);

        const offset = vec3.scale([], normalZ, frustumDistance + aabbHalfExtentZ);
        const cameraPosition = vec3.add([], aabb.center, offset);

        const centerOffset = (typeof eOptions.offset.x === 'number' && typeof eOptions.offset.y === 'number') ?
            new Point(eOptions.offset.x, eOptions.offset.y) :
            Point.convert(eOptions.offset);

        const rotatedOffset = centerOffset.rotate(-degToRad(bearing));

        aabb.center[0] -= rotatedOffset.x * scaleRatio;
        aabb.center[1] += rotatedOffset.y * scaleRatio;

        vec3.transformMat4(aabb.center, aabb.center, cameraToWorld);
        vec3.transformMat4(cameraPosition, cameraPosition, cameraToWorld);

        const mercator = [aabb.center[0], aabb.center[1], cameraPosition[2] * tr.pixelsPerMeter];
        vec3.scale(mercator, mercator, 1.0 / tr.worldSize);

        const lng = lngFromMercatorX(mercator[0]);
        const lat = latFromMercatorY(mercator[1]);

        const zoom = Math.min(tr._zoomFromMercatorZ(mercator[2]), eOptions.maxZoom);
        const center = new LngLat(lng, lat);

        const halfZoomTransition = (GLOBE_ZOOM_THRESHOLD_MIN + GLOBE_ZOOM_THRESHOLD_MAX) * 0.5;

        if (tr.mercatorFromTransition && zoom < halfZoomTransition) {
            tr.setProjection({name: 'globe'});
            tr.zoom = zoom;
            return this._cameraForBounds(tr, p0, p1, bearing, pitch, options);
        }

        return {center, zoom, bearing, pitch};
    }

    /**
     * Pans and zooms the map to contain its visible area within the specified geographical bounds.
     * If a padding is set on the map, the bounds are fit to the inset.
     *
     * @memberof Map#
     * @param {LngLatBoundsLike} bounds Center these bounds in the viewport and use the highest
     *     zoom level up to and including `Map#getMaxZoom()` that fits them in the viewport.
     * @param {Object} [options] Options supports all properties from {@link AnimationOptions} and {@link CameraOptions} in addition to the fields below.
     * @param {number | PaddingOptions} [options.padding] The amount of padding in pixels to add to the given bounds.
     * @param {number} [options.pitch=0] Desired map pitch at end of animation, in degrees.
     * @param {number} [options.bearing=0] Desired map bearing at end of animation, in degrees.
     * @param {boolean} [options.linear=false] If `true`, the map transitions using
     *     {@link Map#easeTo}. If `false`, the map transitions using {@link Map#flyTo}. See
     *     those functions and {@link AnimationOptions} for information about options available.
     * @param {Function} [options.easing] An easing function for the animated transition. See {@link AnimationOptions}.
     * @param {PointLike} [options.offset=[0, 0]] The center of the given bounds relative to the map's center, measured in pixels.
     * @param {number} [options.maxZoom] The maximum zoom level to allow when the map view transitions to the specified bounds.
     * @param {Object} [eventData] Additional properties to be added to event objects of events triggered by this method.
     * @fires Map.event:movestart
     * @fires Map.event:moveend
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * const bbox = [[-79, 43], [-73, 45]];
     * map.fitBounds(bbox, {
     *     padding: {top: 10, bottom:25, left: 15, right: 5}
     * });
     * @see [Example: Fit a map to a bounding box](https://www.mapbox.com/mapbox-gl-js/example/fitbounds/)
     */
    fitBounds(bounds: LngLatBoundsLike, options?: EasingOptions, eventData?: Object): this {
        const cameraPlacement = this.cameraForBounds(bounds, options);
        return this._fitInternal(cameraPlacement, options, eventData);
    }

    /**
     * Pans, rotates and zooms the map to to fit the box made by points p0 and p1
     * once the map is rotated to the specified bearing. To zoom without rotating,
     * pass in the current map bearing.
     *
     * @memberof Map#
     * @param {PointLike} p0 First point on screen, in pixel coordinates.
     * @param {PointLike} p1 Second point on screen, in pixel coordinates.
     * @param {number} bearing Desired map bearing at end of animation, in degrees.
     * @param {EasingOptions | null} options Options object.
     *     Accepts {@link CameraOptions} and {@link AnimationOptions}.
     * @param {number | PaddingOptions} [options.padding] The amount of padding in pixels to add to the given bounds.
     * @param {boolean} [options.linear=false] If `true`, the map transitions using
     *     {@link Map#easeTo}. If `false`, the map transitions using {@link Map#flyTo}. See
     *     those functions and {@link AnimationOptions} for information about options available.
     * @param {number} [options.pitch=0] Desired map pitch at end of animation, in degrees.
     * @param {Function} [options.easing] An easing function for the animated transition. See {@link AnimationOptions}.
     * @param {PointLike} [options.offset=[0, 0]] The center of the given bounds relative to the map's center, measured in pixels.
     * @param {number} [options.maxZoom] The maximum zoom level to allow when the map view transitions to the specified bounds.
     * @param {Object | null} eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires Map.event:movestart
     * @fires Map.event:moveend
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * const p0 = [220, 400];
     * const p1 = [500, 900];
     * map.fitScreenCoordinates(p0, p1, map.getBearing(), {
     *     padding: {top: 10, bottom:25, left: 15, right: 5}
     * });
     * @see Used by {@link BoxZoomHandler}
     */
    fitScreenCoordinates(p0: PointLike, p1: PointLike, bearing: number, options?: EasingOptions, eventData?: Object): this {
        const screen0 = Point.convert(p0);
        const screen1 = Point.convert(p1);

        const min = new Point(Math.min(screen0.x, screen1.x), Math.min(screen0.y, screen1.y));
        const max = new Point(Math.max(screen0.x, screen1.x), Math.max(screen0.y, screen1.y));

        if (this.transform.projection.name === 'mercator' && this.transform.anyCornerOffEdge(screen0, screen1)) {
            return this;
        }

        const lnglat0 = this.transform.pointLocation3D(min);
        const lnglat1 = this.transform.pointLocation3D(max);
        const lnglat2 = this.transform.pointLocation3D(new Point(min.x, max.y));
        const lnglat3 = this.transform.pointLocation3D(new Point(max.x, min.y));

        const p0coord = [
            Math.min(lnglat0.lng, lnglat1.lng, lnglat2.lng, lnglat3.lng),
            Math.min(lnglat0.lat, lnglat1.lat, lnglat2.lat, lnglat3.lat),
        ];
        const p1coord =  [
            Math.max(lnglat0.lng, lnglat1.lng, lnglat2.lng, lnglat3.lng),
            Math.max(lnglat0.lat, lnglat1.lat, lnglat2.lat, lnglat3.lat),
        ];

        const pitch = options && options.pitch ? options.pitch : this.getPitch();

        const cameraPlacement = this._cameraForBounds(this.transform, p0coord, p1coord, bearing, pitch, options);
        return this._fitInternal(cameraPlacement, options, eventData);
    }

    _fitInternal(calculatedOptions?: ?EasingOptions, options?: EasingOptions, eventData?: Object): this {
        // cameraForBounds warns + returns undefined if unable to fit:
        if (!calculatedOptions) return this;

        options = extend(calculatedOptions, options);
        // Explicitly remove the padding field because, calculatedOptions already accounts for padding by setting zoom and center accordingly.
        delete options.padding;

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
     * @param {CameraOptions} options Options object.
     * @param {Object | null} eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires Map.event:movestart
     * @fires Map.event:zoomstart
     * @fires Map.event:pitchstart
     * @fires Map.event:rotate
     * @fires Map.event:move
     * @fires Map.event:zoom
     * @fires Map.event:pitch
     * @fires Map.event:moveend
     * @fires Map.event:zoomend
     * @fires Map.event:pitchend
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * // jump to coordinates at current zoom
     * map.jumpTo({center: [0, 0]});
     * // jump with zoom, pitch, and bearing options
     * map.jumpTo({
     *     center: [0, 0],
     *     zoom: 8,
     *     pitch: 45,
     *     bearing: 90
     * });
     * @see [Example: Jump to a series of locations](https://docs.mapbox.com/mapbox-gl-js/example/jump-to/)
     * @see [Example: Update a feature in realtime](https://docs.mapbox.com/mapbox-gl-js/example/live-update-feature/)
     */
    jumpTo(options: CameraOptions & {preloadOnly?: $PropertyType<AnimationOptions, 'preloadOnly'>}, eventData?: Object): this {
        this.stop();

        const tr = options.preloadOnly ? this.transform.clone() : this.transform;
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

        if (options.padding != null && !tr.isPaddingEqual(options.padding)) {
            // $FlowFixMe[incompatible-type] - Flow can't infer that padding is not null here
            tr.padding = options.padding;
        }

        if (options.preloadOnly) {
            this._preloadTiles(tr);
            return this;
        }

        this.fire(new Event('movestart', eventData))
            .fire(new Event('move', eventData));

        if (zoomChanged) {
            this.fire(new Event('zoomstart', eventData))
                .fire(new Event('zoom', eventData))
                .fire(new Event('zoomend', eventData));
        }

        if (bearingChanged) {
            this.fire(new Event('rotatestart', eventData))
                .fire(new Event('rotate', eventData))
                .fire(new Event('rotateend', eventData));
        }

        if (pitchChanged) {
            this.fire(new Event('pitchstart', eventData))
                .fire(new Event('pitch', eventData))
                .fire(new Event('pitchend', eventData));
        }

        return this.fire(new Event('moveend', eventData));
    }

    /**
     * Returns position and orientation of the camera entity.
     *
     * This method is not supported for projections other than mercator.
     *
     * @memberof Map#
     * @returns {FreeCameraOptions} The camera state.
     * @example
     * const camera = map.getFreeCameraOptions();
     *
     * const position = [138.72649, 35.33974];
     * const altitude = 3000;
     *
     * camera.position = mapboxgl.MercatorCoordinate.fromLngLat(position, altitude);
     * camera.lookAtPoint([138.73036, 35.36197]);
     *
     * map.setFreeCameraOptions(camera);
     */
    getFreeCameraOptions(): FreeCameraOptions {
        if (!this.transform.projection.supportsFreeCamera) {
            warnOnce(freeCameraNotSupportedWarning);
        }
        return this.transform.getFreeCameraOptions();
    }

    /**
     * `FreeCameraOptions` provides more direct access to the underlying camera entity.
     * For backwards compatibility the state set using this API must be representable with
     * `CameraOptions` as well. Parameters are clamped into a valid range or discarded as invalid
     * if the conversion to the pitch and bearing presentation is ambiguous. For example orientation
     * can be invalid if it leads to the camera being upside down, the quaternion has zero length,
     * or the pitch is over the maximum pitch limit.
     *
     * This method is not supported for projections other than mercator.
     *
     * @memberof Map#
     * @param {FreeCameraOptions} options `FreeCameraOptions` object.
     * @param {Object | null} eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires Map.event:movestart
     * @fires Map.event:zoomstart
     * @fires Map.event:pitchstart
     * @fires Map.event:rotate
     * @fires Map.event:move
     * @fires Map.event:zoom
     * @fires Map.event:pitch
     * @fires Map.event:moveend
     * @fires Map.event:zoomend
     * @fires Map.event:pitchend
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * const camera = map.getFreeCameraOptions();
     *
     * const position = [138.72649, 35.33974];
     * const altitude = 3000;
     *
     * camera.position = mapboxgl.MercatorCoordinate.fromLngLat(position, altitude);
     * camera.lookAtPoint([138.73036, 35.36197]);
     *
     * map.setFreeCameraOptions(camera);
     */
    setFreeCameraOptions(options: FreeCameraOptions, eventData?: Object): this {
        const tr = this.transform;

        if (!tr.projection.supportsFreeCamera) {
            warnOnce(freeCameraNotSupportedWarning);
            return this;
        }

        this.stop();

        const prevZoom = tr.zoom;
        const prevPitch = tr.pitch;
        const prevBearing = tr.bearing;

        tr.setFreeCameraOptions(options);

        const zoomChanged = prevZoom !== tr.zoom;
        const pitchChanged = prevPitch !== tr.pitch;
        const bearingChanged = prevBearing !== tr.bearing;

        this.fire(new Event('movestart', eventData))
            .fire(new Event('move', eventData));

        if (zoomChanged) {
            this.fire(new Event('zoomstart', eventData))
                .fire(new Event('zoom', eventData))
                .fire(new Event('zoomend', eventData));
        }

        if (bearingChanged) {
            this.fire(new Event('rotatestart', eventData))
                .fire(new Event('rotate', eventData))
                .fire(new Event('rotateend', eventData));
        }

        if (pitchChanged) {
            this.fire(new Event('pitchstart', eventData))
                .fire(new Event('pitch', eventData))
                .fire(new Event('pitchend', eventData));
        }

        this.fire(new Event('moveend', eventData));
        return this;
    }

    /**
     * Changes any combination of `center`, `zoom`, `bearing`, `pitch`, and `padding` with an animated transition
     * between old and new values. The map will retain its current values for any
     * details not specified in `options`.
     *
     * Note: The transition will happen instantly if the user has enabled
     * the `reduced motion` accessibility feature enabled in their operating system,
     * unless `options` includes `essential: true`.
     *
     * @memberof Map#
     * @param {EasingOptions} options Options describing the destination and animation of the transition.
     *     Accepts {@link CameraOptions} and {@link AnimationOptions}.
     * @param {Object | null} eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires Map.event:movestart
     * @fires Map.event:zoomstart
     * @fires Map.event:pitchstart
     * @fires Map.event:rotate
     * @fires Map.event:move
     * @fires Map.event:zoom
     * @fires Map.event:pitch
     * @fires Map.event:moveend
     * @fires Map.event:zoomend
     * @fires Map.event:pitchend
     * @returns {Map} `this` Returns itself to allow for method chaining.
     * @example
     * // Ease with default options to null island for 5 seconds.
     * map.easeTo({center: [0, 0], zoom: 9, duration: 5000});
     * @example
     * // Using easeTo options.
     * map.easeTo({
     *     center: [0, 0],
     *     zoom: 9,
     *     speed: 0.2,
     *     curve: 1,
     *     duration: 5000,
     *     easing(t) {
     *         return t;
     *     }
     * });
     * @see [Example: Navigate the map with game-like controls](https://www.mapbox.com/mapbox-gl-js/example/game-controls/)
     */
    easeTo(options: EasingOptions & {easeId?: string}, eventData?: Object): this {
        this._stop(false, options.easeId);

        options = extend({
            offset: [0, 0],
            duration: 500,
            easing: defaultEasing
        }, options);

        if (options.animate === false || this._prefersReducedMotion(options)) options.duration = 0;

        const tr = this.transform,
            startZoom = this.getZoom(),
            startBearing = this.getBearing(),
            startPitch = this.getPitch(),
            startPadding = this.getPadding(),

            zoom = 'zoom' in options ? +options.zoom : startZoom,
            bearing = 'bearing' in options ? this._normalizeBearing(options.bearing, startBearing) : startBearing,
            pitch = 'pitch' in options ? +options.pitch : startPitch,
            padding = 'padding' in options ? options.padding : tr.padding;

        const offsetAsPoint = Point.convert(options.offset);

        let pointAtOffset;
        let from;
        let delta;

        if (tr.projection.name === 'globe') {
            // Pixel coordinates will be applied directly to translate the globe
            const centerCoord = MercatorCoordinate.fromLngLat(tr.center);

            const rotatedOffset = offsetAsPoint.rotate(-tr.angle);
            centerCoord.x += rotatedOffset.x / tr.worldSize;
            centerCoord.y += rotatedOffset.y / tr.worldSize;

            const locationAtOffset = centerCoord.toLngLat();
            const center = LngLat.convert(options.center || locationAtOffset);
            this._normalizeCenter(center);

            pointAtOffset = tr.centerPoint.add(rotatedOffset);
            from = new Point(centerCoord.x, centerCoord.y).mult(tr.worldSize);
            delta = new Point(mercatorXfromLng(center.lng), mercatorYfromLat(center.lat)).mult(tr.worldSize).sub(from);
        } else {
            pointAtOffset = tr.centerPoint.add(offsetAsPoint);
            const locationAtOffset = tr.pointLocation(pointAtOffset);
            const center = LngLat.convert(options.center || locationAtOffset);
            this._normalizeCenter(center);

            from = tr.project(locationAtOffset);
            delta = tr.project(center).sub(from);
        }
        const finalScale = tr.zoomScale(zoom - startZoom);

        let around, aroundPoint;

        if (options.around) {
            around = LngLat.convert(options.around);
            aroundPoint = tr.locationPoint(around);
        }

        const zoomChanged = this._zooming || (zoom !== startZoom);
        const bearingChanged = this._rotating || (startBearing !== bearing);
        const pitchChanged = this._pitching || (pitch !== startPitch);
        const paddingChanged = !tr.isPaddingEqual(padding);

        const frame = (tr: Transform) => (k: number) => {
            if (zoomChanged) {
                tr.zoom = interpolate(startZoom, zoom, k);
            }
            if (bearingChanged) {
                tr.bearing = interpolate(startBearing, bearing, k);
            }
            if (pitchChanged) {
                tr.pitch = interpolate(startPitch, pitch, k);
            }
            if (paddingChanged) {
                tr.interpolatePadding(startPadding, padding, k);
                // When padding is being applied, Transform#centerPoint is changing continuously,
                // thus we need to recalculate offsetPoint every fra,e
                pointAtOffset = tr.centerPoint.add(offsetAsPoint);
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

            if (!options.preloadOnly) {
                this._fireMoveEvents(eventData);
            }

            return tr;
        };

        if (options.preloadOnly) {
            const predictedTransforms = this._emulate(frame, options.duration, tr);
            this._preloadTiles(predictedTransforms);
            return this;
        }

        const currently = {
            moving: this._moving,
            zooming: this._zooming,
            rotating: this._rotating,
            pitching: this._pitching
        };

        this._zooming = zoomChanged;
        this._rotating = bearingChanged;
        this._pitching = pitchChanged;

        this._easeId = options.easeId;
        this._prepareEase(eventData, options.noMoveStart, currently);

        this._ease(frame(tr), (interruptingEaseId?: string) => {
            if (tr.cameraElevationReference === "sea") tr.recenterOnTerrain();
            this._afterEase(eventData, interruptingEaseId);
        }, options);

        return this;
    }

    _prepareEase(eventData?: Object, noMoveStart: boolean, currently: Object = {}) {
        this._moving = true;
        this.transform.cameraElevationReference = "sea";
        if (this.transform._orthographicProjectionAtLowPitch && this.transform.pitch  === 0 && this.transform.projection.name !== 'globe') {
            // Run easeTo on ground elevation reference. EaseTo is otherwise always on sea elevation reference,
            // triggering changes in center to camera distance and bumpy camera movement for ortho mode.
            this.transform.cameraElevationReference = "ground";
        }

        if (!noMoveStart && !currently.moving) {
            this.fire(new Event('movestart', eventData));
        }
        if (this._zooming && !currently.zooming) {
            this.fire(new Event('zoomstart', eventData));
        }
        if (this._rotating && !currently.rotating) {
            this.fire(new Event('rotatestart', eventData));
        }
        if (this._pitching && !currently.pitching) {
            this.fire(new Event('pitchstart', eventData));
        }
    }

    _fireMoveEvents(eventData?: Object) {
        this.fire(new Event('move', eventData));
        if (this._zooming) {
            this.fire(new Event('zoom', eventData));
        }
        if (this._rotating) {
            this.fire(new Event('rotate', eventData));
        }
        if (this._pitching) {
            this.fire(new Event('pitch', eventData));
        }
    }

    _afterEase(eventData?: Object, easeId?: string) {
        // if this easing is being stopped to start another easing with
        // the same id then don't fire any events to avoid extra start/stop events
        if (this._easeId && easeId && this._easeId === easeId) {
            return;
        }
        this._easeId = undefined;
        this.transform.cameraElevationReference = "ground";

        const wasZooming = this._zooming;
        const wasRotating = this._rotating;
        const wasPitching = this._pitching;
        this._moving = false;
        this._zooming = false;
        this._rotating = false;
        this._pitching = false;

        if (wasZooming) {
            this.fire(new Event('zoomend', eventData));
        }
        if (wasRotating) {
            this.fire(new Event('rotateend', eventData));
        }
        if (wasPitching) {
            this.fire(new Event('pitchend', eventData));
        }
        this.fire(new Event('moveend', eventData));
    }

    /**
     * Changes any combination of center, zoom, bearing, and pitch, animating the transition along a curve that
     * evokes flight. The animation seamlessly incorporates zooming and panning to help
     * the user maintain their bearings even after traversing a great distance.
     *
     * If a user has the `reduced motion` accessibility feature enabled in their
     * operating system, the animation will be skipped and this will behave
     * equivalently to `jumpTo`, unless 'options' includes `essential: true`.
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
     *     value of 1 would produce a circular motion. If `options.minZoom` is specified, this option will be ignored.
     * @param {number} [options.minZoom] The zero-based zoom level at the peak of the flight path. If
     *     this option is specified, `options.curve` will be ignored.
     * @param {number} [options.speed=1.2] The average speed of the animation defined in relation to
     *     `options.curve`. A speed of 1.2 means that the map appears to move along the flight path
     *     by 1.2 times `options.curve` screenfuls every second. A _screenful_ is the map's visible span.
     *     It does not correspond to a fixed physical distance, but varies by zoom level.
     * @param {number} [options.screenSpeed] The average speed of the animation measured in screenfuls
     *     per second, assuming a linear timing curve. If `options.speed` is specified, this option is ignored.
     * @param {number} [options.maxDuration] The animation's maximum duration, measured in milliseconds.
     *     If duration exceeds maximum duration, it resets to 0.
     * @param {Object | null} eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires Map.event:movestart
     * @fires Map.event:zoomstart
     * @fires Map.event:pitchstart
     * @fires Map.event:move
     * @fires Map.event:zoom
     * @fires Map.event:rotate
     * @fires Map.event:pitch
     * @fires Map.event:moveend
     * @fires Map.event:zoomend
     * @fires Map.event:pitchend
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * // fly with default options to null island
     * map.flyTo({center: [0, 0], zoom: 9});
     * // using flyTo options
     * map.flyTo({
     *     center: [0, 0],
     *     zoom: 9,
     *     speed: 0.2,
     *     curve: 1,
     *     easing(t) {
     *         return t;
     *     }
     * });
     * @see [Example: Fly to a location](https://www.mapbox.com/mapbox-gl-js/example/flyto/)
     * @see [Example: Slowly fly to a location](https://www.mapbox.com/mapbox-gl-js/example/flyto-options/)
     * @see [Example: Fly to a location based on scroll position](https://www.mapbox.com/mapbox-gl-js/example/scroll-fly-to/)
     */
    flyTo(options: EasingOptions, eventData?: Object): this {
        // Fall through to jumpTo if user has set prefers-reduced-motion
        if (this._prefersReducedMotion(options)) {
            const coercedOptions = pick(options, ['center', 'zoom', 'bearing', 'pitch', 'around']);
            return this.jumpTo(coercedOptions, eventData);
        }

        // This method implements an “optimal path” animation, as detailed in:
        //
        // Van Wijk, Jarke J.; Nuij, Wim A. A. “Smooth and efficient zooming and panning.” INFOVIS
        //   ’03. pp. 15–22. <https://www.win.tue.nl/~vanwijk/zoompan.pdf#page=5>.
        //
        // Where applicable, local variable documentation begins with the associated variable or
        // function in van Wijk (2003).

        this.stop();

        options = extend({
            offset: [0, 0],
            speed: 1.2,
            curve: 1.42,
            easing: defaultEasing
        }, options);

        const tr = this.transform,
            startZoom = this.getZoom(),
            startBearing = this.getBearing(),
            startPitch = this.getPitch();

        const zoom = 'zoom' in options ? clamp(+options.zoom, tr.minZoom, tr.maxZoom) : startZoom;
        const bearing = 'bearing' in options ? this._normalizeBearing(options.bearing, startBearing) : startBearing;
        const pitch = 'pitch' in options ? +options.pitch : startPitch;

        const scale = tr.zoomScale(zoom - startZoom);
        const offsetAsPoint = Point.convert(options.offset);
        const pointAtOffset = tr.centerPoint.add(offsetAsPoint);
        const locationAtOffset = tr.pointLocation(pointAtOffset);

        let center = options.center;
        // Calculate center with respect to padding
        if (center && options.padding) {
            const easingOptions = this._cameraForBounds(this.transform, center, center, bearing, pitch, options);
            if (easingOptions) center = easingOptions.center;
        }

        center = LngLat.convert(center || locationAtOffset);
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
            const minZoom = clamp(Math.min(options.minZoom, startZoom, zoom), tr.minZoom, tr.maxZoom);
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
        function r(i: number) {
            const b = (w1 * w1 - w0 * w0 + (i ? -1 : 1) * rho2 * rho2 * u1 * u1) / (2 * (i ? w1 : w0) * rho2 * u1);
            return Math.log(Math.sqrt(b * b + 1) - b);
        }

        function sinh(n: number) { return (Math.exp(n) - Math.exp(-n)) / 2; }
        function cosh(n: number) { return (Math.exp(n) + Math.exp(-n)) / 2; }
        function tanh(n: number) { return sinh(n) / cosh(n); }

        // r₀: Zoom-out factor during ascent.
        const r0 = r(0);

        // w(s): Returns the visible span on the ground, measured in pixels with respect to the
        // initial scale. Assumes an angular field of view of 2 arctan ½ ≈ 53°.
        let w: (_: number) => number = function (s) {
            return (cosh(r0) / cosh(r0 + rho * s));
        };

        // u(s): Returns the distance along the flight path as projected onto the ground plane,
        // measured in pixels from the world image origin at the initial scale.
        let u: (_: number) => number = function (s) {
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

        const zoomChanged = true;
        const bearingChanged = (startBearing !== bearing);
        const pitchChanged = (pitch !== startPitch);

        const frame = (tr: Transform) => (k: number) => {
            // s: The distance traveled along the flight path, measured in ρ-screenfuls.
            const s = k * S;
            const scale = 1 / w(s);
            tr.zoom = k === 1 ? zoom : startZoom + tr.scaleZoom(scale);

            if (bearingChanged) {
                tr.bearing = interpolate(startBearing, bearing, k);
            }
            if (pitchChanged) {
                tr.pitch = interpolate(startPitch, pitch, k);
            }

            const newCenter = k === 1 ? center : tr.unproject(from.add(delta.mult(u(s))).mult(scale));
            tr.setLocationAtPoint(tr.renderWorldCopies ? newCenter.wrap() : newCenter, pointAtOffset);
            tr._updateCameraOnTerrain();

            if (!options.preloadOnly) {
                this._fireMoveEvents(eventData);
            }

            return tr;
        };

        if (options.preloadOnly) {
            const predictedTransforms = this._emulate(frame, options.duration, tr);
            this._preloadTiles(predictedTransforms);
            return this;
        }

        this._zooming = zoomChanged;
        this._rotating = bearingChanged;
        this._pitching = pitchChanged;

        this._prepareEase(eventData, false);
        this._ease(frame(tr), () => this._afterEase(eventData), options);

        return this;
    }

    isEasing(): boolean {
        return !!this._easeFrameId;
    }

    /**
     * Stops any animated transition underway.
     *
     * @memberof Map#
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * map.stop();
     */
    stop(): this {
        return this._stop();
    }

    _stop(allowGestures?: boolean, easeId?: string): this {
        if (this._easeFrameId) {
            this._cancelRenderFrame(this._easeFrameId);
            this._easeFrameId = undefined;
            this._onEaseFrame = undefined;
        }

        if (this._onEaseEnd) {
            // The _onEaseEnd function might emit events which trigger new
            // animation, which sets a new _onEaseEnd. Ensure we don't delete
            // it unintentionally.
            const onEaseEnd = this._onEaseEnd;
            this._onEaseEnd = undefined;
            onEaseEnd.call(this, easeId);
        }
        if (!allowGestures) {
            const handlers = (this: any).handlers;
            if (handlers) handlers.stop(false);
        }
        return this;
    }

    _ease(frame: (_: number) => Transform | void,
          finish: () => void,
          options: {animate: boolean, duration: number, easing: (_: number) => number}) {
        if (options.animate === false || options.duration === 0) {
            frame(1);
            finish();
        } else {
            this._easeStart = browser.now();
            this._easeOptions = options;
            this._onEaseFrame = frame;
            this._onEaseEnd = finish;
            // $FlowFixMe[method-unbinding]
            this._easeFrameId = this._requestRenderFrame(this._renderFrameCallback);
        }
    }

    // Callback for map._requestRenderFrame
    _renderFrameCallback() {
        const t = Math.min((browser.now() - this._easeStart) / this._easeOptions.duration, 1);
        const frame = this._onEaseFrame;
        if (frame) frame(this._easeOptions.easing(t));
        if (t < 1) {
            // $FlowFixMe[method-unbinding]
            this._easeFrameId = this._requestRenderFrame(this._renderFrameCallback);
        } else {
            this.stop();
        }
    }

    // convert bearing so that it's numerically close to the current one so that it interpolates properly
    _normalizeBearing(bearing: number, currentBearing: number): number {
        bearing = wrap(bearing, -180, 180);
        const diff = Math.abs(bearing - currentBearing);
        if (Math.abs(bearing - 360 - currentBearing) < diff) bearing -= 360;
        if (Math.abs(bearing + 360 - currentBearing) < diff) bearing += 360;
        return bearing;
    }

    // If a path crossing the antimeridian would be shorter, extend the final coordinate so that
    // interpolating between the two endpoints will cross it.
    _normalizeCenter(center: LngLat) {
        const tr = this.transform;
        if (tr.maxBounds) return;
        const isGlobe = tr.projection.name === 'globe';
        if (!isGlobe && !tr.renderWorldCopies) return;

        const delta = center.lng - tr.center.lng;
        center.lng +=
            delta > 180 ? -360 :
            delta < -180 ? 360 : 0;
    }

    _prefersReducedMotion(options: ?AnimationOptions): boolean {
        const essential = options && options.essential;
        const prefersReducedMotion = this._respectPrefersReducedMotion && browser.prefersReducedMotion;
        return prefersReducedMotion && !essential;
    }

    // emulates frame function for some transform
    _emulate(frame: Function, duration: number, initialTransform: Transform): Array<Transform> {
        const frameRate = 15;
        const numFrames = Math.ceil(duration * frameRate / 1000);

        const transforms = [];
        const emulateFrame = frame(initialTransform.clone());
        for (let i = 0; i <= numFrames; i++) {
            const transform = emulateFrame(i / numFrames);
            transforms.push(transform.clone());
        }

        return transforms;
    }
}

// In debug builds, check that camera change events are fired in the correct order.
// - ___start events needs to be fired before ___ and ___end events
// - another ___start event can't be fired before a ___end event has been fired for the previous one
function addAssertions(camera: Camera) { //eslint-disable-line
    Debug.run(() => {
        const inProgress = {};

        ['drag', 'zoom', 'rotate', 'pitch', 'move'].forEach(name => {
            inProgress[name] = false;

            camera.on(((`${name}start`: any): MapEvent), () => {
                assert(!inProgress[name], `"${name}start" fired twice without a "${name}end"`);
                inProgress[name] = true;
                assert(inProgress.move);
            });

            camera.on(name, () => {
                assert(inProgress[name]);
                assert(inProgress.move);
            });

            camera.on(((`${name}end`: any): MapEvent), () => {
                assert(inProgress.move);
                assert(inProgress[name]);
                inProgress[name] = false;
            });
        });

        // Canary used to test whether this function is stripped in prod build
        canary = 'canary debug run'; //eslint-disable-line
    });
}

let canary; //eslint-disable-line

export default Camera;
