'use strict';

var Control = require('./control');
var DOM = require('../../util/dom');
var util = require('../../util/util');

module.exports = Navigation;

function Navigation(options) {
    util.setOptions(this, options);
}

Navigation.prototype = util.inherit(Control, {
    options: {
        position: 'topright'
    },

    onAdd: function(map) {
        var className = 'mapboxgl-ctrl-nav';

        var container = this._container = DOM.create('div', className, map.getContainer());

        this._zoomInButton = this._createButton(className + '-zoom-in', map.zoomIn.bind(map));
        this._zoomOutButton = this._createButton(className + '-zoom-out', map.zoomOut.bind(map));
        this._compass = this._createButton(className + '-compass', map.resetNorth.bind(map));

        var compassCanvas = this._compassCanvas = DOM.create('canvas', className + '-compass-canvas', this._compass);
        compassCanvas.style.cssText = 'width:26px; height:26px;';
        compassCanvas.width = 26 * 2;
        compassCanvas.height = 26 * 2;

        this._compass.addEventListener('mousedown', this._onCompassDown.bind(this));
        this._onCompassMove = this._onCompassMove.bind(this);
        this._onCompassUp = this._onCompassUp.bind(this);

        this._compassCtx = compassCanvas.getContext('2d');

        map.on('rotate', this._drawNorth.bind(this));
        this._drawNorth();

        return container;
    },

    _onCompassDown: function(e) {
        DOM.disableDrag();

        document.addEventListener('mousemove', this._onCompassMove);
        document.addEventListener('mouseup', this._onCompassUp);
        this._prevX = e.screenX;

        e.stopPropagation();
    },

    _onCompassMove: function(e) {
        var x = e.screenX,
            d = x < 2 ? -5 : // left edge of the screen, continue rotating
                x > window.screen.width - 2 ? 5 : // right edge
                (x - this._prevX) / 4;

        this._map.setBearing(this._map.getBearing() - d);
        this._prevX = e.screenX;

        e.preventDefault();
    },

    _onCompassUp: function() {
        document.removeEventListener('mousemove', this._onCompassMove);
        document.removeEventListener('mouseup', this._onCompassUp);
        DOM.enableDrag();
    },

    _createButton: function(className, fn) {
        var a = DOM.create('button', className, this._container);
        a.addEventListener('click', function() { fn(); });
        return a;
    },

    _drawNorth: function() {
        var rad = 20,
            width = 8,
            center = 26,
            angle = this._map.transform.angle + (Math.PI / 2),
            ctx = this._compassCtx;

        this._compassCanvas.width = this._compassCanvas.width;

        ctx.translate(center, center);
        ctx.rotate(angle);

        ctx.beginPath();
        ctx.fillStyle = '#000';
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
