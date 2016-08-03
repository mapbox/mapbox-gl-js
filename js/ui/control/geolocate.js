'use strict';

var Control = require('./control');
var browser = require('../../util/browser');
var DOM = require('../../util/dom');
var util = require('../../util/util');

module.exports = Geolocate;

var geoOptions = { enableHighAccuracy: false, timeout: 6000 /* 6sec */ };


/**
 * A `Geolocate` control provides a button that uses the browser's geolocation
 * API to locate the user on the map. Extends [`Control`](#Control).
 *
 * @class Geolocate
 * @param {Object} [options]
 * @param {string} [options.position='top-right'] A string indicating the control's position on the map. Options are `'top-right'`, `'top-left'`, `'bottom-right'`, and `'bottom-left'`.
 * @example
 * map.addControl(new mapboxgl.Geolocate({position: 'top-left'})); // position is optional
 */
function Geolocate(options) {
    util.setOptions(this, options);
}

Geolocate.prototype = util.inherit(Control, {
    options: {
        position: 'top-right'
    },

    onAdd: function(map) {
        var className = 'mapboxgl-ctrl';

        var container = this._container = DOM.create('div', className + '-group', map.getContainer());
        if (!browser.supportsGeolocation) return container;

        this._container.addEventListener('contextmenu', this._onContextMenu.bind(this));

        this._geolocateButton = DOM.create('button', (className + '-icon ' + className + '-geolocate'), this._container);
        this._geolocateButton.type = 'button';
        this._geolocateButton.addEventListener('click', this._onClickGeolocate.bind(this));
        return container;
    },

    _onContextMenu: function(e) {
        e.preventDefault();
    },

    _onClickGeolocate: function() {
        navigator.geolocation.getCurrentPosition(this._success.bind(this), this._error.bind(this), geoOptions);

        // This timeout ensures that we still call finish() even if
        // the user declines to share their location in Firefox
        this._timeoutId = setTimeout(this._finish.bind(this), 10000 /* 10sec */);
    },

    _success: function(position) {
        this._map.jumpTo({
            center: [position.coords.longitude, position.coords.latitude],
            zoom: 17,
            bearing: 0,
            pitch: 0
        });

        this.fire('geolocate', position);
        this._finish();
    },

    _error: function(error) {
        this.fire('error', error);
        this._finish();
    },

    _finish: function() {
        if (this._timeoutId) { clearTimeout(this._timeoutId); }
        this._timeoutId = undefined;
    }

});

/**
 * geolocate event.
 *
 * @event geolocate
 * @memberof Geolocate
 * @instance
 * @property {Position} data The returned [Position](https://developer.mozilla.org/en-US/docs/Web/API/Position) object from the callback in [Geolocation.getCurrentPosition()](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition).
 *
 */

/**
 * error event.
 *
 * @event error
 * @memberof Geolocate
 * @instance
 * @property {PositionError} data The returned [PositionError](https://developer.mozilla.org/en-US/docs/Web/API/PositionError) object from the callback in [Geolocation.getCurrentPosition()](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition).
 *
 */
