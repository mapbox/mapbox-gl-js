'use strict';

module.exports = Hash;

var util = require('../util/util');

function Hash(map) {
    this.map = map;
    window.addEventListener('hashchange', this.onhash.bind(this), false);
    map.on('move', util.debounce(this.updateHash.bind(this), 100));
}

Hash.prototype = {
    onhash() {
        var loc = location.hash.replace('#', '').split('/');
        if (loc.length >= 3) {
            this.map.setView([+loc[1], +loc[2]], +loc[0], +(loc[3] || 0));
            return true;
        }
        return false;
    },

    updateHash() {
        var center = this.map.getCenter(),
            zoom = this.map.getZoom(),
            bearing = this.map.getBearing(),
            precision = Math.max(0, Math.ceil(Math.log(zoom) / Math.LN2)),

            hash = '#' + (Math.round(zoom * 100) / 100) +
                '/' + center.lat.toFixed(precision) +
                '/' + center.lng.toFixed(precision) +
                (bearing ? '/' + (Math.round(bearing * 10) / 10) : '');

        window.history.replaceState('', '', hash);
    }
};
