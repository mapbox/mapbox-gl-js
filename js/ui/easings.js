'use strict';

var util = require('../util/util.js'),
    LatLng = require('../geometry/latlng.js'),
    Point = require('../geometry/point.js');

util.extend(exports, {
    stop: function () {
        if (this._stopFn) {
            this._stopFn();
        }
        return this;
    },

    panBy: function(offset, duration) {
        this.stop();

        offset = Point.convert(offset);

        var tr = this.transform,
            fromX = tr.x,
            fromY = tr.y;

        this._stopFn = util.timed(function(t) {

            this.transform.center = new LatLng(
                tr.yLat(fromY + offset.y * util.ease(t)),
                tr.xLng(fromX + offset.x * util.ease(t)));
            this
                .update()
                .fire('pan')
                .fire('move');

        }, duration !== undefined ? duration : 500, this);

        return this;
    },

    panTo: function(latlng, duration) {
        this.stop();

        latlng = LatLng.convert(latlng);

        var tr = this.transform,
            fromY = tr.y,
            fromX = tr.x,
            toY = tr.latY(latlng.lat),
            toX = tr.lngX(latlng.lng);

        this._stopFn = util.timed(function(t) {

            this.transform.center = new LatLng(
                tr.yLat(util.interp(fromY, toY, util.ease(t))),
                tr.xLng(util.interp(fromX, toX, util.ease(t))));
            this
                .update()
                .fire('pan')
                .fire('move');

        }, duration !== undefined ? duration : 500, this);

        return this;
    },

    fitBounds: function(minLat, minLng, maxLat, maxLng, padding, offset) {
        padding = padding || 0;

        offset = Point.convert(offset || [0, 0]);

        var tr = this.transform,
            x1 = tr.lngX(minLng),
            x2 = tr.lngX(maxLng),
            y1 = tr.latY(minLat),
            y2 = tr.latY(maxLat),
            x = (x1 + x2) / 2,
            y = (y1 + y2) / 2,
            lng = tr.xLng(x),
            lat = tr.yLat(y),
            scaleX = (tr.width - padding * 2 - Math.abs(offset.x) * 2) / (x2 - x1),
            scaleY = (tr.height - padding * 2 - Math.abs(offset.y) * 2) / (y1 - y2),
            zoom = this.transform.scaleZoom(this.transform.scale * Math.min(scaleX, scaleY));

        return this.zoomPanTo([lat, lng], zoom, null, null, offset);
    },

    // Zooms to a certain zoom level with easing.
    zoomTo: function(zoom, duration, center, bezier) {
        this.stop();

        duration = duration !== undefined ? duration : 500;
        center = Point.convert(center) || this.transform.centerPoint;

        var easing = this._updateEasing(duration, zoom, bezier),
            startZoom = this.transform.zoom;

        this.zooming = true;

        this._stopFn = util.timed(function(t) {
            this.transform.zoomAroundTo(util.interp(startZoom, zoom, easing(t)), center);

            if (t === 1) {
                this.ease = null;
                if (duration >= 200) {
                    this.zooming = false;
                }
            }

            this.style.animationLoop.set(300); // text fading
            this.update(true);

            this
                .fire('zoom', [{scale: this.transform.scale}])
                .fire('move');
        }, duration, this);

        if (duration < 200) {
            window.clearTimeout(this._onZoomEnd);
            this._onZoomEnd = window.setTimeout(function() {
                this.zooming = false;
                this._rerender();
            }.bind(this), 200);
        }

        return this;
    },

    scaleTo: function(scale, duration, center) {
        return this.zoomTo(this.transform.scaleZoom(scale), duration, center);
    },

    rotateTo: function(angle, duration) {
        this.stop();

        var start = this.transform.angle;
        this.rotating = true;

        this._stopFn = util.timed(function(t) {
            if (t === 1) { this.rotating = false; }
            this.setAngle(util.interp(start, angle, util.ease(t)));
        }, duration !== undefined ? duration : 500, this);

        return this;
    },

    resetNorth: function(duration) {
        return this.rotateTo(0, duration !== undefined ? duration : 1000);
    },

    zoomPanTo: function(latlng, zoom, V, rho, offset) {

        latlng = LatLng.convert(latlng);
        offset = Point.convert(offset || [0, 0]);

        var tr = this.transform,
            startZoom = this.transform.zoom;

        zoom = zoom === undefined ? startZoom : zoom;

        var scale = tr.zoomScale(zoom - startZoom),
            fromX = tr.x,
            fromY = tr.y,
            toX = tr.lngX(latlng.lng) - offset.x / scale,
            toY = tr.latY(latlng.lat) - offset.y / scale,
            dx = toX - fromX,
            dy = toY - fromY,
            startWorldSize = tr.worldSize;

        rho = rho || 1.42;
        V = V || 1.2;

        var w0 = Math.max(tr.width, tr.height),
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
            w = function (s) { return w0 * (cosh(r0) / cosh(r0 + rho * s)); },
            u = function (s) { return w0 * (cosh(r0) * tanh(r0 + rho * s) - sinh(r0)) / rho2; };

        var S = (r(1) - r0) / rho;

        if (Math.abs(u1) < 0.000001) {
            if (Math.abs(w0 - w1) < 0.000001) return;

            var k = w1 < w0 ? -1 : 1;
            S = Math.abs(Math.log(w1 / w0)) / rho;

            u = function() { return 0; };
            w = function(s) { return w0 * Math.exp(k * rho * s); };
        }

        var duration = 1000 * S / V;

        this.zooming = true;

        this._stopFn = util.timed(function (t) {
            var s = util.ease(t) * S,
                us = u(s) / u1;

            tr.zoom = startZoom + tr.scaleZoom(w0 / w(s));

            tr.center = new LatLng(
                tr.yLat(util.interp(fromY, toY, us), startWorldSize),
                tr.xLng(util.interp(fromX, toX, us), startWorldSize));

            if (t === 1) {
                this.zooming = false;
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
