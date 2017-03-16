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
        if ('onfullscreenchange' in window.document) {
            this._fullscreenchange = 'fullscreenchange';
        } else if ('onmozfullscreenchange' in window.document) {
            this._fullscreenchange = 'mozfullscreenchange';
        } else if ('onwebkitfullscreenchange' in window.document) {
            this._fullscreenchange = 'webkitfullscreenchange';
        } else if ('onmsfullscreenchange' in window.document) {
            this._fullscreenchange = 'MSFullscreenChange';
        }
    }

    onAdd(map) {
        const className = 'mapboxgl-ctrl';
        const container = this._container = DOM.create('div', `${className} mapboxgl-ctrl-group`);
        const button = this._fullscreenButton = DOM.create('button', (`${className}-icon ${className}-fullscreen`), this._container);
        button.setAttribute("aria-label", "Toggle fullscreen");
        button.type = 'button';
        this._fullscreenButton.addEventListener('click', this._onClickFullscreen);
        this._mapContainer = map.getContainer();
        window.document.addEventListener(this._fullscreenchange, this._changeIcon);
        return container;
    }

    onRemove() {
        this._container.parentNode.removeChild(this._container);
        this._map = null;
        window.document.removeEventListener(this._fullscreenchange, this._changeIcon);
    }

    _isFullscreen() {
        return this._fullscreen;
    }

    _changeIcon(e) {
        if (e.target === this._mapContainer) {
            this._fullscreen = !this._fullscreen;
            const className = 'mapboxgl-ctrl';
            this._fullscreenButton.classList.toggle(`${className}-shrink`);
            this._fullscreenButton.classList.toggle(`${className}-fullscreen`);
        }
    }

    _onClickFullscreen() {
        if (this._isFullscreen()) {
            if (window.document.exitFullscreen) {
                window.document.exitFullscreen();
            } else if (window.document.mozCancelFullScreen) {
                window.document.mozCancelFullScreen();
            } else if (window.document.msExitFullscreen) {
                window.document.msExitFullscreen();
            } else if (window.document.webkitCancelFullScreen) {
                window.document.webkitCancelFullScreen();
            }
        } else if (this._mapContainer.requestFullscreen) {
            this._mapContainer.requestFullscreen();
        } else if (this._mapContainer.mozRequestFullScreen) {
            this._mapContainer.mozRequestFullScreen();
        } else if (this._mapContainer.msRequestFullscreen) {
            this._mapContainer.msRequestFullscreen();
        } else if (this._mapContainer.webkitRequestFullscreen) {
            this._mapContainer.webkitRequestFullscreen();
        }
    }
}

module.exports = FullscreenControl;
