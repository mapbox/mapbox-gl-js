function Interaction(el) {
    var handlers = this.handlers = {};
    var pos = null;
    el.addEventListener('mousedown', function(ev) {
        pos = { x: ev.pageX, y: ev.pageY };
    }, false);
    el.addEventListener('click', function(ev) {
        if (handlers.click) {
            var x = ev.pageX - ev.target.offsetLeft, y = ev.pageY - ev.target.offsetTop;
            for (var i = 0; i < handlers.click.length; i++) {
                handlers.click[i](x, y);
            }
        }
    }, false);
    document.addEventListener('mouseup', function() {
        pos = null;
    }, false);
    document.addEventListener('mousemove', function(ev) {
        if (pos) {
            if (handlers.pan) {
                var dx = ev.pageX - pos.x, dy = ev.pageY - pos.y;
                pos = { x: ev.pageX, y: ev.pageY };
                for (var i = 0; i < handlers.pan.length; i++) {
                    handlers.pan[i](dx, dy);
                }
            }
        }
    }, false);
    el.addEventListener(/Firefox/i.test(navigator.userAgent) ? 'DOMMouseScroll' : 'mousewheel', function(ev) {
        if (handlers.zoom) {
            var delta = ev.wheelDeltaY || (ev.detail*-120);
            // TODO: Give position of wheel event on the element to the handler
            var x = ev.pageX - ev.target.offsetLeft, y = ev.pageY - ev.target.offsetTop;
            for (var i = 0; i < handlers.zoom.length; i++) {
                handlers.zoom[i](delta, x, y);
            }
        }
        ev.preventDefault();
    }, false);
    el.addEventListener('dblclick', function(ev) {
        if (handlers.zoom) {
            var x = ev.pageX - ev.target.offsetLeft, y = ev.pageY - ev.target.offsetTop;
            for (var i = 0; i < handlers.zoom.length; i++) {
                handlers.zoom[i](500, x, y);
            }
        }
        ev.preventDefault();
    }, false);
}

Interaction.prototype.on = function(ev, fn) {
    if (!this.handlers[ev]) this.handlers[ev] = [];
    this.handlers[ev].push(fn);
    return this;
};
