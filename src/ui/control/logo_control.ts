import * as DOM from '../../util/dom';
import {bindAll} from '../../util/util';

import type {Map, ControlPosition} from '../map';
import type {MapSourceDataEvent} from '../events';

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
        // @ts-expect-error - TS2339 - Property 'target' does not exist on type 'HTMLElement'.
        anchor.target = "_blank";
        // @ts-expect-error - TS2339 - Property 'rel' does not exist on type 'HTMLElement'.
        anchor.rel = "noopener nofollow";
        // @ts-expect-error - TS2339 - Property 'href' does not exist on type 'HTMLElement'.
        anchor.href = "https://www.mapbox.com/";
        anchor.setAttribute("aria-label", this._map._getUIString('LogoControl.Title'));
        anchor.setAttribute("rel", "noopener nofollow");
        this._container.appendChild(anchor);
        this._container.style.display = 'none';

        this._map.on('sourcedata', this._updateLogo);
        this._updateLogo();

        this._map.on('resize', this._updateCompact);
        this._updateCompact();

        return this._container;
    }

    onRemove() {
        this._container.remove();
        this._map.off('sourcedata', this._updateLogo);
        this._map.off('resize', this._updateCompact);
    }

    getDefaultPosition(): ControlPosition {
        return 'bottom-left';
    }

    _updateLogo(e?: MapSourceDataEvent) {
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
