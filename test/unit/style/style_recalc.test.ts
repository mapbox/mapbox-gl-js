// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import {describe, test, expect, waitFor} from '../../util/vitest';
import {newStubStyle} from './utils';
import EvaluationParameters from '../../../src/style/evaluation_parameters';
import Color from '../../../src/style-spec/util/color';
import {ImageId} from '../../../src/style-spec/expression/types/image_id';
import {makeFQID} from '../../../src/util/fqid';
import browser from '../../../src/util/browser';

const geojson = {type: 'geojson', data: {type: 'FeatureCollection', features: []}};
const zoomOpacity = ['interpolate', ['linear'], ['zoom'], 0, 0, 10, 1];

async function loadStyle(json) {
    const {style} = newStubStyle();
    style.loadJSON({version: 8, sources: {}, layers: [], ...json});
    await waitFor(style, 'style.load');
    return style;
}

function update(style, zoom, options = {}) {
    style.update(new EvaluationParameters(zoom, {now: 0, transition: {duration: 0}, ...options}));
}

function paintValue(style, layerId, name) {
    const value = style.getLayer(layerId).paint.get(name);
    return value && value.constantOr ? value.constantOr(null) : value;
}

describe('Style#update re-evaluation', () => {
    test('applies a paint property change', async () => {
        const style = await loadStyle({layers: [{id: 'bg', type: 'background', paint: {'background-opacity': 0.5}}]});
        update(style, 0);
        style.setPaintProperty('bg', 'background-opacity', 0.25);
        update(style, 0);

        expect(paintValue(style, 'bg', 'background-opacity')).toEqual(0.25);
    });

    test('transitions a paint property change across updates', async () => {
        const style = await loadStyle({layers: [{id: 'bg', type: 'background', paint: {'background-opacity': 0}}]});
        update(style, 0);
        style.setPaintProperty('bg', 'background-opacity', 1);
        update(style, 0, {now: 1000, transition: {duration: 100}});
        update(style, 0, {now: 1050});

        expect(paintValue(style, 'bg', 'background-opacity')).toEqual(0.5);
    });

    test('settles on the final value after a transition ends', async () => {
        const style = await loadStyle({layers: [{id: 'bg', type: 'background', paint: {'background-opacity': 0}}]});
        update(style, 0);
        style.setPaintProperty('bg', 'background-opacity', 1);
        update(style, 0, {now: 1000, transition: {duration: 100}});
        update(style, 0, {now: 1050});
        update(style, 0, {now: 1200});

        expect(paintValue(style, 'bg', 'background-opacity')).toEqual(1);
    });

    test('applies a layout property change', async () => {
        const style = await loadStyle({
            sources: {geojson},
            layers: [{id: 'line', type: 'line', source: 'geojson', layout: {'line-miter-limit': 2}}]
        });
        update(style, 0);
        style.setLayoutProperty('line', 'line-miter-limit', 3);
        update(style, 0);

        expect(style.getLayer('line').layout.get('line-miter-limit')).toEqual(3);
    });

    test('re-evaluates camera properties on zoom change', async () => {
        const style = await loadStyle({layers: [{id: 'bg', type: 'background', paint: {'background-opacity': zoomOpacity}}]});

        const values = [5, 7].map(zoom => {
            update(style, zoom);
            return paintValue(style, 'bg', 'background-opacity');
        });
        expect(values).toEqual([0.5, 0.7]);
    });

    test('re-evaluates composite properties on zoom change', async () => {
        const style = await loadStyle({
            sources: {geojson},
            layers: [{id: 'circle', type: 'circle', source: 'geojson', paint: {
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, ['get', 'r'], 10, ['*', 2, ['get', 'r']]]
            }}]
        });

        const values = [0, 5].map(zoom => {
            update(style, zoom);
            return style.getLayer('circle').paint.get('circle-radius').evaluate({properties: {r: 10}}, {});
        });
        expect(values).toEqual([10, 15]);
    });

    test('evaluates a layer shown after a zoom change while hidden at the new zoom', async () => {
        const style = await loadStyle({layers: [{
            id: 'bg', type: 'background', layout: {visibility: 'none'}, paint: {'background-opacity': zoomOpacity}
        }]});
        update(style, 5);
        update(style, 7);
        style.setLayoutProperty('bg', 'visibility', 'visible');
        update(style, 7);

        expect(paintValue(style, 'bg', 'background-opacity')).toEqual(0.7);
    });

    test('re-evaluates a layer that comes back into its zoom range', async () => {
        const style = await loadStyle({layers: [{id: 'bg', type: 'background', minzoom: 5, paint: {'background-opacity': zoomOpacity}}]});
        update(style, 6);
        update(style, 2);
        update(style, 3);
        update(style, 8);

        expect(paintValue(style, 'bg', 'background-opacity')).toEqual(0.8);
    });

    test('applies an image change made while a layer was out of its zoom range', async () => {
        const style = await loadStyle({
            sources: {geojson},
            layers: [{id: 'fill', type: 'fill', source: 'geojson', minzoom: 5, paint: {
                'fill-pattern': ['coalesce', ['image', 'a'], ['image', 'b']]
            }}]
        });
        style.addImage(ImageId.from('b'), {});
        update(style, 2);
        style.addImage(ImageId.from('a'), {});
        update(style, 3);
        update(style, 6);

        expect(paintValue(style, 'fill', 'fill-pattern').primaryId.name).toEqual('a');
    });

    test('re-evaluates properties that depend on worldview', async () => {
        const style = await loadStyle({layers: [{id: 'bg', type: 'background', paint: {
            'background-opacity': ['match', ['worldview'], 'US', 1, 0]
        }}]});

        const values = ['CN', 'US'].map(worldview => {
            update(style, 0, {worldview});
            return paintValue(style, 'bg', 'background-opacity');
        });
        expect(values).toEqual([0, 1]);
    });

    test('re-evaluates properties that depend on brightness', async () => {
        const style = await loadStyle({
            transition: {duration: 0},
            lights: [
                {id: 'sun', type: 'directional', properties: {intensity: 0}},
                {id: 'env', type: 'ambient', properties: {intensity: 0}}
            ],
            sources: {geojson},
            layers: [{id: 'line', type: 'line', source: 'geojson', paint: {
                'line-opacity': ['step', ['measure-light', 'brightness'], 0, 0.1, 1]
            }}]
        });
        update(style, 0);
        const before = paintValue(style, 'line', 'line-opacity');
        style.setLights([
            {id: 'sun', type: 'directional', properties: {intensity: 1}},
            {id: 'env', type: 'ambient', properties: {intensity: 1}}
        ]);
        update(style, 0);

        expect([before, paintValue(style, 'line', 'line-opacity')]).toEqual([0, 1]);
    });

    test('re-evaluates image properties when an image is added', async () => {
        const style = await loadStyle({
            sources: {geojson},
            layers: [{id: 'fill', type: 'fill', source: 'geojson', paint: {
                'fill-pattern': ['coalesce', ['image', 'a'], ['image', 'b']]
            }}]
        });
        style.addImage(ImageId.from('b'), {});
        update(style, 0);
        const before = paintValue(style, 'fill', 'fill-pattern').primaryId.name;
        style.addImage(ImageId.from('a'), {});
        update(style, 0);

        expect([before, paintValue(style, 'fill', 'fill-pattern').primaryId.name]).toEqual(['b', 'a']);
    });

    test('re-evaluates non-image properties that check image availability when an image is added', async () => {
        const style = await loadStyle({
            sources: {geojson},
            layers: [{id: 'fill', type: 'fill', source: 'geojson', paint: {
                'fill-opacity': ['case', ['to-boolean', ['coalesce', ['image', 'a'], '']], 1, 0]
            }}]
        });
        update(style, 0);
        const before = paintValue(style, 'fill', 'fill-opacity');
        style.addImage(ImageId.from('a'), {});
        update(style, 0);

        expect([before, paintValue(style, 'fill', 'fill-opacity')]).toEqual([0, 1]);
    });

    test('keeps zoom-independent layout values across zoom changes', async () => {
        const style = await loadStyle({
            sources: {geojson},
            layers: [{id: 'line', type: 'line', source: 'geojson', layout: {'line-miter-limit': 3}, paint: {'line-opacity': zoomOpacity}}]
        });
        update(style, 5);
        update(style, 7);

        expect(style.getLayer('line').layout.get('line-miter-limit')).toEqual(3);
    });

    test('applies a paint property change on a zoom change', async () => {
        const style = await loadStyle({layers: [{id: 'bg', type: 'background', paint: {'background-opacity': zoomOpacity, 'background-color': 'red'}}]});
        update(style, 5);
        style.setPaintProperty('bg', 'background-color', 'blue');
        update(style, 7);

        expect(paintValue(style, 'bg', 'background-color')).toEqual(new Color(0, 0, 1, 1));
    });

    test('keeps the final value of a transition that ended before a zoom change', async () => {
        const style = await loadStyle({layers: [{id: 'bg', type: 'background', paint: {'background-opacity': zoomOpacity, 'background-color': 'red'}}]});
        update(style, 0);
        style.setPaintProperty('bg', 'background-color', 'blue');
        update(style, 0, {now: 1000, transition: {duration: 100}});
        update(style, 0, {now: 1050});
        update(style, 5, {now: 1200});
        update(style, 7, {now: 1300});

        expect(paintValue(style, 'bg', 'background-color')).toEqual(new Color(0, 0, 1, 1));
    });

    test('keeps text-color format overrides across zoom changes', async () => {
        const style = await loadStyle({
            sources: {geojson},
            glyphs: 'https://example.com/{fontstack}/{range}.pbf',
            layers: [{id: 'symbol', type: 'symbol', source: 'geojson', layout: {
                'text-field': ['format', 'a', {'text-color': 'red'}], 'text-size': ['interpolate', ['linear'], ['zoom'], 0, 10, 10, 20]
            }, paint: {'text-color': 'blue'}}]
        });
        update(style, 5);
        update(style, 7);

        expect(style.getLayer('symbol').paint.get('text-color').evaluate({properties: {}}, {}, undefined, undefined, {textColor: new Color(1, 0, 0, 1)}))
            .toEqual(new Color(1, 0, 0, 1));
    });

    test('applies text-color format overrides once a zoom-dependent text-field starts using them', async () => {
        const style = await loadStyle({
            sources: {geojson},
            glyphs: 'https://example.com/{fontstack}/{range}.pbf',
            layers: [{id: 'symbol', type: 'symbol', source: 'geojson', layout: {
                'text-field': ['step', ['zoom'], 'a', 6, ['format', 'a', {'text-color': 'red'}]]
            }, paint: {'text-color': 'blue'}}]
        });
        update(style, 5);
        update(style, 7);

        expect(style.getLayer('symbol').paint.get('text-color').evaluate({properties: {}}, {}, undefined, undefined, {textColor: new Color(1, 0, 0, 1)}))
            .toEqual(new Color(1, 0, 0, 1));
    });

    test('re-evaluates appearance properties on zoom change', async () => {
        const style = await loadStyle({
            sources: {geojson},
            layers: [{id: 'symbol', type: 'symbol', source: 'geojson', appearances: [
                {condition: ['==', ['feature-state', 'hover'], true], properties: {'icon-size': zoomOpacity}}
            ]}]
        });

        const values = [5, 7].map(zoom => {
            update(style, zoom);
            return style.getLayer('symbol').appearances[0].getLayoutProperty('icon-size').constantOr(null);
        });
        expect(values).toEqual([0.5, 0.7]);
    });
});

describe('Style#update re-evaluation with config', () => {
    function configStyle(paint, layout = {}) {
        return loadStyle({imports: [{id: 'basemap', url: '', data: {
            version: 8,
            sources: {geojson},
            schema: {width: {default: 1}, color: {default: 'red'}},
            layers: [{id: 'line', type: 'line', source: 'geojson', paint, layout}]
        }}]});
    }

    const lineId = makeFQID('line', 'basemap');

    test('re-evaluates paint properties that depend on config', async () => {
        const style = await configStyle({'line-color': ['config', 'color']});
        update(style, 0);
        style.setConfigProperty('basemap', 'color', 'blue');
        update(style, 0);

        expect(paintValue(style, lineId, 'line-color')).toEqual(new Color(0, 0, 1, 1));
    });

    test('re-evaluates layout properties that depend on config', async () => {
        const style = await configStyle({}, {'line-miter-limit': ['config', 'width']});
        update(style, 0);
        style.setConfigProperty('basemap', 'width', 3);
        update(style, 0);

        expect(style.getLayer(lineId).layout.get('line-miter-limit')).toEqual(3);
    });

    test('re-evaluates config-dependent properties on a config change with a zoom change', async () => {
        const style = await configStyle({'line-color': ['config', 'color'], 'line-opacity': zoomOpacity});
        update(style, 5);
        style.setConfigProperty('basemap', 'color', 'blue');
        update(style, 7);

        expect(paintValue(style, lineId, 'line-color')).toEqual(new Color(0, 0, 1, 1));
    });

    test('snaps an imported layer property on a config change', async () => {
        const style = await configStyle({'line-opacity': ['config', 'width']});
        update(style, 0);
        style.setConfigProperty('basemap', 'width', 0);
        update(style, 0, {now: 1000, transition: {duration: 100}});
        update(style, 0, {now: 1050});

        expect(paintValue(style, lineId, 'line-opacity')).toEqual(0);
    });

    test('re-evaluates appearance properties that depend on config', async () => {
        const style = await loadStyle({imports: [{id: 'basemap', url: '', data: {
            version: 8,
            sources: {geojson},
            schema: {size: {default: 1}},
            layers: [{id: 'symbol', type: 'symbol', source: 'geojson', appearances: [
                {condition: ['==', ['feature-state', 'hover'], true], properties: {'icon-size': ['config', 'size']}}
            ]}]
        }}]});
        update(style, 0);
        style.setConfigProperty('basemap', 'size', 2);
        update(style, 0);

        const appearance = style.getLayer(makeFQID('symbol', 'basemap')).appearances[0];
        expect(appearance.getLayoutProperty('icon-size').constantOr(null)).toEqual(2);
    });

    test('transitions an imported layer paint change', async () => {
        const style = await configStyle({'line-opacity': 1});
        update(style, 0);
        style.getFragmentStyle('basemap').setPaintProperty('line', 'line-opacity', 0);
        update(style, 0, {now: 1000, transition: {duration: 100}});
        update(style, 0, {now: 1050});

        expect(paintValue(style, lineId, 'line-opacity')).toEqual(0.5);
    });

    test('reports a transition in progress on an imported layer', async () => {
        const style = await configStyle({'line-opacity': 1});
        update(style, 0);
        style.getFragmentStyle('basemap').setPaintProperty('line', 'line-opacity', 0);
        update(style, 0, {now: browser.now(), transition: {duration: 10000}});

        expect(style.hasTransitions()).toEqual(true);
    });
});
