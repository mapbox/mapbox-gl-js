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
    _map: Map;
    options: Options;
    _container: HTMLElement;
    _zoomInButton: HTMLButtonElement;
    _zoomOutButton: HTMLButtonElement;
    _compass: HTMLButtonElement;
    _compassIcon: HTMLElement;
    _handler: DragRotateHandler;

    constructor(options: Options) {
        this.options = extend({}, defaultOptions, options);

        this._container = DOM.create('div', 'mapboxgl-ctrl mapboxgl-ctrl-group');
        this._container.addEventListener('contextmenu', (e) => e.preventDefault());

        if (this.options.showZoom) {
            bindAll([
                '_setButtonTitle',
                '_updateZoomButtons'
            ], this);
            this._zoomInButton = this._createButton('mapboxgl-ctrl-zoom-in', (e) => this._map.zoomIn({}, {originalEvent: e}));
            DOM.create('span', `mapboxgl-ctrl-icon`, this._zoomInButton).setAttribute('aria-hidden', true);
            this._zoomOutButton = this._createButton('mapboxgl-ctrl-zoom-out', (e) => this._map.zoomOut({}, {originalEvent: e}));
            DOM.create('span', `mapboxgl-ctrl-icon`, this._zoomOutButton).setAttribute('aria-hidden', true);
        }
        if (this.options.showCompass) {
            bindAll([
                '_rotateCompassArrow'
            ], this);
            this._compass = this._createButton('mapboxgl-ctrl-compass', (e) => {
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
        const zoom = this._map.getZoom();
        this._zoomInButton.disabled = zoom === this._map.getMaxZoom();
        this._zoomOutButton.disabled = zoom === this._map.getMinZoom();
    }

    _rotateCompassArrow() {
        const rotate = this.options.visualizePitch ?
            `scale(${1 / Math.pow(Math.cos(this._map.transform.pitch * (Math.PI / 180)), 0.5)}) rotateX(${this._map.transform.pitch}deg) rotateZ(${this._map.transform.angle * (180 / Math.PI)}deg)` :
            `rotate(${this._map.transform.angle * (180 / Math.PI)}deg)`;

        this._compassIcon.style.transform = rotate;
    }

    onAdd(map: Map) {
        this._map = map;
        if (this.options.showZoom) {
            this._setButtonTitle(this._zoomInButton, 'ZoomIn');
            this._setButtonTitle(this._zoomOutButton, 'ZoomOut');
            this._map.on('zoom', this._updateZoomButtons);
            this._updateZoomButtons();
        }
        if (this.options.showCompass) {
            this._setButtonTitle(this._compass, 'ResetBearing');
            if (this.options.visualizePitch) {
                this._map.on('pitch', this._rotateCompassArrow);
            }
            this._map.on('rotate', this._rotateCompassArrow);
            this._rotateCompassArrow();
            // Temporary fix with clickTolerance (https://github.com/mapbox/mapbox-gl-js/pull/9015)
            this._handler = new DragRotateHandler(map, {button: 'left', element: this._compass, clickTolerance: map.dragRotate._clickTolerance});
            DOM.addEventListener(this._compass, 'mousedown', this._handler.onMouseDown);
            DOM.addEventListener(this._compass, 'touchstart', this._handler.onMouseDown, {passive: false});
            this._handler.enable();
        }
        return this._container;
    }

    onRemove() {
        DOM.remove(this._container);
        if (this.options.showZoom) {
            this._map.off('zoom', this._updateZoomButtons);
        }
        if (this.options.showCompass) {
            if (this.options.visualizePitch) {
                this._map.off('pitch', this._rotateCompassArrow);
            }
            this._map.off('rotate', this._rotateCompassArrow);
            DOM.removeEventListener(this._compass, 'mousedown', this._handler.onMouseDown);
            DOM.removeEventListener(this._compass, 'touchstart', this._handler.onMouseDown, {passive: false});
            this._handler.disable();
            delete this._handler;
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
        const str = this._map._getUIString(`NavigationControl.${title}`);
        button.title = str;
        button.setAttribute('aria-label', str);
    }
}

export default NavigationControl;
