// @flow

import * as DOM from '../../util/dom.js';
import {bindAll} from '../../util/util.js';

import type Map from '../map.js';
import type {ControlPosition} from '../map.js';

/**
 * A `LogoControl` is a control that adds the Mapbox watermark
 * to the map as required by the [terms of service](https://www.mapbox.com/tos/) for Mapbox
 * vector tiles and core styles.
 * Add this control to a map using {@link Map#addControl}.
 *
 * @implements {IControl}
 * @private
**/

class LogoControl {
    _map: Map;
    _container: HTMLElement;

    constructor() {
        bindAll(['_updateLogo', '_updateCompact'], this);
    }

    onAdd(map: Map): HTMLElement {
        this._map = map;
        this._container = DOM.create('div', 'mapboxgl-ctrl');
        const anchor = DOM.create('a', 'mapboxgl-ctrl-logo');
        anchor.target = "_blank";
        anchor.rel = "noopener nofollow";
        anchor.href = "https://www.mapbox.com/";
        anchor.setAttribute("aria-label", this._map._getUIString('LogoControl.Title'));
        anchor.setAttribute("rel", "noopener nofollow");
        this._container.appendChild(anchor);
        this._container.style.display = 'none';

        // $FlowFixMe[method-unbinding]
        this._map.on('sourcedata', this._updateLogo);
        this._updateLogo();

        // $FlowFixMe[method-unbinding]
        this._map.on('resize', this._updateCompact);
        this._updateCompact();

        return this._container;
    }

    onRemove() {
        this._container.remove();
        // $FlowFixMe[method-unbinding]
        this._map.off('sourcedata', this._updateLogo);
        // $FlowFixMe[method-unbinding]
        this._map.off('resize', this._updateCompact);
    }

    getDefaultPosition(): ControlPosition {
        return 'bottom-left';
    }

    _updateLogo(e: any) {
        if (!e || e.sourceDataType === 'metadata') {
            this._container.style.display = this._logoRequired() ? 'block' : 'none';
        }
    }

    _logoRequired(): boolean {
        if (!this._map.style) return true;
        const sourceCaches = this._map.style._sourceCaches;
        if (Object.entries(sourceCaches).length === 0) return true;
        for (const id in sourceCaches) {
            const source = sourceCaches[id].getSource();
            if (source.hasOwnProperty('mapbox_logo') && !source.mapbox_logo) {
                return false;
            }
        }

        return true;
    }

    _updateCompact() {
        const containerChildren = this._container.children;
        if (containerChildren.length) {
            const anchor = containerChildren[0];
            if (this._map.getCanvasContainer().offsetWidth < 250) {
                anchor.classList.add('mapboxgl-compact');
            } else {
                anchor.classList.remove('mapboxgl-compact');
            }
        }
    }

}

export default LogoControl;
