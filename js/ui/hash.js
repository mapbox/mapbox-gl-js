'use strict';

module.exports = Hash;

var util = require('../util/util.js');

function Hash(map) {
    this.map = map;
    window.addEventListener('hashchange', this.onhash.bind(this), false);
    map.on('move', util.debounce(this.updateHash.bind(this), 100));
}

Hash.prototype = {
    onhash: function() {
        var loc = location.hash.replace('#', '').split('/');
        if (loc.length === 4) {
            this.map.setView([+loc[1], +loc[2]], +loc[0], +loc[3]);
            return true;
        }
        return false;
    },

    updateHash: function() {
        var center = this.map.getCenter(),
            hash = '#' + this.map.getZoom().toFixed(2) +
                '/' + center.lat.toFixed(6) +
                '/' + center.lng.toFixed(6) +
                '/' + this.map.getBearing().toFixed(1);

        window.history.replaceState('', '', hash);
    }
};
