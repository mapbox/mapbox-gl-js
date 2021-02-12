// @flow

import DOM from '../../util/dom.js';

import {bindAll} from '../../util/util.js';

import type Map from '../map.js';

/**
 * A `LogoControl` is a control that adds the Mapbox watermark
 * to the map as required by the [terms of service](https://www.mapbox.com/tos/) for Mapbox
 * vector tiles and core styles.
 *
 * @implements {IControl}
 * @private
**/

class LogoControl {
    _map: Map;
    _container: HTMLElement;

    constructor() {
        bindAll(['_updateCompact'], this);
    }

    onAdd(map: Map) {
        this._map = map;
        this._container = DOM.create('div', 'mapboxgl-ctrl');
        const anchor = DOM.create('a', 'mapboxgl-ctrl-logo');
        anchor.target = "_blank";
        anchor.rel = "noopener nofollow";
        anchor.href = "https://www.mapbox.com/";
        anchor.setAttribute("aria-label", this._map._getUIString('LogoControl.Title'));
        anchor.setAttribute("rel", "noopener nofollow");
        this._container.appendChild(anchor);
        this._container.style.display = 'block';

        this._map.on('resize', this._updateCompact);
        this._updateCompact();

        return this._container;
    }

    onRemove() {
        DOM.remove(this._container);
        this._map.off('resize', this._updateCompact);
    }

    getDefaultPosition() {
        return 'bottom-left';
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
