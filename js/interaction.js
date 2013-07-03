function Interaction(el) {
    var handlers = this.handlers = {};
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

    el.addEventListener('mousedown', function(ev) {
        pos = { x: ev.pageX, y: ev.pageY };
    }, false);

    document.addEventListener('mouseup', function() {
        pos = null;
    }, false);

    document.addEventListener('mousemove', function(ev) {
        pan(ev.pageX, ev.pageY);
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
