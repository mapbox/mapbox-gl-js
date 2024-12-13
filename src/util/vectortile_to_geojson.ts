import type {VectorTileFeature} from '@mapbox/vector-tile';
import type {FeatureState} from '../style-spec/expression/index';
import type {LayerSpecification} from '../style-spec/types';

const customProps = ['id', 'tile', 'layer', 'source', 'sourceLayer', 'state'] as const;

export interface GeoJSONFeature extends GeoJSON.Feature {
    layer?: LayerSpecification;
    source?: string;
    sourceLayer?: string;
    state?: FeatureState;
    variants?: Record<string, FeatureVariant[]>;
    clone: () => GeoJSONFeature;
    toJSON: () => GeoJSON.Feature;
}

class Feature implements GeoJSONFeature {
    type: 'Feature';
    id?: number | string;
    properties: Record<any, any>;
    tile?: {z: number; x: number; y: number};
    _geometry?: GeoJSON.Geometry;
    _vectorTileFeature: VectorTileFeature;
    _x: number;
    _y: number;
    _z: number;

    layer: LayerSpecification;
    source: string;
    sourceLayer?: string;
    state?: FeatureState;
    variants?: Record<string, FeatureVariant[]>;

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
        if (this.source) feature.source = this.source;
        if (this.sourceLayer) feature.sourceLayer = this.sourceLayer;
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

/**
 * Featureset descriptor is a reference to a featureset in a style fragment.
 */
export type FeaturesetDescriptor = {featuresetId: string, importId?: string};

/**
 * A descriptor for a query target, which can be either a reference to a layer
 * or a reference to a featureset in a style fragment.
 */
export type TargetDescriptor =
    | {layerId: string}
    | FeaturesetDescriptor;

/**
 * A variant of a feature, which can be used to reference this feature from different featuresets.
 * During the QRF query, the original feature will have a reference to all its variants grouped by the query target.
 */
export type FeatureVariant = {
    target: TargetDescriptor;
    namespace?: string;
    properties?: Record<string, unknown>;
};

/**
 * TargetFeature is a derivative of a Feature and its variant that is used to represent a feature in a specific query target.
 * It includes the `featureset` and `namespace` of the variant and omits the `layer`, `source`, and `sourceLayer` of the original feature.
 */
export class TargetFeature extends Feature {
    override layer: never;
    override source: never;
    override sourceLayer: never;
    override variants: never;

    target?: TargetDescriptor;
    namespace?: string;

    constructor(feature: Feature, variant: FeatureVariant) {
        super(feature._vectorTileFeature, feature._z, feature._x, feature._y, feature.id);
        if (feature.state) this.state = {...feature.state};

        this.target = variant.target;
        this.namespace = variant.namespace;
        if (variant.properties) this.properties = variant.properties;
    }

    override toJSON(): GeoJSON.Feature & FeatureVariant {
        const json = super.toJSON() as GeoJSON.Feature & FeatureVariant;

        json.target = this.target;
        json.namespace = this.namespace;

        return json;
    }
}

export default Feature;
