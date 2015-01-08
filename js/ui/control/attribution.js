'use strict';

var Control = require('./control');
var DOM = require('../../util/dom');
var util = require('../../util/util');

module.exports = Attribution;

function Attribution() {}

Attribution.prototype = util.inherit(Control, {
    onAdd(map) {
        var className = 'mapboxgl-ctrl-attrib',
            container = this._container = DOM.create('div', className, map.container);

        this._update();
        map.on('source.add', this._update.bind(this));
        map.on('source.change', this._update.bind(this));
        map.on('source.remove', this._update.bind(this));

        map.on('moveend', this._updateEditLink.bind(this));

        return container;
    },

    _update() {
        var attrObj = {};
        for (var id in this._map.sources) {
            var source = this._map.sources[id];
            if (source.attribution) {
                attrObj[source.attribution] = true;
            }
        }
        var attributions = [];
        for (var i in attrObj) {
            attributions.push(i);
        }
        this._container.innerHTML = attributions.join(' | ');
        this._editLink = this._container.getElementsByClassName('mapbox-improve-map')[0];
        this._updateEditLink();
    },

    _updateEditLink() {
        if (this._editLink) {
            var center = this._map.getCenter();
            this._editLink.href = 'https://www.mapbox.com/map-feedback/#/' +
                    center.lng + '/' + center.lat + '/' + Math.round(this._map.getZoom() + 1);
        }
    }
});
