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

        map.easeTo({
            zoom: map.transform.scaleZoom(this._startScale * scale),
            bearing: this._startBearing + bearing,
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
