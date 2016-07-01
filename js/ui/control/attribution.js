'use strict';

var Control = require('./control');
var DOM = require('../../util/dom');
var util = require('../../util/util');

module.exports = Attribution;

/**
 * An `Attribution` control presents the map's [attribution information](https://www.mapbox.com/help/attribution/).
 * Extends [`Control`](#Control).
 *
 * @class Attribution
 * @param {Object} [options]
 * @param {string} [options.position='bottom-right'] A string indicating the control's position on the map. Options are `'top-right'`, `'top-left'`, `'bottom-right'`, and `'bottom-left'`.
 * @example
 * var map = new mapboxgl.Map({attributionControl: false})
 *     .addControl(new mapboxgl.Attribution({position: 'top-left'}));
 */
function Attribution(options) {
    util.setOptions(this, options);
}

Attribution.createAttributionString = function(sources) {
    var attributions = [];

    for (var id in sources) {
        var source = sources[id];
        if (source.attribution && attributions.indexOf(source.attribution) < 0) {
            attributions.push(source.attribution);
        }
    }

    // remove any entries that are substrings of another entry.
    // first sort by length so that substrings come first
    attributions.sort(function (a, b) { return a.length - b.length; });
    attributions = attributions.filter(function (attrib, i) {
        for (var j = i + 1; j < attributions.length; j++) {
            if (attributions[j].indexOf(attrib) >= 0) { return false; }
        }
        return true;
    });

    return attributions.join(' | ');
};

Attribution.prototype = util.inherit(Control, {
    options: {
        position: 'bottom-right'
    },

    onAdd: function(map) {
        var className = 'mapboxgl-ctrl-attrib',
            container = this._container = DOM.create('div', className, map.getContainer());

        this._update();
        map.on('source.load', this._update.bind(this));
        map.on('source.change', this._update.bind(this));
        map.on('source.remove', this._update.bind(this));
        map.on('moveend', this._updateEditLink.bind(this));

        return container;
    },

    _update: function() {
        if (this._map.style) {
            this._container.innerHTML = Attribution.createAttributionString(this._map.style.sources);
        }

        this._editLink = this._container.getElementsByClassName('mapbox-improve-map')[0];
        this._updateEditLink();
    },

    _updateEditLink: function() {
        if (this._editLink) {
            var center = this._map.getCenter();
            this._editLink.href = 'https://www.mapbox.com/map-feedback/#/' +
                    center.lng + '/' + center.lat + '/' + Math.round(this._map.getZoom() + 1);
        }
    }
});
