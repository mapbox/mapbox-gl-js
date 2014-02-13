'use strict';

var evented = require('../lib/evented.js');

module.exports = Interaction;
evented(Interaction);
function Interaction(el) {
    var interaction = this;
    if (!el) return;

    var rotating = false,
        panned = false,
        firstPos = null,
        pos = null,
        inertia = null,
        now;

    el.addEventListener('contextmenu', function(ev) {
        rotating = true;
        firstPos = pos = { x: ev.pageX, y: ev.pageY };
        ev.preventDefault();
    }, false);
    el.addEventListener('mousedown', onmousedown, false);
    document.addEventListener('mouseup', onmouseup, false);
    document.addEventListener('mousemove', onmousemove, false);
    el.addEventListener('click', onclick, false);
    scrollwheel(el, zoom);
    el.addEventListener('dblclick', ondoubleclick, false);
    window.addEventListener('resize', resize, false);

    function zoom(type, delta, x, y) {
        interaction.fire('zoom', [ type, delta, x - el.offsetLeft, y - el.offsetTop ]);
        inertia = null;
        now = null;
    }

    function click(x, y) {
        interaction.fire('click', [ x - el.offsetLeft, y - el.offsetTop ]);
    }

    function hover(x, y) {
        interaction.fire('hover', [ x - el.offsetLeft, y - el.offsetTop ]);
    }

    function pan(x, y) {
        if (pos) {
            interaction.fire('pan', [pos.x - x, pos.y - y]);

            // add an averaged version of this movement to the inertia vector
            if (inertia) {
                var speed = Date.now() - now;
                // sometimes it's 0 after some erratic paning
                if (speed) {
                    inertia.x *= 0.8;
                    inertia.y *= 0.8;
                    inertia.x += (pos.x - x) / speed;
                    inertia.y += (pos.y - y) / speed;
                }
            } else {
                inertia = {x: 0, y: 0};
            }
            now = Date.now();
            pos = {x: x, y: y};
        }
    }

    function resize() {
        interaction.fire('resize');
    }

    function rotate(x, y) {
        if (pos) {
            interaction.fire('rotate', [ firstPos, pos, { x: x, y: y } ]);
            pos = { x: x, y: y };
        }
    }

    function onmousedown(ev) {
        firstPos = pos = { x: ev.pageX, y: ev.pageY };
    }

    function onmouseup() {
        panned = pos && firstPos && (pos.x != firstPos.x || pos.y != firstPos.y);

        rotating = false;
        pos = null;
        if (now > +new Date() - 100) {
            interaction.fire('panend', [ inertia.x, inertia.y ]);
        }
        inertia = null;
        now = null;
    }

    function onmousemove(ev) {
        if (rotating) {
            rotate(ev.pageX, ev.pageY);
        } else if (pos) {
            pan(ev.pageX, ev.pageY);
        } else {
            var target = ev.toElement;
            while (target != el && target.parentNode) target = target.parentNode;
            if (target == el) {
                hover(ev.pageX, ev.pageY);
            }
        }
    }

    function onclick(ev) {
        if (!panned) {
            click(ev.pageX, ev.pageY);
        }
    }

    function ondoubleclick(ev) {
        zoom('wheel', Infinity * (ev.shiftKey ? -1 : 1), ev.pageX, ev.pageY);
        ev.preventDefault();
    }
}

function scrollwheel(el, callback) {
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
                callback(type, -initialValue, ev.pageX, ev.pageY);
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
            callback(type, -value, ev.pageX, ev.pageY);
        }
    }

    function wheel(e) {
        var deltaY = e.deltaY;
        // Firefox doubles the values on retina screens...
        if (firefox && e.deltaMode == window.WheelEvent.DOM_DELTA_PIXEL) deltaY /= window.devicePixelRatio;
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
