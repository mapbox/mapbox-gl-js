'use strict';

const Control = require('./control');
const DOM = require('../../util/dom');
const util = require('../../util/util');

module.exports = AttributionControl;

/**
 * An `AttributionControl` control presents the map's [attribution information](https://www.mapbox.com/help/attribution/).
 * Extends [`Control`](#Control).
 *
 * @class AttributionControl
 * @param {Object} [options]
 * @param {string} [options.position='bottom-right'] A string indicating the control's position on the map. Options are `'top-right'`, `'top-left'`, `'bottom-right'`, and `'bottom-left'`.
 * @example
 * var map = new mapboxgl.Map({attributionControl: false})
 *     .addControl(new mapboxgl.AttributionControl({position: 'top-left'}));
 */
function AttributionControl(options) {
    util.setOptions(this, options);
}

AttributionControl.prototype = util.inherit(Control, {
    options: {
        position: 'bottom-right'
    },

    onAdd: function(map) {
        let className = 'mapboxgl-ctrl-attrib',
            container = this._container = DOM.create('div', className, map.getContainer());

        this._updateAttributions();
        this._updateEditLink();

        map.on('data', function(event) {
            if (event.dataType === 'source') {
                this._updateAttributions();
                this._updateEditLink();
            }
        }.bind(this));

        map.on('moveend', this._updateEditLink.bind(this));

        return container;
    },

    _updateAttributions: function() {
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
        attributions.sort(function (a, b) { return a.length - b.length; });
        attributions = attributions.filter(function (attrib, i) {
            for (let j = i + 1; j < attributions.length; j++) {
                if (attributions[j].indexOf(attrib) >= 0) { return false; }
            }
            return true;
        });
        this._container.innerHTML = attributions.join(' | ');
        // remove old DOM node from _editLink
        this._editLink = null;
    },

    _updateEditLink: function() {
        if (!this._editLink) this._editLink = this._container.querySelector('.mapbox-improve-map');
        if (this._editLink) {
            const center = this._map.getCenter();
            this._editLink.href = 'https://www.mapbox.com/map-feedback/#/' +
                    center.lng + '/' + center.lat + '/' + Math.round(this._map.getZoom() + 1);
        }
    }
});
