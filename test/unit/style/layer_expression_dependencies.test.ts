// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {describe, test, expect} from '../../util/vitest';
import createStyleLayer from '../../../src/style/create_style_layer';
import {LayerExpressionDependencies} from '../../../src/style/layer_expression_dependencies';

describe('LayerExpressionDependencies', () => {
    test('reports config dependencies from filter', () => {
        const deps = new LayerExpressionDependencies(createStyleLayer({
            id: 'test',
            type: 'fill',
            source: 'src',
            filter: ['==', ['get', 'x'], ['config', 'foo']]
        }));
        expect(deps.hasConfigDependency('foo')).toBeTruthy();
        expect(deps.isConfigDependent).toBeTruthy();
    });

    test('reports config dependencies from paint and layout properties', () => {
        const deps = new LayerExpressionDependencies(createStyleLayer({
            id: 'test',
            type: 'fill',
            source: 'src',
            paint: {'fill-color': ['config', 'fillColor']}
        }));
        expect(deps.hasConfigDependency('fillColor')).toBeTruthy();
    });

    test('reflects dependencies added by later property changes', () => {
        const layer = createStyleLayer({
            id: 'test',
            type: 'fill',
            source: 'src'
        });
        const deps = new LayerExpressionDependencies(layer);
        expect(deps.isConfigDependent).toBeFalsy();

        layer.setPaintProperty('fill-color', ['config', 'fillColor']);
        expect(deps.hasConfigDependency('fillColor')).toBeTruthy();
    });

    test('background layer has empty dependencies', () => {
        const deps = new LayerExpressionDependencies(createStyleLayer({id: 'bg', type: 'background'}));
        expect(deps.isConfigDependent).toBeFalsy();
        expect(deps.isIndoorDependent).toBeFalsy();
    });

    test('invalidateFilter picks up a config dependency added by a filter change', () => {
        const layer = createStyleLayer({
            id: 'test',
            type: 'fill',
            source: 'src',
            filter: ['==', ['get', 'x'], 1]
        });
        const deps = new LayerExpressionDependencies(layer);
        expect(deps.isConfigDependent).toBeFalsy();

        layer.filter = ['==', ['get', 'x'], ['config', 'foo']];
        deps.invalidateFilter();
        expect(deps.hasConfigDependency('foo')).toBeTruthy();
    });

    test('invalidateFilter drops a config dependency removed by a filter change', () => {
        const layer = createStyleLayer({
            id: 'test',
            type: 'fill',
            source: 'src',
            filter: ['==', ['get', 'x'], ['config', 'foo']]
        });
        const deps = new LayerExpressionDependencies(layer);
        expect(deps.hasConfigDependency('foo')).toBeTruthy();

        layer.filter = ['==', ['get', 'x'], 1];
        deps.invalidateFilter();
        expect(deps.hasConfigDependency('foo')).toBeFalsy();
        expect(deps.isConfigDependent).toBeFalsy();
    });

    test('config dependencies from paint properties survive filter invalidation', () => {
        const layer = createStyleLayer({
            id: 'test',
            type: 'fill',
            source: 'src',
            paint: {'fill-color': ['config', 'fillColor']}
        });
        const deps = new LayerExpressionDependencies(layer);
        deps.invalidateFilter();
        expect(deps.hasConfigDependency('fillColor')).toBeTruthy();
    });
});
