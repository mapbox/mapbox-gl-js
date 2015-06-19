'use strict';

var Evented = require('../util/evented');
var Point = require('point-geometry');

module.exports = Interaction;

/**
 * Mouse event
 *
 * @event mousemove
 * @memberof Map
 * @type {Object}
 * @property {Point} point the pixel location of the event
 * @property {Event} originalEvent the original DOM event
 */

/**
 * Double click event.
 *
 * @event dblclick
 * @memberof Map
 * @type {Object}
 * @property {Point} point the pixel location of the event
 */

/**
 * Pan event
 *
 * @event pan
 * @memberof Map
 * @type {Object}
 * @property {Point} point the pixel location of the event
 * @property {Point} offset a point representing the movement from the previous map location to the current one.
 */

/**
 * Pan end event
 *
 * @event panend
 * @memberof Map
 * @type {Object}
 * @property {number} velocity a measure of how much inertia was recorded in this pan motion
 */

function Interaction(el) {
    var interaction = this;
    if (!el) return;

    var panned = false,
        firstPos = null,
        pos = null;

    function mousePos(e) {
        var rect = el.getBoundingClientRect();
        e = e.touches ? e.touches[0] : e;
        return new Point(
            e.clientX - rect.left - el.clientLeft,
            e.clientY - rect.top - el.clientTop);
    }

    el.addEventListener('mousedown', onmousedown, false);
    el.addEventListener('touchstart', ontouchstart, false);

    document.addEventListener('mouseup', onmouseup, false);
    document.addEventListener('touchend', onmouseup, false);

    el.addEventListener('click', onclick, false);

    el.addEventListener('dblclick', ondoubleclick, false);
    window.addEventListener('resize', resize, false);

    function zoom(type, delta, point) {
        interaction.fire('zoom', {
            source: type,
            delta: delta,
            point: point
        });
    }

    function click(point, ev) {
        interaction.fire('click', {point: point, originalEvent: ev});
    }

    function pinch(scale, bearing, point) {
        interaction.fire('pinch', {
            scale: scale,
            bearing: bearing,
            point: point
        });
    }

    function mousemove(point, ev) {
        interaction.fire('mousemove', {point: point, originalEvent: ev});
    }

    function resize() {
        interaction.fire('resize');
    }

    function doubleclick(point, ev) {
        interaction.fire('dblclick', {
            point: point,
            originalEvent: ev
        });
    }

    function onmousedown(ev) {
        document.addEventListener('mousemove', onmousemove, false);
        document.addEventListener('touchmove', ontouchmove, false);

        firstPos = pos = mousePos(ev);
    }

    function onmouseup() {
        document.removeEventListener('mousemove', onmousemove, false);
        document.removeEventListener('touchmove', ontouchmove, false);

        panned = pos && firstPos && (pos.x !== firstPos.x || pos.y !== firstPos.y);

        pos = null;
    }

    function onmousemove(ev) {
        var point = mousePos(ev);

        if (pos) {
            pos = point;

        } else {
            var target = ev.toElement || ev.target;
            while (target && target !== el && target.parentNode) target = target.parentNode;
            if (target === el) {
                mousemove(point, ev);
            }
        }
    }

    function onclick(ev) {
        if (!panned) click(mousePos(ev), ev);
    }

    function ondoubleclick(ev) {
        doubleclick(mousePos(ev), ev);
        zoom('wheel', Infinity * (ev.shiftKey ? -1 : 1), mousePos(ev));
        ev.preventDefault();
    }

    var startVec;
    var tapped;

    function ontouchstart(e) {
        document.addEventListener('touchmove', ontouchmove, false);

        if (e.touches.length === 1) {
            if (!tapped) {
                tapped = setTimeout(function() {
                    tapped = null;
                }, 300);
            } else {
                clearTimeout(tapped);
                tapped = null;
                ondoubleclick(e);
            }

        } else if (e.touches.length === 2) {
            startVec = mousePos(e.touches[0]).sub(mousePos(e.touches[1]));
            interaction.fire('pinchstart');
        }
    }

    function ontouchmove(e) {
        if (e.touches.length === 2) {
            var p1 = mousePos(e.touches[0]),
                p2 = mousePos(e.touches[1]),
                p = p1.add(p2).div(2),
                vec = p1.sub(p2),
                scale = vec.mag() / startVec.mag(),
                bearing = vec.angleWith(startVec) * 180 / Math.PI;
            pinch(scale, bearing, p);
        }
        e.preventDefault();
    }
}

Interaction.prototype = Object.create(Evented);
