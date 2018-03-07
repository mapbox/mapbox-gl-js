// @flow
import { extend } from '../util/util';

export type FeatureStates = {[feature_id: string]: {[key: string]: string | number | boolean }};
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

    setState(feature: string, key: string, value: any, sourceLayer: string) {
        this.stateChanges[sourceLayer] = this.stateChanges[sourceLayer] || {};
        this.stateChanges[sourceLayer][feature] = this.stateChanges[sourceLayer][feature] || {};
        this.stateChanges[sourceLayer][feature][key] = value;
    }

    getState(feature: string, key?: string, sourceLayer: string) {
        const base = this.state[sourceLayer] || {};
        const changes = this.stateChanges[sourceLayer] || {};

        if (!key) {
            return extend({}, base[feature], changes[feature]);
        }
        if (changes[feature]) {
            return changes[feature][key];
        }
        if (base[feature]) {
            return base[feature][key];
        }
    }

    coalesceChanges() {
        const changes = {};
        for (const sourceLayer in this.stateChanges) {
            this.state[sourceLayer]  = this.state[sourceLayer] || {};
            const layerStates = {};
            for (const id in this.stateChanges[sourceLayer]) {
                this.state[sourceLayer][id] = extend(
                                                {},
                                                this.state[sourceLayer][id],
                                                this.stateChanges[sourceLayer][id]);
                layerStates[id] = this.state[sourceLayer][id];
            }
            changes[sourceLayer] = layerStates;
        }
        this.stateChanges = {};
        return changes;
    }
}

export default SourceFeatureState;
