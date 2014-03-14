'use strict';

module.exports = Hash;
function Hash(map) {
    this.lastHash = null;
    this.updateHashTimeout = null;
    window.addEventListener('hashchange', this.onhash.bind(this), false);
    map.on('move', this.updateHash.bind(this));
    this.map = map;
}

Hash.prototype.onhash = function() {
    var loc = this.parseHash();
    if (location.hash !== this.lastHash && loc) {
        this.map.setPosition([+loc[2], +loc[3]], +loc[1], +loc[4]/180 * Math.PI);
        this.map.update(true);
    }
};

Hash.prototype.parseHash = function() {
    return location.hash.match(/^#(\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/);
};

Hash.prototype.updateHash = function() {
    if (this.updateHashTimeout) {
        window.clearTimeout(this.updateHashTimeout);
    }

    var hash = this;
    var map = this.map;
    this.updateHashTimeout = window.setTimeout(function() {
        var currentHash = '#' + map.transform.zoom.toFixed(2) +
            '/' + map.transform.center.lat.toFixed(6) +
            '/' + map.transform.center.lng.toFixed(6) +
            '/' + (map.transform.angle / Math.PI * 180).toFixed(1);

        // Setting the hash to the last updated hash prevents circular updates
        // where we update the hash, which triggers a rerender, which triggers
        // a hash update etc. This usually occurs when rounding zoom levels.
        hash.lastHash = currentHash;
        location.replace(currentHash);
        hash.updateHashTimeout = null;
    }, 100);
};
