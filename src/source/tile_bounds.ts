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
    readonly bounds: LngLatBounds | null;
    readonly extraBounds: LngLatBounds[] | null;
    readonly minzoom: number;
    readonly maxzoom: number;

    constructor(tileJSON: Pick<TileJSON, 'bounds' | 'extra_bounds' | 'minzoom' | 'maxzoom'>) {
        this.bounds = tileJSON.bounds ? LngLatBounds.convert(this.validateBounds(tileJSON.bounds)) : null;
        this.extraBounds = tileJSON.extra_bounds && tileJSON.extra_bounds.length > 0 ? tileJSON.extra_bounds.map(b => LngLatBounds.convert(this.validateBounds(b))) : null;
        this.minzoom = tileJSON.minzoom || 0;
        this.maxzoom = tileJSON.maxzoom || 24;
    }

    // left, bottom, right, top
    validateBounds(bounds: [number, number, number, number]): [number, number, number, number] {
        // make sure the bounds property contains valid longitude and latitudes
        if (!Array.isArray(bounds) || bounds.length !== 4) return [-180, -90, 180, 90];
        return [Math.max(-180, bounds[0]), Math.max(-90, bounds[1]), Math.min(180, bounds[2]), Math.min(90, bounds[3])];
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
}

export default TileBounds;
