import type {VectorTileFeature} from '@mapbox/vector-tile';

import type {FeatureState} from '../style-spec/expression/index';
import type {LayerSpecification} from '../style-spec/types';

const customProps = ['id', 'tile', 'layer', 'source', 'sourceLayer', 'state'] as const;

export interface GeoJSONFeature extends GeoJSON.Feature {
    layer?: LayerSpecification;
    source: string;
    sourceLayer?: string;
    state?: FeatureState;
}

class Feature implements GeoJSONFeature {
    type: 'Feature';
    _geometry?: GeoJSON.Geometry;
    properties: Record<any, any>;
    id?: number | string;
    _vectorTileFeature: VectorTileFeature;
    _x: number;
    _y: number;
    _z: number;

    layer: LayerSpecification;
    source: string;
    sourceLayer?: string;
    state?: FeatureState;
    tile?: {z: number; x: number; y: number};

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

    toJSON(): GeoJSONFeature {
        const json = {
            type: 'Feature',
            state: undefined,
            geometry: this.geometry,
            properties: this.properties
        };

        for (const key of customProps) {
            if (this[key] !== undefined) json[key] = this[key];
        }

        return json as GeoJSONFeature;
    }
}

export default Feature;
