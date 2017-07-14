
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
        this._className = 'mapboxgl-ctrl';
    }

    onAdd(map) {
        this._map = map;
        this._mapContainer = this._map.getContainer();
        this._container = DOM.create('div', `${this._className} mapboxgl-ctrl-group`);
        if (this._checkFullscreenSupport()) {
            this._setupUI();
        } else {
            this._container.style.display = 'none';
            util.warnOnce('This device does not support fullscreen mode.');
        }
        return this._container;
    }

    onRemove() {
        this._container.parentNode.removeChild(this._container);
        this._map = null;
        window.document.removeEventListener(this._fullscreenchange, this._changeIcon);
    }

    _checkFullscreenSupport() {
        return !!(
            window.document.fullscreenEnabled ||
            window.document.mozFullscreenEnabled ||
            window.document.msFullscreenEnabled ||
            window.document.webkitFullscreenEnabled
        );
    }

    _setupUI() {
        const button = this._fullscreenButton = DOM.create('button', (`${this._className}-icon ${this._className}-fullscreen`), this._container);
        button.setAttribute("aria-label", "Toggle fullscreen");
        button.type = 'button';
        this._fullscreenButton.addEventListener('click', this._onClickFullscreen);
        window.document.addEventListener(this._fullscreenchange, this._changeIcon);
    }

    _isFullscreen() {
        return this._fullscreen;
    }

    _changeIcon() {
        const fullscreenElement =
            window.document.fullscreenElement ||
            window.document.mozFullScreenElement ||
            window.document.webkitFullscreenElement ||
            window.document.msFullscreenElement;

        if ((fullscreenElement === this._mapContainer) !== this._fullscreen) {
            this._fullscreen = !this._fullscreen;
            this._fullscreenButton.classList.toggle(`${this._className}-shrink`);
            this._fullscreenButton.classList.toggle(`${this._className}-fullscreen`);
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
