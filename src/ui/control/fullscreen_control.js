// @flow

import DOM from '../../util/dom';

import {extend, bindAll, warnOnce} from '../../util/util';
import window from '../../util/window';

// $FlowFixMe: Flow doesn't know about our SVG plugin for rollup
import fullscreenSVG from './fullscreen_icon.svg';

import type Map from '../map';

type Options = {
    container?: HTMLElement,
    iconSVG?: string,
};

/**
 * A `FullscreenControl` control contains a button for toggling the map in and out of fullscreen mode.
 *
 * @implements {IControl}
 * @param {Object} [options]
 * @param {HTMLElement} [options.container] `container` is the [compatible DOM element](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullScreen#Compatible_elements) which should be made full screen. By default, the map container element will be made full screen.
 * @param {string} [options.iconSVG=undefined] If set, this SVG is used instead of the default fullscreen icon.
 *
 * @example
 * map.addControl(new mapboxgl.FullscreenControl({container: document.querySelector('body')}));
 * @see [View a fullscreen map](https://www.mapbox.com/mapbox-gl-js/example/fullscreen/)
 */

class FullscreenControl {
    _map: Map;
    options: Options;
    _controlContainer: HTMLElement;
    _fullscreen: boolean;
    _fullscreenchange: string;
    _fullscreenButton: HTMLElement;
    _className: string;
    _container: HTMLElement;

    constructor(options: Options) {
        this._fullscreen = false;
        this.options = extend({}, options);
        if (this.options.container) {
            if (this.options.container instanceof window.HTMLElement) {
                this._container = this.options.container;
            } else {
                warnOnce('Full screen control \'container\' must be a DOM element.');
            }
        }
        bindAll([
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

    onAdd(map: Map) {
        this._map = map;
        if (!this._container) this._container = this._map.getContainer();
        this._controlContainer = DOM.create('div', `${this._className} mapboxgl-ctrl-group`);
        if (this._checkFullscreenSupport()) {
            this._setupUI();
        } else {
            this._controlContainer.style.display = 'none';
            warnOnce('This device does not support fullscreen mode.');
        }
        return this._controlContainer;
    }

    onRemove() {
        DOM.remove(this._controlContainer);
        this._map = (null: any);
        window.document.removeEventListener(this._fullscreenchange, this._changeIcon);
    }

    _checkFullscreenSupport() {
        return !!(
            window.document.fullscreenEnabled ||
            (window.document: any).mozFullScreenEnabled ||
            (window.document: any).msFullscreenEnabled ||
            (window.document: any).webkitFullscreenEnabled
        );
    }

    _setupUI() {
        const button = this._fullscreenButton = DOM.create('button', (`${this._className}-icon ${this._className}-fullscreen`), this._controlContainer);
        button.type = 'button';
        const fullscreenIcon = new window.DOMParser().parseFromString(this.options.iconSVG || fullscreenSVG, 'text/xml');
        if (fullscreenIcon.firstChild) {
            button.appendChild(fullscreenIcon.firstChild);
        }
        this._updateTitle();
        this._fullscreenButton.addEventListener('click', this._onClickFullscreen);
        this._fullscreenButton.setAttribute('aria-pressed', 'false');
        window.document.addEventListener(this._fullscreenchange, this._changeIcon);
    }

    _updateTitle() {
        const title = this._isFullscreen() ? "Exit fullscreen" : "Enter fullscreen";
        this._fullscreenButton.setAttribute("aria-label", title);
        this._fullscreenButton.title = title;
    }

    _isFullscreen() {
        return this._fullscreen;
    }

    _changeIcon() {
        const fullscreenElement =
            window.document.fullscreenElement ||
            (window.document: any).mozFullScreenElement ||
            (window.document: any).webkitFullscreenElement ||
            (window.document: any).msFullscreenElement;

        if ((fullscreenElement === this._container) !== this._fullscreen) {
            this._fullscreen = !this._fullscreen;
            this._fullscreenButton.classList.toggle(`${this._className}-shrink`);
            this._fullscreenButton.classList.toggle(`${this._className}-fullscreen`);
            this._updateTitle();
        }
    }

    _onClickFullscreen() {
        if (this._isFullscreen()) {
            if (window.document.exitFullscreen) {
                (window.document: any).exitFullscreen();
            } else if (window.document.mozCancelFullScreen) {
                (window.document: any).mozCancelFullScreen();
            } else if (window.document.msExitFullscreen) {
                (window.document: any).msExitFullscreen();
            } else if (window.document.webkitCancelFullScreen) {
                (window.document: any).webkitCancelFullScreen();
            }
            this._fullscreenButton.setAttribute('aria-pressed', 'false');
        } else {
            if (this._container.requestFullscreen) {
                this._container.requestFullscreen();
            } else if ((this._container: any).mozRequestFullScreen) {
                (this._container: any).mozRequestFullScreen();
            } else if ((this._container: any).msRequestFullscreen) {
                (this._container: any).msRequestFullscreen();
            } else if ((this._container: any).webkitRequestFullscreen) {
                (this._container: any).webkitRequestFullscreen();
            }
            this._fullscreenButton.setAttribute('aria-pressed', 'true');
        }
    }
}

export default FullscreenControl;
