// @flow

import { extend } from '../util/util';
import Tile from './tile';
import type {FeatureState} from '../style-spec/expression';

export type FeatureStates = {[feature_id: string]: FeatureState};
export type LayerFeatureStates = {[layer: string]: FeatureStates};

/**
 * SourceFeatureState manages the state and state changes
 * to features in a source, separated by source layer.
 *
 * @private
*/
class SourceFeatureState {
    state: LayerFeatureStates;
    stateChanges: LayerFeatureStates;
    deletedStates: {};

    constructor() {
        this.state = {};
        this.stateChanges = {};
    }

    updateState(sourceLayer: string, featureId: number, newState: Object) {
        const feature = String(featureId);
        this.stateChanges[sourceLayer] = this.stateChanges[sourceLayer] || {};
        this.stateChanges[sourceLayer][feature] = this.stateChanges[sourceLayer][feature] || {};
        extend(this.stateChanges[sourceLayer][feature], newState);


        for (const key in newState) {
            const deletionInQueue = this.deletedStates && this.deletedStates[sourceLayer] && this.deletedStates[sourceLayer][feature] && this.deletedStates[sourceLayer][feature][key] === null;
            if (deletionInQueue) {
                delete this.deletedStates[sourceLayer][feature][key];
            }
        }
    }

    removeFeatureState(sourceLayer: string, featureId?: number, key?: string) {

        const feature = String(featureId);

        this.deletedStates = this.deletedStates || {};
        this.deletedStates[sourceLayer] = this.deletedStates[sourceLayer] || {};


        if (key && featureId) {
            this.deletedStates[sourceLayer][feature] = this.deletedStates[sourceLayer][feature] || {};
            this.deletedStates[sourceLayer][feature][key] = null;
        } else if (featureId) {

            const updateInQueue = this.stateChanges[sourceLayer] && this.stateChanges[sourceLayer][feature];

            if (updateInQueue) {
                this.deletedStates[sourceLayer][feature] = {};

                for (key in this.stateChanges[sourceLayer][feature]) {
                    this.deletedStates[sourceLayer][feature][key] = null;
                }
            } else this.deletedStates[sourceLayer][feature] = null;

        } else {
            this.deletedStates[sourceLayer] = {};

            const featureStateExists = this.state[sourceLayer];
            const updateInQueue = this.stateChanges[sourceLayer];

            if (featureStateExists) {
                for (const feature in featureStateExists) {
                    this.deletedStates[sourceLayer][feature] = {};
                    for (key in this.state[sourceLayer][feature]) {
                        this.deletedStates[sourceLayer][feature][key] = null;
                    }
                }
            }

            if (updateInQueue) {
                for (const feature in updateInQueue) {
                    this.deletedStates[sourceLayer][feature] = {};
                    for (key in this.stateChanges[sourceLayer][feature]) {
                        this.deletedStates[sourceLayer][feature][key] = null;
                    }
                }
            }
        }
    }

    getState(sourceLayer: string, featureId: number) {
        const feature = String(featureId);
        const base = this.state[sourceLayer] || {};
        const changes = this.stateChanges[sourceLayer] || {};

        const reconciledState = extend({}, base[feature], changes[feature]);

        const propsToDelete = this.deletedStates && this.deletedStates[sourceLayer] && this.deletedStates[sourceLayer][featureId];

        if (propsToDelete) {
            for (const prop in this.deletedStates[sourceLayer][featureId]) delete reconciledState[prop];
        }

        return reconciledState;
    }

    initializeTileState(tile: Tile, painter: any) {
        tile.setFeatureState(this.state, painter);
    }

    coalesceChanges(tiles: {[any]: Tile}, painter: any) {

        //track changes with full state objects, but only for features that got modified
        const featuresChanged: LayerFeatureStates = {};

        for (const sourceLayer in this.stateChanges) {
            this.state[sourceLayer]  = this.state[sourceLayer] || {};
            const layerStates = {};
            for (const feature in this.stateChanges[sourceLayer]) {
                if (!this.state[sourceLayer][feature]) this.state[sourceLayer][feature] = {};
                extend(this.state[sourceLayer][feature], this.stateChanges[sourceLayer][feature]);
                layerStates[feature] = this.state[sourceLayer][feature];
            }
            featuresChanged[sourceLayer] = layerStates;
        }


        if (this.deletedStates && Object.keys(this.deletedStates).length > 0) {


            for (const sourceLayer in this.deletedStates) {
                this.state[sourceLayer]  = this.state[sourceLayer] || {};
                const layerStates = {};
                for (const feature in this.deletedStates[sourceLayer]) {

                    const deleteWholeFeatureState = this.deletedStates[sourceLayer][feature] === null;
                    if (deleteWholeFeatureState) {
                        delete this.state[sourceLayer][feature];
                    } else {
                        for (const key of Object.keys(this.deletedStates[sourceLayer][feature])) {
                            delete this.state[sourceLayer][feature][key];
                        }
                    }

                    layerStates[feature] = this.state[sourceLayer][feature];
                }
                featuresChanged[sourceLayer] = featuresChanged[sourceLayer] || {};
                extend(featuresChanged[sourceLayer], layerStates);

            }
        }

        this.stateChanges = {};
        this.deletedStates = {};

        if (Object.keys(featuresChanged).length === 0) return;

        for (const id in tiles) {
            const tile = tiles[id];
            tile.setFeatureState(featuresChanged, painter);
        }
    }
}

export default SourceFeatureState;
