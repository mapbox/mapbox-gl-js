'use strict';

const DOM = require('../../util/dom');
const util = require('../../util/util');
const window = require('../../util/window');

/**
 * A `FullscreenControl` control contains a button for toggling the map in and out of fullscreen mode.
 *
 * @implements {IControl}
 * @example
 * map.addControl(new mapboxgl.FullscreenControl());
 * @see [View a fullscreen map](https://www.mapbox.com/mapbox-gl-js/example/fullscreen/)
 */

class FullscreenControl {

    constructor() {
        this._fullscreen = false;
        util.bindAll([
            '_onClickFullscreen',
            '_changeIcon'
        ], this);
    }

    onAdd(map) {
        const className = 'mapboxgl-ctrl';
        const container = this._container = DOM.create('div', `${className} mapboxgl-ctrl-group`);
        const button = this._fullscreenButton = DOM.create('button', (`${className}-icon ${className}-fullscreen`), this._container);
        button.setAttribute("aria-label", "Toggle fullscreen");
        this._fullscreenButton.addEventListener('click', this._onClickFullscreen);
        this._mapContainer = map.getContainer();
        window.document.addEventListener('webkitfullscreenchange', this._changeIcon);
        return container;
    }

    onRemove() {
        this._container.parentNode.removeChild(this._container);
        this._map = null;
    }

    _isFullscreen() {
        return this._fullscreen;
    }

    _changeIcon() {
        this._fullscreen = !this._fullscreen;
        const className = 'mapboxgl-ctrl';
        this._fullscreenButton.classList.toggle(`${className}-shrink`);
        this._fullscreenButton.classList.toggle(`${className}-fullscreen`);
    }

    _onClickFullscreen() {
        if (this._isFullscreen()) {
            if (window.document.exitFullscreen) {
                window.document.exitFullscreen();
            } else if (window.document.mozCancelFullScreen) {
                window.document.mozCancelFullScreen();
            } else {
                window.document.webkitCancelFullScreen();
            }
        } else if (this._mapContainer.requestFullscreen) {
            this._mapContainer.requestFullscreen();
        } else if (this._mapContainer.mozRequestFullScreen) {
            this._mapContainer.mozRequestFullScreen();
        } else {
            this._mapContainer.webkitRequestFullscreen();
        }
    }
}

module.exports = FullscreenControl;
