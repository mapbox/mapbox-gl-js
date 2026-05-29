import {makeFQID} from '../../src/util/fqid';

import type Style from '../../src/style/style';
import type Painter from '../../src/render/painter';
import type EvaluationContext from '../../src/style-spec/expression/evaluation_context';

/// Read `sdCoverageFadeRange` and `sdCoverageSourceLayers` from style config and apply
/// them to the painter. Walks fragment styles; first match wins. Intentionally runs
/// without HD loaded so painter params are set before tiles load, ensuring SD traffic
/// tiles defer correctly even in ESM lazy-HD builds.
export function updateFrcCoverageFadeRange(style: Style, painter: Painter) {
    let fadeRange: [number, number] | null = null;
    let sourceLayers: string[] | null = null;
    const zoomOnlyCtx = {globals: {zoom: 0}} as unknown as EvaluationContext;
    style.forEachFragmentStyle((s: Style) => {
        if (fadeRange) return;
        const schema = s.stylesheet ? s.stylesheet.schema : null;
        if (!schema || !schema['sdCoverageFadeRange']) return;
        const fqid = makeFQID('sdCoverageFadeRange', s.scope);
        const expressions = s.options ? s.options.get(fqid) : undefined;
        const expression = expressions ? expressions.value || expressions.default : null;
        if (expression) {
            const val = expression.evaluate(zoomOnlyCtx) as unknown;
            if (Array.isArray(val) && val.length === 2 && (val[0] > 0 || val[1] > 0)) {
                fadeRange = [val[0] as number, val[1] as number];
            }
        }
        const slFqid = makeFQID('sdCoverageSourceLayers', s.scope);
        const slEntry = s.options ? s.options.get(slFqid) : undefined;
        const slExpr = slEntry ? slEntry.value || slEntry.default : null;
        if (slExpr) {
            const val = slExpr.evaluate(zoomOnlyCtx) as unknown;
            if (Array.isArray(val) && val.length > 0) sourceLayers = val as string[];
        } else {
            const imports = style.stylesheet ? style.stylesheet.imports || [] : [];
            for (const imp of imports) {
                if (imp.id === s.scope) {
                    const raw = imp.config ? imp.config['sdCoverageSourceLayers'] : undefined;
                    if (Array.isArray(raw) && raw.length > 0) sourceLayers = raw as string[];
                    break;
                }
            }
        }
    });
    painter.frcCoverageFadeRange = fadeRange;
    painter.frcCoverageSourceLayers = fadeRange != null ? (sourceLayers || ['road', 'structure']) : [];
}
