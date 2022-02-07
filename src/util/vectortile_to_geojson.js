// @flow
import type {GeoJSONGeometry, GeoJSONFeature} from '@mapbox/geojson-types';

// we augment GeoJSON with custom properties in query*Features results
type QueryFeature = GeoJSONFeature & {
    tile?: mixed,
    layer?: mixed
};

class Feature {
    type: 'Feature';
    _geometry: ?GeoJSONGeometry;
    properties: {};
    id: number | string | void;
    layer: ?mixed;
    tile: ?mixed;
    _x: number;
    _y: number;
    _z: number;

    _vectorTileFeature: VectorTileFeature;

    constructor(vectorTileFeature: VectorTileFeature, z: number, x: number, y: number, id: string | number | void) {
        this.type = 'Feature';

        this._vectorTileFeature = vectorTileFeature;
        this._z = z;
        this._x = x;
        this._y = y;

        this.properties = vectorTileFeature.properties;
        this.id = id;
    }

    get geometry(): ?GeoJSONGeometry {
        if (this._geometry === undefined) {
            this._geometry = this._vectorTileFeature.toGeoJSON(this._x, this._y, this._z).geometry;
        }
        return this._geometry;
    }

    set geometry(g: ?GeoJSONGeometry) {
        this._geometry = g;
    }

    toJSON(): QueryFeature {
        const json: QueryFeature = {
            type: 'Feature',
            geometry: this.geometry,
            properties: this.properties
        };
        if (this.id !== undefined) json.id = this.id;
        if (this.tile !== undefined) json.tile = this.tile;
        if (this.layer !== undefined) json.layer = this.layer;
        return json;
    }
}

export default Feature;
