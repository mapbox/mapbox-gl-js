import {LngLatBounds} from '../geo/lng_lat';
import {mercatorXfromLng, mercatorYfromLat} from '../geo/mercator_coordinate';

import type {TileJSON} from '../types/tilejson';
import type {CanonicalTileID} from './tile_id';

function contains(bounds: LngLatBounds, tileID: CanonicalTileID): boolean {
    const worldSize = Math.pow(2, tileID.z);

    const minX = Math.floor(mercatorXfromLng(bounds.getWest()) * worldSize);
    const minY = Math.floor(mercatorYfromLat(bounds.getNorth()) * worldSize);
    const maxX = Math.ceil(mercatorXfromLng(bounds.getEast()) * worldSize);
    const maxY = Math.ceil(mercatorYfromLat(bounds.getSouth()) * worldSize);

    const hit = tileID.x >= minX && tileID.x < maxX && tileID.y >= minY && tileID.y < maxY;
    return hit;
}

class TileBounds {
    bounds?: LngLatBounds;
    extraBounds?: LngLatBounds[];
    minzoom: number;
    maxzoom: number;

    constructor(bounds?: [number, number, number, number] | null, minzoom?: number | null, maxzoom?: number | null) {
        this.bounds = bounds ? LngLatBounds.convert(this.validateBounds(bounds)) : null;
        this.minzoom = minzoom || 0;
        this.maxzoom = maxzoom || 24;
    }

    // left, bottom, right, top
    validateBounds(bounds: [number, number, number, number]): [number, number, number, number] {
        // make sure the bounds property contains valid longitude and latitudes
        if (!Array.isArray(bounds) || bounds.length !== 4) return [-180, -90, 180, 90];
        return [Math.max(-180, bounds[0]), Math.max(-90, bounds[1]), Math.min(180, bounds[2]), Math.min(90, bounds[3])];
    }

    addExtraBounds(extraBounds?: [number, number, number, number][] | null) {
        if (!extraBounds) return;
        if (!this.extraBounds) this.extraBounds = [];

        for (const bounds of extraBounds) {
            this.extraBounds.push(LngLatBounds.convert(this.validateBounds(bounds)));
        }
    }

    contains(tileID: CanonicalTileID): boolean {
        if (tileID.z > this.maxzoom || tileID.z < this.minzoom) {
            return false;
        }

        if (this.bounds && !contains(this.bounds, tileID)) {
            return false;
        }

        if (!this.extraBounds) {
            return true;
        }

        for (const bounds of this.extraBounds) {
            if (contains(bounds, tileID)) {
                return true;
            }
        }

        return false;
    }

    static fromTileJSON(tileJSON: Partial<TileJSON>): TileBounds | null {
        if (!tileJSON.bounds && !tileJSON.extra_bounds) return null;

        const tileBounds = new TileBounds(tileJSON.bounds, tileJSON.minzoom, tileJSON.maxzoom);
        tileBounds.addExtraBounds(tileJSON.extra_bounds);

        return tileBounds;
    }
}

export default TileBounds;
