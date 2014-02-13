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

        this._stopFn = util.timed(function(t) {
            this.transform.panBy(
                Math.round(x * (1 - t)),
                Math.round(y * (1 - t)));
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
            this._updateStyle();
            this.update();

            this
                .fire('zoom', [{scale: scale}])
                .fire('move');
        }, duration, this);

        if (duration < 200) {
            window.clearTimeout(this._onZoomEnd);
            this._onZoomEnd = window.setTimeout(function() {
                this.zooming = false;
                console.log('rerender');
                this._rerender();
            }.bind(this), 200);
        }

        return this;
    },

    scaleTo: function(scale, duration, center) {
        return this.zoomTo(this.transform.scaleZoom(scale), duration, center);
    },

    resetNorth: function(duration) {
        var center = this.transform.centerPoint,
            start = this.transform.angle;

        this.rotating = true;

        this._stopFn = util.timed(function(t) {
            this.setAngle(center, util.interp(start, 0, util.ease(t)));
            if (t === 1) {
                this.rotating = false;
            }
            this
                .fire('rotate')
                .fire('move');
        }, duration !== undefined ? duration : 1000, this);

        return this;
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

        var r0 = r(0);

        function w(s) { return w0 * (cosh(r0) / cosh(r0 + rho * s)); }
        function u(s) { return w0 * (cosh(r0) * tanh(r0 + rho * s) - sinh(r0)) / rho2; }

        var S = (r(1) - r0) / rho,
            duration = 1000 * S / V;

        this.zooming = true;

        this._stopFn = util.timed(function (t) {
            var s = util.ease(t) * S,
                us = u(s) / u1;

            tr.zoom = startZoom + tr.scaleZoom(w0 / w(s));
            tr.lat = tr.yLat(util.interp(fromY, toY, us), startWorldSize);
            tr.lon = tr.xLon(util.interp(fromX, toX, us), startWorldSize);

            this.style.animationLoop.set(300); // text fading
            this._updateStyle();
            this.update();

            if (t === 1) {
                this.zooming = false;
            }

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
