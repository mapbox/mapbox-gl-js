'use strict';

var DOM = require('../../util/dom'),
    util = require('../../util/util');

module.exports = DragPan;


var inertiaLinearity = 0.25,
    inertiaEasing = util.bezier(0, 0, inertiaLinearity, 1),
    inertiaMaxSpeed = 3000, // px/s
    inertiaDeceleration = 4000; // px/s^2


function DragPan(map) {
    this._map = map;
    this._el = map.getCanvasContainer();

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
        this.active = false;
        this._startPos = this._pos = DOM.mousePos(this._el, e);
        this._inertia = [[Date.now(), this._pos]];

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

        if (!this.active) {
            this.active = true;
            this._fireEvent('dragstart', e);
            this._fireEvent('movestart', e);
        }

        var pos = DOM.mousePos(this._el, e),
            inertia = this._inertia,
            now = Date.now();

        inertia.push([now, pos]);
        while (inertia.length > 2 && now - inertia[0][0] > 50) inertia.shift();

        map.stop();
        map.transform.setLocationAtPoint(map.transform.pointLocation(this._pos), pos);
        this._fireEvent('drag', e);
        this._fireEvent('move', e);

        this._pos = pos;

        e.preventDefault();
    },

    _onUp: function (e) {
        if (!this.active) return;

        this.active = false;
        this._fireEvent('dragend', e);

        var inertia = this._inertia;
        if (inertia.length < 2) {
            this._fireEvent('moveend', e);
            return;
        }

        var last = inertia[inertia.length - 1],
            first = inertia[0],
            flingOffset = last[1].sub(first[1]),
            flingDuration = (last[0] - first[0]) / 1000,

            // calculate px/s velocity & adjust for increased initial animation speed when easing out
            velocity = flingOffset.mult(inertiaLinearity / flingDuration),
            speed = velocity.mag(); // px/s

        if (speed > inertiaMaxSpeed) {
            speed = inertiaMaxSpeed;
            velocity._unit()._mult(speed);
        }

        var duration = speed / (inertiaDeceleration * inertiaLinearity),
            offset = velocity.mult(-duration / 2);

        this._map.panBy(offset, {
            duration: duration * 1000,
            easing: inertiaEasing,
            noMoveStart: true
        });

    },

    _onMouseUp: function (e) {
        this._onUp(e);
        document.removeEventListener('mousemove', this._onMove, false);
        document.removeEventListener('mouseup', this._onMouseUp, false);
    },

    _onTouchEnd: function (e) {
        this._onUp(e);
        document.removeEventListener('touchmove', this._onMove);
        document.removeEventListener('touchend', this._onTouchEnd);
    },

    _fireEvent: function (type, e) {
        return this._map.fire(type, { originalEvent: e });
    }

};
