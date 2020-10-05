// @flow

import DOM from '../../util/dom';
import {bindAll} from '../../util/util';
import config from '../../util/config';

import type Map from '../map';

type Options = {
    compact?: boolean,
    customAttribution?: string | Array<string>
};

/**
 * An `AttributionControl` control presents the map's [attribution information](https://docs.mapbox.com/help/how-mapbox-works/attribution/).
 *
 * @implements {IControl}
 * @param {Object} [options]
 * @param {boolean} [options.compact] If `true`, force a compact attribution that shows the full attribution on mouse hover. If `false`, force the full attribution control. The default is a responsive attribution that collapses when the map is less than 640 pixels wide. **Attribution should not be collapsed if it can comfortably fit on the map. `compact` should only be used to modify default attribution when map size makes it impossible to fit [default attribution](https://docs.mapbox.com/help/how-mapbox-works/attribution/) and when the automatic compact resizing for default settings are not sufficient.**
 * @param {string | Array<string>} [options.customAttribution] String or strings to show in addition to any other attributions.
 * @example
 * var map = new mapboxgl.Map({attributionControl: false})
 *     .addControl(new mapboxgl.AttributionControl({
 *         compact: true
 *     }));
 */
class AttributionControl {
    options: Options;
    _map: Map;
    _container: HTMLElement;
    _innerContainer: HTMLElement;
    _compactButton: HTMLButtonElement;
    _editLink: ?HTMLAnchorElement;
    _attribHTML: string;
    styleId: string;
    styleOwner: string;

    constructor(options: Options = {}) {
        this.options = options;

        bindAll([
            '_toggleAttribution',
            '_updateEditLink',
            '_updateData',
            '_updateCompact'
        ], this);
    }

    getDefaultPosition() {
        return 'bottom-right';
    }

    onAdd(map: Map) {
        const compact = this.options && this.options.compact;

        this._map = map;
        this._container = DOM.create('div', 'mapboxgl-ctrl mapboxgl-ctrl-attrib');
        this._compactButton = DOM.create('button', 'mapboxgl-ctrl-attrib-button', this._container);
        this._compactButton.addEventListener('click', this._toggleAttribution);
        this._setElementTitle(this._compactButton, 'ToggleAttribution');
        this._innerContainer = DOM.create('div', 'mapboxgl-ctrl-attrib-inner', this._container);
        this._innerContainer.setAttribute('role', 'list');

        if (compact) {
            this._container.classList.add('mapboxgl-compact');
        }

        this._updateAttributions();
        this._updateEditLink();

        this._map.on('styledata', this._updateData);
        this._map.on('sourcedata', this._updateData);
        this._map.on('moveend', this._updateEditLink);

        if (compact === undefined) {
            this._map.on('resize', this._updateCompact);
            this._updateCompact();
        }

        return this._container;
    }

    onRemove() {
        DOM.remove(this._container);

        this._map.off('styledata', this._updateData);
        this._map.off('sourcedata', this._updateData);
        this._map.off('moveend', this._updateEditLink);
        this._map.off('resize', this._updateCompact);

        this._map = (undefined: any);
        this._attribHTML = (undefined: any);
    }

    _setElementTitle(element: HTMLElement, title: string) {
        const str = this._map._getUIString(`AttributionControl.${title}`);
        element.title = str;
        element.setAttribute('aria-label', str);
    }

    _toggleAttribution() {
        if (this._container.classList.contains('mapboxgl-compact-show')) {
            this._container.classList.remove('mapboxgl-compact-show');
            this._compactButton.setAttribute('aria-pressed', 'false');
        } else {
            this._container.classList.add('mapboxgl-compact-show');
            this._compactButton.setAttribute('aria-pressed', 'true');
        }
    }

    _updateEditLink() {
        let editLink = this._editLink;
        if (!editLink) {
            editLink = this._editLink = (this._container.querySelector('.mapbox-improve-map'): any);
        }

        const params = [
            {key: 'owner', value: this.styleOwner},
            {key: 'id', value: this.styleId},
            {key: 'access_token', value: this._map._requestManager._customAccessToken || config.ACCESS_TOKEN}
        ];

        if (editLink) {
            const paramString = params.reduce((acc, next, i) => {
                if (next.value) {
                    acc += `${next.key}=${next.value}${i < params.length - 1 ? '&' : ''}`;
                }
                return acc;
            }, `?`);
            editLink.href = `${config.FEEDBACK_URL}/${paramString}${this._map._hash ? this._map._hash.getHashString(true) : ''}`;
            editLink.rel = 'noopener nofollow';
            this._setElementTitle(editLink, 'MapFeedback');
        }
    }

    _updateData(e: any) {
        if (e && (e.sourceDataType === 'metadata' || e.sourceDataType === 'visibility' || e.dataType === 'style')) {
            this._updateAttributions();
            this._updateEditLink();
        }
    }

    _updateAttributions() {
        if (!this._map.style) return;
        let attributions: Array<string> = [];
        if (this.options.customAttribution) {
            if (Array.isArray(this.options.customAttribution)) {
                attributions = attributions.concat(
                    this.options.customAttribution.map(attribution => {
                        if (typeof attribution !== 'string') return '';
                        return attribution;
                    })
                );
            } else if (typeof this.options.customAttribution === 'string') {
                attributions.push(this.options.customAttribution);
            }
        }

        if (this._map.style.stylesheet) {
            const stylesheet: any = this._map.style.stylesheet;
            this.styleOwner = stylesheet.owner;
            this.styleId = stylesheet.id;
        }

        const sourceCaches = this._map.style.sourceCaches;
        for (const id in sourceCaches) {
            const sourceCache = sourceCaches[id];
            if (sourceCache.used) {
                const source = sourceCache.getSource();
                if (source.attribution && attributions.indexOf(source.attribution) < 0) {
                    attributions.push(source.attribution);
                }
            }
        }

        // remove any entries that are substrings of another entry.
        // first sort by length so that substrings come first
        attributions.sort((a, b) => a.length - b.length);
        attributions = attributions.filter((attrib, i) => {
            for (let j = i + 1; j < attributions.length; j++) {
                if (attributions[j].indexOf(attrib) >= 0) { return false; }
            }
            return true;
        });

        // check if attribution string is different to minimize DOM changes
        const attribHTML = attributions.join(' | ');
        if (attribHTML === this._attribHTML) return;

        this._attribHTML = attribHTML;

        if (attributions.length) {
            this._innerContainer.innerHTML = attribHTML;
            this._container.classList.remove('mapboxgl-attrib-empty');
        } else {
            this._container.classList.add('mapboxgl-attrib-empty');
        }
        // remove old DOM node from _editLink
        this._editLink = null;
    }

    _updateCompact() {
        if (this._map.getCanvasContainer().offsetWidth <= 640) {
            this._container.classList.add('mapboxgl-compact');
        } else {
            this._container.classList.remove('mapboxgl-compact', 'mapboxgl-compact-show');
        }
    }

}

export default AttributionControl;
