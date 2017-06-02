'use strict';

const util = require('../util/util');
const window = require('../util/window');

/*
 * Adds the map's position to its page's location hash.
 * Passed as an option to the map object.
 *
 * @returns {Hash} `this`
 */
class Hash {
    constructor() {
        util.bindAll([
            '_onHashChange',
            '_updateHash'
        ], this);
    }

    /*
     * Map element to listen for coordinate changes
     *
     * @param {Object} map
     * @returns {Hash} `this`
     */
    addTo(map) {
        this._map = map;
        window.addEventListener('hashchange', this._onHashChange, false);
        this._map.on('moveend', this._updateHash);
        return this;
    }

    /*
     * Removes hash
     *
     * @returns {Popup} `this`
     */
    remove() {
        window.removeEventListener('hashchange', this._onHashChange, false);
        this._map.off('moveend', this._updateHash);
        delete this._map;
        return this;
    }

    getHashString(mapFeedback) {
        const center = this._map.getCenter(),
            zoom = Math.round(this._map.getZoom() * 100) / 100,
            precision = Math.max(0, Math.ceil(Math.log(zoom) / Math.LN2)),
            lng = Math.round(center.lng * Math.pow(10, precision)) / Math.pow(10, precision),
            lat = Math.round(center.lat * Math.pow(10, precision)) / Math.pow(10, precision),
            bearing = this._map.getBearing(),
            pitch = this._map.getPitch();
        let hash = '';
        if (mapFeedback) {
            // new map feedback site has some constraints that don't allow
            // us to use the same hash format as we do for the Map hash option.
            hash += `#/${lng}/${lat}/${zoom}`;
        } else {
            hash += `#${zoom}/${lat}/${lng}`;
        }

        if (bearing || pitch) hash += (`/${Math.round(bearing * 10) / 10}`);
        if (pitch) hash += (`/${Math.round(pitch)}`);
        return hash;
    }

    _onHashChange() {
        const loc = window.location.hash.replace('#', '').split('/');
        if (loc.length >= 3) {
            this._map.jumpTo({
                center: [+loc[2], +loc[1]],
                zoom: +loc[0],
                bearing: +(loc[3] || 0),
                pitch: +(loc[4] || 0)
            });
            return true;
        }
        return false;
    }

    _updateHash() {
        const hash = this.getHashString();
        window.history.replaceState('', '', hash);
    }

}

module.exports = Hash;
