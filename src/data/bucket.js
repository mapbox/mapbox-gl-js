// @flow

import type {CollisionBoxArray} from './array_types.js';
import type Style from '../style/style.js';
import type {TypedStyleLayer} from '../style/style_layer/typed_style_layer.js';
import type FeatureIndex from './feature_index.js';
import type Context from '../gl/context.js';
import type {FeatureStates} from '../source/source_state.js';
import type {SpritePositions} from '../util/image.js';
import type LineAtlas from '../render/line_atlas.js';
import type {CanonicalTileID} from '../source/tile_id.js';
import type {TileTransform} from '../geo/projection/tile_transform.js';
import type Point from '@mapbox/point-geometry';
import type {ProjectionSpecification} from '../style-spec/types.js';
import type {IVectorTileFeature, IVectorTileLayer} from '@mapbox/vector-tile';

export type BucketParameters<Layer: TypedStyleLayer> = {
    index: number,
    layers: Array<Layer>,
    zoom: number,
    canonical: CanonicalTileID,
    pixelRatio: number,
    overscaling: number,
    collisionBoxArray: CollisionBoxArray,
    sourceLayerIndex: number,
    sourceID: string,
    enableTerrain: boolean,
    projection: ProjectionSpecification
}

export type PopulateParameters = {
    featureIndex: FeatureIndex,
    iconDependencies: {},
    patternDependencies: {},
    glyphDependencies: {},
    availableImages: Array<string>,
    lineAtlas: LineAtlas
}

export type IndexedFeature = {
    feature: IVectorTileFeature,
    id: number | string | void,
    index: number,
    sourceLayerIndex: number,
}

export type BucketFeature = {|
    index: number,
    sourceLayerIndex: number,
    geometry: Array<Array<Point>>,
    properties: Object,
    type: 1 | 2 | 3,
    id?: any,
    +patterns: {[_: string]: {"min": string, "mid": string, "max": string}},
    sortKey?: number
|};

/**
 * The `Bucket` interface is the single point of knowledge about turning vector
 * tiles into WebGL buffers.
 *
 * `Bucket` is an abstract interface. An implementation exists for each style layer type.
 * Create a bucket via the `StyleLayer#createBucket` method.
 *
 * The concrete bucket types, using layout options from the style layer,
 * transform feature geometries into vertex and index data for use by the
 * vertex shader.  They also (via `ProgramConfiguration`) use feature
 * properties and the zoom level to populate the attributes needed for
 * data-driven styling.
 *
 * Buckets are designed to be built on a worker thread and then serialized and
 * transferred back to the main thread for rendering.  On the worker side, a
 * bucket's vertex, index, and attribute data is stored in `bucket.arrays:
 * ArrayGroup`.  When a bucket's data is serialized and sent back to the main
 * thread, is gets deserialized (using `new Bucket(serializedBucketData)`, with
 * the array data now stored in `bucket.buffers: BufferGroup`.  BufferGroups
 * hold the same data as ArrayGroups, but are tuned for consumption by WebGL.
 *
 * @private
 */
export interface Bucket {
    layerIds: Array<string>;
    hasPattern: boolean;
    +layers: Array<any>;
    +stateDependentLayers: Array<any>;
    +stateDependentLayerIds: Array<string>;
    populate(features: Array<IndexedFeature>, options: PopulateParameters, canonical: CanonicalTileID, tileTransform: TileTransform): void;
    update(states: FeatureStates, vtLayer: IVectorTileLayer, availableImages: Array<string>, imagePositions: SpritePositions): void;
    isEmpty(): boolean;

    upload(context: Context): void;
    uploadPending(): boolean;

    /**
     * Release the WebGL resources associated with the buffers. Note that because
     * buckets are shared between layers having the same layout properties, they
     * must be destroyed in groups (all buckets for a tile, or all symbol buckets).
     *
     * @private
     */
    destroy(): void;
}

export function deserialize(input: Array<Bucket>, style: Style): {[_: string]: Bucket} {
    const output = {};

    // Guard against the case where the map's style has been set to null while
    // this bucket has been parsing.
    if (!style) return output;

    for (const bucket of input) {
        const layers = bucket.layerIds
            .map((id) => style.getLayer(id))
            .filter(Boolean);

        if (layers.length === 0) {
            continue;
        }

        // look up StyleLayer objects from layer ids (since we don't
        // want to waste time serializing/copying them from the worker)
        (bucket: any).layers = layers;
        if ((bucket: any).stateDependentLayerIds) {
            (bucket: any).stateDependentLayers = (bucket: any).stateDependentLayerIds.map((lId) => layers.filter((l) => l.id === lId)[0]);
        }
        for (const layer of layers) {
            output[layer.id] = bucket;
        }
    }

    return output;
}
