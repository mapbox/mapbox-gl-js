'use strict';

var Evented = require('../util/evented.js'),
    browser = require('../util/browser.js'),
    Point = require('point-geometry');

module.exports = Interaction;

function Interaction(el) {
    var interaction = this;
    if (!el) return;

    var rotating = false,
        panned = false,
        firstPos = null,
        pos = null,
        inertia = null,
        now;

    function mousePos(e) {
        var rect = el.getBoundingClientRect();
        return new Point(
            e.clientX - rect.left - el.clientLeft,
            e.clientY - rect.top - el.clientTop);
    }

    el.addEventListener('contextmenu', function(ev) {
        rotating = true;
        firstPos = pos = mousePos(ev);
        ev.preventDefault();
    }, false);
    el.addEventListener('mousedown', onmousedown, false);
    document.addEventListener('mouseup', onmouseup, false);
    document.addEventListener('mousemove', onmousemove, false);
    el.addEventListener('click', onclick, false);
    scrollwheel(zoom);
    el.addEventListener('dblclick', ondoubleclick, false);
    window.addEventListener('resize', resize, false);

    function zoom(type, delta, point) {
        interaction.fire('zoom', {
            source: type,
            delta: delta,
            point: point
        });
        inertia = null;
        now = null;
    }

    function click(point) {
        interaction.fire('click', {point: point});
    }

    function hover(point) {
        interaction.fire('hover', {point: point});
    }

    function pan(point) {
        if (pos) {
            var offset = pos.sub(point);
            interaction.fire('pan', {offset: offset});

            // add an averaged version of this movement to the inertia vector
            if (inertia) {
                var speed = Date.now() - now;
                // sometimes it's 0 after some erratic paning
                if (speed) inertia._mult(0.8)._add(offset.div(speed));

            } else {
                inertia = new Point(0, 0);
            }
            now = Date.now();
            pos = point;
        }
    }

    function resize() {
        interaction.fire('resize');
    }

    function rotate(point) {
        if (pos) {
            interaction.fire('rotate', {
                start: firstPos,
                prev: pos,
                current: point
            });
            pos = point;
        }
    }

    function onmousedown(ev) {
        firstPos = pos = mousePos(ev);
    }

    function onmouseup() {
        panned = pos && firstPos && (pos.x != firstPos.x || pos.y != firstPos.y);

        rotating = false;
        pos = null;
        if (now > +new Date() - 100) interaction.fire('panend', {inertia: inertia});
        inertia = null;
        now = null;
    }

    function onmousemove(ev) {
        var point = mousePos(ev);

        if (rotating) { rotate(point); }
        else if (pos) pan(point);
        else {
            var target = ev.toElement;
            while (target && target != el && target.parentNode) target = target.parentNode;
            if (target == el) {
                hover(point);
            }
        }
    }

    function onclick(ev) {
        if (!panned) click(mousePos(ev));
    }

    function ondoubleclick(ev) {
        zoom('wheel', Infinity * (ev.shiftKey ? -1 : 1), mousePos(ev));
        ev.preventDefault();
    }

    function scrollwheel(callback) {
        var firefox = /Firefox/i.test(navigator.userAgent);
        var safari = /Safari/i.test(navigator.userAgent) && !/Chrom(ium|e)/i.test(navigator.userAgent);
        var time = window.performance || Date;

        el.addEventListener('wheel', wheel, false);
        el.addEventListener('mousewheel', mousewheel, false);

        var lastEvent = 0;

        var type = null;
        var typeTimeout = null;
        var initialValue = null;

        function scroll(value, ev) {
            var stamp = time.now();
            var timeDelta = stamp - lastEvent;
            lastEvent = stamp;

            var point = mousePos(ev);

            if (value !== 0 && (value % 4.000244140625) === 0) {
                // This one is definitely a mouse wheel event.
                type = 'wheel';
            } else if (value !== 0 && Math.abs(value) < 4) {
                // This one is definitely a trackpad event because it is so small.
                type = 'trackpad';
            } else if (timeDelta > 400) {
                // This is likely a new scroll action.
                type = null;
                initialValue = value;
                // Start a timeout in case this was a singular event, and dely it
                // by up to 40ms.
                typeTimeout = setTimeout(function() {
                    type = 'wheel';
                    callback(type, -initialValue, point);
                }, 40);
            } else if (type === null) {
                // This is a repeating event, but we don't know the type of event
                // just yet. If the delta per time is small, we assume it's a
                // fast trackpad; otherwise we switch into wheel mode.
                type = (Math.abs(timeDelta * value) < 200) ? 'trackpad' : 'wheel';

                // Make sure our delayed event isn't fired again, because we
                // accumulate the previous event (which was less than 40ms ago) into
                // this event.
                if (typeTimeout) {
                    clearTimeout(typeTimeout);
                    typeTimeout = null;
                    value += initialValue;
                }
            }

            // Only fire the callback if we actually know what type of scrolling
            // device the user uses.
            if (type !== null) {
                callback(type, -value, point);
            }
        }

        function wheel(e) {
            var deltaY = e.deltaY;
            // Firefox doubles the values on retina screens...
            if (firefox && e.deltaMode == window.WheelEvent.DOM_DELTA_PIXEL) deltaY /= browser.devicePixelRatio;
            if (e.deltaMode == window.WheelEvent.DOM_DELTA_LINE) deltaY *= 40;
            scroll(deltaY, e);
            e.preventDefault();
        }

        function mousewheel(e) {
            var deltaY = -e.wheelDeltaY;
            if (safari) deltaY = deltaY / 3;
            scroll(deltaY, e);
            e.preventDefault();
        }
    }
}

Interaction.prototype = Object.create(Evented);
