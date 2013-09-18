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

    var map = this.map;
    this.updateHashTimeout = setTimeout(function() {
        var hash = '#' + (map.transform.z + 1).toFixed(2) +
            '/' + map.transform.lat.toFixed(6) +
            '/' + map.transform.lon.toFixed(6) +
            '/' + map.transform.angle.toFixed(6) / Math.PI * 180;
        map.lastHash = hash;
        location.replace(hash);
        this.updateHashTimeout = null;
    }, 100);
};
