function Interaction(el) {
    var handlers = {};
    this.handlers = handlers;
    var rotating = false,
        firstPos = null,
        pos = null,
        offsetLeft = el.offsetLeft,
        offsetTop = el.offsetTop,
        inertia = { x: 0, y: 0 },
        now;

    document.addEventListener('contextmenu', function(ev) {
        rotating = true;
        firstPos = pos = { x: ev.pageX, y: ev.pageY };
        ev.preventDefault();
    }, false);
    el.addEventListener('mousedown', onmousedown, false);
    document.addEventListener('mouseup', onmouseup, false);
    document.addEventListener('mousemove', onmousemove, false);
    el.addEventListener('click', onclick, false);
    el.addEventListener(/Firefox/i.test(navigator.userAgent) ? 'DOMMouseScroll' : 'mousewheel', onmousewheel, false);
    el.addEventListener('dblclick', ondoubleclick, false);
    window.addEventListener('resize', resize, false);

    function zoom(delta, x, y) {
        if (!handlers.zoom) return;
        for (var i = 0; i < handlers.zoom.length; i++) {
            handlers.zoom[i](delta, x - offsetLeft, y - offsetTop);
        }
        inertia = { x: 0, y: 0 };
        now = null;
    }

    function click(x, y) {
        if (!handlers.click) return;
        for (var i = 0; i < handlers.click.length; i++) {
            handlers.click[i](x - offsetLeft, y - offsetTop);
        }
    }

    function pan(x, y) {
        if (pos && handlers.pan) {
            for (var i = 0; i < handlers.pan.length; i++) {
                handlers.pan[i](x - pos.x, y - pos.y);
            }
            // add an averaged version of this movement to the inertia
            // vector
            if (now) {
                var speed = (+new Date()) - now;
                inertia.x *= 0.8;
                inertia.y *= 0.8;
                inertia.x += (x - pos.x) / speed;
                inertia.y += (y - pos.y) / speed;
            }
            now = +new Date();
            pos = { x: x, y: y };
        }
    }

    function resize() {
        if (!handlers.resize) return;
        for (var i = 0; i < handlers.resize.length; i++) {
            handlers.resize[i]();
        }
        offsetLeft = el.offsetLeft;
    }

    function rotate(x, y) {
        if (pos && handlers.rotate) {
            for (var i = 0; i < handlers.rotate.length; i++) {
                handlers.rotate[i](firstPos, pos, { x: x, y: y });
            }
            pos = { x: x, y: y };
        }
    }

    function onmousedown(ev) {
        firstPos = pos = { x: ev.pageX, y: ev.pageY };
    }

    function onmouseup() {
        rotating = false;
        pos = null;
        if (now > +new Date() - 100) {
            for (var i = 0; i < handlers.panend.length; i++) {
                handlers.panend[i](inertia.x, inertia.y);
            }
        }
        inertia = { x: 0, y: 0 };
        now = null;
    }

    function onmousemove(ev) {
        if (rotating) {
            rotate(ev.pageX, ev.pageY);
        } else {
            pan(ev.pageX, ev.pageY);
        }
    }

    function onclick(ev) {
        click(ev.pageX, ev.pageY);
    }

    function onmousewheel(ev) {
        zoom(ev.wheelDeltaY || (ev.detail * -120), ev.pageX, ev.pageY);
        ev.preventDefault();
    }

    function ondoubleclick(ev) {
        zoom(Infinity * (ev.shiftKey ? -1 : 1), ev.pageX, ev.pageY);
        ev.preventDefault();
    }
}

Interaction.prototype.on = function(ev, fn) {
    if (!this.handlers[ev]) this.handlers[ev] = [];
    this.handlers[ev].push(fn);
    return this;
};
