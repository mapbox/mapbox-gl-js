'use strict';

var util = require('../util/util.js'),
    LatLng = require('../geometry/latlng.js'),
    LatLngBounds = require('../geometry/latlngbounds.js'),
    Point = require('point-geometry');

util.extend(exports, {
    stop: function () {
        if (this._stopFn) {
            this._stopFn();
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

        this._stopFn = util.timed(function(t) {
            tr.center = tr.unproject(from.add(offset.mult(options.easing(t))));
            this
                .update()
                .fire('pan')
                .fire('move');

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

        this._stopFn = util.timed(function(t) {
            tr.center = tr.unproject(from.add(to.sub(from).mult(options.easing(t))));
            this
                .update()
                .fire('pan')
                .fire('move');

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

        this.zooming = true;

        this._stopFn = util.timed(function(t) {
            tr.zoomAroundTo(util.interp(startZoom, zoom, easing(t)), center);

            if (t === 1) {
                this.ease = null;
                if (options.duration >= 200) this.zooming = false;
            }

            this.style.animationLoop.set(300); // text fading
            this.update(true);

            this
                .fire('zoom', {scale: tr.scale})
                .fire('move');
        }, options.duration, this);

        if (options.duration < 200) {
            window.clearTimeout(this._onZoomEnd);
            this._onZoomEnd = window.setTimeout(function() {
                this.zooming = false;
                this._rerender();
            }.bind(this), 200);
        }

        return this;
    },

    scaleTo: function(scale, options) {
        return this.zoomTo(this.transform.scaleZoom(scale), options);
    },

    rotateTo: function(bearing, options) {
        this.stop();

        options = util.extend({
            duration: 500,
            easing: util.ease
        }, options);

        var start = this.getBearing();

        this.rotating = true;

        this._stopFn = util.timed(function(t) {
            if (t === 1) { this.rotating = false; }
            this.setBearing(util.interp(start, bearing, options.easing(t)), options.offset);
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

        return this.zoomPanTo(center, zoom, 0, options);
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
            fromX = tr.x,
            fromY = tr.y,
            toX = tr.lngX(latlng.lng) - offset.x / scale,
            toY = tr.latY(latlng.lat) - offset.y / scale,
            startWorldSize = tr.worldSize;

        if (options.animate === false) options.duration = 0;

        this.zooming = true;
        if (startBearing !== bearing) this.rotating = true;

        this._stopFn = util.timed(function (t) {
            var k = options.easing(t);

            tr.zoom = startZoom + k * (zoom - startZoom);

            tr.center = new LatLng(
                tr.yLat(util.interp(fromY, toY, k), startWorldSize),
                tr.xLng(util.interp(fromX, toX, k), startWorldSize));

            if (startBearing !== bearing) {
                tr.angle = -util.interp(startBearing, bearing, k) * Math.PI / 180;
            }

            if (t === 1) {
                this.zooming = false;
                this.rotating = false;
            }

            this.style.animationLoop.set(300); // text fading
            this.update(true);

            this
                .fire('pan')
                .fire('zoom')
                .fire('move');
        }, options.duration, this);

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
            fromX = tr.x,
            fromY = tr.y,
            toX = tr.lngX(latlng.lng) - offset.x / scale,
            toY = tr.latY(latlng.lat) - offset.y / scale;

        if (options.animate === false) {
            return this.setPosition(latlng, zoom, bearing);
        }

        var dx = toX - fromX,
            dy = toY - fromY,
            startWorldSize = tr.worldSize,
            rho = options.curve,
            V = options.speed,

            w0 = Math.max(tr.width, tr.height),
            w1 = w0 / scale,
            u1 = Math.sqrt(dx * dx + dy * dy),
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
            u = function (s) { return w0 * ((cosh(r0) * tanh(r0 + rho * s) - sinh(r0)) / rho2) / u1; };

        var S = (r(1) - r0) / rho;

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

        this._stopFn = util.timed(function (t) {
            var k = options.easing(t),
                s = k * S,
                us = u(s);

            tr.zoom = startZoom + tr.scaleZoom(1 / w(s));

            tr.center = new LatLng(
                tr.yLat(util.interp(fromY, toY, us), startWorldSize),
                tr.xLng(util.interp(fromX, toX, us), startWorldSize));

            if (startBearing != bearing) {
                tr.angle = -util.interp(startBearing, bearing, k) * Math.PI / 180;
            }

            if (t === 1) {
                this.zooming = false;
                this.rotating = false;
            }

            this.style.animationLoop.set(300); // text fading
            this.update(true);

            this
                .fire('pan')
                .fire('zoom')
                .fire('move');
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
