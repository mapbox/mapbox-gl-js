'use strict';

var util = require('../util/util');
var interpolate = require('../util/interpolate');
var browser = require('../util/browser');
var LngLat = require('../geo/lng_lat');
var LngLatBounds = require('../geo/lng_lat_bounds');
var Point = require('point-geometry');

/**
 * Options common to Map#jumpTo, Map#easeTo, and Map#flyTo, controlling the destination
 * location, zoom level, bearing and pitch. All properties are options; unspecified
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
 * Options common to map movement methods that involve animation, such as Map#panBy and
 * Map#easeTo, controlling the duration of the animation and easing function. All properties
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
     * @fires movestart
     * @fires moveend
     * @returns {Map} `this`
     * @example
     * map.setCenter([-74, 38]);
     */
    setCenter: function(center) {
        this.jumpTo({center: center});
        return this;
    },

    /**
     * Pan by a certain number of pixels
     *
     * @param {Array<number>} offset [x, y]
     * @param {AnimationOptions} [options]
     * @fires movestart
     * @fires moveend
     * @returns {Map} `this`
     */
    panBy: function(offset, options) {
        this.panTo(this.transform.center, util.extend({offset: Point.convert(offset).mult(-1)}, options));
        return this;
    },

    /**
     * Pan to a certain location with easing
     *
     * @param {LngLat} lnglat Location to pan to
     * @param {AnimationOptions} [options]
     * @fires movestart
     * @fires moveend
     * @returns {Map} `this`
     */
    panTo: function(lnglat, options) {
        this.stop();

        lnglat = LngLat.convert(lnglat);

        options = util.extend({
            duration: 500,
            easing: util.ease,
            offset: [0, 0]
        }, options);

        var tr = this.transform,
            offset = Point.convert(options.offset).rotate(-tr.angle),
            from = tr.point,
            to = tr.project(lnglat).sub(offset);

        if (!options.noMoveStart) {
            this.fire('movestart');
        }

        this._ease(function(k) {
            tr.center = tr.unproject(from.add(to.sub(from).mult(k)));
            this.fire('move');
        }, function() {
            this.fire('moveend');
        }, options);

        return this;
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
     * @fires movestart
     * @fires moveend
     * @returns {Map} `this`
     * @example
     * // zoom the map to 5
     * map.setZoom(5);
     */
    setZoom: function(zoom) {
        this.jumpTo({zoom: zoom});
        return this;
    },

    /**
     * Zooms to a certain zoom level with easing.
     *
     * @param {number} zoom
     * @param {AnimationOptions} [options]
     * @fires movestart
     * @fires moveend
     * @returns {Map} `this`
     */
    zoomTo: function(zoom, options) {
        this.stop();

        options = util.extend({
            duration: 500
        }, options);

        options.easing = this._updateEasing(options.duration, zoom, options.easing);

        var tr = this.transform,
            around = tr.center,
            startZoom = tr.zoom;

        if (options.around) {
            around = LngLat.convert(options.around);
        } else if (options.offset) {
            around = tr.pointLocation(tr.centerPoint.add(Point.convert(options.offset)));
        }

        if (options.animate === false) options.duration = 0;

        if (!this.zooming) {
            this.zooming = true;
            this.fire('movestart');
        }

        this._ease(function(k) {
            tr.setZoomAround(interpolate(startZoom, zoom, k), around);
            this.fire('move').fire('zoom');
        }, function() {
            this.ease = null;
            if (options.duration >= 200) {
                this.zooming = false;
                this.fire('moveend');
            }
        }, options);

        if (options.duration < 200) {
            clearTimeout(this._onZoomEnd);
            this._onZoomEnd = setTimeout(function() {
                this.zooming = false;
                this.fire('moveend');
            }.bind(this), 200);
        }

        return this;
    },

    /**
     * Zoom in by 1 level
     *
     * @param {AnimationOptions} [options]
     * @fires movestart
     * @fires moveend
     * @returns {Map} `this`
     */
    zoomIn: function(options) {
        this.zoomTo(this.getZoom() + 1, options);
        return this;
    },

    /**
     * Zoom out by 1 level
     *
     * @param {AnimationOptions} [options]
     * @fires movestart
     * @fires moveend
     * @returns {Map} `this`
     */
    zoomOut: function(options) {
        this.zoomTo(this.getZoom() - 1, options);
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
     * @fires movestart
     * @fires moveend
     * @returns {Map} `this`
     * @example
     * // rotate the map to 90 degrees
     * map.setBearing(90);
     */
    setBearing: function(bearing) {
        this.jumpTo({bearing: bearing});
        return this;
    },

    /**
     * Rotate bearing by a certain number of degrees with easing
     *
     * @param {number} bearing
     * @param {AnimationOptions} [options]
     * @fires movestart
     * @fires moveend
     * @returns {Map} `this`
     */
    rotateTo: function(bearing, options) {
        this.stop();

        options = util.extend({
            duration: 500,
            easing: util.ease
        }, options);

        var tr = this.transform,
            start = this.getBearing(),
            around = tr.center;

        if (options.around) {
            around = LngLat.convert(options.around);
        } else if (options.offset) {
            around = tr.pointLocation(tr.centerPoint.add(Point.convert(options.offset)));
        }

        bearing = this._normalizeBearing(bearing, start);

        this.rotating = true;
        if (!options.noMoveStart) {
            this.fire('movestart');
        }

        this._ease(function(k) {
            tr.setBearingAround(interpolate(start, bearing, k), around);
            this.fire('move').fire('rotate');
        }, function() {
            this.rotating = false;
            this.fire('moveend');
        }, options);

        return this;
    },

    /**
     * Sets map bearing to 0 (north) with easing
     *
     * @param {AnimationOptions} [options]
     * @fires movestart
     * @fires moveend
     * @returns {Map} `this`
     */
    resetNorth: function(options) {
        this.rotateTo(0, util.extend({duration: 1000}, options));
        return this;
    },

    /**
     * Animates map bearing to 0 (north) if it's already close to it.
     *
     * @param {AnimationOptions} [options]
     * @fires movestart
     * @fires moveend
     * @returns {Map} `this`
     */
    snapToNorth: function(options) {
        if (Math.abs(this.getBearing()) < this.options.bearingSnap) {
            return this.resetNorth(options);
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
     * @fires movestart
     * @fires moveend
     * @returns {Map} `this`
     */
    setPitch: function(pitch) {
        this.jumpTo({pitch: pitch});
        return this;
    },


    /**
     * Zoom to contain certain geographical bounds
     *
     * @param {LngLatBounds|Array<Array<number>>} bounds [[minLng, minLat], [maxLng, maxLat]]
     * @param {Object} options
     * @param {number} [options.speed=1.2] How fast animation occurs
     * @param {number} [options.curve=1.42] How much zooming out occurs during animation
     * @param {Function} options.easing
     * @param {number} options.padding how much padding there is around the given bounds on each side in pixels
     * @param {number} options.maxZoom
     * @fires movestart
     * @fires moveend
     * @returns {Map} `this`
     */
    fitBounds: function(bounds, options) {

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
        options.bearing = options.pitch = 0;

        return options.linear ?
            this.easeTo(options) :
            this.flyTo(options);
    },

    /**
     * Change any combination of center, zoom, bearing, and pitch, without
     * a transition. The map will retain the current values for any options
     * not included in `options`.
     *
     * @param {CameraOptions} options map view options
     * @fires movestart
     * @fires moveend
     * @returns {Map} `this`
     */
    jumpTo: function(options) {
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

        this.fire('movestart')
            .fire('move');

        if (zoomChanged) {
            this.fire('zoom');
        }

        if (bearingChanged) {
            this.fire('rotate');
        }

        if (pitchChanged) {
            this.fire('pitch');
        }

        return this.fire('moveend');
    },

    /**
     * Change any combination of center, zoom, bearing, and pitch, with a smooth animation
     * between old and new values. The map will retain the current values for any options
     * not included in `options`.
     *
     * @param {CameraOptions|AnimationOptions} options map view and animation options
     * @fires movestart
     * @fires moveend
     * @returns {Map} `this`
     */
    easeTo: function(options) {
        this.stop();

        options = util.extend({
            offset: [0, 0],
            duration: 500,
            easing: util.ease
        }, options);

        var tr = this.transform,
            offset = Point.convert(options.offset).rotate(-tr.angle),
            from = tr.point,
            startWorldSize = tr.worldSize,
            startZoom = this.getZoom(),
            startBearing = this.getBearing(),
            startPitch = this.getPitch(),

            zoom = 'zoom' in options ? +options.zoom : startZoom,
            bearing = 'bearing' in options ? this._normalizeBearing(options.bearing, startBearing) : startBearing,
            pitch = 'pitch' in options ? +options.pitch : startPitch,

            scale = tr.zoomScale(zoom - startZoom),
            to = 'center' in options ? tr.project(LngLat.convert(options.center)).sub(offset.div(scale)) : from,
            around = 'center' in options ? null : LngLat.convert(options.around);

        if (zoom !== startZoom) {
            this.zooming = true;
        }
        if (startBearing !== bearing) {
            this.rotating = true;
        }

        if (pitch !== startPitch) {
            this.pitching = true;
        }

        if (this.zooming && !around) {
            around = tr.pointLocation(tr.centerPoint.add(to.sub(from).div(1 - 1 / scale)));
        }

        this.fire('movestart');

        this._ease(function (k) {
            if (this.zooming && around) {
                tr.setZoomAround(interpolate(startZoom, zoom, k), around);
            } else {
                if (this.zooming) tr.zoom = interpolate(startZoom, zoom, k);
                tr.center = tr.unproject(from.add(to.sub(from).mult(k)), startWorldSize);
            }

            if (this.rotating) {
                tr.bearing = interpolate(startBearing, bearing, k);
            }

            if (this.pitching) {
                tr.pitch = interpolate(startPitch, pitch, k);
            }

            this.fire('move');
            if (this.zooming) {
                this.fire('zoom');
            }
            if (this.rotating) {
                this.fire('rotate');
            }
            if (this.pitching) {
                this.fire('pitch');
            }
        }, function() {
            this.zooming = false;
            this.rotating = false;
            this.pitching = false;
            this.fire('moveend');
        }, options);

        return this;
    },

    /**
     * Flying animation to a specified location/zoom/bearing with automatic curve
     *
     * @param {CameraOptions} options map view options
     * @param {number} [options.speed=1.2] How fast animation occurs
     * @param {number} [options.curve=1.42] How much zooming out occurs during animation
     * @param {Function} [options.easing]
     * @fires movestart
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
    flyTo: function(options) {
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

        var scale = tr.zoomScale(zoom - startZoom),
            from = tr.point,
            to = tr.project(center).sub(offset.div(scale));

        var startWorldSize = tr.worldSize,
            rho = options.curve,
            V = options.speed,

            w0 = Math.max(tr.width, tr.height),
            w1 = w0 / scale,
            u1 = to.sub(from).mag(),
            rho2 = rho * rho;

        function r(i) {
            var b = (w1 * w1 - w0 * w0 + (i ? -1 : 1) * rho2 * rho2 * u1 * u1) / (2 * (i ? w1 : w0) * rho2 * u1);
            return Math.log(Math.sqrt(b * b + 1) - b);
        }

        function sinh(n) { return (Math.exp(n) - Math.exp(-n)) / 2; }
        function cosh(n) { return (Math.exp(n) + Math.exp(-n)) / 2; }
        function tanh(n) { return sinh(n) / cosh(n); }

        var r0 = r(0),
            w = function (s) { return (cosh(r0) / cosh(r0 + rho * s)); },
            u = function (s) { return w0 * ((cosh(r0) * tanh(r0 + rho * s) - sinh(r0)) / rho2) / u1; },
            S = (r(1) - r0) / rho;

        if (Math.abs(u1) < 0.000001) {
            if (Math.abs(w0 - w1) < 0.000001) return this;

            var k = w1 < w0 ? -1 : 1;
            S = Math.abs(Math.log(w1 / w0)) / rho;

            u = function() { return 0; };
            w = function(s) { return Math.exp(k * rho * s); };
        }

        options.duration = 1000 * S / V;

        this.zooming = true;
        if (startBearing !== bearing) this.rotating = true;
        if (startPitch !== pitch) this.pitching = true;

        this.fire('movestart');

        this._ease(function (k) {
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

            this.fire('move').fire('zoom');
            if (this.rotating) {
                this.fire('rotate');
            }
            if (this.pitching) {
                this.fire('pitch');
            }
        }, function() {
            this.zooming = false;
            this.rotating = false;
            this.pitching = false;
            this.fire('moveend');
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
