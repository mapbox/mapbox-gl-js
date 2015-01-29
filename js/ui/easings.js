'use strict';

var util = require('../util/util');
var interpolate = require('../util/interpolate');
var browser = require('../util/browser');
var LatLng = require('../geo/lat_lng');
var LatLngBounds = require('../geo/lat_lng_bounds');
var Point = require('point-geometry');

util.extend(exports, {
    isEasing: function() {
        return !!this._abortFn;
    },

    stop: function() {
        if (this._abortFn) {
            this._abortFn.call(this);
            delete this._abortFn;

            this._finishFn.call(this);
            delete this._finishFn;
        }
        return this;
    },

    _ease: function(frame, finish, options) {
        this._finishFn = finish;
        this._abortFn = browser.timed(function (t) {
            frame.call(this, options.easing(t));
            if (t === 1) {
                delete this._abortFn;
                this._finishFn.call(this);
                delete this._finishFn;
            }
        }, options.animate === false ? 0 : options.duration, this);
    },

    panBy: function(offset, options) {
        this.panTo(this.transform.center, util.extend({offset: Point.convert(offset).mult(-1)}, options));
        return this;
    },

    panTo: function(latlng, options) {
        this.stop();

        latlng = LatLng.convert(latlng);

        options = util.extend({
            duration: 500,
            easing: util.ease,
            offset: [0, 0]
        }, options);

        var tr = this.transform,
            offset = Point.convert(options.offset).rotate(-tr.angle),
            from = tr.point,
            to = tr.project(latlng).sub(offset);

        if (!options.noMoveStart) {
            this.fire('movestart');
        }

        this._ease(function(k) {
            tr.center = tr.unproject(from.add(to.sub(from).mult(k)));
            this._move();
        }, function() {
            this.fire('moveend');
        }, options);

        return this;
    },

    // Zooms to a certain zoom level with easing.
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
            around = LatLng.convert(options.around);
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
            this.animationLoop.set(300); // text fading
            this._move(true);
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
                this._rerender();
                this.fire('moveend');
            }.bind(this), 200);
        }

        return this;
    },

    zoomIn: function(options) {
        this.zoomTo(this.getZoom() + 1, options);
    },

    zoomOut: function(options) {
        this.zoomTo(this.getZoom() - 1, options);
    },

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
            around = LatLng.convert(options.around);
        } else if (options.offset) {
            around = tr.pointLocation(tr.centerPoint.add(Point.convert(options.offset)));
        }

        bearing = this._normalizeBearing(bearing, start);

        this.rotating = true;
        this.fire('movestart');

        this._ease(function(k) {
            tr.setBearingAround(interpolate(start, bearing, k), around);
            this._move(false, true);
        }, function() {
            this.rotating = false;
            this.fire('moveend');
        }, options);

        return this;
    },

    resetNorth: function(options) {
        return this.rotateTo(0, util.extend({duration: 1000}, options));
    },

    fitBounds: function(bounds, options) {

        options = util.extend({
            padding: 0,
            offset: [0, 0],
            maxZoom: Infinity
        }, options);

        bounds = LatLngBounds.convert(bounds);

        var offset = Point.convert(options.offset),
            tr = this.transform,
            nw = tr.project(bounds.getNorthWest()),
            se = tr.project(bounds.getSouthEast()),
            size = se.sub(nw),
            center = tr.unproject(nw.add(se).div(2)),

            scaleX = (tr.width - options.padding * 2 - Math.abs(offset.x) * 2) / size.x,
            scaleY = (tr.height - options.padding * 2 - Math.abs(offset.y) * 2) / size.y,

            zoom = Math.min(tr.scaleZoom(tr.scale * Math.min(scaleX, scaleY)), options.maxZoom);

        return options.linear ?
            this.easeTo(center, zoom, 0, options) :
            this.flyTo(center, zoom, 0, options);
    },

    easeTo: function(latlng, zoom, bearing, options) {
        this.stop();

        options = util.extend({
            offset: [0, 0],
            duration: 500,
            easing: util.ease
        }, options);

        var tr = this.transform,
            offset = Point.convert(options.offset).rotate(-tr.angle),
            startZoom = this.getZoom(),
            startBearing = this.getBearing();

        latlng = LatLng.convert(latlng);
        zoom = zoom === undefined ? startZoom : zoom;
        bearing = bearing === undefined ? startBearing : this._normalizeBearing(bearing, startBearing);

        var scale = tr.zoomScale(zoom - startZoom),
            from = tr.point,
            to = latlng ? tr.project(latlng).sub(offset.div(scale)) : tr.point,
            around;

        if (zoom !== startZoom) {
            around = tr.pointLocation(tr.centerPoint.add(to.sub(from).div(1 - 1 / scale)));
            this.zooming = true;
        }
        if (startBearing !== bearing) this.rotating = true;

        this.fire('movestart');

        this._ease(function (k) {
            if (zoom !== startZoom) {
                tr.setZoomAround(interpolate(startZoom, zoom, k), around);
            } else {
                tr.center = tr.unproject(from.add(to.sub(from).mult(k)));
            }

            if (bearing !== startBearing) {
                tr.bearing = interpolate(startBearing, bearing, k);
            }

            this.animationLoop.set(300); // text fading
            this._move(zoom !== startZoom, bearing !== startBearing);
        }, function() {
            this.zooming = false;
            this.rotating = false;
            this.fire('moveend');
        }, options);

        return this;
    },

    flyTo: function(latlng, zoom, bearing, options) {
        this.stop();

        options = util.extend({
            offset: [0, 0],
            speed: 1.2,
            curve: 1.42,
            easing: util.ease
        }, options);

        latlng = LatLng.convert(latlng);

        var offset = Point.convert(options.offset),
            tr = this.transform,
            startZoom = this.getZoom(),
            startBearing = this.getBearing();

        zoom = zoom === undefined ? startZoom : zoom;
        bearing = bearing === undefined ? startBearing : this._normalizeBearing(bearing, startBearing);

        var scale = tr.zoomScale(zoom - startZoom),
            from = tr.point,
            to = tr.project(latlng).sub(offset.div(scale));

        if (options.animate === false) {
            return this.setView(latlng, zoom, bearing);
        }

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

        this.fire('movestart');

        this._ease(function (k) {
            var s = k * S,
                us = u(s);

            tr.zoom = startZoom + tr.scaleZoom(1 / w(s));
            tr.center = tr.unproject(from.add(to.sub(from).mult(us)), startWorldSize);

            if (bearing !== startBearing) {
                tr.bearing = interpolate(startBearing, bearing, k);
            }

            this.animationLoop.set(300); // text fading

            this._move(true, bearing !== startBearing);
        }, function() {
            this.zooming = false;
            this.rotating = false;
            this.fire('moveend');
        }, options);

        return this;
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
