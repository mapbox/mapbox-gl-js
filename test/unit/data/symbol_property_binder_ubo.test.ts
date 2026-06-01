import {test, expect, describe} from '../../util/vitest';
import {SymbolPropertiesUBO, HEADER_DATA_DRIVEN_MASK, HEADER_ZOOM_DEPENDENT_MASK, HEADER_BLOCK_SIZE_VEC4, HEADER_OFFSETS} from '../../../src/data/bucket/symbol_properties_ubo';
import {SymbolPropertyBinderUBO} from '../../../src/data/bucket/symbol_property_binder_ubo';
import {SymbolBuffers} from '../../../src/data/bucket/symbol_bucket';
import {ProgramConfigurationSet} from '../../../src/data/program_configuration';
import SegmentVector from '../../../src/data/segment';
import SymbolStyleLayer from '../../../src/style/style_layer/symbol_style_layer';
import {CanonicalTileID} from '../../../src/source/tile_id';
import EvaluationParameters from '../../../src/style/evaluation_parameters';

import type {Feature} from '../../../src/style-spec/expression';
import type {VectorTileLayer} from '@mapbox/vector-tile';
import type {SymbolLayerSpecification} from '../../../src/style-spec/types';

describe('SymbolPropertiesUBO', () => {
    // Build a 12-dword header array (3 uvec4) from named fields, matching updateHeader's layout.
    function makeHeader(dataDrivenMask: number, dataDrivenBlockSizeVec4: number, offsets: number[] = [], zoomDependentMask: number = 0): Uint32Array {
        const header = new Uint32Array(SymbolPropertiesUBO.HEADER_DWORDS);
        header[HEADER_DATA_DRIVEN_MASK] = dataDrivenMask;
        header[HEADER_ZOOM_DEPENDENT_MASK] = zoomDependentMask;
        header[HEADER_BLOCK_SIZE_VEC4] = dataDrivenBlockSizeVec4;
        for (let i = 0; i < offsets.length; i++) header[HEADER_OFFSETS + i] = offsets[i];
        return header;
    }

    test('constructor stores the header at the documented dword slots', () => {
        // Layout (3 uvec4s = 12 dwords): [0]=dataDrivenMask, [1]=zoomDependentMask,
        // [2]=dataDrivenBlockSizeVec4, [3..11]=offsets[0..8].
        const ubo = new SymbolPropertiesUBO(null, 0, 4096, makeHeader(0, 0));
        expect(ubo.headerData[HEADER_DATA_DRIVEN_MASK]).toEqual(0);
        expect(ubo.headerData[HEADER_ZOOM_DEPENDENT_MASK]).toEqual(0);
        expect(ubo.headerData[HEADER_BLOCK_SIZE_VEC4]).toEqual(0);
        expect(ubo.headerData[HEADER_OFFSETS + 0]).toEqual(0); // offsets[0] = fill_color
        expect(ubo.headerData[HEADER_OFFSETS + 8]).toEqual(0); // offsets[8] = translate
    });

    test('writeDataDrivenBlock stores feature data at correct offset', () => {
        // Only opacity is data-driven:
        //   data-driven block: opacity(1 dword) → pad to 4 → dataDrivenBlockSizeVec4 = 1
        //   constant properties go to u_spp_* uniforms, not the UBO buffer
        // bit 2 = opacity; opacity DD offset = 0 (only DD prop)
        const ubo = new SymbolPropertiesUBO(null, 0, 4096, makeHeader(0b00000100, 1));

        // Feature 0 DD block: starts at dword featureIndex * dataDrivenBlockSizeDwords = 0 * 4 = 0
        // opacity is property index 2, flat offset = EVAL_FLAT_OFFSETS[2] = 8
        const flat = new Float32Array(SymbolPropertiesUBO.EVAL_FLAT_TOTAL);
        flat[SymbolPropertiesUBO.EVAL_FLAT_OFFSETS[2]] = 0.9; // opacity = 0.9

        ubo.writeDataDrivenBlock(flat, 0);

        expect(ubo.propertiesData[0]).toBeCloseTo(0.9, 5); // opacity for feature 0
    });

    test('writeDataDrivenBlock for feature 1 is at correct offset', () => {
        const ubo = new SymbolPropertiesUBO(null, 0, 4096, makeHeader(0b00000100, 1));

        // opacity is property index 2, flat offset = EVAL_FLAT_OFFSETS[2] = 8
        const flat = new Float32Array(SymbolPropertiesUBO.EVAL_FLAT_TOTAL);
        flat[SymbolPropertiesUBO.EVAL_FLAT_OFFSETS[2]] = 1.0; // opacity = 1.0 for feature 1

        ubo.writeDataDrivenBlock(flat, 1);

        // Feature 1 DD block: 1 * 4 = 4 (dataDrivenBlockSizeDwords=4, featureIndex=1)
        expect(ubo.propertiesData[4]).toBeCloseTo(1.0, 5);
    });

    test('propertiesData array has correct size', () => {
        const ubo = new SymbolPropertiesUBO(null, 0, 4096, makeHeader(0, 0));
        // 1024 vec4s = 4096 floats
        expect(ubo.propertiesData.length).toEqual(4096);
    });

    test('rightSizeForTransfer trims propertiesData to the written prefix', () => {
        // opacity-only DD block (4 dwords); write 2 features, then trim.
        const ubo = new SymbolPropertiesUBO(null, 0, 4096, makeHeader(0b00000100, 1));
        const flat = new Float32Array(SymbolPropertiesUBO.EVAL_FLAT_TOTAL);
        flat[SymbolPropertiesUBO.EVAL_FLAT_OFFSETS[2]] = 0.9;
        ubo.writeDataDrivenBlock(flat, 0);
        ubo.writeDataDrivenBlock(flat, 1);

        ubo.rightSizeForTransfer();

        // 2 features * 4 dwords = 8, down from the full 4096.
        expect(ubo.propertiesData.length).toEqual(8);
        // Written value survives the trim.
        expect(ubo.propertiesData[0]).toBeCloseTo(0.9, 5);
    });

    test('rightSizeForTransfer empties propertiesData when nothing was written', () => {
        // All-constant binder (no DD block) writes nothing, so the full array is dead weight.
        const ubo = new SymbolPropertiesUBO(null, 0, 4096, makeHeader(0, 0));
        ubo.rightSizeForTransfer();
        expect(ubo.propertiesData.length).toEqual(0);
    });

    test('headerData array has correct size', () => {
        const ubo = new SymbolPropertiesUBO(null, 0, 4096, makeHeader(0, 0));
        // 3 uvec4s = 12 uint32s
        expect(ubo.headerData.length).toEqual(12);
    });

    test('destroy cleans up resources', () => {
        const ubo = new SymbolPropertiesUBO(null, 0, 4096, makeHeader(0, 0));
        // Created without context — all 3 GPU buffers start as null
        expect(ubo.headerBuffer).toBeNull();
        expect(ubo.propertiesBuffer).toBeNull();
        expect(ubo.blockIndicesBuffer).toBeNull();
        ubo.destroy();
        expect(ubo.headerBuffer).toBeNull();
        expect(ubo.propertiesBuffer).toBeNull();
        expect(ubo.blockIndicesBuffer).toBeNull();
    });
});

describe('SymbolPropertyBinderUBO', () => {
    function createTestLayer(paintProperties: Record<string, unknown> = {}) {
        const layer = new SymbolStyleLayer({
            id: 'test-layer',
            type: 'symbol',
            layout: {},
            paint: paintProperties
        } as unknown as SymbolLayerSpecification, '', null);
        layer.recalculate(new EvaluationParameters(0), []);
        return layer;
    }

    function createTestFeature(properties: Record<string, unknown> = {}, id?: number | string) {
        return {
            type: 1 as const, // Point
            properties,
            id,
            geometry: []
        } as unknown as Feature;
    }

    describe('constructor', () => {
        test('initializes with correct defaults', () => {
            const layer = createTestLayer();
            const binder = new SymbolPropertyBinderUBO(layer, 10, null, true, 'US');

            expect(binder.layer).toBe(layer);
            expect(binder.zoom).toEqual(10);
            expect(binder.lut).toBeNull();
            expect(binder.isText).toBeTruthy();
            expect(binder.worldview).toEqual('US');
            expect(binder.featureCount).toEqual(0);
            expect(binder.ubos).toEqual([]);
            expect(binder.featureVertexRangesFromId).toBeNull();
            expect(binder.allFeatureVtIndices).toEqual([]);
            expect(binder.allFeatureIds).toEqual([]);
        });

        test('maxFeaturesPerBatch fits data-driven blocks in the UBO', () => {
            // data-driven opacity → 4-dword block → floor(4096 / 4) = 1024 per batch
            const layer = createTestLayer({'text-opacity': ['get', 'opacity']});
            const binder = new SymbolPropertyBinderUBO(layer, 10, null, true);
            expect(binder.maxFeaturesPerBatch).toEqual(1024);
        });

        test('maxFeaturesPerBatch is unbounded when all properties are constant', () => {
            const layer = createTestLayer({'text-opacity': 0.8});
            const binder = new SymbolPropertyBinderUBO(layer, 10, null, true);
            expect(binder.maxFeaturesPerBatch).toEqual(Number.MAX_SAFE_INTEGER);
        });
    });

    describe('updateHeader', () => {
        test('all-constant layer produces zero dataDrivenMask', () => {
            const layer = createTestLayer({
                'text-color': 'red',
                'text-opacity': 0.8,
            });
            const binder = new SymbolPropertyBinderUBO(layer, 10, null, true);

            expect(binder.header[HEADER_DATA_DRIVEN_MASK]).toEqual(0);
            expect(binder.header[HEADER_BLOCK_SIZE_VEC4]).toEqual(0);
        });

        test('data-driven opacity sets bit 2 in dataDrivenMask', () => {
            const layer = createTestLayer({'text-opacity': ['get', 'opacity']});
            const binder = new SymbolPropertyBinderUBO(layer, 10, null, true);

            expect(binder.header[HEADER_DATA_DRIVEN_MASK] & 0b00000100).not.toEqual(0); // bit 2 = opacity
            expect(binder.header[HEADER_BLOCK_SIZE_VEC4]).toBeGreaterThan(0);
        });

        test('data-driven colors are vec4-aligned in data-driven block', () => {
            // When both colors are data-driven their offsets must be multiples of 4 (vec4 boundary).
            const layer = createTestLayer({
                'text-color': ['get', 'fill_color'],
                'text-halo-color': ['get', 'halo_color'],
            });
            const binder = new SymbolPropertyBinderUBO(layer, 10, null, true);

            // fill_color: first in block → offset 0 (vec4-aligned)
            expect(binder.header[HEADER_OFFSETS + 0]).toEqual(0);
            expect(binder.header[HEADER_OFFSETS + 0] % 4).toEqual(0);
            // halo_color: after 4-dword fill_color → offset 4 (vec4-aligned)
            expect(binder.header[HEADER_OFFSETS + 1]).toEqual(4);
            expect(binder.header[HEADER_OFFSETS + 1] % 4).toEqual(0);
        });
    });

    describe('evaluateAllProperties', () => {
        test('handles constant opacity', () => {
            const layer = createTestLayer({'text-opacity': 0.8});
            const binder = new SymbolPropertyBinderUBO(layer, 10, null, true);
            const feature = createTestFeature({name: 'test'});
            const canonical = new CanonicalTileID(0, 0, 0);

            const result = binder.evaluateAllProperties(feature, {}, canonical, []);

            // Opacity is property index 2, flat offset = EVAL_FLAT_OFFSETS[2] = 8
            expect(result[SymbolPropertiesUBO.EVAL_FLAT_OFFSETS[2]]).toBeCloseTo(0.8, 5);
        });

        test('handles data-driven opacity from feature property', () => {
            const layer = createTestLayer({'text-opacity': ['get', 'opacity']});
            const binder = new SymbolPropertyBinderUBO(layer, 10, null, true);
            const feature = createTestFeature({opacity: 0.75});
            const canonical = new CanonicalTileID(0, 0, 0);

            const result = binder.evaluateAllProperties(feature, {}, canonical, []);

            expect(result[SymbolPropertiesUBO.EVAL_FLAT_OFFSETS[2]]).toBeCloseTo(0.75, 5);
        });

        test('handles constant fill_color as [r,g,b,a]', () => {
            const layer = createTestLayer({'text-color': 'red', 'text-opacity': 0.8});
            const binder = new SymbolPropertyBinderUBO(layer, 10, null, true);
            const feature = createTestFeature({name: 'test'});
            const canonical = new CanonicalTileID(0, 0, 0);

            const result = binder.evaluateAllProperties(feature, {}, canonical, []);

            // result is a Float32Array(24); fill_color occupies flat offsets 0-3
            expect(result instanceof Float32Array).toBeTruthy();
            expect(result.length).toEqual(SymbolPropertiesUBO.EVAL_FLAT_TOTAL);
        });

        test('missing properties return defaults', () => {
            const layer = createTestLayer({});
            const binder = new SymbolPropertyBinderUBO(layer, 10, null, true);
            const feature = createTestFeature();
            const canonical = new CanonicalTileID(0, 0, 0);

            const result = binder.evaluateAllProperties(feature, {}, canonical, []);
            const O = SymbolPropertiesUBO.EVAL_FLAT_OFFSETS;

            // opacity (prop index 2) default = 1.0
            expect(result[O[2]]).toBeCloseTo(1.0, 5);
            // halo_width (prop index 3) default = 0.0
            expect(result[O[3]]).toBeCloseTo(0.0, 5);
            // halo_blur (prop index 4) default = 0.0
            expect(result[O[4]]).toBeCloseTo(0.0, 5);
        });
    });

    describe('UBO batching', () => {
        test('creates first batch automatically', () => {
            const layer = createTestLayer({'text-color': 'red'});
            const binder = new SymbolPropertyBinderUBO(layer, 10, null, true);

            expect(binder.ubos.length).toEqual(0);

            const feature = createTestFeature({}, 'feature-1');
            const canonical = new CanonicalTileID(0, 0, 0);

            binder.populateUBO(feature, 0, canonical, []);

            expect(binder.ubos.length).toEqual(1);
            expect(binder.featureCount).toEqual(1);
        });

        test('creates new batch when batch is full', () => {
            // Only opacity is data-driven → dataDrivenBlockSizeVec4=1, propsDwords=4084 → floor(4084/4) = 1021 per batch
            const layer = createTestLayer({'text-opacity': ['get', 'opacity']});
            const binder = new SymbolPropertyBinderUBO(layer, 10, null, true);
            const canonical = new CanonicalTileID(0, 0, 0);

            // Fill exactly one batch
            const maxPerBatch = 1024;
            for (let i = 0; i < maxPerBatch; i++) {
                binder.populateUBO(createTestFeature({opacity: i / maxPerBatch}, `feature-${i}`), i, canonical, []);
            }

            expect(binder.ubos.length).toEqual(1);
            expect(binder.featureCount).toEqual(maxPerBatch);

            // Add one more to trigger second batch
            binder.populateUBO(createTestFeature({opacity: 1.0}, `feature-${maxPerBatch}`), maxPerBatch, canonical, []);

            expect(binder.ubos.length).toEqual(2);
            expect(binder.featureCount).toEqual(maxPerBatch + 1);
        });

        test('all-constant binder collapses every feature into a single shared entry', () => {
            // No data-driven property → constants go through u_spp_* uniforms, so all features
            // share entry 0 in one batch regardless of count.
            const layer = createTestLayer({'text-color': 'red'});
            const binder = new SymbolPropertyBinderUBO(layer, 10, null, true);
            const canonical = new CanonicalTileID(0, 0, 0);

            for (let i = 0; i < 50; i++) {
                expect(binder.populateUBO(createTestFeature({}, `feature-${i}`), i, canonical, [])).toEqual(0);
            }

            expect(binder.featureCount).toEqual(1);
            expect(binder.ubos.length).toEqual(1);
        });

        test('re-derives feature locations across batches on update', () => {
            const layer = createTestLayer({'text-opacity': ['get', 'opacity']});
            const binder = new SymbolPropertyBinderUBO(layer, 10, null, true);
            const canonical = new CanonicalTileID(0, 0, 0);

            const maxPerBatch = 1024;
            // Fill batch 0 (positions 0..maxPerBatch-1), then one more to open batch 1.
            for (let i = 0; i <= maxPerBatch; i++) {
                binder.populateUBO(createTestFeature({opacity: 0.5}, `feature-${i}`), i, canonical, []);
            }
            expect(binder.ubos.length).toEqual(2);

            // On update, return a distinct opacity for the last entry of batch 0 and the first of
            // batch 1, so the re-derived write slot is observable in propertiesData.
            const vtLayer = {
                feature: (idx: number) => createTestFeature({opacity: idx === maxPerBatch - 1 ? 0.7 : idx === maxPerBatch ? 0.3 : 0.5})
            } as unknown as VectorTileLayer;

            binder.updateDynamicExpressions(layer, vtLayer, canonical, [], {});

            // opacity sits at dword 0 of each feature's 4-dword block; last of batch 0 → local
            // maxPerBatch-1, first of batch 1 → local 0.
            expect(binder.ubos[0].propertiesData[(maxPerBatch - 1) * 4]).toBeCloseTo(0.7, 5);
            expect(binder.ubos[1].propertiesData[0]).toBeCloseTo(0.3, 5);
        });

        test('handles features without IDs', () => {
            const layer = createTestLayer({'text-color': 'red'});
            const binder = new SymbolPropertyBinderUBO(layer, 10, null, true);
            const canonical = new CanonicalTileID(0, 0, 0);

            const feature = createTestFeature({}, undefined);
            binder.populateUBO(feature, 0, canonical, []);

            expect(binder.featureCount).toEqual(1);
            expect(binder.allFeatureVtIndices.length).toEqual(1);
            binder['_ensureRangeMaps']();
            expect(binder.featureVertexRangesFromId.size).toEqual(0);
        });

        test('clamps gracefully when exceeding max binding points', () => {
            const layer = createTestLayer({'text-opacity': ['get', 'opacity']});
            // Small maxUniformBufferBindings (6) and a tiny UBO (8 dwords → 2 features/batch) so the
            // limit is hit after a handful of features. batchIndex 2 needs bindings 6,7,8 > limit 6.
            const binder = new SymbolPropertyBinderUBO(layer, 10, null, true, '', 6, 8);
            const canonical = new CanonicalTileID(0, 0, 0);

            const maxPerBatch = binder.maxFeaturesPerBatch;
            expect(maxPerBatch).toEqual(2);

            // Fill batches 0 and 1 (positions 0..3), all valid.
            for (let i = 0; i < 2 * maxPerBatch; i++) {
                binder.populateUBO(createTestFeature({opacity: i / 10}, `f-${i}`), i, canonical, []);
            }

            const feature = createTestFeature({opacity: 0.5}, 'too-many');

            // The next feature falls in batchIndex 2, which exceeds the limit. Should not throw —
            // returns 0 (clamped to slot 0) and still tracks the feature.
            let returnedIndex: number | undefined;
            expect(() => {
                returnedIndex = binder.populateUBO(feature, 2 * maxPerBatch, canonical, []);
            }).not.toThrow();
            expect(returnedIndex).toEqual(0);

            // Feature still tracked; on update its block re-derives to the clamped batch 0 / slot 0
            // rather than the (nonexistent) batch 2. Distinct opacity for the overflow feature, written
            // last, must end up in slot 0 — proving the clamp routed it there instead of dropping it.
            const vtLayer = {
                feature: (idx: number) => createTestFeature({opacity: idx === 2 * maxPerBatch ? 0.9 : 0.1})
            } as unknown as VectorTileLayer;
            expect(() => binder.updateDynamicExpressions(layer, vtLayer, canonical, [], {})).not.toThrow();
            expect(binder.ubos.length).toEqual(2);
            expect(binder.ubos[0].propertiesData[0]).toBeCloseTo(0.9, 5);
        });
    });

    describe('feature-state updates', () => {
        test('updateFeatures updates data-driven property for a feature', () => {
            const layer = createTestLayer({
                'text-opacity': ['feature-state', 'opacity']
            });

            const binder = new SymbolPropertyBinderUBO(layer, 10, null, true);
            const canonical = new CanonicalTileID(0, 0, 0);

            // populateUBO writes initial state (feature-state is empty → opacity evaluates to default 1.0)
            const feature = createTestFeature({}, 'feature-1');
            binder.populateUBO(feature, 0, canonical, []);

            // Verify header: only opacity is data-driven
            const header = binder.header;
            expect(header).not.toBeNull();
            // data-driven block: opacity(1 dword) → pad to 4 → dataDrivenBlockSizeVec4 = 1
            // constant properties go to u_spp_* uniforms
            expect(header[HEADER_BLOCK_SIZE_VEC4]).toEqual(1);

            const vtLayer = {
                feature: () => feature
            } as unknown as VectorTileLayer;

            const featureIds = new Set(['feature-1']);
            const featureStates = {'feature-1': {opacity: 0.9}};

            binder.updateFeatures(featureIds, layer, vtLayer, canonical, [], featureStates);

            // Feature 0 DD block: starts at dword featureIndex * dataDrivenBlockSizeDwords = 0 * 4 = 0
            // Opacity offset within DD block = 0 → propertiesData[0]
            expect(binder.ubos[0].propertiesData[0]).toBeCloseTo(0.9, 5);
        });

        test('skips features without IDs during update', () => {
            const layer = createTestLayer({'text-opacity': ['feature-state', 'opacity']});
            const binder = new SymbolPropertyBinderUBO(layer, 10, null, true);
            const canonical = new CanonicalTileID(0, 0, 0);

            const feature = createTestFeature({}, undefined);
            binder.populateUBO(feature, 0, canonical, []);

            const vtLayer = {feature: () => feature} as unknown as VectorTileLayer;
            const featureIds = new Set<string | number>();
            const featureStates: Record<string | number, Record<string, unknown>> = {};

            expect(() => {
                binder.updateFeatures(featureIds, layer, vtLayer, canonical, [], featureStates);
            }).not.toThrow();
        });
    });

    describe('getConstantUniformValues', () => {
        test('returns defaults for an unstyled layer', () => {
            const layer = createTestLayer({});
            const binder = new SymbolPropertyBinderUBO(layer, 10, null, true);

            const cv = binder.getConstantUniformValues(10);

            expect(cv.opacity).toBeCloseTo(1.0, 5);
            expect(cv['halo_width']).toBeCloseTo(0.0, 5);
            expect(cv['halo_blur']).toBeCloseTo(0.0, 5);
            expect(cv['z_offset']).toBeCloseTo(0.0, 5);
            // text-occlusion-opacity style-spec default is 0.0 (occlusion effect off by default)
            expect(cv['occlusion_opacity']).toBeCloseTo(0.0, 5);
        });

        test('returns constant paint values', () => {
            const layer = createTestLayer({'text-opacity': 0.7, 'text-halo-width': 2.5});
            const binder = new SymbolPropertyBinderUBO(layer, 10, null, true);

            const cv = binder.getConstantUniformValues(10);

            expect(cv.opacity).toBeCloseTo(0.7, 5);
            expect(cv['halo_width']).toBeCloseTo(2.5, 5);
        });

        test('fill_np_color returns non-premultiplied RGBA', () => {
            const layer = createTestLayer({'text-color': 'red'});
            const binder = new SymbolPropertyBinderUBO(layer, 10, null, true);

            const cv = binder.getConstantUniformValues(10);

            // Non-premultiplied red: r=1, g=0, b=0, a=1
            expect(cv['fill_np_color'][0]).toBeCloseTo(1.0, 2); // r
            expect(cv['fill_np_color'][1]).toBeCloseTo(0.0, 2); // g
            expect(cv['fill_np_color'][2]).toBeCloseTo(0.0, 2); // b
            expect(cv['fill_np_color'][3]).toBeCloseTo(1.0, 2); // a
        });

        test('result is cached and returns the same object for repeated calls', () => {
            const layer = createTestLayer({'text-opacity': 0.5});
            const binder = new SymbolPropertyBinderUBO(layer, 10, null, true);

            const cv1 = binder.getConstantUniformValues(10);
            const cv2 = binder.getConstantUniformValues(10);

            expect(cv1).toBe(cv2); // exact same reference — no recompute
        });

        test('cache is invalidated when brightness changes', () => {
            const layer = createTestLayer({'text-opacity': 0.5});
            const binder = new SymbolPropertyBinderUBO(layer, 10, null, true);

            const cv1 = binder.getConstantUniformValues(10, 0.5);
            const cv2 = binder.getConstantUniformValues(10, 0.9);

            expect(cv1).not.toBe(cv2); // different brightness → recompute
        });

        test('cache is invalidated when updateDynamicExpressions reassigns the layer', () => {
            const layer = createTestLayer({'text-opacity': 0.5});
            const binder = new SymbolPropertyBinderUBO(layer, 10, null, true);

            const cv1 = binder.getConstantUniformValues(10);
            expect(binder.cachedConstantUniforms).not.toBeNull();

            // Simulate a layer update — sets cachedConstantUniforms to null
            const canonical = new CanonicalTileID(0, 0, 0);
            binder.updateDynamicExpressions(layer, null, canonical, [], {});
            expect(binder.cachedConstantUniforms).toBeNull();

            const cv2 = binder.getConstantUniformValues(10);
            expect(cv1).not.toBe(cv2); // cache was cleared → new object
        });
    });

    describe('getBatchGrouping', () => {
        function makeBuffers(layer: SymbolStyleLayer): SymbolBuffers {
            return new SymbolBuffers(
                new ProgramConfigurationSet([layer], {zoom: 10, lut: null}, (p) => p.startsWith('text') || p.startsWith('symbol'))
            );
        }

        function makeSegment(batchIndex: number) {
            return {vertexOffset: 0, primitiveOffset: 0, vertexLength: 4, primitiveLength: 2, vaos: {}, sortKey: undefined, batchIndex};
        }

        test('groups segments by batchIndex', () => {
            const layer = createTestLayer({});
            const buffers = makeBuffers(layer);

            const seg0a = makeSegment(0);
            const seg0b = makeSegment(0);
            const seg1 = makeSegment(1);
            buffers.segments = new SegmentVector([seg0a, seg0b, seg1]);

            const {batchIndices, batchSegments} = buffers.getBatchGrouping(buffers.segments);

            expect(batchIndices).toEqual([0, 1]);
            expect(batchSegments.get(0).get().length).toEqual(2);
            expect(batchSegments.get(1).get().length).toEqual(1);
        });

        test('returns cached result on repeated call with all segments', () => {
            const layer = createTestLayer({});
            const buffers = makeBuffers(layer);
            buffers.segments = new SegmentVector([makeSegment(0), makeSegment(1)]);

            const result1 = buffers.getBatchGrouping(buffers.segments);
            const result2 = buffers.getBatchGrouping(buffers.segments);

            expect(result1.batchIndices).toBe(result2.batchIndices); // same reference — cached
        });

        test('does not cache when rendering a subset of segments', () => {
            const layer = createTestLayer({});
            const buffers = makeBuffers(layer);
            const seg0 = makeSegment(0);
            const seg1 = makeSegment(1);
            buffers.segments = new SegmentVector([seg0, seg1]);

            // Simulate sort-key path: pass a single-segment SegmentVector
            const single = new SegmentVector([seg0]);
            const result1 = buffers.getBatchGrouping(single);
            const result2 = buffers.getBatchGrouping(single);

            expect(result1.batchIndices).not.toBe(result2.batchIndices); // no caching for subset
        });

        test('cache is cleared on upload', () => {
            const layer = createTestLayer({});
            const buffers = makeBuffers(layer);
            buffers.segments = new SegmentVector([makeSegment(0)]);

            buffers.getBatchGrouping(buffers.segments); // populate cache
            expect(buffers.cachedBatchIndices).not.toBeNull();

            // Simulate an upload (pass dummy context-like object)
            buffers.cachedBatchIndices = null;
            buffers.cachedBatchSegments = null;

            expect(buffers.cachedBatchIndices).toBeNull();
        });

        test('segments without batchIndex default to batch 0', () => {
            const layer = createTestLayer({});
            const buffers = makeBuffers(layer);
            // Segment with no batchIndex
            const seg = {vertexOffset: 0, primitiveOffset: 0, vertexLength: 4, primitiveLength: 2, vaos: {}, sortKey: undefined};
            buffers.segments = new SegmentVector([seg]);

            const {batchIndices} = buffers.getBatchGrouping(buffers.segments);

            expect(batchIndices).toEqual([0]);
        });
    });

    describe('destroy', () => {
        test('cleans up all UBO resources', () => {
            const layer = createTestLayer({'text-opacity': ['get', 'opacity']});
            const binder = new SymbolPropertyBinderUBO(layer, 10, null, true);
            const canonical = new CanonicalTileID(0, 0, 0);

            // Create two batches worth of features (1024 per batch)
            for (let i = 0; i < 1100; i++) {
                binder.populateUBO(createTestFeature({opacity: i / 1100}, `feature-${i}`), i, canonical, []);
            }

            expect(binder.ubos.length).toBeGreaterThan(1);
            expect(binder.featureCount).toEqual(1100);

            binder.destroy();

            expect(binder.ubos).toEqual([]);
            expect(binder.featureCount).toEqual(0);
            expect(binder.featureVertexRangesFromId).toBeNull();
            expect(binder.allFeatureVtIndices).toEqual([]);
            expect(binder.allFeatureIds).toEqual([]);
        });
    });
});
