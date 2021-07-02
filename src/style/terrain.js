// @flow

import styleSpec from '../style-spec/reference/latest.js';
import {endsWith} from '../util/util.js';
import {Evented} from '../util/evented.js';
import {Properties, Transitionable, Transitioning, PossiblyEvaluated, DataConstantProperty} from './properties.js';

import type EvaluationParameters from './evaluation_parameters.js';
import type {TransitionParameters} from './properties.js';
import type {TerrainSpecification} from '../style-spec/types.js';

type Props = {|
    "source": DataConstantProperty<string>,
    "exaggeration": DataConstantProperty<number>,
|};

const properties: Properties<Props> = new Properties({
    "source": new DataConstantProperty(styleSpec.terrain.source),
    "exaggeration": new DataConstantProperty(styleSpec.terrain.exaggeration),
});

const TRANSITION_SUFFIX = '-transition';

class Terrain extends Evented {
    _transitionable: Transitionable<Props>;
    _transitioning: Transitioning<Props>;
    properties: PossiblyEvaluated<Props>;

    constructor(terrainOptions: TerrainSpecification) {
        super();
        this._transitionable = new Transitionable(properties);
        this.set(terrainOptions);
        this._transitioning = this._transitionable.untransitioned();
    }

    get() {
        return this._transitionable.serialize();
    }

    set(terrain: TerrainSpecification) {
        for (const name in terrain) {
            const value = terrain[name];
            if (endsWith(name, TRANSITION_SUFFIX)) {
                this._transitionable.setTransition(name.slice(0, -TRANSITION_SUFFIX.length), value);
            } else {
                this._transitionable.setValue(name, value);
            }
        }
    }

    updateTransitions(parameters: TransitionParameters) {
        this._transitioning = this._transitionable.transitioned(parameters, this._transitioning);
    }

    hasTransition() {
        return this._transitioning.hasTransition();
    }

    recalculate(parameters: EvaluationParameters) {
        this.properties = this._transitioning.possiblyEvaluate(parameters);
    }
}

export default Terrain;
