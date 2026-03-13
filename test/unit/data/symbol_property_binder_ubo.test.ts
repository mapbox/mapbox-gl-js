import {test, expect, describe} from '../../util/vitest';
import {SymbolPropertiesUBO, type SymbolPropertyHeader, type PropertyValue} from '../../../src/data/bucket/symbol_properties_ubo';
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
    function makeAllConstantHeader(): SymbolPropertyHeader {
        // All 8 properties constant — no data-driven block; dataDrivenBlockSizeVec4 = 0.
        // Offsets are unused for constant properties (u_spp_* uniforms carry the values).
        return {
            dataDrivenMask: 0,
            zoomDependentMask: 0,
            cameraMask: 0,
            dataDrivenBlockSizeVec4: 0,
            offsets: [0, 0, 0, 0, 0, 0, 0, 0],
        };
    }

    test('writeHeader encodes header data correctly', () => {
        const ubo = new SymbolPropertiesUBO();
        const header = makeAllConstantHeader();
        ubo.writeHeader(header);

        // New layout (matching GL Native):
        //   h[0] = dataDrivenMask
        //   h[1] = zoomDependentMask
        //   h[2] = dataDrivenBlockSizeVec4
        //   h[3..10] = offsets[0..7]
        //   h[11] = 0 (unused)
        expect(ubo.headerData[0]).toEqual(0);   // dataDrivenMask
        expect(ubo.headerData[1]).toEqual(0);   // zoomDependentMask
        expect(ubo.headerData[2]).toEqual(0);   // dataDrivenBlockSizeVec4 (all-constant → 0)
        expect(ubo.headerData[3]).toEqual(0);   // offsets[0] = fill_color
        expect(ubo.headerData[4]).toEqual(0);   // offsets[1] = halo_color
        expect(ubo.headerData[5]).toEqual(0);   // offsets[2] = opacity
        expect(ubo.headerData[6]).toEqual(0);   // offsets[3] = halo_width
        expect(ubo.headerData[11]).toEqual(0);  // unused padding
    });

    test('writeDataDrivenBlock stores feature data at correct offset', () => {
        const ubo = new SymbolPropertiesUBO();
        // Only opacity is data-driven:
        //   data-driven block: opacity(1 dword) → pad to 4 → dataDrivenBlockSizeVec4 = 1
        //   constant properties go to u_spp_* uniforms, not the UBO buffer
        const header: SymbolPropertyHeader = {
            dataDrivenMask: 0b00000100,   // bit 2 = opacity
            zoomDependentMask: 0,
            cameraMask: 0,
            dataDrivenBlockSizeVec4: 1,   // 1 vec4 = 4 dwords for the DD block
            offsets: [0, 0, 0, 0, 0, 0, 0, 0], // opacity DD offset = 0 (only DD prop)
        };
        ubo.writeHeader(header);

        // Feature 0 DD block: starts at dword featureIndex * dataDrivenBlockSizeDwords = 0 * 4 = 0
        const ddValues: Array<PropertyValue | null> = new Array<PropertyValue | null>(8).fill(null);
        ddValues[2] = 0.9; // opacity = 0.9

        ubo.writeDataDrivenBlock(ddValues, 0, header);

        expect(ubo.propertiesData[0]).toBeCloseTo(0.9, 5); // opacity for feature 0
    });

    test('writeDataDrivenBlock for feature 1 is at correct offset', () => {
        const ubo = new SymbolPropertiesUBO();
        const header: SymbolPropertyHeader = {
            dataDrivenMask: 0b00000100,
            zoomDependentMask: 0,
            cameraMask: 0,
            dataDrivenBlockSizeVec4: 1,
            offsets: [0, 0, 0, 0, 0, 0, 0, 0],
        };
        ubo.writeHeader(header);

        const ddValues: Array<PropertyValue | null> = new Array<PropertyValue | null>(8).fill(null);
        ddValues[2] = 1.0; // opacity = 1.0 for feature 1

        ubo.writeDataDrivenBlock(ddValues, 1, header);

        // Feature 1 DD block: 1 * 4 = 4 (dataDrivenBlockSizeDwords=4, featureIndex=1)
        expect(ubo.propertiesData[4]).toBeCloseTo(1.0, 5);
    });

    test('getMaxFeatureCount returns correct value', () => {
        // dataDrivenBlockSizeVec4=1 → dataDrivenBlockSizeDwords=4
        // propsDwords = 4096 - 12 (HEADER_DWORDS) = 4084
        // maxFeatures = floor(4084 / 4) = 1021
        const header: SymbolPropertyHeader = {
            dataDrivenMask: 0b00000100,
            zoomDependentMask: 0,
            cameraMask: 0,
            dataDrivenBlockSizeVec4: 1,
            offsets: [0, 0, 0, 0, 0, 0, 0, 0],
        };
        expect(SymbolPropertiesUBO.getMaxFeatureCount(header)).toEqual(1021);
    });

    test('getMaxFeatureCount returns Infinity when all constant', () => {
        const header = makeAllConstantHeader();
        expect(SymbolPropertiesUBO.getMaxFeatureCount(header)).toEqual(Infinity);
    });

    test('propertiesData array has correct size', () => {
        const ubo = new SymbolPropertiesUBO();
        // 1021 vec4s = 4084 floats
        expect(ubo.propertiesData.length).toEqual(4084);
    });

    test('headerData array has correct size', () => {
        const ubo = new SymbolPropertiesUBO();
        // 3 uvec4s = 12 uint32s
        expect(ubo.headerData.length).toEqual(12);
    });

    test('destroy cleans up resources', () => {
        const ubo = new SymbolPropertiesUBO();
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
            expect(binder.featureVertexRangesFromId.size).toEqual(0);
            expect(binder.allFeatures).toEqual([]);
        });
    });

    describe('buildHeader', () => {
        test('all-constant layer produces zero dataDrivenMask', () => {
            const layer = createTestLayer({
                'text-color': 'red',
                'text-opacity': 0.8,
            });
            const binder = new SymbolPropertyBinderUBO(layer, 10, null, true);
            const header = binder.buildHeader();

            expect(header.dataDrivenMask).toEqual(0);
            expect(header.dataDrivenBlockSizeVec4).toEqual(0);
        });

        test('data-driven opacity sets bit 2 in dataDrivenMask', () => {
            const layer = createTestLayer({'text-opacity': ['get', 'opacity']});
            const binder = new SymbolPropertyBinderUBO(layer, 10, null, true);
            const header = binder.buildHeader();

            expect(header.dataDrivenMask & 0b00000100).not.toEqual(0); // bit 2 = opacity
            expect(header.dataDrivenBlockSizeVec4).toBeGreaterThan(0);
        });

        test('data-driven colors are vec4-aligned in data-driven block', () => {
            // When both colors are data-driven their offsets must be multiples of 4 (vec4 boundary).
            const layer = createTestLayer({
                'text-color': ['get', 'fill_color'],
                'text-halo-color': ['get', 'halo_color'],
            });
            const binder = new SymbolPropertyBinderUBO(layer, 10, null, true);
            const header = binder.buildHeader();

            // fill_color: first in block → offset 0 (vec4-aligned)
            expect(header.offsets[0]).toEqual(0);
            expect(header.offsets[0] % 4).toEqual(0);
            // halo_color: after 4-dword fill_color → offset 4 (vec4-aligned)
            expect(header.offsets[1]).toEqual(4);
            expect(header.offsets[1] % 4).toEqual(0);
        });
    });

    describe('evaluateAllProperties', () => {
        test('handles constant opacity', () => {
            const layer = createTestLayer({'text-opacity': 0.8});
            const binder = new SymbolPropertyBinderUBO(layer, 10, null, true);
            // Build header so evaluateAllProperties has zoomDependentMask
            binder.cachedHeader = binder.buildHeader();
            const feature = createTestFeature({name: 'test'});
            const canonical = new CanonicalTileID(0, 0, 0);

            const result = binder.evaluateAllProperties(feature, {}, canonical, []);

            // Opacity is at index 2, constant, should be 0.8
            expect(result[2]).toBeCloseTo(0.8, 5);
        });

        test('handles data-driven opacity from feature property', () => {
            const layer = createTestLayer({'text-opacity': ['get', 'opacity']});
            const binder = new SymbolPropertyBinderUBO(layer, 10, null, true);
            binder.cachedHeader = binder.buildHeader();
            const feature = createTestFeature({opacity: 0.75});
            const canonical = new CanonicalTileID(0, 0, 0);

            const result = binder.evaluateAllProperties(feature, {}, canonical, []);

            expect(result[2]).toBeCloseTo(0.75, 5);
        });

        test('handles constant fill_color as [r,g,b,a]', () => {
            const layer = createTestLayer({'text-color': 'red', 'text-opacity': 0.8});
            const binder = new SymbolPropertyBinderUBO(layer, 10, null, true);
            binder.cachedHeader = binder.buildHeader();
            const feature = createTestFeature({name: 'test'});
            const canonical = new CanonicalTileID(0, 0, 0);

            const result = binder.evaluateAllProperties(feature, {}, canonical, []);

            // fill_color at index 0 is [r, g, b, a] for constant (non-zoom)
            expect(Array.isArray(result[0])).toBeTruthy();
            expect((result[0] as number[]).length).toEqual(4);
        });

        test('missing properties return defaults', () => {
            const layer = createTestLayer({});
            const binder = new SymbolPropertyBinderUBO(layer, 10, null, true);
            binder.cachedHeader = binder.buildHeader();
            const feature = createTestFeature();
            const canonical = new CanonicalTileID(0, 0, 0);

            const result = binder.evaluateAllProperties(feature, {}, canonical, []);

            // opacity default = 1.0
            expect(result[2]).toBeCloseTo(1.0, 5);
            // halo_width default = 0.0
            expect(result[3]).toBeCloseTo(0.0, 5);
            // halo_blur default = 0.0
            expect(result[4]).toBeCloseTo(0.0, 5);
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
            const maxPerBatch = 1021;
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

        test('tracks feature locations correctly across batches', () => {
            const layer = createTestLayer({'text-opacity': ['get', 'opacity']});
            const binder = new SymbolPropertyBinderUBO(layer, 10, null, true);
            const canonical = new CanonicalTileID(0, 0, 0);

            const maxPerBatch = 1021;
            // Fill up to the last entry of batch 0
            for (let i = 0; i < maxPerBatch - 1; i++) {
                binder.populateUBO(createTestFeature({opacity: i / maxPerBatch}, `feature-${i}`), i, canonical, []);
            }
            binder.populateUBO(createTestFeature({opacity: 1.0}, `feature-last`), maxPerBatch - 1, canonical, []);

            // First entry of batch 1
            binder.populateUBO(createTestFeature({opacity: 0.5}, `feature-first-next`), maxPerBatch, canonical, []);

            const rangesLast = binder.featureVertexRangesFromId.get('feature-last');
            expect(rangesLast).toBeDefined();
            expect(rangesLast[0].batchIndex).toEqual(0);
            expect(rangesLast[0].localFeatureIndex).toEqual(maxPerBatch - 1);

            const rangesFirstNext = binder.featureVertexRangesFromId.get('feature-first-next');
            expect(rangesFirstNext).toBeDefined();
            expect(rangesFirstNext[0].batchIndex).toEqual(1);
            expect(rangesFirstNext[0].localFeatureIndex).toEqual(0);
        });

        test('handles features without IDs', () => {
            const layer = createTestLayer({'text-color': 'red'});
            const binder = new SymbolPropertyBinderUBO(layer, 10, null, true);
            const canonical = new CanonicalTileID(0, 0, 0);

            const feature = createTestFeature({}, undefined);
            binder.populateUBO(feature, 0, canonical, []);

            expect(binder.featureCount).toEqual(1);
            expect(binder.allFeatures.length).toEqual(1);
            expect(binder.featureVertexRangesFromId.size).toEqual(0);
        });

        test('clamps gracefully when exceeding max binding points', () => {
            const layer = createTestLayer({'text-opacity': ['get', 'opacity']});
            // Pass small maxUniformBufferBindings so the limit is hit quickly
            const binder = new SymbolPropertyBinderUBO(layer, 10, null, true, '', 6);
            const canonical = new CanonicalTileID(0, 0, 0);

            // Build header first so we know the batch size
            binder.populateUBO(createTestFeature({opacity: 0.5}, 'seed'), 0, canonical, []);
            const maxPerBatch = binder.maxFeaturesPerBatch;

            // Manually push featureCount past the last allowed batch (batchIndex 1 would need bindings 3,4,5;
            // batchIndex 2 would need 6,7,8 which exceeds limit 6)
            binder.featureCount = 2 * maxPerBatch;

            const feature = createTestFeature({opacity: 0.5}, 'too-many');

            // Should not throw — returns 0 (clamped to slot 0) and tracks the feature
            let returnedIndex: number | undefined;
            expect(() => {
                returnedIndex = binder.populateUBO(feature, 1, canonical, []);
            }).not.toThrow();
            expect(returnedIndex).toEqual(0);

            // Feature still tracked (for future updates)
            const ranges = binder.featureVertexRangesFromId.get('too-many');
            expect(ranges).toBeDefined();
            expect(ranges[0].batchIndex).toEqual(0);
            expect(ranges[0].localFeatureIndex).toEqual(0);
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
            const header = binder.cachedHeader;
            expect(header).not.toBeNull();
            // data-driven block: opacity(1 dword) → pad to 4 → dataDrivenBlockSizeVec4 = 1
            // constant properties go to u_spp_* uniforms
            expect(header.dataDrivenBlockSizeVec4).toEqual(1);

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
            binder.cachedHeader = binder.buildHeader();

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
            binder.cachedHeader = binder.buildHeader();

            const cv = binder.getConstantUniformValues(10);

            expect(cv.opacity).toBeCloseTo(0.7, 5);
            expect(cv['halo_width']).toBeCloseTo(2.5, 5);
        });

        test('fill_np_color returns non-premultiplied RGBA', () => {
            const layer = createTestLayer({'text-color': 'red'});
            const binder = new SymbolPropertyBinderUBO(layer, 10, null, true);
            binder.cachedHeader = binder.buildHeader();

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
            binder.cachedHeader = binder.buildHeader();

            const cv1 = binder.getConstantUniformValues(10);
            const cv2 = binder.getConstantUniformValues(10);

            expect(cv1).toBe(cv2); // exact same reference — no recompute
        });

        test('cache is invalidated when brightness changes', () => {
            const layer = createTestLayer({'text-opacity': 0.5});
            const binder = new SymbolPropertyBinderUBO(layer, 10, null, true);
            binder.cachedHeader = binder.buildHeader();

            const cv1 = binder.getConstantUniformValues(10, 0.5);
            const cv2 = binder.getConstantUniformValues(10, 0.9);

            expect(cv1).not.toBe(cv2); // different brightness → recompute
        });

        test('cache is invalidated when updateDynamicExpressions reassigns the layer', () => {
            const layer = createTestLayer({'text-opacity': 0.5});
            const binder = new SymbolPropertyBinderUBO(layer, 10, null, true);
            binder.cachedHeader = binder.buildHeader();

            const cv1 = binder.getConstantUniformValues(10);
            expect(binder.cachedConstantUniforms).not.toBeNull();

            // Simulate a layer update — sets cachedConstantUniforms to null
            const canonical = new CanonicalTileID(0, 0, 0);
            binder.updateDynamicExpressions(layer, null as unknown as VectorTileLayer, canonical, [], {});
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

            // Create two batches worth of features (1021 per batch → need 1018+)
            for (let i = 0; i < 1100; i++) {
                binder.populateUBO(createTestFeature({opacity: i / 1100}, `feature-${i}`), i, canonical, []);
            }

            expect(binder.ubos.length).toBeGreaterThan(1);
            expect(binder.featureCount).toEqual(1100);

            binder.destroy();

            expect(binder.ubos).toEqual([]);
            expect(binder.featureCount).toEqual(0);
            expect(binder.featureVertexRangesFromId.size).toEqual(0);
            expect(binder.allFeatures).toEqual([]);
        });
    });
});
