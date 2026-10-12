import styleSpec from '../style-spec/reference/latest';
import {Properties, DataConstantProperty, possiblyEvaluateTransition} from './properties';
import {StyleProperties} from './style_properties';
import EvaluationParameters from './evaluation_parameters';
import {ZoomDependentExpression} from '../style-spec/expression/index';

import type {ConfigOptions} from './properties';
import type {TerrainSpecification, TerrainSpecificationUpdate} from '../style-spec/types';
import type {StylePropertySpecification} from '../style-spec/style-spec';

type Props = {
    ["source"]: DataConstantProperty<string>;
    ["exaggeration"]: DataConstantProperty<number>;
};

const terrainSpecification = styleSpec.terrain as Record<string, StylePropertySpecification>;

export const DrapeRenderMode = {
    deferred: 0,
    elevated: 1
} as const;

class Terrain extends StyleProperties<Props> {
    drapeRenderMode: number;

    worldview: string | undefined;

    constructor(terrainOptions: TerrainSpecification, drapeRenderMode: number, scope: string, configOptions?: ConfigOptions | null, worldview?: string) {
        super(new Properties({
            "source": new DataConstantProperty(terrainSpecification.source),
            "exaggeration": new DataConstantProperty(terrainSpecification.exaggeration),
        }), scope, configOptions);

        this._transitionable.setTransitionOrValue(terrainOptions, configOptions);
        this._transitionable.snap();
        this.drapeRenderMode = drapeRenderMode;

        this.worldview = worldview;
    }

    get(): TerrainSpecification {
        return this._transitionable.serialize() as TerrainSpecification;
    }

    set(terrain: TerrainSpecification | TerrainSpecificationUpdate, configOptions?: ConfigOptions | null) {
        this._transitionable.setTransitionOrValue(terrain, configOptions);
    }

    getExaggeration(atZoom: number): number {
        return possiblyEvaluateTransition(this._transitionable._values.exaggeration.state, new EvaluationParameters(atZoom, {worldview: this.worldview}));
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

        const expression = this._transitionable._values.exaggeration.value.expression as ZoomDependentExpression<'camera'>;

        let zoomBeforeDrop = -1.0; // at this zoom, if above zero, terrain flattening starts.
        let fullyDisabledZoom = -1.0; // at this zoom, at the end of the zoom curve, terrain exaggeration expression disables the zoom.
        let theLastExaggeration = 1.0;
        const zeroExaggerationCutoff = 0.01; // ~0 exaggeration
        for (const zoom of expression.zoomStops) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
        return this._transitionable._values.exaggeration.value.expression instanceof ZoomDependentExpression;
    }
}

export default Terrain;

/// True when terrain is enabled at the current zoom.
/// Zero exaggeration on zoom-dependent terrain counts as disabled.
export function terrainEnabled(
    style: {terrain?: Terrain | null} | null | undefined,
    transform: {zoom: number; projection: {requiresDraping: boolean}} | null | undefined,
): boolean {
    const terrain = style ? style.terrain : null;
    if (!terrain) return false;
    if (!transform) return true; // conservative: can't evaluate exaggeration, assume active
    if (transform.projection.requiresDraping) return true;
    if (!terrain.isZoomDependent()) return true;
    return terrain.getExaggeration(transform.zoom) > 0;
}
