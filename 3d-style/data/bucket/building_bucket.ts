import {register} from '../../../src/util/web_worker_transfer';

import type {CanonicalTileID, UnwrappedTileID} from '../../../src/source/tile_id';
import type {
    Bucket,
    BucketParameters,
    IndexedFeature,
    PopulateParameters
} from '../../../src/data/bucket';
import type BuildingStyleLayer from '../../style/style_layer/building_style_layer';
import type Context from '../../../src/gl/context';
import type {FeatureStates} from '../../../src/source/source_state';
import type {ImageId} from '../../../src/style-spec/expression/types/image_id';
import type {SpritePositions} from '../../../src/util/image';
import type {TileTransform} from '../../../src/geo/projection/tile_transform';
import type {VectorTileLayer} from '@mapbox/vector-tile';
import type {TileFootprint} from '../../util/conflation';
import type {TypedStyleLayer} from '../../../src/style/style_layer/typed_style_layer';

class BuildingBucket implements Bucket {
    layers: Array<BuildingStyleLayer>;
    layerIds: Array<string>;
    stateDependentLayers: Array<BuildingStyleLayer>;
    stateDependentLayerIds: Array<string>;
    hasPattern: boolean;
    worldview: string;

    constructor(options: BucketParameters<BuildingStyleLayer>) {
        this.layers = options.layers;
        this.layerIds = this.layers.map(layer => layer.fqid);
        this.hasPattern = false;
        this.worldview = options.worldview;
    }

    updateFootprints(_id: UnwrappedTileID, _footprints: Array<TileFootprint>) {

    }

    populate(features: Array<IndexedFeature>, options: PopulateParameters, canonical: CanonicalTileID, tileTransform: TileTransform) {

    }

    update(states: FeatureStates, vtLayer: VectorTileLayer, availableImages: Array<ImageId>, imagePositions: SpritePositions, layers: ReadonlyArray<TypedStyleLayer>, isBrightnessChanged: boolean, brightness?: number | null) {

    }

    isEmpty(): boolean {
        return false;
    }

    uploadPending(): boolean {
        return false;
    }

    upload(context: Context) {

    }

    destroy() {

    }

    getHeightAtTileCoord(x: number, y: number): {
        height: number;
        hidden: boolean;
    } | null | undefined {
        const height = Number.NEGATIVE_INFINITY;
        const hidden = true;

        return {height, hidden};
    }
}

register(BuildingBucket, 'BuildingBucket', {omit: ['layers']});

export default BuildingBucket;
