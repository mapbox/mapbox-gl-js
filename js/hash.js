'use strict';

var bean = require('./lib/bean.js');

module.exports = Hash;
function Hash(map) {
    this.lastHash = null;
    this.updateHashTimeout = null;
    window.addEventListener('hashchange', this.onhash.bind(this), false);
    bean.on(map, 'move', this.updateHash.bind(this));
    this.map = map;
}

Hash.prototype.onhash = function() {
    var loc = this.parseHash();
    if (location.hash !== this.lastHash && loc) {
        this.map.setPosition(+loc[1], +loc[2], +loc[3], +loc[4]/180 * Math.PI);
        this.map._updateStyle();
        this.map.update();
    }
};

Hash.prototype.parseHash = function() {
    return location.hash.match(/^#(\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/);
};

Hash.prototype.updateHash = function() {
    if (this.updateHashTimeout) {
        clearTimeout(this.updateHashTimeout);
    }

    var hash = this;
    var map = this.map;
    this.updateHashTimeout = setTimeout(function() {
        var currentHash = '#' + (map.transform.z + 1).toFixed(2) +
            '/' + map.transform.lat.toFixed(6) +
            '/' + map.transform.lon.toFixed(6) +
            '/' + (map.transform.angle / Math.PI * 180).toFixed(1);

        // Setting the hash to the last updated hash prevents circular updates
        // where we update the hash, which triggers a rerender, which triggers
        // a hash update etc. This usually occurs when rounding zoom levels.
        hash.lastHash = currentHash;
        location.replace(currentHash);
        hash.updateHashTimeout = null;
    }, 100);
};
