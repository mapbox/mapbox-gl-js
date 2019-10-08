// @flow

import {OverscaledTileID} from './tile_id';
import type Tile from './tile';

// When shrinking the cache-size over time, start shrinking only when
// the target size is below 70% of the current size.
const DEFFERED_SHRINK_THRESHOLD = 0.7;

/**
 * A [least-recently-used cache](http://en.wikipedia.org/wiki/Cache_algorithms)
 * with hash lookup made possible by keeping a list of keys in parallel to
 * an array of dictionary of values
 *
 * @private
 */
class TileCache {
    max: number;
    data: {[key: number | string]: Array<{ value: any, timeout: ?TimeoutID}>};
    order: Array<number>;
    _shrinkTarget: ?number;
    onRemove: (element: Tile) => void;
    /**
     * @param {number} max number of permitted values
     * @param {Function} onRemove callback called with items when they expire
     */
    constructor(max: number, onRemove: (element: any) => void) {
        this.max = max;
        this.onRemove = onRemove;
        this.reset();
    }

    /**
     * Clear the cache
     *
     * @returns {TileCache} this cache
     * @private
     */
    reset() {
        for (const key in this.data) {
            for (const removedData of this.data[key]) {
                if (removedData.timeout) clearTimeout(removedData.timeout);
                this.onRemove(removedData.value);
            }
        }

        this.data = {};
        this.order = [];

        return this;
    }

    /**
     * Add a key, value combination to the cache, trimming its size if this pushes
     * it over max length.
     *
     * @param {OverscaledTileID} tileID lookup key for the item
     * @param {*} data any value
     *
     * @returns {TileCache} this cache
     * @private
     */
    add(tileID: OverscaledTileID, data: any, expiryTimeout: number | void) {
        const key = tileID.wrapped().key;
        if (this.data[key] === undefined) {
            this.data[key] = [];
        }

        const dataWrapper = {
            value: data,
            timeout: undefined
        };

        if (expiryTimeout !== undefined) {
            dataWrapper.timeout = setTimeout(() => {
                this.remove(tileID, dataWrapper);
            }, expiryTimeout);
        }

        this.data[key].push(dataWrapper);
        this.order.push(key);

        if (this.order.length > this.max) {
            const removedData = this._getAndRemoveByKey(this.order[0]);
            if (removedData) this.onRemove(removedData);
        }

        return this;
    }

    /**
     * Determine whether the value attached to `key` is present
     *
     * @param {OverscaledTileID} tileID the key to be looked-up
     * @returns {boolean} whether the cache has this value
     * @private
     */
    has(tileID: OverscaledTileID): boolean {
        return tileID.wrapped().key in this.data;
    }

    /**
     * Get the value attached to a specific key and remove data from cache.
     * If the key is not found, returns `null`
     *
     * @param {OverscaledTileID} tileID the key to look up
     * @returns {*} the data, or null if it isn't found
     * @private
     */
    getAndRemove(tileID: OverscaledTileID): ?any {
        if (!this.has(tileID)) { return null; }
        return this._getAndRemoveByKey(tileID.wrapped().key);
    }

    /*
     * Get and remove the value with the specified key.
     */
    _getAndRemoveByKey(key: number): ?any {
        const data = this.data[key].shift();
        if (data.timeout) clearTimeout(data.timeout);

        if (this.data[key].length === 0) {
            delete this.data[key];
        }
        this.order.splice(this.order.indexOf(key), 1);

        return data.value;
    }

    /**
     * Get the value attached to a specific key without removing data
     * from the cache. If the key is not found, returns `null`
     *
     * @param {OverscaledTileID} tileID the key to look up
     * @returns {*} the data, or null if it isn't found
     * @private
     */
    get(tileID: OverscaledTileID): ?any {
        if (!this.has(tileID)) { return null; }

        const data = this.data[tileID.wrapped().key][0];
        return data.value;
    }

    /**
     * Remove a key/value combination from the cache.
     *
     * @param {OverscaledTileID} tileID the key for the pair to delete
     * @param {Tile} value If a value is provided, remove that exact version of the value.
     * @returns {TileCache} this cache
     * @private
     */
    remove(tileID: OverscaledTileID, value: ?{ value: any, timeout: ?TimeoutID}) {
        if (!this.has(tileID)) { return this; }
        const key = tileID.wrapped().key;

        const dataIndex = value === undefined ? 0 : this.data[key].indexOf(value);
        const data = this.data[key][dataIndex];
        this.data[key].splice(dataIndex, 1);
        if (data.timeout) clearTimeout(data.timeout);
        if (this.data[key].length === 0) {
            delete this.data[key];
        }
        this.onRemove(data.value);
        this.order.splice(this.order.indexOf(key), 1);

        return this;
    }

    /**
     * Change the max size of the cache.
     *
     * @param {number} max the max size of the cache
     * @returns {TileCache} this cache
     * @private
     */
    setMaxSize(max: number): TileCache {
        this.max = max;

        while (this.order.length > this.max) {
            const removedData = this._getAndRemoveByKey(this.order[0]);
            if (removedData) this.onRemove(removedData);
        }

        return this;
    }

    /**
     * Grows the size of the cache instantly, but defers size shrinking.
     * The cache then shrinks by a fixed budget everytime `shrinkTick()`is called
     *
     * @param {number} max
     * @returns {TileCache}
     * @private
     */
    setMaxSizeDeffered(max: number): TileCache {
        if (max > this.max) {
            this.max = max;
            this._shrinkTarget = null;
        } else {
            this._shrinkTarget = max;
        }

        return this;
    }

    /**
     * Call at appropriate intervals based on the usage of `setMaxSizeDeffered()`.
     *
     * @param {number} shrinkSize
     * @memberof TileCache
     */
    shrinkTick(shrinkSize: number) {
        if (this._shrinkTarget && this._shrinkTarget / this.order.length < DEFFERED_SHRINK_THRESHOLD) {
            for (let itr = 0; itr < shrinkSize; itr++) {
                const removedData = this._getAndRemoveByKey(this.order[0]);
                if (removedData) this.onRemove(removedData);
            }
        }
    }
}

export default TileCache;
