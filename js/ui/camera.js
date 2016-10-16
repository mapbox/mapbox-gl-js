'use strict';

var util = require('../util/util');
var interpolate = require('../util/interpolate');
var browser = require('../util/browser');
var LngLat = require('../geo/lng_lat');
var LngLatBounds = require('../geo/lng_lat_bounds');
var Point = require('point-geometry');

/**
 * Options common to {@link Map#jumpTo}, {@link Map#easeTo}, and {@link Map#flyTo},
 * controlling the destination's location, zoom level, bearing, and pitch.
 * All properties are optional. Unspecified
 * options will default to the map's current value for that property.
 *
 * @typedef {Object} CameraOptions
 * @property {LngLatLike} center The destination's center.
 * @property {number} zoom The destination's zoom level.
 * @property {number} bearing The destination's bearing (rotation), measured in degrees counter-clockwise from north.
 * @property {number} pitch The destination's pitch (tilt), measured in degrees.
 * @property {LngLatLike} around If a `zoom` is specified, `around` determines the zoom center (defaults to the center of the map).
 */

/**
 * Options common to map movement methods that involve animation, such as {@link Map#panBy} and
 * {@link Map#easeTo}, controlling the duration and easing function of the animation. All properties
 * are optional.
 *
 * @typedef {Object} AnimationOptions
 * @property {number} duration The animation's duration, measured in milliseconds.
 * @property {Function} easing The animation's easing function.
 * @property {PointLike} offset `x` and `y` coordinates representing the animation's origin of movement relative to the map's center.
 * @property {boolean} animate If `false`, no animation will occur.
 */

var Camera = module.exports = function() {};

util.extend(Camera.prototype, /** @lends Map.prototype */{
    /**
     * Returns the map's geographical centerpoint.
     *
     * @returns {LngLat} The map's geographical centerpoint.
     */
    getCenter: function() { return this.transform.center; },

    /**
     * Sets the map's geographical centerpoint. Equivalent to `jumpTo({center: center})`.
     *
     * @param {LngLatLike} center The centerpoint to set.
     * @param {Object} [eventData] Data to propagate to any event listeners.
     * @fires movestart
     * @fires moveend
     * @returns {Map} `this`
     * @example
     * map.setCenter([-74, 38]);
     * @see [Move symbol with the keyboard](https://www.mapbox.com/mapbox-gl-js/example/rotating-controllable-marker/)
     */
    setCenter: function(center, eventData) {
        this.jumpTo({center: center}, eventData);
        return this;
    },

    /**
     * Pans the map by the specified offest.
     *
     * @param {Array<number>} offset `x` and `y` coordinates by which to pan the map.
     * @param {AnimationOptions} [options]
     * @param {Object} [eventData] Data to propagate to any event listeners.
     * @fires movestart
     * @fires moveend
     * @returns {Map} `this`
     * @see [Navigate the map with game-like controls](https://www.mapbox.com/mapbox-gl-js/example/game-controls/)
     */
    panBy: function(offset, options, eventData) {
        this.panTo(this.transform.center,
            util.extend({offset: Point.convert(offset).mult(-1)}, options), eventData);
        return this;
    },

    /**
     * Pans the map to the specified location, with an animated transition.
     *
     * @param {LngLatLike} lnglat The location to pan the map to.
     * @param {AnimationOptions} [options]
     * @param {Object} [eventData] Data to propagate to any event listeners.
     * @fires movestart
     * @fires moveend
     * @returns {Map} `this`
     */
    panTo: function(lnglat, options, eventData) {
        return this.easeTo(util.extend({
            center: lnglat
        }, options), eventData);
    },


    /**
     * Returns the map's current zoom level.
     *
     * @returns {number} The map's current zoom level.
     */
    getZoom: function() { return this.transform.zoom; },

    /**
     * Sets the map's zoom level. Equivalent to `jumpTo({zoom: zoom})`.
     *
     * @param {number} zoom The zoom level to set (0-20).
     * @param {Object} [eventData] Data to propagate to any event listeners.
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
    setZoom: function(zoom, eventData) {
        this.jumpTo({zoom: zoom}, eventData);
        return this;
    },

    /**
     * Zooms the map to the specified zoom level, with an animated transition.
     *
     * @param {number} zoom The zoom level to transition to.
     * @param {AnimationOptions} [options]
     * @param {Object} [eventData] Data to propagate to any event listeners.
     * @fires movestart
     * @fires zoomstart
     * @fires move
     * @fires zoom
     * @fires moveend
     * @fires zoomend
     * @returns {Map} `this`
     */
    zoomTo: function(zoom, options, eventData) {
        return this.easeTo(util.extend({
            zoom: zoom
        }, options), eventData);
    },

    /**
     * Increases the map's zoom level by 1.
     *
     * @param {AnimationOptions} [options]
     * @param {Object} [eventData] Data to propagate to any event listeners.
     * @fires movestart
     * @fires zoomstart
     * @fires move
     * @fires zoom
     * @fires moveend
     * @fires zoomend
     * @returns {Map} `this`
     */
    zoomIn: function(options, eventData) {
        this.zoomTo(this.getZoom() + 1, options, eventData);
        return this;
    },

    /**
     * Decreases the map's zoom level by 1.
     *
     * @param {AnimationOptions} [options]
     * @param {Object} [eventData] Data to propagate to any event listeners.
     * @fires movestart
     * @fires zoomstart
     * @fires move
     * @fires zoom
     * @fires moveend
     * @fires zoomend
     * @returns {Map} `this`
     */
    zoomOut: function(options, eventData) {
        this.zoomTo(this.getZoom() - 1, options, eventData);
        return this;
    },


    /**
     * Returns the map's current bearing (rotation).
     *
     * @returns {number} The map's current bearing, measured in degrees counter-clockwise from north.
     * @see [Navigate the map with game-like controls](https://www.mapbox.com/mapbox-gl-js/example/game-controls/)
     */
    getBearing: function() { return this.transform.bearing; },

    /**
     * Sets the maps' bearing (rotation). Equivalent to `jumpTo({bearing: bearing})`.
     *
     * @param {number} bearing The bearing to set, measured in degrees counter-clockwise from north.
     * @param {Object} [eventData] Data to propagate to any event listeners.
     * @fires movestart
     * @fires moveend
     * @returns {Map} `this`
     * @example
     * // rotate the map to 90 degrees
     * map.setBearing(90);
     */
    setBearing: function(bearing, eventData) {
        this.jumpTo({bearing: bearing}, eventData);
        return this;
    },

    /**
     * Rotates the map to the specified bearing, with an animated transition.
     *
     * @param {number} bearing The bearing to rotate the map to, measured in degrees counter-clockwise from north.
     * @param {AnimationOptions} [options]
     * @param {Object} [eventData] Data to propagate to any event listeners.
     * @fires movestart
     * @fires moveend
     * @returns {Map} `this`
     */
    rotateTo: function(bearing, options, eventData) {
        return this.easeTo(util.extend({
            bearing: bearing
        }, options), eventData);
    },

    /**
     * Rotates the map to a bearing of 0 (due north), with an animated transition.
     *
     * @param {AnimationOptions} [options]
     * @param {Object} [eventData] Data to propagate to any event listeners.
     * @fires movestart
     * @fires moveend
     * @returns {Map} `this`
     */
    resetNorth: function(options, eventData) {
        this.rotateTo(0, util.extend({duration: 1000}, options), eventData);
        return this;
    },

    /**
     * Snaps the map's bearing to 0 (due north), if the current bearing is close enough to it (i.e. within the `bearingSnap` threshold).
     *
     * @param {AnimationOptions} [options]
     * @param {Object} [eventData] Data to propagate to any event listeners.
     * @fires movestart
     * @fires moveend
     * @returns {Map} `this`
     */
    snapToNorth: function(options, eventData) {
        if (Math.abs(this.getBearing()) < this._bearingSnap) {
            return this.resetNorth(options, eventData);
        }
        return this;
    },

    /**
     * Returns the map's current pitch (tilt).
     *
     * @returns {number} The map's current pitch, measured in degrees away from the plane of the screen.
     */
    getPitch: function() { return this.transform.pitch; },

    /**
     * Sets the map's pitch (tilt). Equivalent to `jumpTo({pitch: pitch})`.
     *
     * @param {number} pitch The pitch to set, measured in degrees away from the plane of the screen (0-60).
     * @param {Object} [eventData] Data to propagate to any event listeners.
     * @fires movestart
     * @fires moveend
     * @returns {Map} `this`
     */
    setPitch: function(pitch, eventData) {
        this.jumpTo({pitch: pitch}, eventData);
        return this;
    },


    /**
     * Pans and zooms the map to contain its visible area within the specified geographical bounds.
     *
     * @param {LngLatBoundsLike} bounds The bounds to fit the visible area into.
     * @param {Object} [options]
     * @param {boolean} [options.linear=false] If `true`, the map transitions using
     *     {@link Map#easeTo}. If `false`, the map transitions using {@link Map#flyTo}. See
     *     {@link Map#flyTo} for information about the options specific to that animated transition.
     * @param {Function} [options.easing] An easing function for the animated transition.
     * @param {number} [options.padding=0] The amount of padding, in pixels, to allow around the specified bounds.
     * @param {PointLike} [options.offset=[0, 0]] The center of the given bounds relative to the map's center, measured in pixels.
     * @param {number} [options.maxZoom] The maximum zoom level to allow when the map view transitions to the specified bounds.
     * @param {Object} [eventData] Data to propagate to any event listeners.
     * @fires movestart
     * @fires moveend
     * @returns {Map} `this`
     * @see [Fit a map to a bounding box](https://www.mapbox.com/mapbox-gl-js/example/fitbounds/)
     */
    fitBounds: function(bounds, options, eventData) {

        options = util.extend({
            padding: 0,
            offset: [0, 0],
            maxZoom: Infinity
        }, options);

        bounds = LngLatBounds.convert(bounds);

        var offset = Point.convert(options.offset),
            tr = this.transform,
            nw = tr.project(bounds.getNorthWest()),
            se = tr.project(bounds.getSouthEast()),
            size = se.sub(nw),
            scaleX = (tr.width - options.padding * 2 - Math.abs(offset.x) * 2) / size.x,
            scaleY = (tr.height - options.padding * 2 - Math.abs(offset.y) * 2) / size.y;

        options.center = tr.unproject(nw.add(se).div(2));
        options.zoom = Math.min(tr.scaleZoom(tr.scale * Math.min(scaleX, scaleY)), options.maxZoom);
        options.bearing = 0;

        return options.linear ?
            this.easeTo(options, eventData) :
            this.flyTo(options, eventData);
    },

    /**
     * Changes any combination of center, zoom, bearing, and pitch, without
     * an animated transition. The map will retain its current values for any
     * details not specified in `options`.
     *
     * @param {CameraOptions} options
     * @param {Object} [eventData] Data to propagate to any event listeners.
     * @fires movestart
     * @fires zoomstart
     * @fires move
     * @fires zoom
     * @fires rotate
     * @fires pitch
     * @fires zoomend
     * @fires moveend
     * @returns {Map} `this`
     */
    jumpTo: function(options, eventData) {
        this.stop();

        var tr = this.transform,
            zoomChanged = false,
            bearingChanged = false,
            pitchChanged = false;

        if ('zoom' in options && tr.zoom !== +options.zoom) {
            zoomChanged = true;
            tr.zoom = +options.zoom;
        }

        if ('center' in options) {
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
            this.fire('pitch', eventData);
        }

        return this.fire('moveend', eventData);
    },

    /**
     * Changes any combination of center, zoom, bearing, and pitch, with an animated transition
     * between old and new values. The map will retain its current values for any
     * details not specified in `options`.
     *
     * @param {CameraOptions|AnimationOptions} options Options describing the destination and animation of the transition.
     * @param {Object} [eventData] Data to propagate to any event listeners.
     * @fires movestart
     * @fires zoomstart
     * @fires move
     * @fires zoom
     * @fires rotate
     * @fires pitch
     * @fires zoomend
     * @fires moveend
     * @returns {Map} `this`
     * @see [Navigate the map with game-like controls](https://www.mapbox.com/mapbox-gl-js/example/game-controls/)
     */
    easeTo: function(options, eventData) {
        this.stop();

        options = util.extend({
            offset: [0, 0],
            duration: 500,
            easing: util.ease
        }, options);

        var tr = this.transform,
            offset = Point.convert(options.offset),
            startZoom = this.getZoom(),
            startBearing = this.getBearing(),
            startPitch = this.getPitch(),

            zoom = 'zoom' in options ? +options.zoom : startZoom,
            bearing = 'bearing' in options ? this._normalizeBearing(options.bearing, startBearing) : startBearing,
            pitch = 'pitch' in options ? +options.pitch : startPitch,

            toLngLat,
            toPoint;

        if ('center' in options) {
            toLngLat = LngLat.convert(options.center);
            toPoint = tr.centerPoint.add(offset);
        } else if ('around' in options) {
            toLngLat = LngLat.convert(options.around);
            toPoint = tr.locationPoint(toLngLat);
        } else {
            toPoint = tr.centerPoint.add(offset);
            toLngLat = tr.pointLocation(toPoint);
        }

        var fromPoint = tr.locationPoint(toLngLat);

        if (options.animate === false) options.duration = 0;

        this.zooming = (zoom !== startZoom);
        this.rotating = (startBearing !== bearing);
        this.pitching = (pitch !== startPitch);

        if (options.smoothEasing && options.duration !== 0) {
            options.easing = this._smoothOutEasing(options.duration);
        }

        if (!options.noMoveStart) {
            this.fire('movestart', eventData);
        }
        if (this.zooming) {
            this.fire('zoomstart', eventData);
        }

        clearTimeout(this._onEaseEnd);

        this._ease(function (k) {
            if (this.zooming) {
                tr.zoom = interpolate(startZoom, zoom, k);
            }

            if (this.rotating) {
                tr.bearing = interpolate(startBearing, bearing, k);
            }

            if (this.pitching) {
                tr.pitch = interpolate(startPitch, pitch, k);
            }

            tr.setLocationAtPoint(toLngLat, fromPoint.add(toPoint.sub(fromPoint)._mult(k)));

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
        }, function() {
            if (options.delayEndEvents) {
                this._onEaseEnd = setTimeout(this._easeToEnd.bind(this, eventData), options.delayEndEvents);
            } else {
                this._easeToEnd(eventData);
            }
        }.bind(this), options);

        return this;
    },

    _easeToEnd: function(eventData) {
        var wasZooming = this.zooming;
        this.zooming = false;
        this.rotating = false;
        this.pitching = false;

        if (wasZooming) {
            this.fire('zoomend', eventData);
        }
        this.fire('moveend', eventData);

    },

    /**
     * Changes any combination of center, zoom, bearing, and pitch, animating the transition along a curve that
     * evokes flight. The animation seamlessly incorporates zooming and panning to help
     * the user maintain her bearings even after traversing a great distance.
     *
     * @param {Object} options Options describing the destination and animation of the transition.
     *     Accepts [CameraOptions](#CameraOptions), [AnimationOptions](#AnimationOptions),
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
     * @param {Function} [options.easing] An easing function for the animated transition.
     * @param {Object} [eventData] Data to propagate to any event listeners.
     * @fires movestart
     * @fires zoomstart
     * @fires move
     * @fires zoom
     * @fires rotate
     * @fires pitch
     * @fires zoomend
     * @fires moveend
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
     *   easing: function(t) {
     *     return t;
     *   }
     * });
     * @see [Fly to a location](https://www.mapbox.com/mapbox-gl-js/example/flyto/)
     * @see [Slowly fly to a location](https://www.mapbox.com/mapbox-gl-js/example/flyto-options/)
     * @see [Fly to a location based on scroll position](https://www.mapbox.com/mapbox-gl-js/example/scroll-fly-to/)
     */
    flyTo: function(options, eventData) {
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

        var tr = this.transform,
            offset = Point.convert(options.offset),
            startZoom = this.getZoom(),
            startBearing = this.getBearing(),
            startPitch = this.getPitch();

        var center = 'center' in options ? LngLat.convert(options.center) : this.getCenter();
        var zoom = 'zoom' in options ?  +options.zoom : startZoom;
        var bearing = 'bearing' in options ? this._normalizeBearing(options.bearing, startBearing) : startBearing;
        var pitch = 'pitch' in options ? +options.pitch : startPitch;

        // If a path crossing the antimeridian would be shorter, extend the final coordinate so that
        // interpolating between the two endpoints will cross it.
        if (Math.abs(tr.center.lng) + Math.abs(center.lng) > 180) {
            if (tr.center.lng > 0 && center.lng < 0) {
                center.lng += 360;
            } else if (tr.center.lng < 0 && center.lng > 0) {
                center.lng -= 360;
            }
        }

        var scale = tr.zoomScale(zoom - startZoom),
            from = tr.point,
            to = 'center' in options ? tr.project(center).sub(offset.div(scale)) : from;

        var startWorldSize = tr.worldSize,
            rho = options.curve,

            // w₀: Initial visible span, measured in pixels at the initial scale.
            w0 = Math.max(tr.width, tr.height),
            // w₁: Final visible span, measured in pixels with respect to the initial scale.
            w1 = w0 / scale,
            // Length of the flight path as projected onto the ground plane, measured in pixels from
            // the world image origin at the initial scale.
            u1 = to.sub(from).mag();

        if ('minZoom' in options) {
            var minZoom = util.clamp(Math.min(options.minZoom, startZoom, zoom), tr.minZoom, tr.maxZoom);
            // w<sub>m</sub>: Maximum visible span, measured in pixels with respect to the initial
            // scale.
            var wMax = w0 / tr.zoomScale(minZoom - startZoom);
            rho = Math.sqrt(wMax / u1 * 2);
        }

        // ρ²
        var rho2 = rho * rho;

        /**
         * rᵢ: Returns the zoom-out factor at one end of the animation.
         *
         * @param i 0 for the ascent or 1 for the descent.
         * @private
         */
        function r(i) {
            var b = (w1 * w1 - w0 * w0 + (i ? -1 : 1) * rho2 * rho2 * u1 * u1) / (2 * (i ? w1 : w0) * rho2 * u1);
            return Math.log(Math.sqrt(b * b + 1) - b);
        }

        function sinh(n) { return (Math.exp(n) - Math.exp(-n)) / 2; }
        function cosh(n) { return (Math.exp(n) + Math.exp(-n)) / 2; }
        function tanh(n) { return sinh(n) / cosh(n); }

        // r₀: Zoom-out factor during ascent.
        var r0 = r(0),
            /**
             * w(s): Returns the visible span on the ground, measured in pixels with respect to the
             * initial scale.
             *
             * Assumes an angular field of view of 2 arctan ½ ≈ 53°.
             * @private
             */
            w = function (s) { return (cosh(r0) / cosh(r0 + rho * s)); },
            /**
             * u(s): Returns the distance along the flight path as projected onto the ground plane,
             * measured in pixels from the world image origin at the initial scale.
             * @private
             */
            u = function (s) { return w0 * ((cosh(r0) * tanh(r0 + rho * s) - sinh(r0)) / rho2) / u1; },
            // S: Total length of the flight path, measured in ρ-screenfuls.
            S = (r(1) - r0) / rho;

        // When u₀ = u₁, the optimal path doesn’t require both ascent and descent.
        if (Math.abs(u1) < 0.000001) {
            // Perform a more or less instantaneous transition if the path is too short.
            if (Math.abs(w0 - w1) < 0.000001) return this.easeTo(options);

            var k = w1 < w0 ? -1 : 1;
            S = Math.abs(Math.log(w1 / w0)) / rho;

            u = function() { return 0; };
            w = function(s) { return Math.exp(k * rho * s); };
        }

        if ('duration' in options) {
            options.duration = +options.duration;
        } else {
            var V = 'screenSpeed' in options ? +options.screenSpeed / rho : +options.speed;
            options.duration = 1000 * S / V;
        }

        this.zooming = true;
        if (startBearing !== bearing) this.rotating = true;
        if (startPitch !== pitch) this.pitching = true;

        this.fire('movestart', eventData);
        this.fire('zoomstart', eventData);

        this._ease(function (k) {
            // s: The distance traveled along the flight path, measured in ρ-screenfuls.
            var s = k * S,
                us = u(s);

            tr.zoom = startZoom + tr.scaleZoom(1 / w(s));
            tr.center = tr.unproject(from.add(to.sub(from).mult(us)), startWorldSize);

            if (this.rotating) {
                tr.bearing = interpolate(startBearing, bearing, k);
            }
            if (this.pitching) {
                tr.pitch = interpolate(startPitch, pitch, k);
            }

            this.fire('move', eventData);
            this.fire('zoom', eventData);
            if (this.rotating) {
                this.fire('rotate', eventData);
            }
            if (this.pitching) {
                this.fire('pitch', eventData);
            }
        }, function() {
            this.zooming = false;
            this.rotating = false;
            this.pitching = false;

            this.fire('zoomend', eventData);
            this.fire('moveend', eventData);
        }, options);

        return this;
    },

    isEasing: function() {
        return !!this._abortFn;
    },

    /**
     * Stops any animated transition underway.
     *
     * @returns {Map} `this`
     */
    stop: function() {
        if (this._abortFn) {
            this._abortFn();
            this._finishEase();
        }
        return this;
    },

    _ease: function(frame, finish, options) {
        this._finishFn = finish;
        this._abortFn = browser.timed(function (t) {
            frame.call(this, options.easing(t));
            if (t === 1) {
                this._finishEase();
            }
        }, options.animate === false ? 0 : options.duration, this);
    },

    _finishEase: function() {
        delete this._abortFn;
        // The finish function might emit events which trigger new eases, which
        // set a new _finishFn. Ensure we don't delete it unintentionally.
        var finish = this._finishFn;
        delete this._finishFn;
        finish.call(this);
    },

    // convert bearing so that it's numerically close to the current one so that it interpolates properly
    _normalizeBearing: function(bearing, currentBearing) {
        bearing = util.wrap(bearing, -180, 180);
        var diff = Math.abs(bearing - currentBearing);
        if (Math.abs(bearing - 360 - currentBearing) < diff) bearing -= 360;
        if (Math.abs(bearing + 360 - currentBearing) < diff) bearing += 360;
        return bearing;
    },

    // only used on mouse-wheel zoom to smooth out animation
    _smoothOutEasing: function(duration) {
        var easing = util.ease;

        if (this._prevEase) {
            var ease = this._prevEase,
                t = (Date.now() - ease.start) / ease.duration,
                speed = ease.easing(t + 0.01) - ease.easing(t),

                // Quick hack to make new bezier that is continuous with last
                x = 0.27 / Math.sqrt(speed * speed + 0.0001) * 0.01,
                y = Math.sqrt(0.27 * 0.27 - x * x);

            easing = util.bezier(x, y, 0.25, 1);
        }

        this._prevEase = {
            start: (new Date()).getTime(),
            duration: duration,
            easing: easing
        };

        return easing;
    }
});

/**
 * Fired whenever the map's pitch (tilt) changes.
 *
 * @event pitch
 * @memberof Map
 * @instance
 * @property {MapEventData} data
 */
