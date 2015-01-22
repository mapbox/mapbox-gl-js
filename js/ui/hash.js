'use strict';

module.exports = Hash;

var util = require('../util/util');

function Hash() {
    util.bindAll([
        '_onHashChange',
        '_updateHash'
    ], this);
}

Hash.prototype = {
    addTo: function(map) {
        this._map = map;
        window.addEventListener('hashchange', this._onHashChange, false);
        this._map.on('moveend', this._updateHash);
        return this;
    },

    remove: function() {
        window.removeEventListener('hashchange', this._onHashChange, false);
        this._map.off('moveend', this._updateHash);
        delete this._map;
        return this;
    },

    _onHashChange: function() {
        var loc = location.hash.replace('#', '').split('/');
        if (loc.length >= 3) {
            this._map.setView([+loc[1], +loc[2]], +loc[0], +(loc[3] || 0));
            return true;
        }
        return false;
    },

    _updateHash: function() {
        var center = this._map.getCenter(),
            zoom = this._map.getZoom(),
            bearing = this._map.getBearing(),
            precision = Math.max(0, Math.ceil(Math.log(zoom) / Math.LN2)),

            hash = '#' + (Math.round(zoom * 100) / 100) +
                '/' + center.lat.toFixed(precision) +
                '/' + center.lng.toFixed(precision) +
                (bearing ? '/' + (Math.round(bearing * 10) / 10) : '');

        window.history.replaceState('', '', hash);
    }
};
