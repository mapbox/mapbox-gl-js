import * as DOM from '../../util/dom';

import {bindAll, warnOnce} from '../../util/util';

import type {Map} from '../map';

type Options = {
    container?: HTMLElement;
};

/**
 * A `FullscreenControl` control contains a button for toggling the map in and out of fullscreen mode. See the `requestFullScreen` [compatibility table](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullScreen#browser_compatibility) for supported browsers.
 * Add this control to a map using {@link Map#addControl}.
 *
 * @implements {IControl}
 * @param {Object} [options]
 * @param {HTMLElement} [options.container] `container` is the [compatible DOM element](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullScreen#Compatible_elements) which should be made full screen. By default, the map container element will be made full screen.
 *
 * @example
 * map.addControl(new mapboxgl.FullscreenControl({container: document.querySelector('body')}));
 * @see [Example: View a fullscreen map](https://www.mapbox.com/mapbox-gl-js/example/fullscreen/)
 */

class FullscreenControl {
    _map: Map;
    _controlContainer: HTMLElement;
    _fullscreen: boolean;
    _fullscreenchange: string;
    _fullscreenButton: HTMLElement;
    _container: HTMLElement;

    constructor(options?: Options) {
        this._fullscreen = false;
        if (options && options.container) {
            if (options.container instanceof HTMLElement) {
                this._container = options.container;
            } else {
                warnOnce('Full screen control \'container\' must be a DOM element.');
            }
        }
        bindAll([
            '_onClickFullscreen',
            '_changeIcon'
        ], this);
        if ('onfullscreenchange' in document) {
            this._fullscreenchange = 'fullscreenchange';
        } else if ('onwebkitfullscreenchange' in document) {
            this._fullscreenchange = 'webkitfullscreenchange';
        }
    }

    onAdd(map: Map): HTMLElement {
        this._map = map;
        if (!this._container) this._container = this._map.getContainer();
        this._controlContainer = DOM.create('div', `mapboxgl-ctrl mapboxgl-ctrl-group`);
        if (this._checkFullscreenSupport()) {
            this._setupUI();
        } else {
            this._controlContainer.style.display = 'none';
            warnOnce('This device does not support fullscreen mode.');
        }
        return this._controlContainer;
    }

    onRemove() {
        this._controlContainer.remove();
        this._map = (null as any);
        document.removeEventListener(this._fullscreenchange, this._changeIcon);
    }

    _checkFullscreenSupport(): boolean {
        return !!(
            document.fullscreenEnabled ||
            (document as any).webkitFullscreenEnabled
        );
    }

    _setupUI() {
        const button = this._fullscreenButton = DOM.create('button', (`mapboxgl-ctrl-fullscreen`), this._controlContainer);
        DOM.create('span', `mapboxgl-ctrl-icon`, button).setAttribute('aria-hidden', 'true');
        // @ts-expect-error - TS2339 - Property 'type' does not exist on type 'HTMLElement'.
        button.type = 'button';
        this._updateTitle();
        this._fullscreenButton.addEventListener('click', this._onClickFullscreen);
        document.addEventListener(this._fullscreenchange, this._changeIcon);
    }

    _updateTitle() {
        const title = this._getTitle();
        this._fullscreenButton.setAttribute("aria-label", title);
        if (this._fullscreenButton.firstElementChild) this._fullscreenButton.firstElementChild.setAttribute('title', title);
    }

    _getTitle(): string {
        return this._map._getUIString(this._isFullscreen() ? 'FullscreenControl.Exit' : 'FullscreenControl.Enter');
    }

    _isFullscreen(): boolean {
        return this._fullscreen;
    }

    _changeIcon() {
        const fullscreenElement =
            document.fullscreenElement ||
            (document as any).webkitFullscreenElement;

        if ((fullscreenElement === this._container) !== this._fullscreen) {
            this._fullscreen = !this._fullscreen;
            this._fullscreenButton.classList.toggle(`mapboxgl-ctrl-shrink`);
            this._fullscreenButton.classList.toggle(`mapboxgl-ctrl-fullscreen`);
            this._updateTitle();
        }
    }

    _onClickFullscreen() {
        if (this._isFullscreen()) {
            if (document.exitFullscreen) {
                (document as any).exitFullscreen();
            } else if ((document as any).webkitCancelFullScreen) {
                (document as any).webkitCancelFullScreen();
            }
        } else if (this._container.requestFullscreen) {
            this._container.requestFullscreen();
        } else if ((this._container as any).webkitRequestFullscreen) {
            (this._container as any).webkitRequestFullscreen();
        }
    }
}

export default FullscreenControl;
