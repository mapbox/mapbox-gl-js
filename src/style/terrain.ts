import styleSpec from '../style-spec/reference/latest';
import {Evented} from '../util/evented';
import {Properties, Transitionable, Transitioning, PossiblyEvaluated, DataConstantProperty} from './properties';

import EvaluationParameters from './evaluation_parameters';
import type {ConfigOptions, TransitionParameters} from './properties';
import type {TerrainSpecification} from '../style-spec/types';
import {ZoomDependentExpression} from '../style-spec/expression/index';

type Props = {
    ["source"]: DataConstantProperty<string>;
    ["exaggeration"]: DataConstantProperty<number>;
};

export const DrapeRenderMode = {
    deferred: 0,
    elevated: 1
} as const;

const properties: Properties<Props> = new Properties({
    "source": new DataConstantProperty(styleSpec.terrain.source),
    "exaggeration": new DataConstantProperty(styleSpec.terrain.exaggeration),
});

class Terrain extends Evented {
    scope: string;
    _transitionable: Transitionable<Props>;
    _transitioning: Transitioning<Props>;
    properties: PossiblyEvaluated<Props>;
    drapeRenderMode: number;

    constructor(terrainOptions: TerrainSpecification, drapeRenderMode: number, scope: string, configOptions?: ConfigOptions | null) {
        super();
        this.scope = scope;
        this._transitionable = new Transitionable(properties, scope, configOptions);
        // @ts-expect-error - TS2345 - Argument of type 'TerrainSpecification' is not assignable to parameter of type 'PropertyValueSpecifications<Props>'.
        this._transitionable.setTransitionOrValue(terrainOptions, configOptions);
        this._transitioning = this._transitionable.untransitioned();
        this.drapeRenderMode = drapeRenderMode;
    }

    get(): TerrainSpecification {
        return this._transitionable.serialize() as any;
    }

    set(terrain: TerrainSpecification, configOptions?: ConfigOptions | null) {
        // @ts-expect-error - TS2345 - Argument of type 'TerrainSpecification' is not assignable to parameter of type 'PropertyValueSpecifications<Props>'.
        this._transitionable.setTransitionOrValue(terrain, configOptions);
    }

    updateTransitions(parameters: TransitionParameters) {
        this._transitioning = this._transitionable.transitioned(parameters, this._transitioning);
    }

    hasTransition(): boolean {
        return this._transitioning.hasTransition();
    }

    recalculate(parameters: EvaluationParameters) {
        this.properties = this._transitioning.possiblyEvaluate(parameters);
    }

    getExaggeration(atZoom: number): number {

        return this._transitioning.possiblyEvaluate(new EvaluationParameters(atZoom)).get('exaggeration');
    }

    isZoomDependent(): boolean {
        const exaggeration = this._transitionable._values['exaggeration'];
        return exaggeration != null && exaggeration.value != null &&
            exaggeration.value.expression != null &&
            exaggeration.value.expression instanceof ZoomDependentExpression;
    }
}

export default Terrain;
