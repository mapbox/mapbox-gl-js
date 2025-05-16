import ResolvedImage from '../../style-spec/expression/types/resolved_image';

import type FillStyleLayer from '../../style/style_layer/fill_style_layer';
import type FillExtrusionStyleLayer from '../../style/style_layer/fill_extrusion_style_layer';
import type LineStyleLayer from '../../style/style_layer/line_style_layer';
import type {
    BucketFeature,
    PopulateParameters,
    ImageDependenciesMap
} from '../bucket';

type PatternStyleLayers = Array<LineStyleLayer> | Array<FillStyleLayer> | Array<FillExtrusionStyleLayer>;

type AddPatternResult = {
    primary: string | null;
    secondary: string | null;
}

function addPattern(pattern: string | ResolvedImage, patterns: ImageDependenciesMap, pixelRatio: number = 1): AddPatternResult {
    if (!pattern) {
        return null;
    }

    const patternPrimary = typeof pattern === 'string' ? ResolvedImage.from(pattern).getPrimary() : pattern.getPrimary();
    const patternSecondary = typeof pattern === 'string' ? null : pattern.getSecondary();

    for (const pattern of [patternPrimary, patternSecondary]) {
        if (!pattern) {
            continue;
        }

        const id = pattern.id.toString();
        if (!patterns.has(id)) {
            patterns.set(id, []);
        }

        pattern.scaleSelf(pixelRatio);
        patterns.get(id).push(pattern);
    }

    return {
        primary: patternPrimary.toString(),
        secondary: patternSecondary ? patternSecondary.toString() : null
    };
}

export function hasPattern(type: string, layers: PatternStyleLayers, pixelRatio: number, options: PopulateParameters): boolean {
    const patterns = options.patternDependencies;
    let hasPattern = false;

    for (const layer of layers) {
        // @ts-expect-error - TS2349 - This expression is not callable.
        const patternProperty = layer.paint.get(`${type}-pattern`);

        if (!patternProperty.isConstant()) {
            hasPattern = true;
        }

        const constantPattern = patternProperty.constantOr(null);

        if (addPattern(constantPattern, patterns, pixelRatio)) {
            hasPattern = true;
        }
    }

    return hasPattern;
}

export function addPatternDependencies(
    type: string,
    layers: PatternStyleLayers,
    patternFeature: BucketFeature,
    zoom: number,
    pixelRatio: number,
    options: PopulateParameters,
): BucketFeature {
    const patterns = options.patternDependencies;
    for (const layer of layers) {
        // @ts-expect-error - TS2349 - This expression is not callable.
        const patternProperty = layer.paint.get(`${type}-pattern`);

        const patternPropertyValue = patternProperty.value;
        if (patternPropertyValue.kind !== "constant") {
            let pattern = patternPropertyValue.evaluate({zoom}, patternFeature, {}, options.availableImages);
            pattern = pattern && pattern.name ? pattern.name : pattern;

            const patternResult = addPattern(pattern, patterns, pixelRatio);

            if (!patternResult) {
                continue;
            }

            const {
                primary: primarySerialized,
                secondary: secondarySerialized
            } = patternResult;

            // save for layout
            if (primarySerialized) {
                patternFeature.patterns[layer.id] = [primarySerialized, secondarySerialized].filter(Boolean);
            }
        }
    }
    return patternFeature;
}
