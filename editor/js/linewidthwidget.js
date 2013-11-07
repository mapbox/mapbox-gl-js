

E.ender({
    drag: function (down, move, up) {
        return this.on('mousedown', function(e) {
            if (down(e)) {
                E(window)
                    .on('mousemove', move)
                    .one('mouseup', function(e) {
                        E(window).off('mousemove', move);
                        if (up) up(e);
                    });
            }
        });
    }
}, true);


function formatNumber(num, maxdecimals) {
    maxdecimals = +maxdecimals;
    if (typeof maxdecimals !== 'number') maxdecimals = 0;
    var factor = Math.pow(10, maxdecimals);
    return (Math.round(num * factor) / factor).toFixed(maxdecimals).replace(/\.?0+$/, '');
}

function clamp(val, min, max) {
    return val > max ? max : val < min ? min : val;
}



function LineWidthWidget(stops) {
    var widget = this;

    this.pivot = null;
    this.stops = stops;

    this.clickTargetSize = 10;
    this.width = 255;
    this.height = 250;
    this.padding = {
        left: 44,
        top: 10,
        bottom: 35,
        right: 10
    };

    // setup Canvas.
    this.canvas = E('<canvas>').addClass('linewidth');
    this.resize();
    this.ctx = this.canvas.get(0).getContext('2d');
    this.ctx.scale(devicePixelRatio, devicePixelRatio);

    // this.setupResizer();
    this.setupPivot();
    this.setupInteractivity();

    this.draw();
}

LineWidthWidget.prototype.setupResizer = function() {
    var widget = this;
    // Allow resizing this canvas.
    var wrapper = E('<div class="resize"></div>').append(this.canvas).appendTo('body');
    this.canvas.css({ cursor: 'default' });
    wrapper.css({ cursor: 'se-resize', display: 'inline-block', padding: '0 3px 3px 0' });
    wrapper.on('mousedown', function(e) {
        var before = { x: e.pageX, y: e. pageY };
        E(window).on('mousemove', move).one('mouseup', function() {
            E(window).off('mousemove', move);
        });

        function move(e) {
            widget.width += e.pageX - before.x;
            widget.height += e.pageY - before.y;
            widget.resize();
            widget.draw();
            before = { x: e.pageX, y: e.pageY };
        }
    });

};

LineWidthWidget.prototype.setupPivot = function() {
    var widget = this;
    // this.canvas.on('mousemove', function(e) {
    //     var x = e.pageX - e.target.offsetLeft;
    //     var y = e.pageY - e.target.offsetTop;

    //     widget.pivot = clamp(widget.reverseX(x), 0, 20);
    //     require('bean').fire(widget, 'pivot', [ widget.pivot ]);
    //     widget.draw();    
    // });

    this.canvas.on('contextmenu', function(e) {
        e.preventDefault();
    });

    // this.canvas.on('mouseout', function() {
    //     widget.pivot = undefined;
    //     widget.draw();
    // });
};

LineWidthWidget.prototype.setupInteractivity = function() {
    var widget = this;
    var stop = null;
    this.canvas.drag(function down(e) {
        var offset = widget.canvas.offset();
        var x = e.pageX - offset.left;
        var y = e.pageY - offset.top;

        stop = widget.stopAtPosition(x, y);

        if (stop && e.rightClick) {
            // Remove stops when right-clicking
            var i = widget.stops.indexOf(stop);
            widget.stops.splice(i, 1);
            e.preventDefault();
        }
        else if (!stop && !e.rightClick) {
            // Ad a new stop when clicking at an inactive region.
            stop = { z: widget.reverseX(x), val: widget.reverseY(y) };
            widget.stops.push(stop);
        }

        widget.updateStops();
        widget.draw();

        // Stop other interactions from happening on this canvas.
        e.stop();
        return stop;
    }, function move(e) {
        if (stop) {
            var offset = widget.canvas.offset();
            stop.z = clamp(widget.reverseX(e.pageX - offset.left), 0, 20);
            stop.val = widget.reverseY(e.pageY - offset.top);

            // Force to current zoom level when pressing Cmd.
            if (e.metaKey) {
                stop.z = widget.pivot;
            }

            widget.updateStops();
            widget.draw();
            e.stop();
        }
    });
};

LineWidthWidget.prototype.stopAtPosition = function(x, y) {
    var r = this.clickTargetSize * this.clickTargetSize;
    var stop = null;
    for (var i = 0; i < this.transformedStops.length; i++) {
        var transformedStop = this.transformedStops[i];
        var dx = transformedStop.x - x;
        var dy = transformedStop.y - y;
        if (dx * dx + dy * dy < r) {
            stop = this.stops[i];
        }
    }
    return stop;
};

LineWidthWidget.prototype.updateStops = function() {
    this.stops.sort(function(a, b) {
        return a.z - b.z;
    });
    this.fn = llmr.style.fns.stops.apply(llmr.style.fns, this.stops);

    this.transformedStops = [];
    for (var i = 0; i < this.stops.length; i++) {
        var x = this.convertX(this.stops[i].z);
        var y = this.convertY(this.stops[i].val);

        this.transformedStops.push({ x: x, y: y });
    }

    var bean = require('bean');
    bean.fire(this, 'stops', [this.stops]);
};

LineWidthWidget.prototype.resize = function() {
    this.zfactor = Math.floor((this.width - this.padding.left - this.padding.right) / 20);
    this.yfactor = Math.floor((this.height - this.padding.top - this.padding.bottom) / 5);


    this.updateStops();

    this.canvas
        .attr({
            width: this.width * devicePixelRatio,
            height: this.height * devicePixelRatio
        })
        .css({
            width: this.width + 'px',
            height: this.height + 'px'
        });
};

// Converts the line width value to y pixel coordinates in this canvas.
LineWidthWidget.prototype.convertY = function(val) {
    return this.height - this.padding.bottom - this.yfactor * (Math.log(val) / Math.log(10) + 2) - 0.5;
};

// Converts y coordinates to to the line width.
LineWidthWidget.prototype.reverseY = function(val) {
    return Math.pow(10, (val - this.height + this.padding.bottom + 0.5) / -this.yfactor - 2);
};

// Converts the zoom level to the x pixel coordinate.
LineWidthWidget.prototype.convertX = function(val) {
    return this.padding.left + val * this.zfactor;
}

// Converst the x coordinate to the zoom level.
LineWidthWidget.prototype.reverseX = function(val) {
    return (val - this.padding.left) / this.zfactor;
};



LineWidthWidget.prototype.draw = function() {
    var ctx = this.ctx;
    var width = this.width;
    var height = this.height;
    var padding = this.padding;
    var stops = this.stops;
    var transformedStops = this.transformedStops;
    var fn = this.fn;
    var pivot = this.pivot;

    ctx.clearRect(0, 0, width, height);

    ctx.font = '10px Open Sans';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#AAA';

    // horizontal lines
    ctx.textAlign = 'right';
    for (var y = 0.01; y <= 1000; y *= 10) {
        ctx.beginPath();
        ctx.fillText(formatNumber(y, 2), this.convertX(0) - 4, this.convertY(y) + 2);
        ctx.moveTo(this.convertX(0) - 1, this.convertY(y));
        ctx.lineTo(this.convertX(20), this.convertY(y));
        ctx.strokeStyle = '#666';
        ctx.stroke();

        ctx.beginPath();
        for (var i = 2; i < 10; i++) {
            ctx.moveTo(this.convertX(0) - 1, this.convertY(y * i));
            ctx.lineTo(this.convertX(20), this.convertY(y * i));
        }
        ctx.strokeStyle = '#444';
        ctx.stroke();
    }

    // vertical lines
    ctx.textAlign = 'right';
    ctx.beginPath();
    for (var z = 0; z <= 20; z++) {
        ctx.moveTo(this.convertX(z) - 0.5, this.convertY(1000));
        ctx.lineTo(this.convertX(z) - 0.5, this.convertY(0.01));

        ctx.save();
        ctx.translate(this.convertX(z), this.convertY(0.01) + 4);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(z, 0, 3);
        ctx.restore();
    }
    ctx.strokeStyle = '#666';
    ctx.stroke();


    // Draw reference lines that show exponential width.
    ctx.beginPath();
    for (var i = 0; i < stops.length; i++) {
        var y1 = Math.pow(2, stops[i].z - 2) * (stops[i].val / Math.pow(2, stops[i].z));
        ctx.moveTo(this.convertX(stops[i].z - 2), this.convertY(y1));
        var y2 = Math.pow(2, stops[i].z + 2) * (stops[i].val / Math.pow(2, stops[i].z));
        ctx.lineTo(this.convertX(stops[i].z + 2), this.convertY(y2));
    }


    if (ctx.setLineDash) ctx.setLineDash([1, 2]);
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1;
    ctx.stroke();

    if (ctx.setLineDash) ctx.setLineDash([]);

    // Draw the actual curve.
    ctx.beginPath();
    // ctx.moveTo(this.convertX(0), this.convertY(Math.pow(2, 0) * (stops[0].val / Math.pow(2, stops[0].z))));

    for (var i = 0; i < transformedStops.length; i++) {
        ctx.lineTo(transformedStops[i].x, transformedStops[i].y);
    }
    // ctx.lineTo(this.convertX(20), this.convertY(Math.pow(2, 20) * (stops[i - 1].val / Math.pow(2, stops[i - 1].z))));

    ctx.strokeStyle = '#FFF';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    for (var i = 0; i < stops.length; i++) {
        ctx.beginPath();
        var x = this.convertX(stops[i].z);
        var y = this.convertY(stops[i].val);
        ctx.arc(x, y, 6, 0, Math.PI * 2, false);
        ctx.fill();
    }

    // Draw the red pivot marker indicating the current zoom level.
    if (typeof pivot === 'number' && !isNaN(pivot)) {
        ctx.beginPath();
        ctx.moveTo(Math.round(this.convertX(pivot)) - 0.5, this.convertY(1000));
        ctx.lineTo(Math.round(this.convertX(pivot)) - 0.5, this.convertY(0.01) + 16);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#F00';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(this.convertX(pivot) - 0.5, this.convertY(1000) - 3, 3, 0, Math.PI * 2, false)
        ctx.stroke();


        var y = fn(pivot);
        var num = formatNumber(y, 2);
        ctx.textAlign = 'left';
        ctx.font = 'bold 10px Open Sans';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 3;

        var textSide = pivot >= 10 ? -1 : 1;

        var textX, textY;
        if (pivot >= 10) {
            textX = this.convertX(pivot) - 4;
            textY = this.convertY(y) - 2;
            ctx.textAlign = 'right';
        } else {
            textX = this.convertX(pivot) + 4;
            textY = this.convertY(y) + 10;
            ctx.textAlign = 'left';
        }
        ctx.strokeText(num, textX, textY);
        ctx.fillStyle = 'white';
        ctx.fillText(num, textX, textY);

        ctx.textAlign = 'center';
        ctx.font = 'bold 12px Open Sans';
        ctx.fillText('z=' + (+pivot).toFixed(2), Math.round(this.convertX(pivot)) - 0.5, this.convertY(0.01) + 28);
    }
};

LineWidthWidget.prototype.on = function() {
    var bean = require('bean');
    var args = Array.prototype.slice.call(arguments);
    args.unshift(this);
    bean.on.apply(bean, args);
};

LineWidthWidget.prototype.setPivot = function(val) {
    this.pivot = val;
    this.draw();
};
