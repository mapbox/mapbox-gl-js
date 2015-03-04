'use strict';

var Evented = require('../util/evented');
var browser = require('../util/browser');
var Point = require('point-geometry');

module.exports = Interaction;

function Interaction(el) {
    var interaction = this;
    if (!el) return;

    var rotating = false,
        panned = false,
        boxzoom = false,
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
    el.addEventListener('keydown', keydown, false);

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

    function mousemove(point) {
        interaction.fire('mousemove', {point: point});
    }

    function pan(point) {
        if (pos) {
            var offset = pos.sub(point);
            interaction.fire('pan', {offset: offset});

            // add an averaged version of this movement to the inertia vector
            if (inertia) {
                var duration = Date.now() - now;
                // sometimes it's 0 after some erratic paning
                if (duration) {
                    var time = duration + now;
                    inertia.push([time, point]);
                    while (inertia.length > 2 && time - inertia[0][0] > 100) inertia.shift();
                }

            } else {
                inertia = [];
            }
            now = Date.now();
            pos = point;
        }
    }

    function resize() {
        interaction.fire('resize');
    }

    function keydown(ev) {
        if (boxzoom && ev.keyCode === 27) {
            interaction.fire('boxzoomcancel');
            boxzoom = false;
        }

        interaction.fire('keydown', ev);
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

    function doubleclick(point) {
        interaction.fire('dblclick', {point: point});
    }

    function onmousedown(ev) {
        firstPos = pos = mousePos(ev);
        interaction.fire('down');
        if (ev.shiftKey || ((ev.which === 1) && (ev.button === 1))) {
          boxzoom = true;
        }
    }

    function onmouseup(ev) {
        panned = pos && firstPos && (pos.x !== firstPos.x || pos.y !== firstPos.y);

        rotating = false;
        pos = null;

        if (boxzoom) {
            interaction.fire('boxzoomend', {
                start: firstPos,
                current: mousePos(ev)
            });
            boxzoom = false;

        } else if (inertia && inertia.length >= 2 && now > Date.now() - 100) {
            var last = inertia[inertia.length - 1],
                first = inertia[0],
                velocity = last[1].sub(first[1]).div(last[0] - first[0]);
            interaction.fire('panend', {inertia: velocity});

        } else {
          interaction.fire('panend');
        }

        inertia = null;
        now = null;
    }

    function onmousemove(ev) {
        var point = mousePos(ev);

        if (boxzoom) {
            interaction.fire('boxzoomstart', {
                start: firstPos,
                current: point
            });

        } else if (rotating) {
            rotate(point);

        } else if (pos) {
            pan(point);

        } else {
            var target = ev.toElement || ev.target;
            while (target && target !== el && target.parentNode) target = target.parentNode;
            if (target === el) {
                mousemove(point);
            }
        }
    }

    function onclick(ev) {
        if (!panned) click(mousePos(ev));
    }

    function ondoubleclick(ev) {
        doubleclick(mousePos(ev));
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

            // Slow down zoom if shift key is held for more precise zooming
            if (ev.shiftKey && value) value = value / 4;

            // Only fire the callback if we actually know what type of scrolling
            // device the user uses.
            if (type !== null) {
                callback(type, -value, point);
            }
        }

        function wheel(e) {
            var deltaY = e.deltaY;
            // Firefox doubles the values on retina screens...
            if (firefox && e.deltaMode === window.WheelEvent.DOM_DELTA_PIXEL) deltaY /= browser.devicePixelRatio;
            if (e.deltaMode === window.WheelEvent.DOM_DELTA_LINE) deltaY *= 40;
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
