// Import FeatureIndex as a module with side effects to ensure
// it's registered as a serializable class on the main thread
import './feature_index';

import type {CollisionBoxArray} from './array_types';
import type Style from '../style/style';
import type {TypedStyleLayer} from '../style/style_layer/typed_style_layer';
import type FeatureIndex from './feature_index';
import type Context from '../gl/context';
import type {FeatureStates} from '../source/source_state';
import type {SpritePositions} from '../util/image';
import type LineAtlas from '../render/line_atlas';
import type {CanonicalTileID, UnwrappedTileID} from '../source/tile_id';
import type {TileTransform} from '../geo/projection/tile_transform';
import type Point from '@mapbox/point-geometry';
import type {ProjectionSpecification} from '../style-spec/types';
import type {VectorTileFeature, VectorTileLayer} from '@mapbox/vector-tile';
import type {TileFootprint} from '../../3d-style/util/conflation';
import type {LUT} from "../util/lut";
import type {ImageVariant} from '../style-spec/expression/types/image_variant';
import type {ElevationFeature} from '../../3d-style/elevation/elevation_feature';
import type {ImageId, StringifiedImageId} from '../style-spec/expression/types/image_id';

export type BucketParameters<Layer extends TypedStyleLayer> = {
    index: number;
    layers: Array<Layer>;
    zoom: number;
    lut: LUT | null;
    canonical: CanonicalTileID;
    pixelRatio: number;
    overscaling: number;
    collisionBoxArray: CollisionBoxArray;
    sourceLayerIndex: number;
    sourceID: string;
    projection: ProjectionSpecification;
    tessellationStep: number | null | undefined;
};

export type ImageDependenciesMap = Map<StringifiedImageId, Array<ImageVariant>>;

export type GlyphDependencies = Record<string, Record<number, boolean>>;

export type PopulateParameters = {
    featureIndex: FeatureIndex;
    iconDependencies: ImageDependenciesMap;
    patternDependencies: ImageDependenciesMap;
    glyphDependencies: GlyphDependencies;
    availableImages: ImageId[];
    lineAtlas: LineAtlas;
    brightness: number | null | undefined;
    scaleFactor: number;
    elevationFeatures: ElevationFeature[] | undefined;
};

export type IndexedFeature = {
    feature: VectorTileFeature;
    id: number | string | undefined;
    index: number;
    sourceLayerIndex: number;
};

export type BucketFeature = {
    index: number;
    sourceLayerIndex: number;
    geometry: Array<Array<Point>>;
    properties: any;
    type: 0 | 1 | 2 | 3;
    id?: any;
    readonly patterns: Record<string, string>;
    sortKey?: number;
};

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
    readonly layers: Array<any>;
    readonly stateDependentLayers: Array<any>;
    readonly stateDependentLayerIds: Array<string>;
    populate: (
        features: Array<IndexedFeature>,
        options: PopulateParameters,
        canonical: CanonicalTileID,
        tileTransform: TileTransform,
    ) => void;
    update: (
        states: FeatureStates,
        vtLayer: VectorTileLayer,
        availableImages: ImageId[],
        imagePositions: SpritePositions,
        layers: Array<TypedStyleLayer>,
        isBrightnessChanged: boolean,
        brightness?: number | null,
    ) => void;
    isEmpty: () => boolean;
    upload: (context: Context) => void;
    uploadPending: () => boolean;
    /**
     * Release the WebGL resources associated with the buffers. Note that because
     * buckets are shared between layers having the same layout properties, they
     * must be destroyed in groups (all buckets for a tile, or all symbol buckets).
     *
     * @private
     */
    destroy: () => void;
    updateFootprints: (id: UnwrappedTileID, footprints: Array<TileFootprint>) => void;
}

export function deserialize(input: Array<Bucket>, style: Style): Record<string, Bucket> {
    const output: Record<string, Bucket> = {};

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
        // @ts-expect-error - layers is a readonly property
        bucket.layers = layers;
        if (bucket.stateDependentLayerIds) {
            (bucket as any).stateDependentLayers = bucket.stateDependentLayerIds.map((lId) => layers.filter((l) => l.id === lId)[0]);
        }
        for (const layer of layers) {
            output[layer.fqid] = bucket;
        }
    }

    return output;
}
