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
import LngLat from '../geo/lng_lat.js';
import LngLatBounds from '../geo/lng_lat_bounds.js';
import Point from '@mapbox/point-geometry';
import {Event, Evented} from '../util/evented.js';
import assert from 'assert';
import {Debug} from '../util/debug.js';
import MercatorCoordinate, {mercatorZfromAltitude} from '../geo/mercator_coordinate.js';
import {vec3} from 'gl-matrix';
import type {FreeCameraOptions} from './free_camera.js';
import type Transform from '../geo/transform.js';
import type {LngLatLike} from '../geo/lng_lat.js';
import type {LngLatBoundsLike} from '../geo/lng_lat_bounds.js';
import type {TaskID} from '../util/task_queue.js';
import type {PointLike} from '@mapbox/point-geometry';
import {Aabb, Frustum} from '../util/primitives.js';
import type {PaddingOptions} from '../geo/edge_insets.js';

/**
 * Options common to {@link Map#jumpTo}, {@link Map#easeTo}, and {@link Map#flyTo}, controlling the desired location,
 * zoom, bearing, and pitch of the camera. All properties are optional, and when a property is omitted, the current
 * camera value for that property will remain unchanged.
 *
 * @typedef {Object} CameraOptions
 * @property {LngLatLike} center The desired center.
 * @property {number} zoom The desired zoom level.
 * @property {number} bearing The desired bearing in degrees. The bearing is the compass direction that
 * is "up". For example, `bearing: 90` orients the map so that east is up.
 * @property {number} pitch The desired pitch in degrees. The pitch is the angle towards the horizon
 * measured in degrees with a range between 0 and 60 degrees. For example, pitch: 0 provides the appearance
 * of looking straight down at the map, while pitch: 60 tilts the user's perspective towards the horizon.
 * Increasing the pitch value is often used to display 3D objects.
 * @property {LngLatLike} around If `zoom` is specified, `around` determines the point around which the zoom is centered.
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

/**
 * Options common to map movement methods that involve animation, such as {@link Map#panBy} and
 * {@link Map#easeTo}, controlling the duration and easing function of the animation. All properties
 * are optional.
 *
 * @typedef {Object} AnimationOptions
 * @property {number} duration The animation's duration, measured in milliseconds.
 * @property {Function} easing A function taking a time in the range 0..1 and returning a number where 0 is
 *   the initial state and 1 is the final state.
 * @property {PointLike} offset The target center's offset relative to real map container center at the end of animation.
 * @property {boolean} animate If `false`, no animation will occur.
 * @property {boolean} essential If `true`, then the animation is considered essential and will not be affected by
 *   [`prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion).
 * @see [Example: Slowly fly to a location](https://docs.mapbox.com/mapbox-gl-js/example/flyto-options/)
 * @see [Example: Customize camera animations](https://docs.mapbox.com/mapbox-gl-js/example/camera-animation/)
 * @see [Example: Navigate the map with game-like controls](https://docs.mapbox.com/mapbox-gl-js/example/game-controls/)
*/
export type AnimationOptions = {
    duration?: number,
    easing?: (_: number) => number,
    offset?: PointLike,
    animate?: boolean,
    essential?: boolean
};

export type ElevationBoxRaycast = {
    minLngLat: LngLat,
    maxLngLat: LngLat,
    minAltitude: number,
    maxAltitude: number
};

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
 *     padding: {top: 10, bottom:25, left: 15, right: 5}
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
    _padding: boolean;

    _bearingSnap: number;
    _easeStart: number;
    _easeOptions: {duration: number, easing: (_: number) => number};
    _easeId: string | void;

    _onEaseFrame: (_: number) => void;
    _onEaseEnd: (easeId?: string) => void;
    _easeFrameId: ?TaskID;

    +_requestRenderFrame: (() => void) => TaskID;
    +_cancelRenderFrame: (_: TaskID) => void;

    constructor(transform: Transform, options: {bearingSnap: number}) {
        super();
        this._moving = false;
        this._zooming = false;
        this.transform = transform;
        this._bearingSnap = options.bearingSnap;

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
     * const {longitude, latitude} = map.getCenter();
     * @see [Tutorial: Use Mapbox GL JS in a React app](https://docs.mapbox.com/help/tutorials/use-mapbox-gl-js-with-react/#store-the-new-coordinates)
     */
    getCenter(): LngLat { return new LngLat(this.transform.center.lng, this.transform.center.lat); }

    /**
     * Sets the map's geographical centerpoint. Equivalent to `jumpTo({center: center})`.
     *
     * @memberof Map#
     * @param {LngLatLike} center The centerpoint to set.
     * @param {Object | null} eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires movestart
     * @fires moveend
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * map.setCenter([-74, 38]);
     */
    setCenter(center: LngLatLike, eventData?: Object) {
        return this.jumpTo({center}, eventData);
    }

    /**
     * Pans the map by the specified offset.
     *
     * @memberof Map#
     * @param {PointLike} offset The `x` and `y` coordinates by which to pan the map.
     * @param {AnimationOptions | null} options An options object describing the destination and animation of the transition. We do not recommend using `options.offset` since this value will override the value of the `offset` parameter.
     * @param {Object | null} eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires movestart
     * @fires moveend
     * @returns {Map} `this` Returns itself to allow for method chaining.
     * @example
     * map.panBy([-74, 38]);
     * @example
     * // panBy with an animation of 5 seconds.
     * map.panBy([-74, 38], {duration: 5000});
     * @see [Example: Navigate the map with game-like controls](https://www.mapbox.com/mapbox-gl-js/example/game-controls/)
     */
    panBy(offset: PointLike, options?: AnimationOptions, eventData?: Object) {
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
     * @fires movestart
     * @fires moveend
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * map.panTo([-74, 38]);
     * @example
     * // Specify that the panTo animation should last 5000 milliseconds.
     * map.panTo([-74, 38], {duration: 5000});
     * @see [Example: Update a feature in realtime](https://docs.mapbox.com/mapbox-gl-js/example/live-update-feature/)
     */
    panTo(lnglat: LngLatLike, options?: AnimationOptions, eventData?: Object) {
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
     * @fires movestart
     * @fires zoomstart
     * @fires move
     * @fires zoom
     * @fires moveend
     * @fires zoomend
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * // Zoom to the zoom level 5 without an animated transition
     * map.setZoom(5);
     */
    setZoom(zoom: number, eventData?: Object) {
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
     * @fires movestart
     * @fires zoomstart
     * @fires move
     * @fires zoom
     * @fires moveend
     * @fires zoomend
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
    zoomTo(zoom: number, options: ? AnimationOptions, eventData?: Object) {
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
     * @fires movestart
     * @fires zoomstart
     * @fires move
     * @fires zoom
     * @fires moveend
     * @fires zoomend
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * // zoom the map in one level with a custom animation duration
     * map.zoomIn({duration: 1000});
     */
    zoomIn(options?: AnimationOptions, eventData?: Object) {
        this.zoomTo(this.getZoom() + 1, options, eventData);
        return this;
    }

    /**
     * Decreases the map's zoom level by 1.
     *
     * @memberof Map#
     * @param {AnimationOptions | null} options Options object.
     * @param {Object | null} eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires movestart
     * @fires zoomstart
     * @fires move
     * @fires zoom
     * @fires moveend
     * @fires zoomend
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * // zoom the map out one level with a custom animation offset
     * map.zoomOut({offset: [80, 60]});
     */
    zoomOut(options?: AnimationOptions, eventData?: Object) {
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
    getBearing(): number { return this.transform.bearing; }

    /**
     * Sets the map's bearing (rotation). The bearing is the compass direction that is "up"; for example, a bearing
     * of 90° orients the map so that east is up.
     *
     * Equivalent to `jumpTo({bearing: bearing})`.
     *
     * @memberof Map#
     * @param {number} bearing The desired bearing.
     * @param {Object | null} eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires movestart
     * @fires moveend
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * // Rotate the map to 90 degrees.
     * map.setBearing(90);
     */
    setBearing(bearing: number, eventData?: Object) {
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
     * @fires movestart
     * @fires moveend
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * // Sets a left padding of 300px, and a top padding of 50px
     * map.setPadding({left: 300, top: 50});
     */
    setPadding(padding: PaddingOptions, eventData?: Object) {
        this.jumpTo({padding}, eventData);
        return this;
    }

    /**
     * Rotates the map to the specified bearing, with an animated transition. The bearing is the compass direction
     * that is \"up\"; for example, a bearing of 90° orients the map so that east is up.
     *
     * @memberof Map#
     * @param {number} bearing The desired bearing.
     * @param {AnimationOptions | null} options Options object.
     * @param {Object | null} eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires movestart
     * @fires moveend
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * map.rotateTo(30);
     * @example
     * // rotateTo with an animation of 2 seconds.
     * map.rotateTo(30, {duration: 2000});
     */
    rotateTo(bearing: number, options?: AnimationOptions, eventData?: Object) {
        return this.easeTo(extend({
            bearing
        }, options), eventData);
    }

    /**
     * Rotates the map so that north is up (0° bearing), with an animated transition.
     *
     * @memberof Map#
     * @param {AnimationOptions | null} options Options object.
     * @param {Object | null} eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires movestart
     * @fires moveend
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * // resetNorth with an animation of 2 seconds.
     * map.resetNorth({duration: 2000});
     */
    resetNorth(options?: AnimationOptions, eventData?: Object) {
        this.rotateTo(0, extend({duration: 1000}, options), eventData);
        return this;
    }

    /**
     * Rotates and pitches the map so that north is up (0° bearing) and pitch is 0°, with an animated transition.
     *
     * @memberof Map#
     * @param {AnimationOptions | null} options Options object.
     * @param {Object | null} eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires movestart
     * @fires moveend
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * // resetNorthPitch with an animation of 2 seconds.
     * map.resetNorthPitch({duration: 2000});
     */
    resetNorthPitch(options?: AnimationOptions, eventData?: Object) {
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
     * @param {AnimationOptions | null} options Options object.
     * @param {Object | null} eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires movestart
     * @fires moveend
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * // snapToNorth with an animation of 2 seconds.
     * map.snapToNorth({duration: 2000});
     */
    snapToNorth(options?: AnimationOptions, eventData?: Object) {
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
     * @fires pitchstart
     * @fires movestart
     * @fires moveend
     * @returns {Map} Returns itself to allow for method chaining.
     * @example
     * // setPitch with an animation of 2 seconds.
     * map.setPitch(80, {duration: 2000});
     */
    setPitch(pitch: number, eventData?: Object) {
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
     *      the highest zoom level up to and including `Map#getMaxZoom()` that fits
     *      in the viewport. LngLatBounds represent a box that is always axis-aligned with bearing 0.
     * @param {CameraOptions | null} options Options object.
     * @param {number | PaddingOptions} [options.padding] The amount of padding in pixels to add to the given bounds.
     * @param {number} [options.bearing=0] Desired map bearing at end of animation, in degrees.
     * @param {PointLike} [options.offset=[0, 0]] The center of the given bounds relative to the map's center, measured in pixels.
     * @param {number} [options.maxZoom] The maximum zoom level to allow when the camera would transition to the specified bounds.
     * @returns {CameraOptions | void} If map is able to fit to provided bounds, returns `CameraOptions` with
     *      `center`, `zoom`, and `bearing`. If map is unable to fit, method will warn and return undefined.
     * @example
     * const bbox = [[-79, 43], [-73, 45]];
     * const newCameraTransform = map.cameraForBounds(bbox, {
     *     padding: {top: 10, bottom:25, left: 15, right: 5}
     * });
     */
    cameraForBounds(bounds: LngLatBoundsLike, options?: CameraOptions): void | CameraOptions & AnimationOptions {
        bounds = LngLatBounds.convert(bounds);
        const bearing = options && options.bearing || 0;
        return this._cameraForBoxAndBearing(bounds.getNorthWest(), bounds.getSouthEast(), bearing, options);
    }

    _extendCameraOptions(options?: CameraOptions) {
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

    /**
     * Calculate the center of these two points in the viewport and use
     * the highest zoom level up to and including `Map#getMaxZoom()` that fits
     * the points in the viewport at the specified bearing.
     * @memberof Map#
     * @param {LngLatLike} p0 First point
     * @param {LngLatLike} p1 Second point
     * @param {number} bearing Desired map bearing at end of animation, in degrees
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
     * var newCameraTransform = map._cameraForBoxAndBearing(p0, p1, bearing, {
     *   padding: {top: 10, bottom:25, left: 15, right: 5}
     * });
     */
    _cameraForBoxAndBearing(p0: LngLatLike, p1: LngLatLike, bearing: number, options?: CameraOptions): void | CameraOptions & AnimationOptions {
        const eOptions = this._extendCameraOptions(options);
        const tr = this.transform;
        const edgePadding = tr.padding;

        // We want to calculate the upper right and lower left of the box defined by p0 and p1
        // in a coordinate system rotate to match the destination bearing.
        const p0world = tr.project(LngLat.convert(p0));
        const p1world = tr.project(LngLat.convert(p1));
        const p0rotated = p0world.rotate(-degToRad(bearing));
        const p1rotated = p1world.rotate(-degToRad(bearing));

        const upperRight = new Point(Math.max(p0rotated.x, p1rotated.x), Math.max(p0rotated.y, p1rotated.y));
        const lowerLeft = new Point(Math.min(p0rotated.x, p1rotated.x), Math.min(p0rotated.y, p1rotated.y));

        // Calculate zoom: consider the original bbox and padding.
        const size = upperRight.sub(lowerLeft);
        const scaleX = (tr.width - (edgePadding.left + edgePadding.right + eOptions.padding.left + eOptions.padding.right)) / size.x;
        const scaleY = (tr.height - (edgePadding.top + edgePadding.bottom + eOptions.padding.top + eOptions.padding.bottom)) / size.y;

        if (scaleY < 0 || scaleX < 0) {
            warnOnce(
                'Map cannot fit within canvas with the given bounds, padding, and/or offset.'
            );
            return;
        }
        const zoom = Math.min(tr.scaleZoom(tr.scale * Math.min(scaleX, scaleY)), eOptions.maxZoom);

        // Calculate center: apply the zoom, the configured offset, as well as offset that exists as a result of padding.
        const offset = (typeof eOptions.offset.x === 'number') ? new Point(eOptions.offset.x, eOptions.offset.y) : Point.convert(eOptions.offset);
        const paddingOffsetX = (eOptions.padding.left - eOptions.padding.right) / 2;
        const paddingOffsetY = (eOptions.padding.top - eOptions.padding.bottom) / 2;
        const paddingOffset = new Point(paddingOffsetX, paddingOffsetY);
        const rotatedPaddingOffset = paddingOffset.rotate(bearing * Math.PI / 180);
        const offsetAtInitialZoom = offset.add(rotatedPaddingOffset);
        const offsetAtFinalZoom = offsetAtInitialZoom.mult(tr.scale / tr.zoomScale(zoom));

        const center =  tr.unproject(p0world.add(p1world).div(2).sub(offsetAtFinalZoom));

        return {
            center,
            zoom,
            bearing
        };
    }

    /**
     * Finds the best camera fit for two given viewport point coordinates.
     * The method will iteratively ray march towards the target and stops
     * when any of the given input points collides with the view frustum.
     * @memberof Map#
     * @param {LngLatLike} p0 First point
     * @param {LngLatLike} p1 Second point
     * @param {number} minAltitude Optional min altitude in meters
     * @param {number} maxAltitude Optional max altitude in meters
     * @param {CameraOptions | null} options
     * @param {number | PaddingOptions} [options.padding] The amount of padding in pixels to add to the given bounds.
     * @returns {CameraOptions | void} If map is able to fit to provided bounds, returns `CameraOptions` with
     *      `center`, `zoom`, `bearing` and `pitch`. If map is unable to fit, method will warn and return undefined.
     * @private
     */
    _cameraForBox(p0: LngLatLike, p1: LngLatLike, minAltitude?: number, maxAltitude?: number, options?: CameraOptions): void | CameraOptions & AnimationOptions {
        const eOptions = this._extendCameraOptions(options);

        minAltitude = minAltitude || 0;
        maxAltitude = maxAltitude || 0;

        p0 = LngLat.convert(p0);
        p1 = LngLat.convert(p1);

        const tr = this.transform.clone();
        tr.padding = eOptions.padding;

        const camera = this.getFreeCameraOptions();
        const focus = new LngLat((p0.lng + p1.lng) * 0.5, (p0.lat + p1.lat) * 0.5);
        const focusAltitude = (minAltitude + maxAltitude) * 0.5;

        if (tr._camera.position[2] < mercatorZfromAltitude(focusAltitude, focus.lat)) {
            warnOnce('Map cannot fit within canvas with the given bounds, padding, and/or offset.');
            return;
        }

        camera.lookAtPoint(focus);

        tr.setFreeCameraOptions(camera);

        const coord0 = MercatorCoordinate.fromLngLat(p0);
        const coord1 = MercatorCoordinate.fromLngLat(p1);

        const toVec3 = (p: MercatorCoordinate): vec3 => [p.x, p.y, p.z];

        const centerIntersectionPoint = tr.pointRayIntersection(tr.centerPoint, focusAltitude);
        const centerIntersectionCoord = toVec3(tr.rayIntersectionCoordinate(centerIntersectionPoint));
        const centerMercatorRay = tr.screenPointToMercatorRay(tr.centerPoint);

        const maxMarchingSteps = 10;

        let steps = 0;
        let halfDistanceToGround;
        do {
            const z = Math.floor(tr.zoom);
            const z2 = 1 << z;

            const minX = Math.min(z2 * coord0.x, z2 * coord1.x);
            const minY = Math.min(z2 * coord0.y, z2 * coord1.y);
            const maxX = Math.max(z2 * coord0.x, z2 * coord1.x);
            const maxY = Math.max(z2 * coord0.y, z2 * coord1.y);

            const aabb = new Aabb([minX, minY, minAltitude], [maxX, maxY, maxAltitude]);

            const frustum = Frustum.fromInvProjectionMatrix(tr.invProjMatrix, tr.worldSize, z);

            // Stop marching when frustum intersection
            // reports any aabb point not fully inside
            if (aabb.intersects(frustum) !== 2) {
                // Went too far, step one iteration back
                if (halfDistanceToGround) {
                    tr._camera.position = vec3.scaleAndAdd([], tr._camera.position, centerMercatorRay.dir, -halfDistanceToGround);
                    tr._updateStateFromCamera();
                }
                break;
            }

            const cameraPositionToGround = vec3.sub([], tr._camera.position, centerIntersectionCoord);
            halfDistanceToGround = 0.5 * vec3.length(cameraPositionToGround);

            // March the camera position forward by half the distance to the ground
            tr._camera.position = vec3.scaleAndAdd([], tr._camera.position, centerMercatorRay.dir, halfDistanceToGround);
            try {
                tr._updateStateFromCamera();
            } catch (e) {
                warnOnce('Map cannot fit within canvas with the given bounds, padding, and/or offset.');
                return;
            }
        } while (++steps < maxMarchingSteps);

        return {
            center: tr.center,
            zoom: tr.zoom,
            bearing: tr.bearing,
            pitch: tr.pitch
        };
    }

    /**
     * Pans and zooms the map to contain its visible area within the specified geographical bounds.
     * This function will also reset the map's bearing to 0 if bearing is nonzero.
     * If a padding is set on the map, the bounds are fit to the inset.
     *
     * @memberof Map#
     * @param {LngLatBoundsLike} bounds Center these bounds in the viewport and use the highest
     *      zoom level up to and including `Map#getMaxZoom()` that fits them in the viewport.
     * @param {Object} [options] Options supports all properties from {@link AnimationOptions} and {@link CameraOptions} in addition to the fields below.
     * @param {number | PaddingOptions} [options.padding] The amount of padding in pixels to add to the given bounds.
     * @param {boolean} [options.linear=false] If `true`, the map transitions using
     *     {@link Map#easeTo}. If `false`, the map transitions using {@link Map#flyTo}. See
     *     those functions and {@link AnimationOptions} for information about options available.
     * @param {Function} [options.easing] An easing function for the animated transition. See {@link AnimationOptions}.
     * @param {PointLike} [options.offset=[0, 0]] The center of the given bounds relative to the map's center, measured in pixels.
     * @param {number} [options.maxZoom] The maximum zoom level to allow when the map view transitions to the specified bounds.
     * @param {Object} [eventData] Additional properties to be added to event objects of events triggered by this method.
     * @fires movestart
     * @fires moveend
     * @returns {Map} Returns itself to allow for method chaining.
	 * @example
     * const bbox = [[-79, 43], [-73, 45]];
     * map.fitBounds(bbox, {
     *     padding: {top: 10, bottom:25, left: 15, right: 5}
     * });
     * @see [Example: Fit a map to a bounding box](https://www.mapbox.com/mapbox-gl-js/example/fitbounds/)
     */
    fitBounds(bounds: LngLatBoundsLike, options?: AnimationOptions & CameraOptions, eventData?: Object) {
        return this._fitInternal(
            this.cameraForBounds(bounds, options),
            options,
            eventData);
    }

    _raycastElevationBox(point0: Point, point1: Point): ?ElevationBoxRaycast {
        const elevation = this.transform.elevation;

        if (!elevation) return;

        const point2 = new Point(point0.x, point1.y);
        const point3 = new Point(point1.x, point0.y);

        const r0 = elevation.pointCoordinate(point0);
        if (!r0) return;
        const r1 = elevation.pointCoordinate(point1);
        if (!r1) return;
        const r2 = elevation.pointCoordinate(point2);
        if (!r2) return;
        const r3 = elevation.pointCoordinate(point3);
        if (!r3) return;

        const m0 = new MercatorCoordinate(r0[0], r0[1]).toLngLat();
        const m1 = new MercatorCoordinate(r1[0], r1[1]).toLngLat();
        const m2 = new MercatorCoordinate(r2[0], r2[1]).toLngLat();
        const m3 = new MercatorCoordinate(r3[0], r3[1]).toLngLat();

        const minLng = Math.min(m0.lng, Math.min(m1.lng, Math.min(m2.lng, m3.lng)));
        const minLat = Math.min(m0.lat, Math.min(m1.lat, Math.min(m2.lat, m3.lat)));

        const maxLng = Math.max(m0.lng, Math.max(m1.lng, Math.max(m2.lng, m3.lng)));
        const maxLat = Math.max(m0.lat, Math.max(m1.lat, Math.max(m2.lat, m3.lat)));

        const minAltitude = Math.min(r0[3], Math.min(r1[3], Math.min(r2[3], r3[3])));
        const maxAltitude = Math.max(r0[3], Math.max(r1[3], Math.max(r2[3], r3[3])));

        const minLngLat = new LngLat(minLng, minLat);
        const maxLngLat = new LngLat(maxLng, maxLat);

        return {minLngLat, maxLngLat, minAltitude, maxAltitude};
    }

    /**
     * Pans, rotates and zooms the map to to fit the box made by points p0 and p1
     * once the map is rotated to the specified bearing. To zoom without rotating,
     * pass in the current map bearing.
     *
     * @memberof Map#
     * @param {PointLike} p0 First point on screen, in pixel coordinates.
     * @param {PointLike} p1 Second point on screen, in pixel coordinates.
     * @param {number} bearing Desired map bearing at end of animation, in degrees. This value is ignored if the map has non-zero pitch.
     * @param {CameraOptions | null} options Options object.
     * @param {number | PaddingOptions} [options.padding] The amount of padding in pixels to add to the given bounds.
     * @param {boolean} [options.linear=false] If `true`, the map transitions using
     *     {@link Map#easeTo}. If `false`, the map transitions using {@link Map#flyTo}. See
     *     those functions and {@link AnimationOptions} for information about options available.
     * @param {Function} [options.easing] An easing function for the animated transition. See {@link AnimationOptions}.
     * @param {PointLike} [options.offset=[0, 0]] The center of the given bounds relative to the map's center, measured in pixels.
     * @param {number} [options.maxZoom] The maximum zoom level to allow when the map view transitions to the specified bounds.
     * @param {Object | null} eventData Additional properties to be added to event objects of events triggered by this method.
     * @fires movestart
     * @fires moveend
     * @returns {Map} Returns itself to allow for method chaining.
	 * @example
     * const p0 = [220, 400];
     * const p1 = [500, 900];
     * map.fitScreenCoordinates(p0, p1, map.getBearing(), {
     *     padding: {top: 10, bottom:25, left: 15, right: 5}
     * });
     * @see Used by {@link BoxZoomHandler}
     */
    fitScreenCoordinates(p0: PointLike, p1: PointLike, bearing: number, options?: AnimationOptions & CameraOptions, eventData?: Object) {
        let lngLat0, lngLat1, minAltitude, maxAltitude;
        const point0 = Point.convert(p0);
        const point1 = Point.convert(p1);

        const raycast = this._raycastElevationBox(point0, point1);

        if (!raycast) {
            if (this.transform.isHorizonVisibleForPoints(point0, point1)) {
                return this;
            }

            lngLat0 = this.transform.pointLocation(point0);
            lngLat1 = this.transform.pointLocation(point1);
        } else {
            lngLat0 = raycast.minLngLat;
            lngLat1 = raycast.maxLngLat;
            minAltitude = raycast.minAltitude;
            maxAltitude = raycast.maxAltitude;
        }

        if (this.transform.pitch === 0) {
            return this._fitInternal(
                this._cameraForBoxAndBearing(
                    this.transform.pointLocation(Point.convert(p0)),
                    this.transform.pointLocation(Point.convert(p1)),
                    bearing,
                    options),
                options,
                eventData);
        }

        return this._fitInternal(
            this._cameraForBox(
                lngLat0,
                lngLat1,
                minAltitude,
                maxAltitude,
                options),
            options, eventData);
    }

    _fitInternal(calculatedOptions?: CameraOptions & AnimationOptions, options?: AnimationOptions & CameraOptions, eventData?: Object) {
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

        if (options.padding != null && !tr.isPaddingEqual(options.padding)) {
            tr.padding = options.padding;
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
     * @memberof Map#
     * @param {FreeCameraOptions} options `FreeCameraOptions` object.
     * @param {Object | null} eventData Additional properties to be added to event objects of events triggered by this method.
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
    setFreeCameraOptions(options: FreeCameraOptions, eventData?: Object) {
        this.stop();

        const tr = this.transform;
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
     * @param {CameraOptions & AnimationOptions} options Options describing the destination and animation of the transition.
     *            Accepts {@link CameraOptions} and {@link AnimationOptions}.
     * @param {Object | null} eventData Additional properties to be added to event objects of events triggered by this method.
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
    easeTo(options: CameraOptions & AnimationOptions & {easeId?: string}, eventData?: Object) {
        this._stop(false, options.easeId);

        options = extend({
            offset: [0, 0],
            duration: 500,
            easing: defaultEasing
        }, options);

        if (options.animate === false || (!options.essential && browser.prefersReducedMotion)) options.duration = 0;

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
        let pointAtOffset = tr.centerPoint.add(offsetAsPoint);
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

        const currently = {
            moving: this._moving,
            zooming: this._zooming,
            rotating: this._rotating,
            pitching: this._pitching
        };

        this._zooming = this._zooming || (zoom !== startZoom);
        this._rotating = this._rotating || (startBearing !== bearing);
        this._pitching = this._pitching || (pitch !== startPitch);
        this._padding = !tr.isPaddingEqual(padding);

        this._easeId = options.easeId;
        this._prepareEase(eventData, options.noMoveStart, currently);

        this._ease((k) => {
            if (this._zooming) {
                tr.zoom = interpolate(startZoom, zoom, k);
            }
            if (this._rotating) {
                tr.bearing = interpolate(startBearing, bearing, k);
            }
            if (this._pitching) {
                tr.pitch = interpolate(startPitch, pitch, k);
            }
            if (this._padding) {
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

            this._fireMoveEvents(eventData);

        }, (interruptingEaseId?: string) => {
            tr.recenterOnTerrain();
            this._afterEase(eventData, interruptingEaseId);
        }, options);

        return this;
    }

    _prepareEase(eventData?: Object, noMoveStart: boolean, currently: Object = {}) {
        this._moving = true;
        this.transform.cameraElevationReference = "sea";

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
        delete this._easeId;
        this.transform.cameraElevationReference = "ground";

        const wasZooming = this._zooming;
        const wasRotating = this._rotating;
        const wasPitching = this._pitching;
        this._moving = false;
        this._zooming = false;
        this._rotating = false;
        this._pitching = false;
        this._padding = false;

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
    flyTo(options: Object, eventData?: Object) {
        // Fall through to jumpTo if user has set prefers-reduced-motion
        if (!options.essential && browser.prefersReducedMotion) {
            const coercedOptions = (pick(options, ['center', 'zoom', 'bearing', 'pitch', 'around']): CameraOptions);
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
            startPitch = this.getPitch(),
            startPadding = this.getPadding();

        const zoom = 'zoom' in options ? clamp(+options.zoom, tr.minZoom, tr.maxZoom) : startZoom;
        const bearing = 'bearing' in options ? this._normalizeBearing(options.bearing, startBearing) : startBearing;
        const pitch = 'pitch' in options ? +options.pitch : startPitch;
        const padding = 'padding' in options ? options.padding : tr.padding;

        const scale = tr.zoomScale(zoom - startZoom);
        const offsetAsPoint = Point.convert(options.offset);
        let pointAtOffset = tr.centerPoint.add(offsetAsPoint);
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

        this._zooming = true;
        this._rotating = (startBearing !== bearing);
        this._pitching = (pitch !== startPitch);
        this._padding = !tr.isPaddingEqual(padding);

        this._prepareEase(eventData, false);

        this._ease((k) => {
            // s: The distance traveled along the flight path, measured in ρ-screenfuls.
            const s = k * S;
            const scale = 1 / w(s);
            tr.zoom = k === 1 ? zoom : startZoom + tr.scaleZoom(scale);

            if (this._rotating) {
                tr.bearing = interpolate(startBearing, bearing, k);
            }
            if (this._pitching) {
                tr.pitch = interpolate(startPitch, pitch, k);
            }
            if (this._padding) {
                tr.interpolatePadding(startPadding, padding, k);
                // When padding is being applied, Transform#centerPoint is changing continuously,
                // thus we need to recalculate offsetPoint every frame
                pointAtOffset = tr.centerPoint.add(offsetAsPoint);
            }

            const newCenter = k === 1 ? center : tr.unproject(from.add(delta.mult(u(s))).mult(scale));
            tr.setLocationAtPoint(tr.renderWorldCopies ? newCenter.wrap() : newCenter, pointAtOffset);
            tr._updateCenterElevation();

            this._fireMoveEvents(eventData);

        }, () => this._afterEase(eventData), options);

        return this;
    }

    isEasing() {
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
            delete this._easeFrameId;
            delete this._onEaseFrame;
        }

        if (this._onEaseEnd) {
            // The _onEaseEnd function might emit events which trigger new
            // animation, which sets a new _onEaseEnd. Ensure we don't delete
            // it unintentionally.
            const onEaseEnd = this._onEaseEnd;
            delete this._onEaseEnd;
            onEaseEnd.call(this, easeId);
        }
        if (!allowGestures) {
            const handlers = (this: any).handlers;
            if (handlers) handlers.stop(false);
        }
        return this;
    }

    _ease(frame: (_: number) => void,
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
            this._easeFrameId = this._requestRenderFrame(this._renderFrameCallback);
        }
    }

    // Callback for map._requestRenderFrame
    _renderFrameCallback() {
        const t = Math.min((browser.now() - this._easeStart) / this._easeOptions.duration, 1);
        this._onEaseFrame(this._easeOptions.easing(t));
        if (t < 1) {
            this._easeFrameId = this._requestRenderFrame(this._renderFrameCallback);
        } else {
            this.stop();
        }
    }

    // convert bearing so that it's numerically close to the current one so that it interpolates properly
    _normalizeBearing(bearing: number, currentBearing: number) {
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
        if (!tr.renderWorldCopies || tr.lngRange) return;

        const delta = center.lng - tr.center.lng;
        center.lng +=
            delta > 180 ? -360 :
            delta < -180 ? 360 : 0;
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

            camera.on(`${name}start`, () => {
                assert(!inProgress[name], `"${name}start" fired twice without a "${name}end"`);
                inProgress[name] = true;
                assert(inProgress.move);
            });

            camera.on(name, () => {
                assert(inProgress[name]);
                assert(inProgress.move);
            });

            camera.on(`${name}end`, () => {
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
