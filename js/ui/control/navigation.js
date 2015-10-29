'use strict';

var Control = require('./control');
var DOM = require('../../util/dom');
var util = require('../../util/util');

module.exports = Navigation;

/**
 * Creates a navigation control with zoom buttons and a compass
 * @class Navigation
 * @param {Object} [options]
 * @param {string} [options.position=top-right] A string indicating the control's position on the map. Options are `top-right`, `top-left`, `bottom-right`, `bottom-left`
 * @example
 * map.addControl(new mapboxgl.Navigation({position: 'top-left'})); // position is optional
 */
function Navigation(options) {
    util.setOptions(this, options);
}

Navigation.prototype = util.inherit(Control, {
    options: {
        position: 'top-right'
    },

    onAdd: function(map) {
        var className = 'mapboxgl-ctrl';

        var container = this._container = DOM.create('div', className + '-group', map.getContainer());

        this._zoomInButton = this._createButton(className + '-icon ' + className + '-zoom-in', map.zoomIn.bind(map));
        this._zoomOutButton = this._createButton(className + '-icon ' + className + '-zoom-out', map.zoomOut.bind(map));
        this._compass = this._createButton(className + '-icon ' + className + '-compass', map.resetNorth.bind(map));

        this._compassArrow = DOM.create('div', 'arrow', this._compass);

        this._compass.addEventListener('mousedown', this._onCompassDown.bind(this));
        this._onCompassMove = this._onCompassMove.bind(this);
        this._onCompassUp = this._onCompassUp.bind(this);

        map.on('rotate', this._rotateCompassArrow.bind(this));
        this._rotateCompassArrow();

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
        this._moved = true;

        e.preventDefault();
    },

    _onCompassUp: function() {
        document.removeEventListener('mousemove', this._onCompassMove);
        document.removeEventListener('mouseup', this._onCompassUp);
        DOM.enableDrag();

        if (this._moved) {
            this._moved = false;
            DOM.suppressClick();
        } else {
            this._map.setPitch(0);
        }

        this._map.snapToNorth();
    },

    _createButton: function(className, fn) {
        var a = DOM.create('button', className, this._container);
        a.addEventListener('click', function() { fn(); });
        return a;
    },

    _rotateCompassArrow: function() {
        var rotate = 'rotate(' + (this._map.transform.angle * (180 / Math.PI)) + 'deg)';
        this._compassArrow.style.transform = rotate;
    }
});
