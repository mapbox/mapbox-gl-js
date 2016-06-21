'use strict';

var util = require('../util/util');
var interpolate = require('../util/interpolate');
var browser = require('../util/browser');
var LngLat = require('../geo/lng_lat');
var LngLatBounds = require('../geo/lng_lat_bounds');
var Point = require('point-geometry');

/**
 * Options common to {@link Map#jumpTo}, {@link Map#easeTo}, and {@link Map#flyTo},
 * controlling the destination location, zoom level, bearing and pitch.
 * All properties are options; unspecified
 * options will default to the current value for that property.
 *
 * @typedef {Object} CameraOptions
 * @property {LngLat} center Map center
 * @property {number} zoom Map zoom level
 * @property {number} bearing Map rotation bearing in degrees counter-clockwise from north
 * @property {number} pitch Map angle in degrees at which the camera is looking at the ground
 * @property {LngLat} around If zooming, the zoom center (defaults to map center)
 */

/**
 * Options common to map movement methods that involve animation, such as {@link Map#panBy} and
 * {@link Map#easeTo}, controlling the duration of the animation and easing function. All properties
 * are optional.
 *
 * @typedef {Object} AnimationOptions
 * @property {number} duration Number in milliseconds
 * @property {Function} easing
 * @property {Array} offset point, origin of movement relative to map center
 * @property {boolean} animate When set to false, no animation happens
 */

var Camera = module.exports = function() {};

util.extend(Camera.prototype, /** @lends Map.prototype */{
    /**
     * Get the current view geographical point.
     * @returns {LngLat}
     */
    getCenter: function() { return this.transform.center; },

    /**
     * Sets a map location. Equivalent to `jumpTo({center: center})`.
     *
     * @param {LngLat} center Map center to jump to
     * @param {EventData} [eventData] Data to propagate to any event receivers
     * @fires movestart
     * @fires moveend
     * @returns {Map} `this`
     * @example
     * map.setCenter([-74, 38]);
     */
    setCenter: function(center, eventData) {
        this.jumpTo({center: center}, eventData);
        return this;
    },

    /**
     * Pan by a certain number of pixels
     *
     * @param {Array<number>} offset [x, y]
     * @param {AnimationOptions} [options]
     * @param {EventData} [eventData] Data to propagate to any event receivers
     * @fires movestart
     * @fires moveend
     * @returns {Map} `this`
     */
    panBy: function(offset, options, eventData) {
        this.panTo(this.transform.center,
            util.extend({offset: Point.convert(offset).mult(-1)}, options), eventData);
        return this;
    },

    /**
     * Pan to a certain location with easing
     *
     * @param {LngLat} lnglat Location to pan to
     * @param {AnimationOptions} [options]
     * @param {EventData} [eventData] Data to propagate to any event receivers
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
     * Get the current zoom
     * @returns {number}
     */
    getZoom: function() { return this.transform.zoom; },

    /**
     * Sets a map zoom. Equivalent to `jumpTo({zoom: zoom})`.
     *
     * @param {number} zoom Map zoom level
     * @param {EventData} [eventData] Data to propagate to any event receivers
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
     * Zooms to a certain zoom level with easing.
     *
     * @param {number} zoom
     * @param {AnimationOptions} [options]
     * @param {EventData} [eventData] Data to propagate to any event receivers
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
     * Zoom in by 1 level
     *
     * @param {AnimationOptions} [options]
     * @param {EventData} [eventData] Data to propagate to any event receivers
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
     * Zoom out by 1 level
     *
     * @param {AnimationOptions} [options]
     * @param {EventData} [eventData] Data to propagate to any event receivers
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
     * Get the current bearing in degrees
     * @returns {number}
     */
    getBearing: function() { return this.transform.bearing; },

    /**
     * Sets a map rotation. Equivalent to `jumpTo({bearing: bearing})`.
     *
     * @param {number} bearing Map rotation bearing in degrees counter-clockwise from north
     * @param {EventData} [eventData] Data to propagate to any event receivers
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
     * Rotate bearing by a certain number of degrees with easing
     *
     * @param {number} bearing
     * @param {AnimationOptions} [options]
     * @param {EventData} [eventData] Data to propagate to any event receivers
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
     * Sets map bearing to 0 (north) with easing
     *
     * @param {AnimationOptions} [options]
     * @param {EventData} [eventData] Data to propagate to any event receivers
     * @fires movestart
     * @fires moveend
     * @returns {Map} `this`
     */
    resetNorth: function(options, eventData) {
        this.rotateTo(0, util.extend({duration: 1000}, options), eventData);
        return this;
    },

    /**
     * Animates map bearing to 0 (north) if it's already close to it.
     *
     * @param {AnimationOptions} [options]
     * @param {EventData} [eventData] Data to propagate to any event receivers
     * @fires movestart
     * @fires moveend
     * @returns {Map} `this`
     */
    snapToNorth: function(options, eventData) {
        if (Math.abs(this.getBearing()) < this.options.bearingSnap) {
            return this.resetNorth(options, eventData);
        }
        return this;
    },

    /**
     * Get the current angle in degrees
     * @returns {number}
     */
    getPitch: function() { return this.transform.pitch; },

    /**
     * Sets a map angle. Equivalent to `jumpTo({pitch: pitch})`.
     *
     * @param {number} pitch The angle at which the camera is looking at the ground
     * @param {EventData} [eventData] Data to propagate to any event receivers
     * @fires movestart
     * @fires moveend
     * @returns {Map} `this`
     */
    setPitch: function(pitch, eventData) {
        this.jumpTo({pitch: pitch}, eventData);
        return this;
    },


    /**
     * Zoom to contain certain geographical bounds
     *
     * @param {LngLatBounds|Array<Array<number>>} bounds [[minLng, minLat], [maxLng, maxLat]]
     * @param {Object} options
     * @param {boolean} [options.linear] When true, the map transitions to the new camera using
     *     {@link Map#easeTo}. When false, the map transitions using {@link Map#flyTo}. See
     *     {@link Map#flyTo} for information on options specific to that animation transition.
     * @param {Function} options.easing
     * @param {number} options.padding how much padding there is around the given bounds on each side in pixels
     * @param {Array<number>} options.offset Center of the given bounds relative to map center, in pixels
     * @param {number} options.maxZoom The resulting zoom level will be at most
     *     this value.
     * @param {EventData} [eventData] Data to propagate to any event receivers
     * @fires movestart
     * @fires moveend
     * @returns {Map} `this`
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
     * Change any combination of center, zoom, bearing, and pitch, without
     * a transition. The map will retain the current values for any options
     * not included in `options`.
     *
     * @param {CameraOptions} options map view options
     * @param {EventData} [eventData] Data to propagate to any event receivers
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
     * Change any combination of center, zoom, bearing, and pitch, with a smooth animation
     * between old and new values. The map will retain the current values for any options
     * not included in `options`.
     *
     * @param {CameraOptions|AnimationOptions} options map view and animation options
     * @param {EventData} [eventData] Data to propagate to any event receivers
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
        if (this.zooming) {
            this.fire('zoomend', eventData);
        }
        this.fire('moveend', eventData);

        this.zooming = false;
        this.rotating = false;
        this.pitching = false;
    },

    /**
     * Change any combination of center, zoom, bearing, and pitch, animated along a curve that
     * evokes flight. The transition animation seamlessly incorporates zooming and panning to help
     * the user find his or her bearings even after traversing a great distance.
     *
     * @param {CameraOptions|AnimationOptions} options map view and animation options
     * @param {number} [options.curve=1.42] Relative amount of zooming that takes place along the
     *     flight path. A high value maximizes zooming for an exaggerated animation, while a low
     *     value minimizes zooming for something closer to {@link Map#easeTo}. 1.42 is the average
     *     value selected by participants in the user study in
     *     [van Wijk (2003)](https://www.win.tue.nl/~vanwijk/zoompan.pdf). A value of
     *     `Math.pow(6, 0.25)` would be equivalent to the root mean squared average velocity. A
     *     value of 1 would produce a circular motion.
     * @param {number} [options.minZoom] Zero-based zoom level at the peak of the flight path. If
     *     `options.curve` is specified, this option is ignored.
     * @param {number} [options.speed=1.2] Average speed of the animation. A speed of 1.2 means that
     *     the map appears to move along the flight path by 1.2 times `options.curve` screenfuls every
     *     second. A _screenful_ is the visible span in pixels. It does not correspond to a fixed
     *     physical distance but rather varies by zoom level.
     * @param {number} [options.screenSpeed] Average speed of the animation, measured in screenfuls
     *     per second, assuming a linear timing curve. If `options.speed` is specified, this option
     *     is ignored.
     * @param {Function} [options.easing] Transition timing curve
     * @param {EventData} [eventData] Data to propagate to any event receivers
     * @fires movestart
     * @fires zoomstart
     * @fires move
     * @fires zoom
     * @fires rotate
     * @fires pitch
     * @fires zoomend
     * @fires moveend
     * @returns {this}
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
            this.fire('zoomend', eventData);
            this.fire('moveend', eventData);
            this.zooming = false;
            this.rotating = false;
            this.pitching = false;
        }, options);

        return this;
    },

    isEasing: function() {
        return !!this._abortFn;
    },

    /**
     * Stop current animation
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

    _updateEasing: function(duration, zoom, bezier) {
        var easing;

        if (this.ease) {
            var ease = this.ease,
                t = (Date.now() - ease.start) / ease.duration,
                speed = ease.easing(t + 0.01) - ease.easing(t),

                // Quick hack to make new bezier that is continuous with last
                x = 0.27 / Math.sqrt(speed * speed + 0.0001) * 0.01,
                y = Math.sqrt(0.27 * 0.27 - x * x);

            easing = util.bezier(x, y, 0.25, 1);
        } else {
            easing = bezier ? util.bezier.apply(util, bezier) : util.ease;
        }

        // store information on current easing
        this.ease = {
            start: (new Date()).getTime(),
            to: Math.pow(2, zoom),
            duration: duration,
            easing: easing
        };

        return easing;
    }
});

/**
 * Pitch event. This event is emitted whenever the map's pitch changes.
 *
 * @event pitch
 * @memberof Map
 * @instance
 * @property {EventData} data Original event data
 */
