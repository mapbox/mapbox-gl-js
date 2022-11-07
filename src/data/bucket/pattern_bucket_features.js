// @flow
import type FillStyleLayer from '../../style/style_layer/fill_style_layer.js';
import type FillExtrusionStyleLayer from '../../style/style_layer/fill_extrusion_style_layer.js';
import type LineStyleLayer from '../../style/style_layer/line_style_layer.js';

import type {
    BucketFeature,
    PopulateParameters
} from '../bucket.js';

type PatternStyleLayers =
    Array<LineStyleLayer> |
    Array<FillStyleLayer> |
    Array<FillExtrusionStyleLayer>;

export function hasPattern(type: string, layers: PatternStyleLayers, options: PopulateParameters): boolean {
    const patterns = options.patternDependencies;
    let hasPattern = false;

    for (const layer of layers) {
        const patternProperty = layer.paint.get(`${type}-pattern`);
        if (!patternProperty.isConstant()) {
            hasPattern = true;
        }

        const constantPattern = patternProperty.constantOr(null);
        if (constantPattern) {
            hasPattern = true;
            patterns[constantPattern] =  true;
        }
    }

    return hasPattern;
}

export function addPatternDependencies(type: string, layers: PatternStyleLayers, patternFeature: BucketFeature, zoom: number, options: PopulateParameters): BucketFeature {
    const patterns = options.patternDependencies;
    for (const layer of layers) {
        const patternProperty = layer.paint.get(`${type}-pattern`);

        const patternPropertyValue = patternProperty.value;
        if (patternPropertyValue.kind !== "constant") {
            let pattern = patternPropertyValue.evaluate({zoom}, patternFeature, {}, options.availableImages);
            pattern = pattern && pattern.name ? pattern.name : pattern;

            // add to patternDependencies
            patterns[pattern] = true;

            // save for layout
            patternFeature.patterns[layer.id] = pattern;
        }
    }
    return patternFeature;
}
