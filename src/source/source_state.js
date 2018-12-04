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

    constructor() {
        this.state = {};
        this.stateChanges = {};
    }

    updateState(sourceLayer: string, featureId: number, newState: Object) {
        const feature = String(featureId);
        this.stateChanges[sourceLayer] = this.stateChanges[sourceLayer] || {};
        this.stateChanges[sourceLayer][feature] = this.stateChanges[sourceLayer][feature] || {};
        extend(this.stateChanges[sourceLayer][feature], newState);

        if (this.deletedStates && this.deletedStates[sourceLayer] && this.deletedStates[sourceLayer][feature]) delete this.deletedStates[sourceLayer][feature]
    }

    removeFeatureState(sourceLayer: string, featureId: number, key: string) {
        const feature = String(featureId);

        this.deletedStates = {};
        this.deletedStates[sourceLayer] = {};


        if (key) {
            this.deletedStates[sourceLayer][feature] = {}
            this.deletedStates[sourceLayer][feature][key] = this.state[sourceLayer][feature][key]
        }

        else if (feature) this.deletedStates[sourceLayer][feature] = this.state[sourceLayer][feature];
        else  this.deletedStates[sourceLayer] = this.state[sourceLayer]
    }

    getState(sourceLayer: string, featureId: number) {
        const feature = String(featureId);
        const base = this.state[sourceLayer] || {};
        const changes = this.stateChanges[sourceLayer] || {};
        return extend({}, base[feature], changes[feature]);
    }

    initializeTileState(tile: Tile, painter: any) {
        tile.setFeatureState(this.state, painter);
    }

    coalesceChanges(tiles: {[any]: Tile}, painter: any) {

        const currentChanges: LayerFeatureStates = {};

        for (const sourceLayer in this.stateChanges) {
            this.state[sourceLayer]  = this.state[sourceLayer] || {};
            const layerStates = {};
            for (const id in this.stateChanges[sourceLayer]) {
                if (!this.state[sourceLayer][id]) {
                    this.state[sourceLayer][id] = {};
                }
                extend(this.state[sourceLayer][id], this.stateChanges[sourceLayer][id]);
                layerStates[id] = this.state[sourceLayer][id];
            }
            currentChanges[sourceLayer] = layerStates;
        }


        if (this.deletedStates) {

            for (const sourceLayer in this.deletedStates) {
                this.state[sourceLayer]  = this.state[sourceLayer] || {};
                const layerStates = {};
                for (const id in this.deletedStates[sourceLayer]) {
                    for (const feature in this.deletedStates[sourceLayer][id]){
                        this.state[sourceLayer][id][key] = null;
                    }

                    extend(layerStates[id], this.state[sourceLayer][id]);
                }
                extend(currentChanges[sourceLayer], layerStates);
            }

        }

        this.stateChanges = {};
        this.deletedStates = null;

        if (Object.keys(changes).length === 0) return;

        for (const id in tiles) {
            const tile = tiles[id];
            tile.setFeatureState(currentChanges, painter);
        }
    }
}

export default SourceFeatureState;
