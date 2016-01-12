'use strict';

var DOM = require('../../util/dom'),
    util = require('../../util/util');

module.exports = TouchZoomRotate;


function TouchZoomRotate(map) {
    this._map = map;
    this._el = map.getCanvasContainer();
    this._rotationDisabled = false;

    util.bindHandlers(this);
}

TouchZoomRotate.prototype = {
    enable: function () {
        this._el.addEventListener('touchstart', this._onStart, false);
    },

    disable: function () {
        this._el.removeEventListener('touchstart', this._onStart);
    },

    disableRotation: function() {
        this._rotationDisabled = true;
    },

    enableRotation: function() {
        this._rotationDisabled = false;
    },

    _onStart: function (e) {
        if (e.touches.length !== 2) return;

        var p0 = DOM.mousePos(this._el, e.touches[0]),
            p1 = DOM.mousePos(this._el, e.touches[1]);

        this._startVec = p0.sub(p1);
        this._startScale = this._map.transform.scale;
        this._startBearing = this._map.transform.bearing;
        this._gestureIntent = undefined;

        this._significantScaleThreshold = 0.15;
        this._significantRotateThreshold = 4;

        document.addEventListener('touchmove', this._onMove, false);
        document.addEventListener('touchend', this._onEnd, false);
    },

    _onMove: function (e) {
        if (e.touches.length !== 2) return;

        var p0 = DOM.mousePos(this._el, e.touches[0]),
            p1 = DOM.mousePos(this._el, e.touches[1]),
            p = p0.add(p1).div(2),
            vec = p0.sub(p1),
            scale = vec.mag() / this._startVec.mag(),
            bearing = this._rotationDisabled ? 0 : vec.angleWith(this._startVec) * 180 / Math.PI,
            map = this._map;

        // Determine 'intent' by whichever threshold is surpassed first,
        // then keep that state for the duration of this gesture.
        if (!this._gestureIntent) {
            var scalingSignificantly = (Math.abs(1 - scale) > this._significantScaleThreshold),
                rotatingSignificantly = (Math.abs(bearing) > this._significantRotateThreshold);

            if (rotatingSignificantly) {
                this._gestureIntent = 'rotate';
            } else if (scalingSignificantly) {
                this._gestureIntent = 'zoom';
            }

            if (this._gestureIntent) {
                this._startVec = vec;
                this._startScale = map.transform.scale;
                this._startBearing = map.transform.bearing;
            }

        } else {
            var param = { duration: 0, around: map.unproject(p) };

            if (this._gestureIntent === 'rotate') {
                param.bearing = this._startBearing + bearing;
            }
            if (this._gestureIntent === 'zoom' || this._gestureIntent === 'rotate') {
                param.zoom = map.transform.scaleZoom(this._startScale * scale);
            }

            map.easeTo(param);
        }

        e.preventDefault();
    },

    _onEnd: function () {
        this._map.snapToNorth();

        document.removeEventListener('touchmove', this._onMove);
        document.removeEventListener('touchend', this._onEnd);
    }
};
