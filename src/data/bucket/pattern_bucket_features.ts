import ResolvedImage from '../../style-spec/expression/types/resolved_image';

import type FillStyleLayer from '../../style/style_layer/fill_style_layer';
import type FillExtrusionStyleLayer from '../../style/style_layer/fill_extrusion_style_layer';
import type LineStyleLayer from '../../style/style_layer/line_style_layer';
import type {
    BucketFeature,
    PopulateParameters
} from '../bucket';
import type {ImageIdWithOptions} from '../../style-spec/expression/types/image_id_with_options';

type PatternStyleLayers = Array<LineStyleLayer> | Array<FillStyleLayer> | Array<FillExtrusionStyleLayer>;

function addPattern(
    pattern: string | ResolvedImage,
    patterns: Record<string, Array<ImageIdWithOptions>>
): string | null {
    if (!pattern) {
        return null;
    }

    const patternId = typeof pattern === 'string' ? pattern : pattern.getPrimary().id;

    if (!patterns[patternId]) {
        patterns[patternId] = [];
    }

    const patternPrimary = (ResolvedImage.from(pattern)).getPrimary();
    patterns[patternId].push(patternPrimary);
    return patternPrimary.serialize();
}

export function hasPattern(type: string, layers: PatternStyleLayers, options: PopulateParameters): boolean {
    const patterns = options.patternDependencies;
    let hasPattern = false;

    for (const layer of layers) {
        // @ts-expect-error - TS2349 - This expression is not callable.
        const patternProperty = layer.paint.get(`${type}-pattern`);

        if (!patternProperty.isConstant()) {
            hasPattern = true;
        }

        const constantPattern = patternProperty.constantOr(null);

        if (addPattern(constantPattern, patterns)) {
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

            const patternSerialized: string | null = addPattern(pattern, patterns);

            // save for layout
            if (patternSerialized) {
                patternFeature.patterns[layer.id] = patternSerialized;
            }
        }
    }
    return patternFeature;
}
