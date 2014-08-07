'use strict';

var Control = require('./control.js'),
    DOM = require('../../util/dom.js'),
    util = require('../../util/util.js');

module.exports = Navigation;

function Navigation() {}

Navigation.prototype = util.inherit(Control, {
    onAdd: function(map) {
        var className = 'mapboxgl-zoom-ctrl';

        var container = this._container = DOM.create('div', className);

        this._northButton = this._createButton(className + '-north-btn', map.resetNorth.bind(map));
        this._zoomInButton = this._createButton(className + '-zoom-in-btn', map.zoomIn.bind(map));
        this._zoomOutButton = this._createButton(className + '-zoom-out-btn', map.zoomOut.bind(map));

        var northCanvas = this._northCanvas =
                this._northButton.appendChild(DOM.create('canvas', className + '-north-btn-canvas'));
        northCanvas.style.cssText = 'width:26px; height:26px;';
        northCanvas.width = 26 * 2;
        northCanvas.height = 26 * 2;

        this._northCtx = northCanvas.getContext('2d');

        map.on('rotate', this._drawNorth.bind(this));
        this._drawNorth();

        map.container.appendChild(container);

        return container;
    },

    _createButton: function(className, fn) {
        var a = DOM.create('a', className);
        a.href = '#';
        a.addEventListener('click', function (e) {
            fn();
            e.preventDefault();
            e.stopPropagation();
        });
        this._container.appendChild(a);
        return a;
    },

    _drawNorth: function() {
        var rad = 10 * 2,
            width = rad / 3,
            center = 12 * 2 + 1,
            angle = this._map.transform.angle + (Math.PI / 2),
            ctx = this._northCtx;

        this._northCanvas.width = this._northCanvas.width;

        ctx.translate(center, center);
        ctx.rotate(angle);

        ctx.beginPath();
        ctx.fillStyle = 'red';
        ctx.lineTo(0, -width);
        ctx.lineTo(-rad, 0);
        ctx.lineTo(0, width);
        ctx.fill();

        ctx.beginPath();
        ctx.fillStyle = '#bbb';
        ctx.moveTo(0, 0);
        ctx.lineTo(0, width);
        ctx.lineTo(rad, 0);
        ctx.lineTo(0, -width);
        ctx.fill();

        ctx.beginPath();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 4;
        ctx.moveTo(0, -width);
        ctx.lineTo(0, width);
        ctx.stroke();
    }
});
