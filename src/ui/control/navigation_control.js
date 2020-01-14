// @flow

import DOM from '../../util/dom';
import {extend, bindAll} from '../../util/util';
import DragRotateHandler from '../handler/drag_rotate';

import type Map from '../map';

type Options = {
    showCompass?: boolean,
    showZoom?: boolean,
    visualizePitch?: boolean
};

const defaultOptions: Options = {
    showCompass: true,
    showZoom: true,
    visualizePitch: false
};

/**
 * A `NavigationControl` control contains zoom buttons and a compass.
 *
 * @implements {IControl}
 * @param {Object} [options]
 * @param {Boolean} [options.showCompass=true] If `true` the compass button is included.
 * @param {Boolean} [options.showZoom=true] If `true` the zoom-in and zoom-out buttons are included.
 * @param {Boolean} [options.visualizePitch=false] If `true` the pitch is visualized by rotating X-axis of compass.
 * @example
 * var nav = new mapboxgl.NavigationControl();
 * map.addControl(nav, 'top-left');
 * @see [Display map navigation controls](https://www.mapbox.com/mapbox-gl-js/example/navigation/)
 * @see [Add a third party vector tile source](https://www.mapbox.com/mapbox-gl-js/example/third-party/)
 */
class NavigationControl {
    _map: ?Map;
    options: Options;
    _container: HTMLElement;
    _zoomInButton: HTMLButtonElement;
    _zoomOutButton: HTMLButtonElement;
    _compass: HTMLButtonElement;
    _compassIcon: HTMLElement;
    _handler: ?DragRotateHandler;

    constructor(options: Options) {
        this.options = extend({}, defaultOptions, options);

        this._container = DOM.create('div', 'mapboxgl-ctrl mapboxgl-ctrl-group');
        this._container.addEventListener('contextmenu', (e) => e.preventDefault());

        if (this.options.showZoom) {
            bindAll([
                '_setButtonTitle',
                '_updateZoomButtons'
            ], this);
            this._zoomInButton = this._createButton('mapboxgl-ctrl-zoom-in', (e) => {
                if (!this._map) return;
                this._map.zoomIn({}, {originalEvent: e});
            });
            DOM.create('span', `mapboxgl-ctrl-icon`, this._zoomInButton).setAttribute('aria-hidden', true);
            this._zoomOutButton = this._createButton('mapboxgl-ctrl-zoom-out', (e) => {
                if (!this._map) return;
                this._map.zoomOut({}, {originalEvent: e});
            });
            DOM.create('span', `mapboxgl-ctrl-icon`, this._zoomOutButton).setAttribute('aria-hidden', true);
        }
        if (this.options.showCompass) {
            bindAll([
                '_rotateCompassArrow'
            ], this);
            this._compass = this._createButton('mapboxgl-ctrl-compass', (e) => {
                if (!this._map) return;
                if (this.options.visualizePitch) {
                    this._map.resetNorthPitch({}, {originalEvent: e});
                } else {
                    this._map.resetNorth({}, {originalEvent: e});
                }
            });
            this._compassIcon = DOM.create('span', 'mapboxgl-ctrl-icon', this._compass);
            this._compassIcon.setAttribute('aria-hidden', true);
        }
    }

    _updateZoomButtons() {
        if (!this._map) return;
        const map = this._map;
        const zoom = map.getZoom();
        this._zoomInButton.disabled = zoom === map.getMaxZoom();
        this._zoomOutButton.disabled = zoom === map.getMinZoom();
    }

    _rotateCompassArrow() {
        if (!this._map) return;
        const map = this._map;
        const rotate = this.options.visualizePitch ?
            `scale(${1 / Math.pow(Math.cos(map.transform.pitch * (Math.PI / 180)), 0.5)}) rotateX(${map.transform.pitch}deg) rotateZ(${map.transform.angle * (180 / Math.PI)}deg)` :
            `rotate(${map.transform.angle * (180 / Math.PI)}deg)`;

        this._compassIcon.style.transform = rotate;
    }

    onAdd(map: Map) {
        this._map = map;
        if (this.options.showZoom) {
            this._setButtonTitle(this._zoomInButton, 'ZoomIn');
            this._setButtonTitle(this._zoomOutButton, 'ZoomOut');
            map.on('zoom', this._updateZoomButtons);
            this._updateZoomButtons();
        }
        if (this.options.showCompass) {
            this._setButtonTitle(this._compass, 'ResetBearing');
            if (this.options.visualizePitch) {
                map.on('pitch', this._rotateCompassArrow);
            }
            map.on('rotate', this._rotateCompassArrow);
            this._rotateCompassArrow();
            // Temporary fix with clickTolerance (https://github.com/mapbox/mapbox-gl-js/pull/9015)
            const handler = this._handler = new DragRotateHandler(map, {button: 'left', element: this._compass, clickTolerance: map.dragRotate._clickTolerance});
            DOM.addEventListener(this._compass, 'mousedown', handler.onMouseDown);
            DOM.addEventListener(this._compass, 'touchstart', handler.onMouseDown, {passive: false});
            handler.enable();
        }
        return this._container;
    }

    onRemove() {
        if (!this._map) return;
        const map = this._map;
        DOM.remove(this._container);
        if (this.options.showZoom) {
            map.off('zoom', this._updateZoomButtons);
        }
        if (this.options.showCompass) {
            if (this.options.visualizePitch) {
                map.off('pitch', this._rotateCompassArrow);
            }
            map.off('rotate', this._rotateCompassArrow);
            if (this._handler != null) {
                const handler = this._handler;
                DOM.removeEventListener(this._compass, 'mousedown', handler.onMouseDown);
                DOM.removeEventListener(this._compass, 'touchstart', handler.onMouseDown, {passive: false});
                handler.disable();
                delete this._handler;
            }
        }

        delete this._map;
    }

    _createButton(className: string, fn: () => mixed) {
        const a = DOM.create('button', className, this._container);
        a.type = 'button';
        a.addEventListener('click', fn);
        return a;
    }

    _setButtonTitle(button: HTMLButtonElement, title: string) {
        if (!this._map) return;
        const str = this._map._getUIString(`NavigationControl.${title}`);
        button.title = str;
        button.setAttribute('aria-label', str);
    }
}

export default NavigationControl;
