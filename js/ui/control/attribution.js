'use strict';

var Control = require('./control');
var DOM = require('../../util/dom');
var util = require('../../util/util');

module.exports = Attribution;

function Attribution() {}

Attribution.prototype = util.inherit(Control, {
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
        var attributions = [];

        if (this._map.style) {
            for (var id in this._map.style.sources) {
                var source = this._map.style.sources[id];
                if (source.attribution && attributions.indexOf(source.attribution) < 0) {
                    attributions.push(source.attribution);
                }
            }
        }

        this._container.innerHTML = attributions.join(' | ');
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
