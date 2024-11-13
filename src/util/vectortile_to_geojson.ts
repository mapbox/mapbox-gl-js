import type {VectorTileFeature} from '@mapbox/vector-tile';
import type {FeatureState} from '../style-spec/expression/index';
import type {LayerSpecification} from '../style-spec/types';

const customProps = ['id', 'tile', 'layer', 'source', 'sourceLayer', 'state'] as const;

/**
 * A descriptor for a featureset, which can be either a reference to a layer
 * or a reference to a featureset in a style fragment.
 */
export type FeaturesetDescriptor = {layerId: string} | {featuresetId: string, importId?: string};

export interface GeoJSONFeature extends GeoJSON.Feature {
    layer?: LayerSpecification;
    source?: string;
    sourceLayer?: string;
    namespace?: string;
    featureset?: FeaturesetDescriptor;
    state?: FeatureState;
    clone: () => GeoJSONFeature;
    toJSON: () => GeoJSON.Feature;
}

class Feature implements GeoJSONFeature {
    type: 'Feature';
    _geometry?: GeoJSON.Geometry;
    properties: Record<any, any>;
    id?: number | string;
    namespace?: string;
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

    clone(): Feature {
        const feature = new Feature(this._vectorTileFeature, this._z, this._x, this._y, this.id);
        if (this.state) feature.state = {...this.state};
        if (this.layer) feature.layer = {...this.layer};
        if (this.namespace) feature.namespace = this.namespace;
        return feature;
    }

    get geometry(): GeoJSON.Geometry {
        if (this._geometry === undefined) {
            this._geometry = this._vectorTileFeature.toGeoJSON(this._x, this._y, this._z).geometry;
        }
        return this._geometry;
    }

    set geometry(g: GeoJSON.Geometry) {
        this._geometry = g;
    }

    toJSON(): GeoJSON.Feature {
        const json = {
            type: 'Feature',
            state: undefined,
            geometry: this.geometry,
            properties: this.properties
        };

        for (const key of customProps) {
            if (this[key] !== undefined) json[key] = this[key];
        }

        return json as GeoJSON.Feature;
    }
}

export default Feature;
