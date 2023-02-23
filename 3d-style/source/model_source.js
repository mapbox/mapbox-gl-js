// @flow

import {Evented} from '../../src/util/evented.js';
import type {Source} from '../../src/source/source.js';
import type Tile from '../../src/source/tile.js';
import type {Callback} from '../../src/types/callback.js';
import type Dispatcher from '../../src/util/dispatcher.js';
import type Map from '../../src/ui/map.js';
import Projection from '../../src/geo/projection/projection.js';
import {degToRad} from '../../src/util/util.js';

import type {ModelSourceSpecification} from '../../src/style-spec/types.js';
import Model from '../data/model.js';
import convertModel from './model_loader.js';

import type {Mat4, Vec3} from 'gl-matrix';
import {mat4} from 'gl-matrix';
import {load} from '@loaders.gl/core';
import {GLTFLoader} from '@loaders.gl/gltf';

/**
 * A source containing single models.
 */
// Important Note: ModelSource is legacy and should not be offered in the API, as the only valid official sources to add models
// are batched-models and via GeoJson/vector sources. We keep this one (for now) just for ease development and get the render-tests
// passing.
class ModelSource extends Evented implements Source {
    type: 'model';
    id: string;
    minzoom: number;
    maxzoom: number;
    tileSize: number;
    map: Map;
    uri: string;
    models: Array<Model>;
    _options: ModelSourceSpecification;
    _loaded: boolean;
    /**
     * @private
     */
    // eslint-disable-next-line no-unused-vars
    constructor(id: string, options: ModelSourceSpecification, dispatcher: Dispatcher, eventedParent: Evented) {
        super();
        this.id = id;
        this.type = 'model';
        this.models = [];
        this._loaded = false;
        this._options = options;
    }

    async load() {
        /* $FlowIgnore[prop-missing] we don't need the full spec of model_source as it's only used for testing*/
        for (const modelId in this._options.models) {
            const modelSpec = this._options.models[modelId];
            const gltf = await load(modelSpec.uri, GLTFLoader, {gltf: {postProcess: false, loadBuffers: true, loadImages: true}});
            const nodes = convertModel(gltf, this.map.painter.context);
            const model = new Model(modelId, modelSpec.uri, modelSpec.position, modelSpec.orientation, nodes);
            model.computeBoundsAndApplyParent();
            this._calculateModelMatrix(model);
            this.models.push(model);
        }
        this._loaded = true;
    }

    onAdd(map: Map) {
        this.map = map;
        this.load();
    }

    hasTransition(): boolean {
        return false;
    }

    loaded(): boolean {
        return this._loaded;
    }

    _rotationScaleYZFlipMatrix(out: Mat4, rotation: Vec3, scale: Vec3) {
        mat4.identity(out);
        mat4.rotateZ(out, out, degToRad(rotation[2]));
        mat4.rotateX(out, out, degToRad(rotation[0]));
        mat4.rotateY(out, out, degToRad(rotation[1]));

        mat4.scale(out, out, scale);

        // gltf spec uses right handed coordinate space where +y is up. Coordinate space transformation matrix
        // has to be created for the initial transform to our left handed coordinate space
        const coordSpaceTransform = [
            1, 0, 0, 0,
            0, 0, 1, 0,
            0, 1, 0, 0,
            0, 0, 0, 1
        ];

        mat4.multiply(out, out, coordSpaceTransform);
    }

    _calculateModelMatrix(model: Model) {
        const state = this.map.painter.transform;
        const zoom = state.zoom;
        const projectedPoint = state.project(model.position);
        const modelMetersPerPixel = Projection.getMetersPerPixelAtLatitude(model.position.lat, zoom);
        const modelPixelsPerMeter = 1.0 / modelMetersPerPixel;
        const modelMatrix = mat4.identity([]);
        const translation = [0, 0, 0];
        const offset = [projectedPoint.x + translation[0] * modelPixelsPerMeter, projectedPoint.y + translation[1] * modelPixelsPerMeter, translation[2]];
        mat4.translate(modelMatrix, modelMatrix, offset);
        const scaleXY = [modelPixelsPerMeter, modelPixelsPerMeter, 1.0];
        mat4.scale(modelMatrix, modelMatrix, scaleXY);

        // When applying physics (rotation) we need to insert rotation matrix
        // between model rotation and transforms above. Keep the intermediate results.
        const modelMatrixBeforeRotationScaleYZFlip = mat4.clone(modelMatrix);

        const orientation = model.orientation;
        const rotation = [0, 0, 0];

        const rotationScaleYZFlip: Mat4 = [];
        this._rotationScaleYZFlipMatrix(rotationScaleYZFlip,
                              [orientation[0] + rotation[0],
                                  orientation[1] + rotation[1],
                                  orientation[2] + rotation[2]],
                               [1.0, 1.0, 1.0]);
        mat4.multiply(modelMatrix, modelMatrixBeforeRotationScaleYZFlip, rotationScaleYZFlip);

        model.matrix = modelMatrix;
    }

    getModels(): Array<Model> {
        return this.models;
    }
    // eslint-disable-next-line no-unused-vars
    loadTile(tile: Tile, callback: Callback<void>) {}

    serialize(): Object {
        return {
            type: 'model'
        };
    }
}

export default ModelSource;
