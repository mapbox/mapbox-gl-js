'use strict';

var DOM = require('../../util/dom'),
    Point = require('point-geometry'),
    util = require('../../util/util');

module.exports = DragRotate;

var inertiaLinearity = 0.25,
    inertiaEasing = util.bezier(0, 0, inertiaLinearity, 1),
    inertiaMaxSpeed = 180, // deg/s
    inertiaDeceleration = 720; // deg/s^2


function DragRotate(map) {
    this._map = map;
    this._el = map.getCanvasContainer();

    util.bindHandlers(this);
}

DragRotate.prototype = {
    enable: function () {
        this._el.addEventListener('mousedown', this._onDown);
    },

    disable: function () {
        this._el.removeEventListener('mousedown', this._onDown);
    },

    _onDown: function (e) {
        if (this._ignoreEvent(e)) return;
        if (this.active) return;

        document.addEventListener('mousemove', this._onMove);
        document.addEventListener('mouseup', this._onUp);

        this.active = false;
        this._inertia = [[Date.now(), this._map.getBearing()]];
        this._startPos = this._pos = DOM.mousePos(this._el, e);
        this._center = this._map.transform.centerPoint;  // Center of rotation

        // If the first click was too close to the center, move the center of rotation by 200 pixels
        // in the direction of the click.
        var startToCenter = this._startPos.sub(this._center),
            startToCenterDist = startToCenter.mag();

        if (startToCenterDist < 200) {
            this._center = this._startPos.add(new Point(-200, 0)._rotate(startToCenter.angle()));
        }

        e.preventDefault();
    },

    _onMove: function (e) {
        if (this._ignoreEvent(e)) return;

        if (!this.active) {
            this.active = true;
            this._fireEvent('rotatestart', e);
            this._fireEvent('movestart', e);
        }

        var map = this._map;
        map.stop();

        var p1 = this._pos,
            p2 = DOM.mousePos(this._el, e),
            center = this._center,
            bearingDiff = p1.sub(center).angleWith(p2.sub(center)) / Math.PI * 180,
            bearing = map.getBearing() - bearingDiff,
            inertia = this._inertia,
            last = inertia[inertia.length - 1];

        this._drainInertiaBuffer();
        inertia.push([Date.now(), map._normalizeBearing(bearing, last[1])]);

        map.transform.bearing = bearing;

        this._fireEvent('rotate', e);
        this._fireEvent('move', e);

        this._pos = p2;
    },

    _onUp: function (e) {
        if (this._ignoreEvent(e)) return;
        document.removeEventListener('mousemove', this._onMove);
        document.removeEventListener('mouseup', this._onUp);

        if (!this.active) return;

        this.active = false;
        this._fireEvent('rotateend', e);
        this._drainInertiaBuffer();

        var map = this._map,
            mapBearing = map.getBearing(),
            inertia = this._inertia;

        var finish = function() {
            if (Math.abs(mapBearing) < map.options.bearingSnap) {
                map.resetNorth({noMoveStart: true}, { originalEvent: e });
            } else {
                this._fireEvent('moveend', e);
            }
        }.bind(this);

        if (inertia.length < 2) {
            finish();
            return;
        }

        var first = inertia[0],
            last = inertia[inertia.length - 1],
            previous = inertia[inertia.length - 2],
            bearing = map._normalizeBearing(mapBearing, previous[1]),
            flingDiff = last[1] - first[1],
            sign = flingDiff < 0 ? -1 : 1,
            flingDuration = (last[0] - first[0]) / 1000;

        if (flingDiff === 0 || flingDuration === 0) {
            finish();
            return;
        }

        var speed = Math.abs(flingDiff * (inertiaLinearity / flingDuration));  // deg/s
        if (speed > inertiaMaxSpeed) {
            speed = inertiaMaxSpeed;
        }

        var duration = speed / (inertiaDeceleration * inertiaLinearity),
            offset = sign * speed * (duration / 2);

        bearing += offset;

        if (Math.abs(map._normalizeBearing(bearing, 0)) < map.options.bearingSnap) {
            bearing = map._normalizeBearing(0, bearing);
        }

        map.rotateTo(bearing, {
            duration: duration * 1000,
            easing: inertiaEasing,
            noMoveStart: true
        }, { originalEvent: e });
    },

    _fireEvent: function (type, e) {
        return this._map.fire(type, { originalEvent: e });
    },

    _ignoreEvent: function (e) {
        var map = this._map;

        if (map.boxZoom && map.boxZoom.active) return true;
        if (map.dragPan && map.dragPan.active) return true;
        if (e.touches) {
            return (e.touches.length > 1);
        } else {
            var buttons = (e.ctrlKey ? 1 : 2),  // ? ctrl+left button : right button
                button = (e.ctrlKey ? 0 : 2);   // ? ctrl+left button : right button
            return (e.type === 'mousemove' ? e.buttons & buttons === 0 : e.button !== button);
        }
    },

    _drainInertiaBuffer: function () {
        var inertia = this._inertia,
            now = Date.now(),
            cutoff = 160;   //msec

        while (inertia.length > 0 && now - inertia[0][0] > cutoff)
            inertia.shift();
    }

};


/**
 * Rotate start event. This event is emitted at the start of a user-initiated rotate interaction.
 *
 * @event rotatestart
 * @memberof Map
 * @instance
 * @property {EventData} data Original event data
 */

/**
 * Rotate event. This event is emitted repeatedly during a user-initiated rotate interaction.
 *
 * @event rotate
 * @memberof Map
 * @instance
 * @property {EventData} data Original event data
 */

/**
 * Rotate end event. This event is emitted at the end of a user-initiated rotate interaction.
 *
 * @event rotateend
 * @memberof Map
 * @instance
 * @property {EventData} data Original event data
 */
