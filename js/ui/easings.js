'use strict';

var util = require('../util/util.js');

util.extend(exports, {
    stop: function () {
        if (this._stopFn) {
            this._stopFn();
        }
        return this;
    },

    panBy: function(x, y, duration) {
        this.stop();

        var tr = this.transform,
            fromX = tr.lonX(tr.lon),
            fromY = tr.latY(tr.lat);

        this._stopFn = util.timed(function(t) {
            this.transform.lon = tr.xLon(fromX + x * util.ease(t));
            this.transform.lat = tr.yLat(fromY + y * util.ease(t));
            this.update();
            this
                .fire('pan')
                .fire('move');
        }, duration !== undefined ? duration : 500, this);

        return this;
    },

    panTo: function(lat, lon, duration) {
        this.stop();

        var tr = this.transform,
            fromY = tr.latY(tr.lat),
            fromX = tr.lonX(tr.lon),
            toY = tr.latY(lat),
            toX = tr.lonX(lon);

        this._stopFn = util.timed(function(t) {
            this.transform.lon = tr.xLon(util.interp(fromX, toX, util.ease(t)));
            this.transform.lat = tr.yLat(util.interp(fromY, toY, util.ease(t)));
            this.update();
            this
                .fire('pan')
                .fire('move');
        }, duration !== undefined ? duration : 500, this);

        return this;
    },

    fitBounds: function(minLat, minLon, maxLat, maxLon, p) {
        p = p || 0;
        var tr = this.transform,
            x1 = tr.lonX(minLon),
            x2 = tr.lonX(maxLon),
            y1 = tr.latY(minLat),
            y2 = tr.latY(maxLat),
            y = (y1 + y2) / 2,
            x = (x1 + x2) / 2,
            lat = tr.yLat(y),
            lon = tr.xLon(x),
            scaleX = (tr.width - p * 2) / (x2 - x1),
            scaleY = (tr.height - p * 2) / (y1 - y2),
            zoom = this.transform.scaleZoom(this.transform.scale * Math.min(scaleX, scaleY));

        return this.zoomPanTo(lat, lon, zoom);
    },

    // Zooms to a certain zoom level with easing.
    zoomTo: function(zoom, duration, center) {
        this.stop();

        duration = duration !== undefined ? duration : 500;
        center = center || this.transform.centerPoint;

        var easing = this._updateEasing(duration, zoom),
            from = this.transform.scale,
            to = Math.pow(2, zoom);

        this.zooming = true;

        this._stopFn = util.timed(function(t) {
            var scale = util.interp(from, to, easing(t));
            this.transform.zoomAroundTo(scale, center);

            if (t === 1) {
                this.ease = null;
                if (duration >= 200) {
                    this.zooming = false;
                }
            }

            this.style.animationLoop.set(300); // text fading
            this.update(true);

            this
                .fire('zoom', [{scale: scale}])
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

    zoomPanTo: function(lat, lon, zoom, V, rho) {

        var tr = this.transform,
            fromX = tr.lonX(tr.lon),
            fromY = tr.latY(tr.lat),
            toX = tr.lonX(lon),
            toY = tr.latY(lat),
            dx = toX - fromX,
            dy = toY - fromY,
            startZoom = this.transform.z,
            startWorldSize = tr.worldSize;

        zoom = zoom === undefined ? startZoom : zoom;
        rho = rho || 1.42;
        V = V || 1.2;

        var w0 = Math.max(tr.width, tr.height),
            w1 = w0 * tr.zoomScale(startZoom - zoom),
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
            tr.lat = tr.yLat(util.interp(fromY, toY, us), startWorldSize);
            tr.lon = tr.xLon(util.interp(fromX, toX, us), startWorldSize);

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

    _updateEasing: function(duration, zoom) {
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
            easing = util.ease;
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
