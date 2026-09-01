// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {describe, test, expect, vi} from '../../util/vitest';
import SymbolStyleLayer from '../../../src/style/style_layer/symbol_style_layer';
import FormatSectionOverride from '../../../src/style/format_section_override';
import {getPaintProperties} from '../../../src/style/style_layer/symbol_style_layer_properties';
import Transform from '../../../src/geo/transform';
import {OverscaledTileID} from '../../../src/source/tile_id';
import {SymbolIdRangeAllocator} from '../../../src/placement/symbol_id_range_allocator';

function createSymbolLayer(layerProperties) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const layer = new SymbolStyleLayer(layerProperties);
    layer.recalculate({zoom: 0});
    return layer;
}

function isOverriden(paintProperty) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (paintProperty.value.kind === 'source' || paintProperty.value.kind === 'composite') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return paintProperty.value._styleExpression.expression instanceof FormatSectionOverride;
    }
    return false;
}

describe('setPaintOverrides', () => {
    test('setPaintOverrides, no overrides', () => {
        const layer = createSymbolLayer({});
        layer._setPaintOverrides();
        for (const overridable of getPaintProperties().overridableProperties) {
            expect(isOverriden(layer.paint.get(overridable))).toEqual(false);
        }
    });

    test('setPaintOverrides, format expression, overriden text-color', () => {
        const props = {layout: {'text-field': ["format", "text", {"text-color": "yellow"}]}};
        const layer = createSymbolLayer(props);
        layer._setPaintOverrides();
        expect(isOverriden(layer.paint.get('text-color'))).toEqual(true);
    });

    test('setPaintOverrides, format expression, no overrides', () => {
        const props = {layout: {'text-field': ["format", "text", {}]}};
        const layer = createSymbolLayer(props);
        layer._setPaintOverrides();
        expect(isOverriden(layer.paint.get('text-color'))).toEqual(false);
    });
});

describe('hasPaintOverrides', () => {
    test('undefined', () => {
        const layer = createSymbolLayer({});
        expect(SymbolStyleLayer.hasPaintOverride(layer.layout, 'text-color')).toEqual(false);
    });

    test('constant, Formatted type, overriden text-color', () => {
        const props = {layout: {'text-field': ["format", "text", {"text-color": "red"}]}};
        const layer = createSymbolLayer(props);
        expect(SymbolStyleLayer.hasPaintOverride(layer.layout, 'text-color')).toEqual(true);
    });

    test('constant, Formatted type, no overrides', () => {
        const props = {layout: {'text-field': ["format", "text", {"font-scale": 0.8}]}};
        const layer = createSymbolLayer(props);
        expect(SymbolStyleLayer.hasPaintOverride(layer.layout, 'text-color')).toEqual(false);
    });

    test('format expression, overriden text-color', () => {
        const props = {layout: {'text-field': ["format", ["get", "name"], {"text-color": "red"}]}};
        const layer = createSymbolLayer(props);
        expect(SymbolStyleLayer.hasPaintOverride(layer.layout, 'text-color')).toEqual(true);
    });

    test('format expression, no overrides', () => {
        const props = {layout: {'text-field': ["format", ["get", "name"], {}]}};
        const layer = createSymbolLayer(props);
        expect(SymbolStyleLayer.hasPaintOverride(layer.layout, 'text-color')).toEqual(false);
    });

    test('nested expression, overriden text-color', () => {
        const matchExpr = ["match", ["get", "case"],
            "one", ["format", "color", {"text-color": "blue"}],
            "default"];
        const props = {layout: {'text-field': matchExpr}};
        const layer = createSymbolLayer(props);
        expect(SymbolStyleLayer.hasPaintOverride(layer.layout, 'text-color')).toEqual(true);
    });

    test('nested expression, no overrides', () => {
        const matchExpr = ["match", ["get", "case"],
            "one", ["format", "b&w", {}],
            "default"];
        const props = {layout: {'text-field': matchExpr}};
        const layer = createSymbolLayer(props);
        expect(SymbolStyleLayer.hasPaintOverride(layer.layout, 'text-color')).toEqual(false);
    });
});

describe('placeSymbols', () => {
    function createGlobalPlacement() {
        return {startSymbolSourceProcessing: vi.fn(), finishSourceProcessing: vi.fn()};
    }

    function createTransform() {
        const transform = new Transform();
        transform.resize(512, 512);
        return transform;
    }

    test('opens and closes symbol source processing for the bucket it leads', () => {
        const layer = createSymbolLayer({id: 'symbol'});
        const bucket = {
            layerIds: [layer.fqid],
            getProjection: () => ({name: 'mercator'}),
            addToPlacement: vi.fn(),
            updateZOffset: vi.fn(),
            elevationType: 'none',
        };
        const tile = {getBucket: () => bucket, tileID: new OverscaledTileID(0, 0, 0, 0, 0), tileSize: 512};
        const globalPlacement = createGlobalPlacement();

        layer.placeSymbols(globalPlacement, [tile], new SymbolIdRangeAllocator(), createTransform());

        expect(globalPlacement.startSymbolSourceProcessing).toHaveBeenCalledExactlyOnceWith(bucket);
        expect(bucket.addToPlacement).toHaveBeenCalledOnce();
        expect(globalPlacement.finishSourceProcessing).toHaveBeenCalledOnce();
    });

    test('skips a tile with no bucket', () => {
        const layer = createSymbolLayer({id: 'symbol'});
        const tile = {getBucket: () => undefined};
        const globalPlacement = createGlobalPlacement();

        layer.placeSymbols(globalPlacement, [tile], new SymbolIdRangeAllocator(), createTransform());

        expect(globalPlacement.startSymbolSourceProcessing).not.toHaveBeenCalled();
        expect(globalPlacement.finishSourceProcessing).not.toHaveBeenCalled();
    });

    test('skips a bucket this layer does not lead', () => {
        const layer = createSymbolLayer({id: 'symbol'});
        const bucket = {layerIds: ['other-layer']};
        const tile = {getBucket: () => bucket};
        const globalPlacement = createGlobalPlacement();

        layer.placeSymbols(globalPlacement, [tile], new SymbolIdRangeAllocator(), createTransform());

        expect(globalPlacement.startSymbolSourceProcessing).not.toHaveBeenCalled();
        expect(globalPlacement.finishSourceProcessing).not.toHaveBeenCalled();
    });
});
