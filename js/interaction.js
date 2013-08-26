function Interaction(el) {
    var handlers = this.handlers = {};
    var rotationKey = rotating = false;
    var pos = null;

    function zoom(delta, x, y) {
        if (handlers.zoom) {
            var rect = el.getBoundingClientRect();
            for (var i = 0; i < handlers.zoom.length; i++) {
                handlers.zoom[i](delta, x - rect.left, y - rect.top);
            }
        }
    }

    function click(x, y) {
        if (handlers.click) {
            var rect = el.getBoundingClientRect();
            for (var i = 0; i < handlers.click.length; i++) {
                handlers.click[i](x - rect.left, y - rect.left);
            }
        }
    }

    function pan(x, y) {
        if (pos && handlers.pan) {
            for (var i = 0; i < handlers.pan.length; i++) {
                handlers.pan[i](x - pos.x, y - pos.y);
            }
            pos = { x: x, y: y };
        }
    }

    function rotate(x, y) {
        if (pos && handlers.rotate) {
            for (var i = 0; i < handlers.rotate.length; i++) {
                handlers.rotate[i]([ x, y ], [ pos.x, pos.y ]);
            }
            pos = { x: x, y: y };
        }
    }


    document.addEventListener('keydown', function(ev) {
        if (ev.keyCode == 18) {
            rotating = rotationKey = true;
        }
    });

    document.addEventListener('keyup', function(ev) {
        if (ev.keyCode == 18) {
            rotationKey = false;
        }
    });

    el.addEventListener('mousedown', function(ev) {
        if (!rotationKey) {
            rotating = false;
        }
        pos = { x: ev.pageX, y: ev.pageY };
    }, false);

    document.addEventListener('mouseup', function() {
        if (!rotationKey) {
            rotating = false;
        }
        pos = null;
    }, false);

    document.addEventListener('mousemove', function(ev) {
        if (rotating) {
            rotate(ev.pageX, ev.pageY);
        }
        else {
            pan(ev.pageX, ev.pageY);
        }
    }, false);

    el.addEventListener('click', function(ev) {
        click(ev.pageX, ev.pageY);
    }, false);

    el.addEventListener(/Firefox/i.test(navigator.userAgent) ? 'DOMMouseScroll' : 'mousewheel', function(ev) {
        zoom(ev.wheelDeltaY || (ev.detail * -120), ev.pageX, ev.pageY);
        ev.preventDefault();
    }, false);

    el.addEventListener('dblclick', function(ev) {
        zoom(500, ev.pageX, ev.pageY);
        ev.preventDefault();
    }, false);
}

Interaction.prototype.on = function(ev, fn) {
    if (!this.handlers[ev]) this.handlers[ev] = [];
    this.handlers[ev].push(fn);
    return this;
};
