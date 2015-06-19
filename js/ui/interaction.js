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

    document.addEventListener('mouseup', onmouseup, false);

    el.addEventListener('click', onclick, false);

    window.addEventListener('resize', resize, false);

    function click(point, ev) {
        interaction.fire('click', {point: point, originalEvent: ev});
    }

    function mousemove(point, ev) {
        interaction.fire('mousemove', {point: point, originalEvent: ev});
    }

    function resize() {
        interaction.fire('resize');
    }

    function onmousedown(ev) {
        document.addEventListener('mousemove', onmousemove, false);

        firstPos = pos = mousePos(ev);
    }

    function onmouseup() {
        document.removeEventListener('mousemove', onmousemove, false);

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
}

Interaction.prototype = Object.create(Evented);
