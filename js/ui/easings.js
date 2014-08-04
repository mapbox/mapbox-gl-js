'use strict';

var util = require('../util/util.js'),
    browser = require('../util/browser.js'),
    LatLng = require('../geo/latlng.js'),
    LatLngBounds = require('../geo/latlngbounds.js'),
    Point = require('point-geometry');

util.extend(exports, {
    isEasing: function () {
        return !!this._stopFn;
    },

    stop: function () {
        if (this._stopFn) {
            this._stopFn();
            delete this._stopFn;
        }
        return this;
    },

    panBy: function(offset, options) {
        this.stop();

        offset = Point.convert(offset);

        options = util.extend({
            duration: 500,
            easing: util.ease
        }, options);

        var tr = this.transform,
            from = tr.point;

        if (!options.noMoveStart) {
            this.fire('movestart');
        }

        this._stopFn = browser.timed(function(t) {
            tr.center = tr.unproject(from.add(offset.mult(options.easing(t))));
            this._move();
            if (t === 1) this.fire('moveend');

        }, options.animate === false ? 0 : options.duration, this);

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

        var offset = Point.convert(options.offset),
            tr = this.transform,
            from = tr.point,
            to = tr.project(latlng).sub(offset);

        this.fire('movestart');

        this._stopFn = browser.timed(function(t) {
            tr.center = tr.unproject(from.add(to.sub(from).mult(options.easing(t))));
            this._move();
            if (t === 1) this.fire('moveend');

        }, options.animate === false ? 0 : options.duration, this);

        return this;
    },

    // Zooms to a certain zoom level with easing.
    zoomTo: function(zoom, options) {
        this.stop();

        options = util.extend({
            duration: 500,
            offset: [0, 0]
        }, options);

        var tr = this.transform,
            center = tr.centerPoint.add(Point.convert(options.offset)),
            easing = this._updateEasing(options.duration, zoom, options.easing),
            startZoom = tr.zoom;

        if (options.animate === false) options.duration = 0;

        if (!this.zooming) {
            this.zooming = true;
            this.fire('movestart');
        }

        this._stopFn = browser.timed(function(t) {
            tr.zoomAroundTo(util.interp(startZoom, zoom, easing(t)), center);

            this.style.animationLoop.set(300); // text fading
            this._move(true);

            if (t === 1) {
                this.ease = null;
                if (options.duration >= 200) {
                    this.fire('moveend');
                    this.zooming = false;
                }
            }

        }, options.duration, this);

        if (options.duration < 200) {
            window.clearTimeout(this._onZoomEnd);
            this._onZoomEnd = window.setTimeout(function() {
                this.zooming = false;
                this._rerender();
                this.fire('moveend');
            }.bind(this), 200);
        }

        return this;
    },

    rotateTo: function(bearing, options) {
        this.stop();

        options = util.extend({
            duration: 500,
            easing: util.ease
        }, options);

        var start = this.getBearing(),
            offset = Point.convert(options.offset);

        this.rotating = true;
        this.fire('movestart');

        this._stopFn = browser.timed(function(t) {
            if (t === 1) { this.rotating = false; }
            this.transform.rotate(util.interp(start, bearing, options.easing(t)), offset);
            this._move(false, true).fire('moveend');
        }, options.animate === false ? 0 : options.duration, this);

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

        options = util.extend({
            offset: [0, 0],
            duration: 500,
            easing: util.ease
        }, options);

        latlng = LatLng.convert(latlng);

        var offset = Point.convert(options.offset),
            tr = this.transform,
            startZoom = this.getZoom(),
            startBearing = this.getBearing();

        zoom = zoom === undefined ? startZoom : zoom;
        bearing = bearing === undefined ? startBearing : bearing;

        var scale = tr.zoomScale(zoom - startZoom),
            from = tr.point,
            to = tr.project(latlng).sub(offset.div(scale)),
            around = tr.centerPoint.add(to.sub(from).div(1 - 1 / scale));

        if (zoom !== startZoom) this.zooming = true;
        if (startBearing !== bearing) this.rotating = true;

        this.fire('movestart');

        this._stopFn = browser.timed(function (t) {
            var k = options.easing(t);

            if (zoom !== startZoom) {
                tr.zoomAroundTo(startZoom + k * (zoom - startZoom), around);
            }
            if (bearing !== startBearing) {
                tr.bearing = util.interp(startBearing, bearing, k);
            }

            this.style.animationLoop.set(300); // text fading
            this._move(zoom !== startZoom, bearing !== startBearing);

            if (t === 1) {
                this.zooming = false;
                this.rotating = false;
                this.fire('moveend');
            }

        }, options.animate === false ? 0 : options.duration, this);

        return this;
    },

    flyTo: function(latlng, zoom, bearing, options) {

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
        bearing = bearing === undefined ? startBearing : bearing;

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

        var duration = 1000 * S / V;

        this.zooming = true;
        if (startBearing != bearing) this.rotating = true;

        this.fire('movestart');

        this._stopFn = browser.timed(function (t) {
            var k = options.easing(t),
                s = k * S,
                us = u(s);

            tr.zoom = startZoom + tr.scaleZoom(1 / w(s));
            tr.center = tr.unproject(from.add(to.sub(from).mult(us)), startWorldSize);

            if (bearing !== startBearing) {
                tr.bearing = util.interp(startBearing, bearing, k);
            }

            this.style.animationLoop.set(300); // text fading

            this._move(true, bearing !== startBearing);

            if (t === 1) {
                this.zooming = false;
                this.rotating = false;
                this.fire('moveend');
            }
        }, duration, this);

        return this;
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
