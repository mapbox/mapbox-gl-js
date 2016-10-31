'use strict';

const DOM = require('../../util/dom');

/**
 * An `AttributionControl` control presents the map's [attribution information](https://www.mapbox.com/help/attribution/).
 *
 * @example
 * var map = new mapboxgl.Map({attributionControl: false})
 *     .addControl(new mapboxgl.AttributionControl());
 */
class AttributionControl {

    onAdd(map) {
        this._map = map;
        this._container = DOM.create('div', 'mapboxgl-ctrl-attrib');

        this._updateAttributions();
        this._updateEditLink();

        this._map.on('data', (event) => {
            if (event.dataType === 'source') {
                this._updateAttributions();
                this._updateEditLink();
            }
        });
        this._map.on('moveend', this._updateEditLink.bind(this));

        return this._container;
    }

    onRemove(map) {
        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
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
        attributions.sort((a, b) => { return a.length - b.length; });
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

    _updateEditLink() {
        if (!this._editLink) this._editLink = this._container.querySelector('.mapbox-improve-map');
        if (this._editLink) {
            const center = this._map.getCenter();
            this._editLink.href = `https://www.mapbox.com/map-feedback/#/${
                    center.lng}/${center.lat}/${Math.round(this._map.getZoom() + 1)}`;
        }
    }
}

module.exports = AttributionControl;
