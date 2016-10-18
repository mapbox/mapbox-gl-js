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
        var button = this._fullscreenButton = DOM.create('button', (className + '-icon ' + className + '-fullscreen'), this._container);
        button.id = 'fullscreen-button'
        this._fullscreenButton.type = 'button';
        this._fullscreenButton.addEventListener('click', this._onClickFullscreen.bind(this));
        return container;
    },

    isFullscreen: function () {
        return this._isFullscreen || false;
    },

    _onClickFullscreen: function() {
        var mapContainer = map.getContainer();
        var button = document.getElementById('fullscreen-button');
        var className = 'mapboxgl-ctrl';
        if (window.innerHeight == screen.height) {
            button.classList.remove(className + '-shrink');
            button.classList.add(className + '-fullscreen');
           if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else {
                document.webkitCancelFullScreen();
            } 
        } else {
            button.classList.remove(className + '-fullscreen');
            button.classList.add(className + '-shrink');
            if (mapContainer.requestFullscreen) {
                mapContainer.requestFullscreen();
            } else if (mapContainer.mozRequestFullScreen) {
                mapContainer.mozRequestFullScreen();
            } else {
                mapContainer.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
            }
        }
        
    }
});            
