'use strict';

var Control = require('./control.js'),
    DOM = require('../../util/dom.js'),
    util = require('../../util/util.js');

module.exports = Navigation;

function Navigation() {}

Navigation.prototype = util.inherit(Control, {
    onAdd: function(map) {
        var className = 'mapboxgl-zoom-ctrl';

        var container = this._container = DOM.create('div', className, map.container);

        this._compass = this._createButton(className + '-compass', map.resetNorth.bind(map));
        this._zoomInButton = this._createButton(className + '-zoom-in-btn', map.zoomIn.bind(map));
        this._zoomOutButton = this._createButton(className + '-zoom-out-btn', map.zoomOut.bind(map));

        var compassCanvas = this._compassCanvas = DOM.create('canvas', className + '-compass-canvas', this._compass);
        compassCanvas.style.cssText = 'width:26px; height:26px;';
        compassCanvas.width = 26 * 2;
        compassCanvas.height = 26 * 2;

        this._compassCtx = compassCanvas.getContext('2d');

        map.on('rotate', this._drawNorth.bind(this));
        this._drawNorth();

        return container;
    },

    _createButton: function(className, fn) {
        var a = DOM.create('a', className, this._container);
        a.href = '#';
        a.addEventListener('click', function (e) {
            fn();
            e.preventDefault();
            e.stopPropagation();
        });
        return a;
    },

    _drawNorth: function() {
        var rad = 10 * 2,
            width = rad / 3,
            center = 12 * 2 + 1,
            angle = this._map.transform.angle + (Math.PI / 2),
            ctx = this._compassCtx;

        this._compassCanvas.width = this._compassCanvas.width;

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
