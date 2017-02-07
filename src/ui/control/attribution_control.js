'use strict';

const DOM = require('../../util/dom');
const util = require('../../util/util');

/**
 * An `AttributionControl` control presents the map's [attribution information](https://www.mapbox.com/help/attribution/).
 *
 * @implements {IControl}
 * @param {Object} [options]
 * @param {boolean} [options.compact] If `true` force a compact attribution that shows the full attribution on mouse hover, or if `false` force the full attribution control. The default is a responsive attribution that collapses when the map is less than 640 pixels wide.
 * @example
 * var map = new mapboxgl.Map({attributionControl: false})
 *     .addControl(new mapboxgl.AttributionControl({
 *         compact: true
 *     }));
 */
class AttributionControl {

    constructor(options) {
        this.options = options;

        util.bindAll([
            '_updateEditLink',
            '_updateData',
            '_updateCompact'
        ], this);
    }

    getDefaultPosition() {
        return 'bottom-right';
    }

    onAdd(map) {
        const compact = this.options && this.options.compact;

        this._map = map;
        this._container = DOM.create('div', 'mapboxgl-ctrl mapboxgl-ctrl-attrib');

        if (compact) {
            this._container.classList.add('compact');
        }

        this._updateAttributions();
        this._updateEditLink();

        this._map.on('data', this._updateData);
        this._map.on('moveend', this._updateEditLink);

        if (compact === undefined) {
            this._map.on('resize', this._updateCompact);
            this._updateCompact();
        }

        return this._container;
    }

    onRemove() {
        this._container.parentNode.removeChild(this._container);

        this._map.off('data', this._updateData);
        this._map.off('moveend', this._updateEditLink);
        this._map.off('resize', this._updateCompact);

        this._map = undefined;
    }

    _updateEditLink() {
        if (!this._editLink) this._editLink = this._container.querySelector('.mapbox-improve-map');
        if (this._editLink) {
            const center = this._map.getCenter();
            this._editLink.href = `https://www.mapbox.com/map-feedback/#/${
                    center.lng}/${center.lat}/${Math.round(this._map.getZoom() + 1)}`;
        }
    }

    _updateData(event) {
        if (event.dataType === 'source') {
            this._updateAttributions();
            this._updateEditLink();
        }
    }

    _updateAttributions() {
        if (!this._map.style) return;

        let attributions = [];

        const sourceCaches = this._map.style.sourceCaches;
        for (const id in sourceCaches) {
            const source = sourceCaches[id].getSource();
            if (source.attribution && attributions.indexOf(source.attribution) < 0) {
                attributions.push(source.attribution);
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
        this._container.innerHTML = attributions.join(' | ');
        // remove old DOM node from _editLink
        this._editLink = null;
    }

    _updateCompact() {
        const compact = this._map.getCanvasContainer().offsetWidth <= 640;

        this._container.classList[compact ? 'add' : 'remove']('compact');
    }

}

module.exports = AttributionControl;
