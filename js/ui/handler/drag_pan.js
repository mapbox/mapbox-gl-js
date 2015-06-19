'use strict';

var DOM = require('../../util/dom'),
    util = require('../../util/util');

module.exports = DragPan;


var inertiaLinearity = 0.2,
    inertiaEasing = util.bezier(0, 0, inertiaLinearity, 1),
    inertiaMaxSpeed = 4000, // px/s
    inertiaDeceleration = 8000; // px/s^2


function DragPan(map) {
    this._map = map;
    this._el = map.getCanvas();

    util.bindHandlers(this);
}

DragPan.prototype = {
    enable: function () {
        this._el.addEventListener('mousedown', this._onDown, false);
        this._el.addEventListener('touchstart', this._onDown, false);
    },

    disable: function () {
        this._el.removeEventListener('mousedown', this._onDown);
        this._el.removeEventListener('touchstart', this._onDown);
    },

    _onDown: function (e) {
        this._startPos = this._pos = DOM.mousePos(this._el, e);

        this._inertia = [];
        this._time = null;

        if (!e.touches) {
            document.addEventListener('mousemove', this._onMove, false);
            document.addEventListener('mouseup', this._onMouseUp, false);

        } else if (e.touches.length === 1) {
            document.addEventListener('touchmove', this._onMove, false);
            document.addEventListener('touchend', this._onTouchEnd, false);
        }
    },

    _onMove: function (e) {
        var map = this._map;
        if (map.boxZoom.active || map.dragRotate.active || (e.touches && e.touches.length > 1)) return;

        var p1 = this._pos,
            p2 = DOM.mousePos(this._el, e),

            inertia = this._inertia,
            now = Date.now();

        if (this._time && now > this._time) {
            // add an averaged version of this movement to the inertia vector
            inertia.push([now, p2]);
            while (inertia.length > 2 && now - inertia[0][0] > 100) inertia.shift();
        }

        map.stop();
        map.transform.setLocationAtPoint(map.transform.pointLocation(p1), p2);
        map.fire('move');

        this._pos = p2;
        this._time = now;

        e.preventDefault();
    },

    _onUp: function () {
        var map = this._map,
            inertia = this._inertia,
            velocity;

        if (inertia && inertia.length >= 2 && Date.now() < this._time + 100) {
            var last = inertia[inertia.length - 1],
                first = inertia[0];

            // calculate px/s velocity & adjust for increased initial animation speed when easing out
            velocity = last[1].sub(first[1]).mult(1000 * inertiaLinearity / (last[0] - first[0]));
        }

        if (velocity) {
            var speed = velocity.mag(); // px/s

            if (speed >= inertiaMaxSpeed) {
                speed = inertiaMaxSpeed;
                velocity._unit()._mult(inertiaMaxSpeed);
            }

            var duration = speed / (inertiaDeceleration * inertiaLinearity),
                offset = velocity.mult(-duration / 2).round();

            map.panBy(offset, {
                duration: duration * 1000,
                easing: inertiaEasing,
                noMoveStart: true
            });

        } else {
            map.fire('moveend');
        }
    },

    _onMouseUp: function () {
        this._onUp();
        document.removeEventListener('mousemove', this._onMove, false);
        document.removeEventListener('mouseup', this._onMouseUp, false);
    },

    _onTouchEnd: function () {
        this._onUp();
        document.removeEventListener('touchmove', this._onMove);
        document.removeEventListener('touchend', this._onTouchEnd);
    }
};
