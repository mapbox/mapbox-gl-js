// @flow

import {getTileBBox} from '@mapbox/whoots-js';
import EXTENT from '../data/extent.js';
import Point from '@mapbox/point-geometry';
import MercatorCoordinate, {altitudeFromMercatorZ} from '../geo/mercator_coordinate.js';
import {MAX_SAFE_INTEGER} from '../util/util.js';
import assert from 'assert';
import {register} from '../util/web_worker_transfer.js';
import {vec3} from 'gl-matrix';

export class CanonicalTileID {
    z: number;
    x: number;
    y: number;
    key: number;

    constructor(z: number, x: number, y: number) {
        assert(z >= 0 && z <= 25);
        assert(x >= 0 && x < Math.pow(2, z));
        assert(y >= 0 && y < Math.pow(2, z));
        this.z = z;
        this.x = x;
        this.y = y;
        this.key = calculateKey(0, z, z, x, y);
    }

    equals(id: CanonicalTileID) {
        return this.z === id.z && this.x === id.x && this.y === id.y;
    }

    // given a list of urls, choose a url template and return a tile URL
    url(urls: Array<string>, scheme: ?string) {
        const bbox = getTileBBox(this.x, this.y, this.z);
        const quadkey = getQuadkey(this.z, this.x, this.y);

        return urls[(this.x + this.y) % urls.length]
            .replace('{prefix}', (this.x % 16).toString(16) + (this.y % 16).toString(16))
            .replace('{z}', String(this.z))
            .replace('{x}', String(this.x))
            .replace('{y}', String(scheme === 'tms' ? (Math.pow(2, this.z) - this.y - 1) : this.y))
            .replace('{quadkey}', quadkey)
            .replace('{bbox-epsg-3857}', bbox);
    }

    getTilePoint(coord: MercatorCoordinate) {
        const tilesAtZoom = Math.pow(2, this.z);
        return new Point(
            (coord.x * tilesAtZoom - this.x) * EXTENT,
            (coord.y * tilesAtZoom - this.y) * EXTENT);
    }

    getTileVec3(coord: MercatorCoordinate): vec3 {
        const tilesAtZoom = Math.pow(2, this.z);
        const x = (coord.x * tilesAtZoom - this.x) * EXTENT;
        const y = (coord.y * tilesAtZoom - this.y) * EXTENT;
        return vec3.fromValues(x, y, altitudeFromMercatorZ(coord.z, coord.y));
    }

    toString() {
        return `${this.z}/${this.x}/${this.y}`;
    }
}

export class UnwrappedTileID {
    wrap: number;
    canonical: CanonicalTileID;
    key: number;

    constructor(wrap: number, canonical: CanonicalTileID) {
        this.wrap = wrap;
        this.canonical = canonical;
        this.key = calculateKey(wrap, canonical.z, canonical.z, canonical.x, canonical.y);
    }
}

export class OverscaledTileID {
    overscaledZ: number;
    wrap: number;
    canonical: CanonicalTileID;
    key: number;
    projMatrix: Float32Array;

    constructor(overscaledZ: number, wrap: number, z: number, x: number, y: number) {
        assert(overscaledZ >= z);
        this.overscaledZ = overscaledZ;
        this.wrap = wrap;
        this.canonical = new CanonicalTileID(z, +x, +y);
        this.key = wrap === 0 && overscaledZ === z ? this.canonical.key : calculateKey(wrap, overscaledZ, z, x, y);
    }

    equals(id: OverscaledTileID) {
        return this.overscaledZ === id.overscaledZ && this.wrap === id.wrap && this.canonical.equals(id.canonical);
    }

    scaledTo(targetZ: number) {
        assert(targetZ <= this.overscaledZ);
        const zDifference = this.canonical.z - targetZ;
        if (targetZ > this.canonical.z) {
            return new OverscaledTileID(targetZ, this.wrap, this.canonical.z, this.canonical.x, this.canonical.y);
        } else {
            return new OverscaledTileID(targetZ, this.wrap, targetZ, this.canonical.x >> zDifference, this.canonical.y >> zDifference);
        }
    }

    /*
     * calculateScaledKey is an optimization:
     * when withWrap == true, implements the same as this.scaledTo(z).key,
     * when withWrap == false, implements the same as this.scaledTo(z).wrapped().key.
     */
    calculateScaledKey(targetZ: number, withWrap: boolean = true): number {
        if (this.overscaledZ === targetZ && withWrap) return this.key;
        if (targetZ > this.canonical.z) {
            return calculateKey(this.wrap * +withWrap, targetZ, this.canonical.z, this.canonical.x, this.canonical.y);
        } else {
            const zDifference = this.canonical.z - targetZ;
            return calculateKey(this.wrap * +withWrap, targetZ, targetZ, this.canonical.x >> zDifference, this.canonical.y >> zDifference);
        }
    }

    isChildOf(parent: OverscaledTileID) {
        if (parent.wrap !== this.wrap) {
            // We can't be a child if we're in a different world copy
            return false;
        }
        const zDifference = this.canonical.z - parent.canonical.z;
        // We're first testing for z == 0, to avoid a 32 bit shift, which is undefined.
        return parent.overscaledZ === 0 || (
            parent.overscaledZ < this.overscaledZ &&
                parent.canonical.x === (this.canonical.x >> zDifference) &&
                parent.canonical.y === (this.canonical.y >> zDifference));
    }

    children(sourceMaxZoom: number) {
        if (this.overscaledZ >= sourceMaxZoom) {
            // return a single tile coord representing a an overscaled tile
            return [new OverscaledTileID(this.overscaledZ + 1, this.wrap, this.canonical.z, this.canonical.x, this.canonical.y)];
        }

        const z = this.canonical.z + 1;
        const x = this.canonical.x * 2;
        const y = this.canonical.y * 2;
        return [
            new OverscaledTileID(z, this.wrap, z, x, y),
            new OverscaledTileID(z, this.wrap, z, x + 1, y),
            new OverscaledTileID(z, this.wrap, z, x, y + 1),
            new OverscaledTileID(z, this.wrap, z, x + 1, y + 1)
        ];
    }

    isLessThan(rhs: OverscaledTileID) {
        if (this.wrap < rhs.wrap) return true;
        if (this.wrap > rhs.wrap) return false;

        if (this.overscaledZ < rhs.overscaledZ) return true;
        if (this.overscaledZ > rhs.overscaledZ) return false;

        if (this.canonical.x < rhs.canonical.x) return true;
        if (this.canonical.x > rhs.canonical.x) return false;

        if (this.canonical.y < rhs.canonical.y) return true;
        return false;
    }

    wrapped() {
        return new OverscaledTileID(this.overscaledZ, 0, this.canonical.z, this.canonical.x, this.canonical.y);
    }

    unwrapTo(wrap: number) {
        return new OverscaledTileID(this.overscaledZ, wrap, this.canonical.z, this.canonical.x, this.canonical.y);
    }

    overscaleFactor() {
        return Math.pow(2, this.overscaledZ - this.canonical.z);
    }

    toUnwrapped() {
        return new UnwrappedTileID(this.wrap, this.canonical);
    }

    toString() {
        return `${this.overscaledZ}/${this.canonical.x}/${this.canonical.y}`;
    }

    getTilePoint(coord: MercatorCoordinate) {
        return this.canonical.getTilePoint(new MercatorCoordinate(coord.x - this.wrap, coord.y));
    }

    getTileVec3(coord: MercatorCoordinate) {
        return this.canonical.getTileVec3(new MercatorCoordinate(coord.x - this.wrap, coord.y, coord.z));
    }
}

function calculateKey(wrap: number, overscaledZ: number, z: number, x: number, y: number): number {
    // only use 22 bits for x & y so that the key fits into MAX_SAFE_INTEGER
    const dim = 1 << Math.min(z, 22);
    let xy = dim * (y % dim) + (x % dim);

    // zigzag-encode wrap if we have the room for it
    if (wrap && z < 22) {
        const bitsAvailable = 2 * (22 - z);
        xy += dim * dim * ((wrap < 0 ? -2 * wrap - 1 : 2 * wrap) % (1 << bitsAvailable));
    }

    // encode z into 5 bits (24 max) and overscaledZ into 4 bits (10 max)
    const key = ((xy * 32) + z) * 16 + (overscaledZ - z);
    assert(key >= 0 && key <= MAX_SAFE_INTEGER);

    return key;
}

function getQuadkey(z, x, y) {
    let quadkey = '', mask;
    for (let i = z; i > 0; i--) {
        mask = 1 << (i - 1);
        quadkey += ((x & mask ? 1 : 0) + (y & mask ? 2 : 0));
    }
    return quadkey;
}

register('CanonicalTileID', CanonicalTileID);
register('OverscaledTileID', OverscaledTileID, {omit: ['projMatrix']});
