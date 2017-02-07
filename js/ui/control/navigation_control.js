'use strict';

var Control = require('./control');
var DOM = require('../../util/dom');
var util = require('../../util/util');
var window = require('../../util/window');

module.exports = NavigationControl;

/**
 * A `NavigationControl` control contains zoom buttons and a compass.
 * Extends [`Control`](#Control).
 *
 * @class NavigationControl
 * @param {Object} [options]
 * @param {string} [options.position='top-right'] A string indicating the control's position on the map. Options are `'top-right'`, `'top-left'`, `'bottom-right'`, and `'bottom-left'`.
 * @example
 * var nav = new mapboxgl.NavigationControl({position: 'top-left'}); // position is optional
 * map.addControl(nav);
 * @see [Display map navigation controls](https://www.mapbox.com/mapbox-gl-js/example/navigation/)
 * @see [Add a third party vector tile source](https://www.mapbox.com/mapbox-gl-js/example/third-party/)
 */
function NavigationControl(options) {
    util.setOptions(this, options);
}

NavigationControl.prototype = util.inherit(Control, {
    options: {
        position: 'top-right'
    },

    onAdd: function(map) {
        var className = 'mapboxgl-ctrl';

        var container = this._container = DOM.create('div', className + '-group', map.getContainer());
        this._container.addEventListener('contextmenu', this._onContextMenu.bind(this));

        this._zoomInButton = this._createButton(className + '-icon ' + className + '-zoom-in', map.zoomIn.bind(map));
        this._zoomOutButton = this._createButton(className + '-icon ' + className + '-zoom-out', map.zoomOut.bind(map));
        this._compass = this._createButton(className + '-icon ' + className + '-compass', map.resetNorth.bind(map));

        this._compassArrow = DOM.create('span', 'arrow', this._compass);

        this._compass.addEventListener('mousedown', this._onCompassDown.bind(this));
        this._onCompassMove = this._onCompassMove.bind(this);
        this._onCompassUp = this._onCompassUp.bind(this);

        map.on('rotate', this._rotateCompassArrow.bind(this));
        this._rotateCompassArrow();

        this._el = map.getCanvasContainer();

        return container;
    },

    _onContextMenu: function(e) {
        e.preventDefault();
    },

    _onCompassDown: function(e) {
        if (e.button !== 0) return;

        DOM.disableDrag();
        window.document.addEventListener('mousemove', this._onCompassMove);
        window.document.addEventListener('mouseup', this._onCompassUp);

        this._el.dispatchEvent(copyMouseEvent(e));
        e.stopPropagation();
    },

    _onCompassMove: function(e) {
        if (e.button !== 0) return;

        this._el.dispatchEvent(copyMouseEvent(e));
        e.stopPropagation();
    },

    _onCompassUp: function(e) {
        if (e.button !== 0) return;

        window.document.removeEventListener('mousemove', this._onCompassMove);
        window.document.removeEventListener('mouseup', this._onCompassUp);
        DOM.enableDrag();

        this._el.dispatchEvent(copyMouseEvent(e));
        e.stopPropagation();
    },

    _createButton: function(className, fn) {
        var a = DOM.create('button', className, this._container);
        a.type = 'button';
        a.addEventListener('click', function() { fn(); });
        return a;
    },

    _rotateCompassArrow: function() {
        var rotate = 'rotate(' + (this._map.transform.angle * (180 / Math.PI)) + 'deg)';
        this._compassArrow.style.transform = rotate;
    }
});


function copyMouseEvent(e) {
    return new window.MouseEvent(e.type, {
        button: 2,    // right click
        buttons: 2,   // right click
        bubbles: true,
        cancelable: true,
        detail: e.detail,
        view: e.view,
        screenX: e.screenX,
        screenY: e.screenY,
        clientX: e.clientX,
        clientY: e.clientY,
        movementX: e.movementX,
        movementY: e.movementY,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        metaKey: e.metaKey
    });
}
