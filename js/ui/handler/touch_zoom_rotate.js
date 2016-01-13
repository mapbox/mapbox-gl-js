'use strict';

var DOM = require('../../util/dom'),
    util = require('../../util/util');

module.exports = TouchZoomRotate;


function TouchZoomRotate(map) {
    this._map = map;
    this._el = map.getCanvasContainer();

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
        this._scalingSignificantly = false;
        this._rotatingSignificantly = false;
        this._blockRotation = undefined;

        // TODO(jliebrand): Move these to config options on the map?
        this._significantScaleThreshold = 0.1;
        this._significantRotateThreshold = 5;

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

        this._scalingSignificantly =
            this._scalingSignificantly || (Math.abs(1 - scale) > this._significantScaleThreshold);

        this._rotatingSignificantly =
            this._rotatingSignificantly || (Math.abs(bearing) > this._significantRotateThreshold);

        // Similar to google maps: if the user's intent is pinch zooming, rotate
        // will be disabled. If their intent is rotating, then both rotate and
        // zoom will be supported. We determine 'intent' by whichever threshold is
        // surpassed first. Once determined, we keep that state for the duration
        // of this gesture.
        if (this._blockRotation === undefined) {
            if (this._scalingSignificantly) {
                this._blockRotation = true;
            } else if (this._rotatingSignificantly) {
                this._blockRotation = false;
            }
        }

        // Only set the bearing if rotation is allowed AND we are rotating more than our threshold
        var updateBearing = ((this._blockRotation === false) && this._rotatingSignificantly);
        map.easeTo({
            zoom: map.transform.scaleZoom(this._startScale * scale),
            bearing: updateBearing ? (this._startBearing + bearing) : this._startBearing,
            duration: 0,
            around: map.unproject(p)
        });

        e.preventDefault();
    },

    _onEnd: function () {
        this._map.snapToNorth();

        document.removeEventListener('touchmove', this._onMove);
        document.removeEventListener('touchend', this._onEnd);
    }
};
