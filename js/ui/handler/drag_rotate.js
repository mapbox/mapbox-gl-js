'use strict';

var DOM = require('../../util/dom'),
    Point = require('point-geometry'),
    util = require('../../util/util');

module.exports = DragRotate;


function DragRotate(map) {
    this._map = map;
    this._el = map.getCanvasContainer();

    util.bindHandlers(this);
}

DragRotate.prototype = {
    enable: function () {
        this._el.addEventListener('contextmenu', this._onContextMenu, false);
    },

    disable: function () {
        this._el.removeEventListener('contextmenu', this._onContextMenu);
    },

    _onContextMenu: function (e) {
        this._map.stop();
        this._startPos = this._pos = DOM.mousePos(this._el, e);

        document.addEventListener('mousemove', this._onMouseMove, false);
        document.addEventListener('mouseup', this._onMouseUp, false);

        e.preventDefault();
    },

    _onMouseMove: function (e) {

        var p0 = this._startPos,
            p1 = this._pos,
            p2 = DOM.mousePos(this._el, e),

            map = this._map,
            center = map.transform.centerPoint, // Center of rotation
            startToCenter = p0.sub(center),
            startToCenterDist = startToCenter.mag();

        this.active = true;

        if (!map.rotating) {
            map.fire('movestart');
            map.rotating = true;
        }

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
        var map = this._map;

        map.rotating = false;
        map.snapToNorth();

        if (!map.rotating) {
            map._rerender();
            map.fire('moveend');
        }
    },

    _onMouseUp: function () {
        this.active = false;

        document.removeEventListener('mousemove', this._onMouseMove, false);
        document.removeEventListener('mouseup', this._onMouseUp, false);
    }
};
