'use strict';

var Control = require('./control');
var browser = require('../../util/browser');
var DOM = require('../../util/dom');
var util = require('../../util/util');
var window = require('../../util/window');

module.exports = Fullscreen;

function Fullscreen(options) {
    util.setOptions(this, options);
}

Fullscreen.prototype = util.inherit(Control, {
    options: {
        position: 'top-left'
    },

    onAdd: function(map) {
        var className = 'mapboxgl-ctrl';
        var container = this._container = DOM.create('div', className + '-group', map.getContainer());

        this._fullscreenButton = DOM.create('button', (className + '-icon ' + className + '-fullscreen'), this._container);
        this._fullscreenButton.type = 'button';
        this._fullscreenButton.addEventListener('click', this._onClickFullscreen.bind(this));
        return container;
    },

    _onClickFullscreen: function() {
        var mapContainer = map.getContainer();
        if (mapContainer.requestFullscreen) {
            mapContainer.requestFullscreen();
        } else if (mapContainer.mozRequestFullScreen) {
            mapContainer.mozRequestFullScreen();
        } else if (mapContainer.webkitRequestFullscreen) {
            mapContainer.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
        } else {
        }
    }
});            
