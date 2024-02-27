// @flow

import {bindAll} from '../util/util.js';
import throttle from '../util/throttle.js';

import type Map from './map.js';

/*
 * Adds the map's position to its page's location hash.
 * Passed as an option to the map object.
 *
 * @returns {Hash} `this`
 */
export default class Hash {
    _map: ?Map;
    _updateHash: () => ?TimeoutID;
    _hashName: ?string;

    constructor(hashName: ?string) {
        this._hashName = hashName && encodeURIComponent(hashName);
        bindAll([
            '_getCurrentHash',
            '_onHashChange',
            '_updateHash'
        ], this);

        // Mobile Safari doesn't allow updating the hash more than 100 times per 30 seconds.
        // $FlowFixMe[method-unbinding]
        this._updateHash = throttle(this._updateHashUnthrottled.bind(this), 30 * 1000 / 100);
    }

    /*
     * Map element to listen for coordinate changes
     *
     * @param {Object} map
     * @returns {Hash} `this`
     */
    addTo(map: Map): this {
        this._map = map;
        // $FlowFixMe[method-unbinding]
        window.addEventListener('hashchange', this._onHashChange, false);
        map.on('moveend', this._updateHash);
        return this;
    }

    /*
     * Removes hash
     *
     * @returns {Popup} `this`
     */
    remove(): this {
        if (!this._map) return this;

        this._map.off('moveend', this._updateHash);
        // $FlowFixMe[method-unbinding]
        window.removeEventListener('hashchange', this._onHashChange, false);
        clearTimeout(this._updateHash());

        this._map = undefined;
        return this;
    }

    getHashString(): string {
        const map = this._map;
        if (!map) return '';

        const hash = getHashString(map);

        if (this._hashName) {
            const hashName = this._hashName;
            let found = false;
            const parts = location.hash.slice(1).split('&').map(part => {
                const key = part.split('=')[0];
                if (key === hashName) {
                    found = true;
                    return `${key}=${hash}`;
                }
                return part;
            }).filter(a => a);
            if (!found) {
                parts.push(`${hashName}=${hash}`);
            }
            return `#${parts.join('&')}`;
        }

        return `#${hash}`;
    }

    _getCurrentHash(): Array<string> {
        // Get the current hash from location, stripped from its number sign
        const hash = location.hash.replace('#', '');
        if (this._hashName) {
            // Split the parameter-styled hash into parts and find the value we need
            let keyval;
            hash.split('&').map(
                part => part.split('=')
            ).forEach(part => {
                if (part[0] === this._hashName) {
                    keyval = part;
                }
            });
            return (keyval ? keyval[1] || '' : '').split('/');
        }
        return hash.split('/');
    }

    _onHashChange(): boolean {
        const map = this._map;
        if (!map) return false;
        const loc = this._getCurrentHash();
        if (loc.length >= 3 && !loc.some(v => isNaN(v))) {
            const bearing = map.dragRotate.isEnabled() && map.touchZoomRotate.isEnabled() ? +(loc[3] || 0) : map.getBearing();
            map.jumpTo({
                center: [+loc[2], +loc[1]],
                zoom: +loc[0],
                bearing,
                pitch: +(loc[4] || 0)
            });
            return true;
        }
        return false;
    }

    _updateHashUnthrottled() {
        // Replace if already present, else append the updated hash string
        history.replaceState(history.state, '', location.href.replace(/(#.+)?$/, this.getHashString()));
    }
}

export function getHashString(map: Map, mapFeedback?: boolean): string {
    const center = map.getCenter(),
        zoom = Math.round(map.getZoom() * 100) / 100,
        // derived from equation: 512px * 2^z / 360 / 10^d < 0.5px
        precision = Math.ceil((zoom * Math.LN2 + Math.log(512 / 360 / 0.5)) / Math.LN10),
        m = Math.pow(10, precision),
        lng = Math.round(center.lng * m) / m,
        lat = Math.round(center.lat * m) / m,
        bearing = map.getBearing(),
        pitch = map.getPitch();

    // new map feedback site has some constraints that don't allow
    // us to use the same hash format as we do for the Map hash option.
    let hash = mapFeedback ? `/${lng}/${lat}/${zoom}` : `${zoom}/${lat}/${lng}`;

    if (bearing || pitch) hash += (`/${Math.round(bearing * 10) / 10}`);
    if (pitch) hash += (`/${Math.round(pitch)}`);

    return hash;
}
