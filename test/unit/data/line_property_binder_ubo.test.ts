import {test, expect, describe} from '../../util/vitest';
import {LinePropertiesUBO} from '../../../src/data/bucket/line_properties_ubo';
import {LinePropertyBinderUBO, FLOORWIDTH_BIT} from '../../../src/data/bucket/line_property_binder_ubo';
import {HEADER_DATA_DRIVEN_MASK} from '../../../src/data/bucket/paint_property_ubo';
import LineStyleLayer from '../../../src/style/style_layer/line_style_layer';
import {CanonicalTileID} from '../../../src/source/tile_id';
import EvaluationParameters from '../../../src/style/evaluation_parameters';

import type {Feature} from '../../../src/style-spec/expression';
import type {LayerSpecification} from '../../../src/style-spec/types';

describe('LinePropertyBinderUBO', () => {
    function createTestLayer(paintProperties: Record<string, unknown> = {}, layoutProperties: Record<string, unknown> = {}) {
        const layer = new LineStyleLayer({
            id: 'test-layer',
            type: 'line',
            layout: layoutProperties,
            paint: paintProperties
        } as unknown as LayerSpecification, '', null);
        layer.recalculate(new EvaluationParameters(0), []);
        return layer;
    }

    function createTestFeature(properties: Record<string, unknown> = {}, id?: number | string) {
        return {
            type: 2 as const, // LineString
            properties,
            id,
            geometry: []
        } as unknown as Feature;
    }

    describe('constructor', () => {
        test('initializes with correct defaults', () => {
            const layer = createTestLayer();
            const binder = new LinePropertyBinderUBO(layer, 10, null, 'US');

            expect(binder.layer).toBe(layer);
            expect(binder.zoom).toEqual(10);
            expect(binder.lut).toBeNull();
            expect(binder.worldview).toEqual('US');
            expect(binder.featureCount).toEqual(0);
            expect(binder.ubos).toEqual([]);
        });

        test('maxFeaturesPerBatch is unbounded when all properties are constant', () => {
            const layer = createTestLayer({'line-color': 'red', 'line-width': 4});
            const binder = new LinePropertyBinderUBO(layer, 10, null);
            expect(binder.isAllConstant).toBe(true);
            expect(binder.maxFeaturesPerBatch).toEqual(Number.MAX_SAFE_INTEGER);
        });

        test('maxFeaturesPerBatch fits data-driven blocks in the UBO', () => {
            // line-width data-driven → line-floorwidth (derived from line-width, see
            // LineStyleLayer.recalculate()) is also data-driven → 2 properties x 4-dword blocks
            // = 8-dword block → floor(4096 / 8) = 512 per batch.
            const layer = createTestLayer({'line-width': ['get', 'width']});
            const binder = new LinePropertyBinderUBO(layer, 10, null);
            expect(binder.maxFeaturesPerBatch).toEqual(512);
        });
    });

    describe('updateHeader', () => {
        test('all-constant layer produces zero dataDrivenMask', () => {
            const layer = createTestLayer({'line-color': 'red', 'line-opacity': 0.8});
            const binder = new LinePropertyBinderUBO(layer, 10, null);

            expect(binder.header[HEADER_DATA_DRIVEN_MASK]).toEqual(0);
            expect(binder.isAllConstant).toBe(true);
        });

        test('data-driven line-width sets its bit in dataDrivenMask', () => {
            const layer = createTestLayer({'line-width': ['get', 'width']});
            const binder = new LinePropertyBinderUBO(layer, 10, null);

            expect(binder.header[HEADER_DATA_DRIVEN_MASK] & (1 << 4)).not.toEqual(0); // bit 4 = line-width
        });

        // Regression test: a constant line-color whose `-use-theme` companion is data-driven still
        // needs a per-feature UBO block, because the LUT-vs-no-LUT decision varies per feature even
        // though the raw color value doesn't. Without this, the color is wrongly treated as fully
        // constant and every feature gets whichever feature's use-theme decision happened to be
        // cached last (found via a failing render test:
        // color-theme/use-theme/data-driven-use-theme-constant-line-color).
        test('constant line-color with data-driven line-color-use-theme is forced data-driven', () => {
            const layer = createTestLayer({
                'line-color': 'grey',
                'line-color-use-theme': ['match', ['get', 'road-type'], 'street', 'none', 'default']
            });
            const binder = new LinePropertyBinderUBO(layer, 10, null);

            expect(binder.header[HEADER_DATA_DRIVEN_MASK] & 0b1).not.toEqual(0); // bit 0 = line-color
            expect(binder.isAllConstant).toBe(false);
        });

        test('constant line-color with constant line-color-use-theme stays constant', () => {
            const layer = createTestLayer({
                'line-color': 'grey',
                'line-color-use-theme': 'none'
            });
            const binder = new LinePropertyBinderUBO(layer, 10, null);

            expect(binder.header[HEADER_DATA_DRIVEN_MASK] & 0b1).toEqual(0);
            expect(binder.isAllConstant).toBe(true);
        });

        test('data-driven line-border-color with constant line-border-color-use-theme is data-driven via its own value', () => {
            const layer = createTestLayer({
                'line-border-color': ['get', 'border_color'],
                'line-border-color-use-theme': 'none'
            });
            const binder = new LinePropertyBinderUBO(layer, 10, null);

            expect(binder.header[HEADER_DATA_DRIVEN_MASK] & 0b10).not.toEqual(0); // bit 1 = line-border-color
        });
    });

    describe('populateUBO / getConstantUniformValues', () => {
        test('populateUBO writes a data-driven width into the properties buffer', () => {
            const layer = createTestLayer({'line-width': ['get', 'width']});
            const binder = new LinePropertyBinderUBO(layer, 10, null);
            const canonical = new CanonicalTileID(0, 0, 0);

            const localIndex = binder.populateUBO(createTestFeature({width: 6}), 0, canonical, []);
            expect(localIndex).toEqual(0);
            binder.finalize();

            expect(binder.ubos.length).toEqual(1);
            // line-width is offset 0 (only data-driven prop): [min, max, zm, zM]
            expect(binder.ubos[0].propertiesData[0]).toBeCloseTo(6, 5);
            expect(binder.ubos[0].propertiesData[1]).toBeCloseTo(6, 5);
        });

        test('populateUBO never leaks a previous feature\'s dash position into a miss', () => {
            // evalFlatScratch (the flat evaluation buffer) is a module-level buffer shared across
            // every populateUBO() call — a feature populated with no dashPosition must not inherit
            // whatever the previous feature's dash rect left there.
            const layer = createTestLayer({'line-dasharray': ['get', 'dash']});
            const binder = new LinePropertyBinderUBO(layer, 10, null);
            const canonical = new CanonicalTileID(0, 0, 0);

            binder.populateUBO(createTestFeature({dash: [2, 2]}), 0, canonical, [], null, undefined, {tl: [10, 20], br: [30, 40]});
            binder.populateUBO(createTestFeature({dash: [10, 4]}), 1, canonical, [], null, undefined, undefined);
            binder.finalize();

            // line-dasharray is the only data-driven prop, so its block offset is 0.
            expect(binder.ubos[0].propertiesData.subarray(4, 8)).toEqual(new Float32Array([0, 0, 0, 0]));
        });

        test('getConstantUniformValues returns defaults for an all-constant layer', () => {
            const layer = createTestLayer({'line-width': 3, 'line-opacity': 0.5});
            const binder = new LinePropertyBinderUBO(layer, 10, null);

            const cv = binder.getConstantUniformValues(10, null);
            expect(cv.width).toEqual(3);
            expect(cv.opacity).toEqual(0.5);
        });
    });

    describe('device-limit batching', () => {
        test('clamps gracefully when exceeding max binding points', () => {
            // line-width data-driven → line-floorwidth also becomes data-driven (see
            // "maxFeaturesPerBatch fits data-driven blocks in the UBO" above), so the block is 2
            // vec4 = 8 dwords → floor(8 / 8) = 1 feature/batch here. Line uses 2 bindings/batch (no
            // indirection block): batch 0 -> points 0,1; batch 1 -> points 2,3 (still under the
            // limit 4); batch 2 -> points 4,5 (>= limit 4, clamps) — one binding point later than
            // with symbol's 3-bindings/batch stride, which would clamp starting at batch 1.
            const layer = createTestLayer({'line-width': ['get', 'width']});
            const binder = new LinePropertyBinderUBO(layer, 10, null, '', 4, 8);
            expect(binder.maxFeaturesPerBatch).toEqual(1);
            const canonical = new CanonicalTileID(0, 0, 0);

            const indices = [0, 1, 2, 3, 4].map((i) => binder.populateUBO(createTestFeature({width: i + 1}), i, canonical, []));
            // Features 0 -> batch 0, feature 1 -> batch 1 (both fit under the limit); features 2+
            // would need batch 2+ (points >= 4 >= limit 4) and clamp to batch 0 / local 0.
            expect(indices).toEqual([0, 0, 0, 0, 0]);
            expect(binder.ubos.length).toEqual(2);
        });
    });

    describe('FLOORWIDTH_BIT', () => {
        test('is a single bit matching line-floorwidth in the property list', () => {
            expect(FLOORWIDTH_BIT).toBeGreaterThan(0);
            expect(FLOORWIDTH_BIT & (FLOORWIDTH_BIT - 1)).toEqual(0); // power of two
        });
    });
});

describe('LinePropertiesUBO', () => {
    test('header dwords accommodate 10 properties plus shared color zoom', () => {
        expect(LinePropertiesUBO.HEADER_DWORDS % 4).toEqual(0); // whole uvec4s
        expect(LinePropertiesUBO.HEADER_DWORDS).toBeGreaterThanOrEqual(3 + 10);
    });
});
