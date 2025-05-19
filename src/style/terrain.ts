import styleSpec from '../style-spec/reference/latest';
import {Evented} from '../util/evented';
import {Properties, Transitionable, DataConstantProperty} from './properties';
import EvaluationParameters from './evaluation_parameters';
import {ZoomDependentExpression} from '../style-spec/expression/index';

import type {ConfigOptions, TransitionParameters, Transitioning, PossiblyEvaluated} from './properties';
import type {TerrainSpecification} from '../style-spec/types';

type Props = {
    ["source"]: DataConstantProperty<string>;
    ["exaggeration"]: DataConstantProperty<number>;
};

export const DrapeRenderMode = {
    deferred: 0,
    elevated: 1
} as const;

class Terrain extends Evented {
    scope: string;
    _transitionable: Transitionable<Props>;
    _transitioning: Transitioning<Props>;
    properties: PossiblyEvaluated<Props>;
    drapeRenderMode: number;

    worldview: string | undefined;

    constructor(terrainOptions: TerrainSpecification, drapeRenderMode: number, scope: string, configOptions?: ConfigOptions | null, worldview?: string) {
        super();
        this.scope = scope;
        this._transitionable = new Transitionable(new Properties({
            "source": new DataConstantProperty(styleSpec.terrain.source),
            "exaggeration": new DataConstantProperty(styleSpec.terrain.exaggeration),
        }), scope, configOptions);
        // @ts-expect-error - TS2345 - Argument of type 'TerrainSpecification' is not assignable to parameter of type 'PropertyValueSpecifications<Props>'.
        this._transitionable.setTransitionOrValue(terrainOptions, configOptions);
        this._transitioning = this._transitionable.untransitioned();
        this.drapeRenderMode = drapeRenderMode;

        this.worldview = worldview;
    }

    get(): TerrainSpecification {
        return this._transitionable.serialize() as TerrainSpecification;
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

        return this._transitioning.possiblyEvaluate(new EvaluationParameters(atZoom, {worldview: this.worldview})).get('exaggeration');
    }

    // For dynamic terrain, this is the zoom range when the terrain flattening (disabling) starts
    // and ends. At zoom above attenuationRange->max, terrain exaggeration is evaluated to 0.
    // The exaggeration used in terrain is smoothened from this value, and as terrain gets disabled
    // using smoothened curve, it effectivelly gets disabled at some value above attenuationRange->max
    // but that value is capped at ceil(attenuationRange->max).
    getAttenuationRange(): [number, number] | null {
        if (!this.isZoomDependent()) {
            return null;
        }

        const exaggeration = this._transitionable._values['exaggeration'];
        if (!exaggeration) {
            return null;
        }

        const expression = exaggeration.value.expression as ZoomDependentExpression<'camera'>;
        if (!expression) {
            return null;
        }

        let zoomBeforeDrop = -1.0; // at this zoom, if above zero, terrain flattening starts.
        let fullyDisabledZoom = -1.0; // at this zoom, at the end of the zoom curve, terrain exaggeration expression disables the zoom.
        let theLastExaggeration = 1.0;
        const zeroExaggerationCutoff = 0.01; // ~0 exaggeration
        for (const zoom of expression.zoomStops) {
            theLastExaggeration = expression.evaluate(new EvaluationParameters(zoom, {worldview: this.worldview}));
            if (theLastExaggeration > zeroExaggerationCutoff) {
                zoomBeforeDrop = zoom;
                fullyDisabledZoom = -1;
            } else {
                fullyDisabledZoom = zoom;
            }
        }
        if (theLastExaggeration < zeroExaggerationCutoff && zoomBeforeDrop > 0.0 && fullyDisabledZoom > zoomBeforeDrop) {
            return [zoomBeforeDrop, fullyDisabledZoom];
        }
        return null;
    }

    isZoomDependent(): boolean {
        const exaggeration = this._transitionable._values['exaggeration'];
        return exaggeration != null && exaggeration.value != null &&
            exaggeration.value.expression != null &&
            exaggeration.value.expression instanceof ZoomDependentExpression;
    }
}

export default Terrain;
