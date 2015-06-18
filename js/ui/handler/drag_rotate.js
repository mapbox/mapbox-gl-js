'use strict';

var DOM = require('../../util/dom'),
    Point = require('point-geometry');

module.exports = DragRotate;


function DragRotate(map) {
    this._map = map;
    this._el = map.getCanvas();
    this._container = map.getContainer();

    this._onContextMenu = this._onContextMenu.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onTimeout = this._onTimeout.bind(this);
}

DragRotate.prototype = {
    enable: function () {
        this._el.addEventListener('contextmenu', this._onContextMenu, false);
    },

    disable: function () {
        this._el.removeEventListener('contextmenu', this._onContextMenu, false);
    },

    _onContextMenu: function (e) {
        this._startPos = this._pos = DOM.mousePos(this._el, e);
        e.preventDefault();

        document.addEventListener('mousemove', this._onMouseMove, false);
        document.addEventListener('mouseup', this._onMouseUp, false);
    },

    _onMouseMove: function (e) {

        var p0 = this._startPos,
            p1 = this._pos,
            p2 = DOM.mousePos(this._el, e),

            map = this._map,
            center = map.transform.centerPoint, // Center of rotation
            startToCenter = p0.sub(center),
            startToCenterDist = startToCenter.mag();

        map.rotating = true;

        // If the first click was too close to the center, move the center of rotation by 200 pixels
        // in the direction of the click.
        if (startToCenterDist < 200) {
            center = p0.add(new Point(-200, 0)._rotate(startToCenter.angle()));
        }

        var bearingDiff = p1.sub(center).angleWith(p2.sub(center)) / Math.PI * 180;
        map.transform.bearing = map.getBearing() - bearingDiff;

        map.fire('move').fire('rotate');

        clearTimeout(this._timeout);
        this._timeout = setTimeout(this._onTimeout, 200);

        this._pos = p2;
    },

    _onTimeout: function () {
        this._map.rotating = false;
        this._map._rerender();
    },

    _onMouseUp: function () {
        document.removeEventListener('mousemove', this._onMouseMove, false);
        document.removeEventListener('mouseup', this._onMouseUp, false);
    }
};
