// @ts-nocheck
import {test, expect, vi} from '../../util/vitest';
import Protobuf from 'pbf';
import {VectorTile} from '@mapbox/vector-tile';
import {CollisionBoxArray} from '../../../src/data/array_types';
import vectorStub from '../../fixtures/mbsv5-6-18-23.vector.pbf?arraybuffer';
import ModelStyleLayer from '../../../3d-style/style/style_layer/model_style_layer';
import ModelBucket from '../../../3d-style/data/bucket/model_bucket';
import ModelManager from '../../../3d-style/render/model_manager';
import {Evented} from '../../../src/util/evented';
import {RequestManager} from '../../../src/util/mapbox';
import {OverscaledTileID} from '../../../src/source/tile_id';
import FeatureIndex from '../../../src/data/feature_index';
import featureFilter from '../../../src/style-spec/feature_filter/index';

// Load a point feature from fixture tile.
const vt = new VectorTile(new Protobuf(vectorStub));
const feature = vt.layers.place_label.feature(10);
const collisionBoxArray = new CollisionBoxArray();
const eventedParent = new Evented();
const modelManager = new ModelManager(new RequestManager());
modelManager.setEventedParent(eventedParent);
const modelId = "https://example.com/model.gltf";
const scope = '';

export function createModelBucket(layerId, zoom, canonical) {
    const layer = new ModelStyleLayer({
        id: layerId,
        type: 'model',
        layout: {'model-id': modelId},
        filter: featureFilter(),
    }, scope, null);
    layer.modelManager = modelManager;
    layer.recalculate({zoom}, []);

    return new ModelBucket({
        overscaling: 1,
        zoom,
        canonical,
        collisionBoxArray,
        layers: [layer],
        projection: {name: 'mercator'}
    });
}

test("ModelBucket destroy doesn't remove models if they haven't been requested", () => {
    const zoom = 15;
    const overscaled1 = new OverscaledTileID(zoom, 0, zoom, 16369, 10895);
    const overscaled2 = new OverscaledTileID(zoom, 0, zoom, 16369, 10896);
    const modelBucket1 = createModelBucket('modelLayer', 15, overscaled1.canonical);
    const modelBucket2 = createModelBucket('modelLayer', 15, overscaled2.canonical);

    const model = {
        id: modelId,
        url: modelId,
        destroy: vi.fn()
    };

    vi.spyOn(modelManager, 'loadModel').mockImplementation(
        (id, url) => id === modelId ? Promise.resolve(model) : Promise.reject(new Error('Not found'))
    );

    eventedParent.on('error', ({error}) => {
        expect.unreachable(error.message);
    });

    eventedParent.on('data', () => {
        expect(modelManager.hasModel(modelId, scope)).toBe(true);

        // populate will add modelIds to the bucket model list
        modelBucket2.populate([{feature}], {featureIndex: new FeatureIndex(overscaled2)}, overscaled2.canonical);
        // Destroying the tile should only remove models if they have been added to the bucket
        modelBucket2.destroy();
        // References to the models should not have been removed
        expect(modelManager.hasModel(modelId, scope)).toBe(true);
        expect(model.destroy).not.toHaveBeenCalled();
    });

    // populate will add modelIds to the bucket model list
    modelBucket1.populate([{feature}], {featureIndex: new FeatureIndex(overscaled1)}, overscaled1.canonical);
    modelManager.addModelsFromBucket(modelBucket1.getModelUris(), scope);
});
