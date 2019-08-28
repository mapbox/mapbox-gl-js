import {test} from '../../util/test';
import SymbolStyleLayer from '../../../src/style/style_layer/symbol_style_layer';
import FormatSectionOverride from '../../../src/style-spec/expression/definitions/format_section_override';
import properties from '../../../src/style/style_layer/symbol_style_layer_properties';

function createSymbolLayer(layerProperties) {
    const layer = new SymbolStyleLayer(layerProperties);
    layer.recalculate({zoom: 0, zoomHistory: {}});
    return layer;
}

function isOverriden(paintProperty) {
    if (paintProperty.value.kind === 'source' || paintProperty.value.kind === 'composite') {
        return paintProperty.value._styleExpression.expression instanceof FormatSectionOverride;
    }
    return false;
}

test('setPaintOverrides', (t) => {
    t.test('setPaintOverrides, no overrides', (t) => {
        const layer = createSymbolLayer({});
        layer._setPaintOverrides();
        for (const overridable of properties.paint.overridableProperties) {
            t.equal(isOverriden(layer.paint.get(overridable)), false);
        }
        t.end();
    });

    t.test('setPaintOverrides, format expression, overriden text-color', (t) => {
        const props = {layout: {'text-field': ["format", "text", {"text-color": "yellow"}]}};
        const layer = createSymbolLayer(props);
        layer._setPaintOverrides();
        t.equal(isOverriden(layer.paint.get('text-color')), true);
        t.end();
    });

    t.test('setPaintOverrides, format expression, no overrides', (t) => {
        const props = {layout: {'text-field': ["format", "text", {}]}};
        const layer = createSymbolLayer(props);
        layer._setPaintOverrides();
        t.equal(isOverriden(layer.paint.get('text-color')), false);
        t.end();
    });

    t.end();
});

test('hasPaintOverrides', (t) => {
    t.test('undefined', (t) => {
        const layer = createSymbolLayer({});
        t.equal(SymbolStyleLayer.hasPaintOverrides(layer.layout), false);
        t.end();
    });

    t.test('constant, Formatted type, overriden text-color', (t) => {
        const props = {layout: {'text-field': ["format", "text", {"text-color": "red"}]}};
        const layer = createSymbolLayer(props);
        t.equal(SymbolStyleLayer.hasPaintOverrides(layer.layout), true);
        t.end();
    });

    t.test('constant, Formatted type, no overrides', (t) => {
        const props = {layout: {'text-field': ["format", "text", {"font-scale": 0.8}]}};
        const layer = createSymbolLayer(props);
        t.equal(SymbolStyleLayer.hasPaintOverrides(layer.layout), false);
        t.end();
    });

    t.test('format expression, overriden text-color', (t) => {
        const props = {layout: {'text-field': ["format", ["get", "name"], {"text-color":"red"}]}};
        const layer = createSymbolLayer(props);
        t.equal(SymbolStyleLayer.hasPaintOverrides(layer.layout), true);
        t.end();
    });

    t.test('format expression, no overrides', (t) => {
        const props = {layout: {'text-field': ["format", ["get", "name"], {}]}};
        const layer = createSymbolLayer(props);
        t.equal(SymbolStyleLayer.hasPaintOverrides(layer.layout), false);
        t.end();
    });

    t.test('nested expression, overriden text-color', (t) => {
        const matchExpr = ["match", ["get", "case"],
            "one", ["format", "color", {"text-color": "blue"}],
            "default"];
        const props = {layout: {'text-field': matchExpr}};
        const layer = createSymbolLayer(props);
        t.equal(SymbolStyleLayer.hasPaintOverrides(layer.layout), true);
        t.end();
    });

    t.test('nested expression, no overrides', (t) => {
        const matchExpr = ["match", ["get", "case"],
            "one", ["format", "b&w", {}],
            "default"];
        const props = {layout: {'text-field': matchExpr}};
        const layer = createSymbolLayer(props);
        t.equal(SymbolStyleLayer.hasPaintOverrides(layer.layout), false);
        t.end();
    });

    t.end();
});
