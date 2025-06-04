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
    properties: Record<string, string | number | boolean>;
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
        if (this.state) feature.state = Object.assign({}, this.state);
        if (this.layer) feature.layer = Object.assign({}, this.layer);
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
 * `FeaturesetDescriptor` references a featureset in a style. If `importId` is not specified, the featureset is assumed to be in the root style.
 */
export type FeaturesetDescriptor = {featuresetId: string, importId?: string};

/**
 * `TargetDescriptor` defines the target for a {@link Map#queryRenderedFeatures} query to inspect,
 * referencing either a [style layer ID](https://docs.mapbox.com/mapbox-gl-js/style-spec/#layer-id) or a {@link FeaturesetDescriptor}.
 * It acts as a universal target for {@link Map#addInteraction} and {@link Map#queryRenderedFeatures}.
 */
export type TargetDescriptor =
    | {layerId: string}
    | FeaturesetDescriptor;

/**
 * `FeatureVariant` represents a feature variant, allowing references to the feature from different featuresets.
 * In a {@link Map#queryRenderedFeatures} query, the original feature includes references to all its variants, grouped by the query target.
 */
export type FeatureVariant = {
    target: TargetDescriptor;
    namespace?: string;
    properties?: Record<string, string | number | boolean>;
    uniqueFeatureID?: boolean;
};

/**
 * `TargetFeature` is a [GeoJSON](http://geojson.org/) [Feature object](https://tools.ietf.org/html/rfc7946#section-3.2) representing a feature
 * associated with a specific query target in {@link Map#queryRenderedFeatures}. For featuresets in imports, `TargetFeature` includes a `target` reference as a {@link TargetDescriptor}
 * and may also include a `namespace` property to prevent feature ID collisions when layers defined in the query target reference multiple sources.
 * Unlike features returned for root style featuresets, `TargetFeature` omits the `layer`, `source`, and `sourceLayer` properties if the feature belongs to import style.
 */
export class TargetFeature extends Feature {
    override variants: never;

    /**
     * The target descriptor of the feature.
     */
    target?: TargetDescriptor;

    /**
     * The namespace of the feature.
     */
    namespace?: string;

    /**
     * @private
     */
    constructor(feature: Feature, variant: FeatureVariant) {
        super(feature._vectorTileFeature, feature._z, feature._x, feature._y, feature.id);
        if (feature.state) this.state = Object.assign({}, feature.state);

        this.target = variant.target;
        this.namespace = variant.namespace;
        if (variant.properties) this.properties = variant.properties;

        if (this.target && (('featuresetId' in this.target && !this.target.importId) || ('layerId' in this.target))) {
            this.source = feature.source;
            this.sourceLayer = feature.sourceLayer;
            this.layer = feature.layer;
        }
    }

    override toJSON(): GeoJSON.Feature & FeatureVariant {
        const json = super.toJSON() as GeoJSON.Feature & FeatureVariant;

        json.target = this.target;
        json.namespace = this.namespace;

        return json;
    }
}

export default Feature;
