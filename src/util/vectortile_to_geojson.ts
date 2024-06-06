import type {LayerSpecification, SourceSpecification} from '../style-spec/types';
import type {VectorTileFeature} from '@mapbox/vector-tile';

// we augment GeoJSON with custom properties in query*Features results
export interface QueryFeature extends GeoJSON.Feature {
    layer?: LayerSpecification | null | undefined;
    source?: SourceSpecification | null | undefined | unknown    ;
    sourceLayer?: string | null | undefined | unknown    ;
    state: unknown | null | undefined;
    [key: string]: unknown;
}

const customProps = ['tile', 'layer', 'source', 'sourceLayer', 'state'];

class Feature {
    type: 'Feature';
    _geometry: GeoJSON.Geometry | null | undefined;
    properties: Record<any, any> | null | undefined;
    id: number | string | undefined;
    _vectorTileFeature: VectorTileFeature;
    _x: number;
    _y: number;
    _z: number;

    tile: unknown | null | undefined;
    layer: LayerSpecification | null | undefined;
    source: unknown | null | undefined;
    sourceLayer: unknown | null | undefined;
    state: unknown | null | undefined;

    constructor(vectorTileFeature: VectorTileFeature, z: number, x: number, y: number, id?: string | number) {
        this.type = 'Feature';

        this._vectorTileFeature = vectorTileFeature;
        this._z = z;
        this._x = x;
        this._y = y;

        this.properties = vectorTileFeature.properties;
        this.id = id;
    }

    get geometry(): GeoJSON.Geometry | null | undefined {
        if (this._geometry === undefined) {
            this._geometry = this._vectorTileFeature.toGeoJSON(this._x, this._y, this._z).geometry;
        }
        return this._geometry;
    }

    set geometry(g: GeoJSON.Geometry | null | undefined) {
        this._geometry = g;
    }

    toJSON(): QueryFeature {
        const json: QueryFeature = {
            type: 'Feature',
            state: undefined,
            geometry: this.geometry,
            properties: this.properties
        };
        if (this.id !== undefined) json.id = this.id;
        for (const key of customProps) {
            if (this[key] !== undefined) json[key] = this[key];
        }
        return json;
    }
}

export default Feature;
