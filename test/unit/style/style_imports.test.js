import Style from '../../../src/style/style.js';
import Transform from '../../../src/geo/transform.js';
import StyleLayer from '../../../src/style/style_layer.js';
import VectorTileSource from '../../../src/source/vector_tile_source.js';
import GlyphManager from '../../../src/render/glyph_manager.js';
import {Event, Evented} from '../../../src/util/evented.js';
import {RequestManager} from '../../../src/util/mapbox.js';
import {OverscaledTileID} from '../../../src/source/tile_id.js';

import window from '../../../src/util/window.js';
import {test} from '../../util/test.js';
import {extend} from '../../../src/util/util.js';
import {makeFQID} from '../../../src/util/fqid.js';

function createStyleJSON(properties) {
    return extend({
        version: 8,
        sources: {},
        layers: []
    }, properties);
}

class StubMap extends Evented {
    constructor() {
        super();
        this.transform = new Transform();
        this._requestManager = new RequestManager();
        this._markers = [];
        this._triggerCameraUpdate = () => {};
        this._prioritizeAndUpdateProjection = () => {};
    }

    setCamera() {}

    _getMapId() {
        return 1;
    }
}

test('Style#loadURL', (t) => {
    t.beforeEach(() => {
        window.useFakeXMLHttpRequest();
        window.server.configure({respondImmediately: true});
    });

    t.afterEach(() => {
        window.restore();
    });

    t.test('imports style from URL', (t) => {
        const style = new Style(new StubMap());

        const initialStyle = createStyleJSON({
            imports: [{id: 'streets', url: '/styles/streets-v12.json'}],
        });

        const fragment = createStyleJSON({
            sources: {mapbox: {type: 'vector', tiles: []}},
            layers: [{id: 'land', type: 'background'}]
        });

        style.on('style.load', () => {
            t.equals(window.server.requests.length, 2);

            const fragmentStyle = style.getFragmentStyle('streets');
            t.deepEqual(fragmentStyle.stylesheet.layers, fragment.layers);
            t.deepEqual(fragmentStyle.stylesheet.sources, fragment.sources);

            t.end();
        });

        window.server.respondWith('/style.json', JSON.stringify(initialStyle));
        window.server.respondWith('/styles/streets-v12.json', JSON.stringify(fragment));
        style.loadURL('/style.json');
    });

    t.test('imports style from JSON', (t) => {
        const style = new Style(new StubMap());

        const fragment = createStyleJSON({
            sources: {mapbox: {type: 'vector', tiles: []}},
            layers: [{id: 'land', type: 'background'}]
        });

        const initialStyle = createStyleJSON({
            imports: [{id: 'streets', url: '/styles/streets-v12.json', data: fragment}],
        });

        style.on('style.load', () => {
            t.equals(window.server.requests.length, 1);

            const fragmentStyle = style.getFragmentStyle('streets');
            t.deepEqual(fragmentStyle.stylesheet.layers, fragment.layers);
            t.deepEqual(fragmentStyle.stylesheet.sources, fragment.sources);

            t.end();
        });

        window.server.respondWith('/style.json', JSON.stringify(initialStyle));
        style.loadURL('/style.json');
    });

    t.test('imports nested styles with circular dependencies', (t) => {
        const style = new Style(new StubMap());

        const initialStyle = createStyleJSON({
            imports: [{id: 'parent', url: '/styles/parent.json'}]
        });

        // Parent fragment imports 2 children
        const parentFragment = createStyleJSON({
            imports: [
                {id: 'child1', url: '/styles/child1.json'},
                {id: 'child2', url: '/styles/child2.json'}
            ]
        });

        // Child imports parent fragment
        const childFragment1 = createStyleJSON({
            sources: {childSource1: {type: 'vector', tiles: []}},
            imports: [{id: 'parent', url: '/styles/parent.json'}]
        });

        // Child imports neighbour child fragment
        const childFragment2 = createStyleJSON({
            sources: {childSource2: {type: 'vector', tiles: []}},
            imports: [{id: 'child1', url: '/styles/child1.json'}]
        });

        // Resulting stylesheet import
        const expectedImport = {
            id: 'parent',
            url: '/styles/parent.json',
            data: {
                version: 8,
                sources: {},
                layers: [],
                imports: [
                    {
                        id: 'child1',
                        url: '/styles/child1.json',
                        data: {
                            version: 8,
                            imports: [{id: 'parent', url: '/styles/parent.json'}],
                            sources: {childSource1: {type: 'vector', tiles: []}},
                            layers: []
                        }
                    },
                    {
                        id: 'child2',
                        url: '/styles/child2.json',
                        data: {
                            version: 8,
                            imports: [{id: 'child1', url: '/styles/child1.json'}],
                            sources: {childSource2: {type: 'vector', tiles: []}},
                            layers: []
                        }
                    }
                ]
            }
        };

        style.on('style.load', () => {
            t.equals(window.server.requests.length, 4);

            const {id: parentStyleId, style: parentStyle} = style.fragments[0];
            t.equal(parentStyleId, expectedImport.id);
            t.deepEqual(parentStyle.stylesheet.layers, expectedImport.data.layers);
            t.deepEqual(parentStyle.stylesheet.sources, expectedImport.data.sources);

            for (let i = 0; i < parentStyle.fragments.length; i++) {
                const {id: childStyleId, style: childStyle} = parentStyle.fragments[i];
                t.equal(childStyleId, expectedImport.data.imports[i].id);
                t.deepEqual(childStyle.stylesheet.layers, expectedImport.data.imports[i].data.layers);
                t.deepEqual(childStyle.stylesheet.sources, expectedImport.data.imports[i].data.sources);
            }

            t.pass();
            t.end();
        });

        window.server.respondWith('/style.json', JSON.stringify(initialStyle));
        window.server.respondWith('/styles/parent.json', JSON.stringify(parentFragment));
        window.server.respondWith('/styles/child1.json', JSON.stringify(childFragment1));
        window.server.respondWith('/styles/child2.json', JSON.stringify(childFragment2));
        style.loadURL('/style.json');
    });

    t.test('fires "style.import.load"', (t) => {
        const map = new StubMap();
        const style = new Style(map);
        style.setEventedParent(map, {style});

        const initialStyle = createStyleJSON({
            imports: [{id: 'streets', url: '/styles/streets-v12.json'}],
        });

        const spy = t.spy();
        map.on('style.import.load', spy);

        style.on('style.load', () => {
            t.ok(spy.calledOnce);

            t.equal(spy.getCall(0).args[0].target, map);
            t.equal(spy.getCall(0).args[0].style.scope, 'streets');

            t.end();
        });

        window.server.respondWith('/style.json', JSON.stringify(initialStyle));
        window.server.respondWith('/styles/streets-v12.json', JSON.stringify(createStyleJSON()));
        style.loadURL('/style.json');
    });

    t.test('fires "dataloading"', (t) => {
        const map = new StubMap();
        const style = new Style(map);
        style.setEventedParent(map, {style});

        const initialStyle = createStyleJSON({
            imports: [{id: 'streets', url: '/styles/streets-v12.json'}],
        });

        const spy = t.spy();
        map.on('dataloading', spy);

        style.on('style.load', () => {
            t.ok(spy.calledTwice);

            t.equal(spy.getCall(0).args[0].target, map);
            t.equal(spy.getCall(0).args[0].dataType, 'style');
            t.equal(spy.getCall(0).args[0].style.scope, '');

            t.equal(spy.getCall(1).args[0].target, map);
            t.equal(spy.getCall(1).args[0].dataType, 'style');
            t.equal(spy.getCall(1).args[0].style.scope, 'streets');

            t.end();
        });

        window.server.respondWith('/style.json', JSON.stringify(initialStyle));
        window.server.respondWith('/styles/streets-v12.json', JSON.stringify(createStyleJSON()));
        style.loadURL('/style.json');
    });

    t.test('fires "data"', (t) => {
        const map = new StubMap();
        const style = new Style(map);
        style.setEventedParent(map, {style});

        const initialStyle = createStyleJSON({
            imports: [{id: 'streets', url: '/styles/streets-v12.json'}],
        });

        const spy = t.spy();
        map.on('data', spy);

        style.on('style.load', () => {
            t.ok(spy.calledTwice);

            // initial root style 'data' event
            t.equal(spy.getCall(0).args[0].target, map);
            t.equal(spy.getCall(0).args[0].dataType, 'style');
            t.equal(spy.getCall(0).args[0].style.scope, '');

            // child style 'data' event
            t.equal(spy.getCall(1).args[0].target, map);
            t.equal(spy.getCall(1).args[0].dataType, 'style');
            t.equal(spy.getCall(1).args[0].style.scope, 'streets');

            t.end();
        });

        window.server.respondWith('/style.json', JSON.stringify(initialStyle));
        window.server.respondWith('/styles/streets-v12.json', JSON.stringify(createStyleJSON()));
        style.loadURL('/style.json');
    });

    t.test('validates the style', (t) => {
        const map = new StubMap();
        const style = new Style(map);
        style.setEventedParent(map, {style});

        const initialStyle = createStyleJSON({
            imports: [{id: 'streets', url: '/styles/streets-v12.json'}],
        });

        map.on('error', ({error}) => {
            t.ok(error);
            t.match(error.message, /version/);
            t.end();
        });

        window.server.respondWith('/style.json', JSON.stringify(initialStyle));
        window.server.respondWith('/styles/streets-v12.json', JSON.stringify(createStyleJSON({version: 'invalid'})));

        style.loadURL('/style.json');
    });

    t.end();
});

test('Style#loadJSON', (t) => {
    t.beforeEach(() => {
        window.useFakeXMLHttpRequest();
        window.server.configure({respondImmediately: true});
    });

    t.afterEach(() => {
        window.restore();
    });

    t.test('imports style from URL', (t) => {
        const style = new Style(new StubMap());

        const initialStyle = createStyleJSON({
            imports: [{id: 'streets', url: '/styles/streets-v12.json'}]
        });

        const fragment = createStyleJSON({
            sources: {mapbox: {type: 'vector', tiles: []}},
            layers: [{id: 'land', type: 'background'}]
        });

        style.on('style.load', () => {
            t.equals(window.server.requests.length, 1);

            const fragmentStyle = style.getFragmentStyle('streets');
            t.deepEqual(fragmentStyle.stylesheet.layers, fragment.layers);
            t.deepEqual(fragmentStyle.stylesheet.sources, fragment.sources);

            t.end();
        });

        window.server.respondWith('/styles/streets-v12.json', JSON.stringify(fragment));
        style.loadJSON(initialStyle);
    });

    t.test('imports style from JSON', (t) => {
        const style = new Style(new StubMap());

        const fragment = createStyleJSON({
            sources: {mapbox: {type: 'vector', tiles: []}},
            layers: [{id: 'land', type: 'background'}]
        });

        const initialStyle = createStyleJSON({
            imports: [{id: 'streets', url: '/styles/streets-v12.json', data: fragment}]
        });

        style.on('style.load', () => {
            t.equals(window.server.requests.length, 0);

            const fragmentStyle = style.getFragmentStyle('streets');
            t.deepEqual(fragmentStyle.stylesheet.layers, fragment.layers);
            t.deepEqual(fragmentStyle.stylesheet.sources, fragment.sources);

            t.end();
        });

        style.loadJSON(initialStyle);
    });

    t.test('limits nesting', (t) => {
        const style = new Style(new StubMap());
        const stub = t.stub(console, 'warn');

        const MAX_IMPORT_DEPTH = 5;
        function createNestedStyle(style = createStyleJSON(), depth = MAX_IMPORT_DEPTH + 1) {
            if (depth === 0) return style;
            const nextStyle = createStyleJSON({imports: [{id: `streets-${depth}`, url: '/style.json', data: style}]});
            return createNestedStyle(nextStyle, depth - 1);
        }

        const initialStyle = createNestedStyle();

        style.on('style.load', () => {
            let nestedStyle = style;
            for (let i = 1; i < MAX_IMPORT_DEPTH; i++) {
                nestedStyle = nestedStyle.getFragmentStyle(`streets-${i}`);
                t.ok(nestedStyle);
            }

            t.ok(stub.calledOnce);
            t.equal(nestedStyle.fragments.length, 0);
            t.end();
        });

        style.loadJSON(initialStyle);
    });

    t.test('fires "style.import.load"', (t) => {
        const map = new StubMap();

        const style = new Style(map);
        style.setEventedParent(map, {style});

        const initialStyle = createStyleJSON({
            imports: [{id: 'streets', url: '/styles/streets-v12.json', data: createStyleJSON()}],
        });

        const spy = t.spy();
        map.on('style.import.load', spy);

        style.on('style.load', () => {
            t.ok(spy.calledOnce);

            t.equal(spy.getCall(0).args[0].target, map);
            t.equal(spy.getCall(0).args[0].style.scope, 'streets');

            t.end();
        });

        style.loadJSON(initialStyle);
    });

    t.test('fires "dataloading"', (t) => {
        const map = new StubMap();

        const style = new Style(map);
        style.setEventedParent(map, {style});

        const initialStyle = createStyleJSON({
            imports: [{id: 'streets', url: '/styles/streets-v12.json', data: createStyleJSON()}],
        });

        const spy = t.spy();
        map.on('dataloading', spy);

        style.on('style.load', () => {
            t.ok(spy.calledTwice);

            t.equal(spy.getCall(0).args[0].target, map);
            t.equal(spy.getCall(0).args[0].dataType, 'style');
            t.equal(spy.getCall(0).args[0].style.scope, '');

            t.equal(spy.getCall(1).args[0].target, map);
            t.equal(spy.getCall(1).args[0].dataType, 'style');
            t.equal(spy.getCall(1).args[0].style.scope, 'streets');

            t.end();
        });

        style.loadJSON(initialStyle);
    });

    t.test('fires "data"', (t) => {
        const map = new StubMap();
        const style = new Style(map);
        style.setEventedParent(map, {style});

        const initialStyle = createStyleJSON({
            imports: [{id: 'streets', url: '/styles/streets-v12.json', data: createStyleJSON()}],
        });

        const spy = t.spy();
        map.on('data', spy);

        style.on('style.load', () => {
            t.ok(spy.calledTwice);

            // initial root style 'data' event
            t.equal(spy.getCall(0).args[0].target, map);
            t.equal(spy.getCall(0).args[0].dataType, 'style');
            t.equal(spy.getCall(0).args[0].style.scope, '');

            // child style 'data' event
            t.equal(spy.getCall(1).args[0].target, map);
            t.equal(spy.getCall(1).args[0].dataType, 'style');
            t.equal(spy.getCall(1).args[0].style.scope, 'streets');

            t.end();
        });

        style.loadJSON(initialStyle);
    });

    t.test('validates the style', (t) => {
        const map = new StubMap();
        const style = new Style(map);
        style.setEventedParent(map, {style});

        const initialStyle = createStyleJSON({
            imports: [{id: 'streets', url: '/styles/streets-v12.json', data: createStyleJSON({version: 'invalid'})}],
        });

        map.on('error', ({error}) => {
            t.ok(error);
            t.match(error.message, /version/);
            t.end();
        });

        style.loadJSON(initialStyle);
    });

    t.test('creates sources', (t) => {
        const style = new Style(new StubMap());

        const initialStyle = createStyleJSON({
            imports: [{id: 'basemap', url: '/style.json', data: createStyleJSON({
                sources: {mapbox: {type: 'vector', tiles: []}}
            })}],
        });

        style.on('style.load', () => {
            t.ok(style.getSource(makeFQID('mapbox', 'basemap')) instanceof VectorTileSource);
            t.end();
        });

        style.loadJSON(initialStyle);
    });

    t.test('creates layers', (t) => {
        const style = new Style(new StubMap());

        const initialStyle = createStyleJSON({
            imports: [{id: 'streets', url: '/style.json', data: createStyleJSON({
                sources: {mapbox: {type: 'vector', tiles: []}},
                layers: [{
                    id: 'fill',
                    type: 'fill',
                    source: 'mapbox',
                    'source-layer': 'source-layer'
                }]
            })}],
        });

        style.on('style.load', () => {
            t.ok(style.getLayer(makeFQID('fill', 'streets')) instanceof StyleLayer);
            t.end();
        });

        style.loadJSON(initialStyle);
    });

    t.test('own entities', (t) => {
        const style = new Style(new StubMap());

        const initialStyle = createStyleJSON({
            imports: [{id: 'streets', url: '/style.json', data: createStyleJSON({
                sources: {mapbox: {type: 'vector', tiles: []}},
                layers: [{id: 'background', type: 'background'}]
            })}],
            sources: {mapbox: {type: 'vector', tiles: []}},
            layers: [{id: 'background', type: 'background'}]
        });

        style.on('style.load', () => {
            t.ok(style.getLayer('background') instanceof StyleLayer);
            t.ok(style.getSource('mapbox') instanceof VectorTileSource);
            t.notOk(style.getOwnLayer(makeFQID('background', 'streets')) instanceof StyleLayer);
            t.notOk(style.getOwnSource(makeFQID('mapbox', 'streets')) instanceof VectorTileSource);
            t.ok(style.getLayer(makeFQID('background', 'streets')) instanceof StyleLayer);
            t.ok(style.getSource(makeFQID('mapbox', 'streets')) instanceof VectorTileSource);

            t.end();
        });

        style.loadJSON(initialStyle);
    });

    t.end();
});

test('Style#addSource', (t) => {
    t.test('same id in different scopes', (t) => {
        const style = new Style(new StubMap());

        const initialStyle = createStyleJSON({
            imports: [{id: 'streets', url: '/style.json', data: createStyleJSON({
                sources: {mapbox: {type: 'vector', tiles: []}}
            })}],
        });

        style.on('style.load', () => {
            style.addSource('mapbox', {type: 'vector', tiles: []});

            t.ok(style.getSource('mapbox') instanceof VectorTileSource);
            t.ok(style.getSource(makeFQID('mapbox', 'streets')) instanceof VectorTileSource);

            t.end();
        });

        style.loadJSON(initialStyle);
    });

    t.test('sets up source event forwarding', (t) => {
        const map = new StubMap();
        const style = new Style(map);
        style.setEventedParent(map, {style});

        const initialStyle = createStyleJSON({
            imports: [{id: 'streets', url: '/style.json', data: createStyleJSON({
                sources: {mapbox: {type: 'vector', tiles: []}}
            })}],
        });

        t.plan(4);

        map.on('error', () => { t.ok(true); });

        map.on('data', (e) => {
            if (e.dataType === 'style') return;

            if (e.sourceDataType === 'metadata' && e.dataType === 'source') {
                t.ok(true);
            } else if (e.sourceDataType === 'content' && e.dataType === 'source') {
                t.ok(true);
            } else {
                t.ok(true);
            }
        });

        style.on('style.load', () => {
            const source = style.getSource(makeFQID('mapbox', 'streets'));
            source.fire(new Event('error'));
            source.fire(new Event('data'));
        });

        style.loadJSON(initialStyle);
    });

    t.end();
});

test('Style#removeSource', (t) => {
    t.test('same id in different scope is intact', (t) => {
        const style = new Style(new StubMap());

        const initialStyle = createStyleJSON({
            sources: {mapbox: {type: 'vector', tiles: []}},
            imports: [{id: 'streets', url: '/style.json', data: createStyleJSON({
                sources: {mapbox: {type: 'vector', tiles: []}}
            })}],
        });

        style.on('style.load', () => {
            style.removeSource('mapbox');
            t.notOk(style.getSource('mapbox'), 'source in parent style is removed');
            t.ok(style.getSource(makeFQID('mapbox', 'streets')) instanceof VectorTileSource, 'source in child style is intact');
            t.end();
        });

        style.loadJSON(initialStyle);
    });

    t.end();
});

test('Style#addLayer', (t) => {
    t.test('sets up layer event forwarding', (t) => {
        const map = new StubMap();
        const style = new Style(map);
        style.setEventedParent(map, {style});

        const initialStyle = createStyleJSON({
            imports: [{id: 'streets', url: '/style.json', data: createStyleJSON({
                layers: [{
                    id: 'background',
                    type: 'background'
                }]
            })}],
        });

        map.on('error', (e) => {
            t.deepEqual(e.layer, {id: 'background'});
            t.ok(e.mapbox);
            t.end();
        });

        style.on('style.load', () => {
            const layer = style.getLayer(makeFQID('background', 'streets'));
            layer.fire(new Event('error', {mapbox: true}));
        });

        style.loadJSON(initialStyle);
    });

    t.test('adds before the given layer', (t) => {
        const style = new Style(new StubMap());

        const initialStyle = createStyleJSON({
            imports: [{
                id: 'streets',
                url: '/style.json',
                data: createStyleJSON({
                    layers: [
                        {id: 'a', type: 'background'},
                        {id: 'b', type: 'background'},
                    ]
                })
            }],
            layers: [
                {id: 'a', type: 'background'},
                {id: 'b', type: 'background'},
            ]
        });

        style.on('style.load', () => {
            style.addLayer({id: 'c', type: 'background'}, 'a');

            t.deepEqual(style.order, [
                makeFQID('a', 'streets'),
                makeFQID('b', 'streets'),
                'c',
                'a',
                'b'
            ]);

            t.end();
        });

        style.loadJSON(initialStyle);
    });

    t.test('Checks scope exist after adding layer', (t) => {
        const style = new Style(new StubMap());

        style.on('style.load', () => {
            style.addLayer({type: 'custom', id: 'custom', render: () => {}});
            t.equal(style.getLayer('custom').scope, style.scope);
            t.end();
        });
        style.loadJSON(createStyleJSON());
    });

    t.test('fire error on referencing before from different scope', (t) => {
        const map = new StubMap();
        const style = new Style(map);
        style.setEventedParent(map, {style});

        const initialStyle = createStyleJSON({
            imports: [{
                id: 'streets',
                url: '/style.json',
                data: createStyleJSON({layers: [{id: 'a', type: 'background'}]})
            }],
            layers: [{id: 'a', type: 'background'}]
        });

        map.on('error', (error) => {
            t.match(error.error, /does not exist on this map/);
            t.end();
        });

        style.on('style.load', () => {
            style.addLayer({id: 'c', type: 'background'}, makeFQID('a', 'streets'));
        });

        style.loadJSON(initialStyle);
    });

    t.end();
});

test('Style#removeLayer', (t) => {
    t.test('same id in different scope is intact', (t) => {
        const style = new Style(new StubMap());

        const initialStyle = createStyleJSON({
            layers: [{id: 'background', type: 'background'}],
            imports: [{id: 'streets', url: '/style.json', data: createStyleJSON({
                layers: [{id: 'background', type: 'background'}]
            })}],
        });

        style.on('style.load', () => {
            style.removeLayer('background');
            t.notOk(style.getLayer('background'), 'layer in parent style is removed');
            t.ok(style.getLayer(makeFQID('background', 'streets')), 'layer in child style is intact');
            t.end();
        });

        style.loadJSON(initialStyle);
    });

    t.test('fire error on removing layer from different scope', (t) => {
        const map = new StubMap();
        const style = new Style(map);
        style.setEventedParent(map, {style});

        const initialStyle = createStyleJSON({
            imports: [{
                id: 'streets',
                url: '/style.json',
                data: createStyleJSON({layers: [{id: 'a', type: 'background'}]})
            }]
        });

        map.on('error', (error) => {
            t.match(error.error, /does not exist in the map\'s style/);
            t.end();
        });

        style.on('style.load', () => {
            style.removeLayer(makeFQID('a', 'streets'));
        });

        style.loadJSON(initialStyle);
    });

    t.end();
});

test('Style#moveLayer', (t) => {
    t.test('reorders layers', (t) => {
        const style = new Style(new StubMap());

        const initialStyle = createStyleJSON({
            imports: [{
                id: 'streets',
                url: '/style.json',
                data: createStyleJSON({
                    layers: [
                        {id: 'a', type: 'background'},
                        {id: 'b', type: 'background'},
                        {id: 'c', type: 'background'},
                    ]
                })
            }],
            layers: [
                {id: 'd', type: 'background'},
                {id: 'e', type: 'background'},
                {id: 'f', type: 'background'}
            ]
        });

        style.on('style.load', () => {
            style.moveLayer('d', 'f');

            t.deepEqual(style.order, [
                makeFQID('a', 'streets'),
                makeFQID('b', 'streets'),
                makeFQID('c', 'streets'),
                makeFQID('e'),
                makeFQID('d'),
                makeFQID('f'),
            ]);

            t.end();
        });

        style.loadJSON(initialStyle);
    });

    t.test('fires an error on moving layer from different scope', (t) => {
        const style = new Style(new StubMap());

        const initialStyle = createStyleJSON({
            imports: [{
                id: 'streets',
                url: '/style.json',
                data: createStyleJSON({layers: [{id: 'background', type: 'background'}]})
            }]
        });

        style.on('style.load', () => {
            style.on('error', ({error}) => {
                t.match(error.message, /does not exist in the map\'s style/);
                t.end();
            });

            style.moveLayer(makeFQID('background', 'streets'));
        });

        style.loadJSON(initialStyle);
    });

    t.end();
});

test('Style#_mergeLayers', (t) => {
    t.test('supports slots', (t) => {
        const style = new Style(new StubMap());

        const initialStyle = createStyleJSON({
            imports: [{
                id: 'streets',
                url: '/style.json',
                data: createStyleJSON({
                    layers: [
                        {id: 'land', type: 'background'},
                        {id: 'below-water', type: 'slot'},
                        {id: 'water', type: 'background'},
                        {id: 'below-pois', type: 'slot'},
                        {id: 'pois', type: 'background'}
                    ]
                })
            }],
            layers: [
                {id: 'roads', type: 'background', slot: 'below-pois'},
                {id: 'national-park', type: 'background', slot: 'below-water'}
            ]
        });

        style.on('style.load', () => {
            style.addLayer({id: 'custom', type: 'custom', slot: 'below-water', render: () => {}});

            t.deepEqual(style.order, [
                makeFQID('land', 'streets'),
                makeFQID('national-park'),
                makeFQID('custom'),
                makeFQID('water', 'streets'),
                makeFQID('roads'),
                makeFQID('pois', 'streets'),
            ]);

            t.end();
        });

        style.loadJSON(initialStyle);
    });

    t.test('supports nested slots', (t) => {
        const style = new Style(new StubMap());

        const initialStyle = createStyleJSON({
            imports: [{
                id: 'streets',
                url: '/style.json',
                data: createStyleJSON({
                    layers: [
                        {id: 'land', type: 'background'},
                        {id: 'below-road', type: 'slot'},
                        {id: 'road', type: 'background'}
                    ]
                })
            }],
            layers: [
                {id: 'park', type: 'background', slot: 'below-road'},
                {id: 'below-water', type: 'slot', slot: 'below-road'},
                {id: 'water', type: 'background', slot: 'below-road'}
            ]
        });

        style.on('style.load', () => {
            style.addLayer({id: 'waterway', type: 'background', slot: 'below-water'});

            t.deepEqual(style.order, [
                makeFQID('land', 'streets'),
                makeFQID('park'),
                makeFQID('waterway'),
                makeFQID('water'),
                makeFQID('road', 'streets'),
            ]);

            t.end();
        });

        style.loadJSON(initialStyle);
    });

    t.test('supports dynamic adding slots', (t) => {
        const style = new Style(new StubMap());

        const initialStyle = createStyleJSON({
            layers: [
                {id: 'park', type: 'background'},
                {id: 'water', type: 'background'}
            ]
        });

        style.on('style.load', () => {
            style.addLayer({id: 'below-water', type: 'slot'}, 'water');
            style.addLayer({id: 'waterway', type: 'background', slot: 'below-water'});

            t.deepEqual(style.order, [
                makeFQID('park'),
                makeFQID('waterway'),
                makeFQID('water'),
            ]);

            t.end();
        });

        style.loadJSON(initialStyle);
    });

    t.test('supports adding layer into a slot with before', (t) => {
        const style = new Style(new StubMap());

        const initialStyle = createStyleJSON({
            imports: [{
                id: 'streets',
                url: '/style.json',
                data: createStyleJSON({
                    layers: [
                        {id: 'land', type: 'background'},
                        {id: 'below-water', type: 'slot'},
                        {id: 'water', type: 'background'}
                    ]
                })
            }],
            layers: [{id: 'national-park', type: 'background', slot: 'below-water'}]
        });

        style.on('style.load', () => {
            style.addLayer({id: 'before-national-park', type: 'background', slot: 'below-water'}, 'national-park');

            t.deepEqual(style.order, [
                makeFQID('land', 'streets'),
                makeFQID('before-national-park'),
                makeFQID('national-park'),
                makeFQID('water', 'streets'),
            ]);

            t.end();
        });

        style.loadJSON(initialStyle);
    });

    t.test('supports adding layers into multiple slots with before', (t) => {
        const style = new Style(new StubMap());
        const stub = t.stub(console, 'warn');

        const initialStyle = createStyleJSON({
            imports: [{
                id: 'streets',
                url: '/style.json',
                data: createStyleJSON({
                    layers: [
                        {id: 'land', type: 'background'},
                        {id: 'below-road', type: 'slot'},
                        {id: 'road', type: 'background'},
                        {id: 'below-pois', type: 'slot'},
                        {id: 'pois', type: 'background'},
                    ]
                })
            }]
        });

        style.on('style.load', () => {
            style.addLayer({id: 'park', type: 'background', slot: 'below-road'});
            style.addLayer({id: 'landuse', type: 'background', slot: 'below-pois'}, 'park');
            style.addLayer({id: 'waterway', type: 'background', slot: 'below-road'}, 'landuse');
            style.addLayer({id: 'water', type: 'background', slot: 'below-road'}, 'waterway');
            style.addLayer({id: 'bridge', type: 'background', slot: 'below-pois'}, 'park');
            style.addLayer({id: 'tunnel', type: 'background', slot: 'below-pois'}, 'bridge');

            t.deepEqual(style.order, [
                makeFQID('land', 'streets'),
                makeFQID('park'),
                makeFQID('water'),
                makeFQID('waterway'),
                makeFQID('road', 'streets'),
                makeFQID('landuse'),
                makeFQID('tunnel'),
                makeFQID('bridge'),
                makeFQID('pois', 'streets'),
            ]);

            t.equal(stub.callCount, 2);
            t.end();
        });

        style.loadJSON(initialStyle);
    });

    t.test('supports moving layer inside a slot', (t) => {
        const style = new Style(new StubMap());

        const initialStyle = createStyleJSON({
            imports: [{
                id: 'streets',
                url: '/style.json',
                data: createStyleJSON({
                    layers: [
                        {id: 'land', type: 'background'},
                        {id: 'below-road', type: 'slot'},
                        {id: 'road', type: 'background'}
                    ]
                })
            }],
            layers: [
                {id: 'park', type: 'background', slot: 'below-road'},
                {id: 'waterway', type: 'background', slot: 'below-road'},
                {id: 'water', type: 'background', slot: 'below-road'}
            ]
        });

        style.on('style.load', () => {
            style.moveLayer('water', 'waterway');

            t.deepEqual(style.order, [
                makeFQID('land', 'streets'),
                makeFQID('park'),
                makeFQID('water'),
                makeFQID('waterway'),
                makeFQID('road', 'streets'),
            ]);

            t.end();
        });

        style.loadJSON(initialStyle);
    });

    t.test('supports moving layers inside multiple slots', (t) => {
        const style = new Style(new StubMap());
        const stub = t.stub(console, 'warn');

        const initialStyle = createStyleJSON({
            imports: [{
                id: 'streets',
                url: '/style.json',
                data: createStyleJSON({
                    layers: [
                        {id: 'land', type: 'background'},
                        {id: 'below-road', type: 'slot'},
                        {id: 'road', type: 'background'},
                        {id: 'below-pois', type: 'slot'},
                        {id: 'pois', type: 'background'},
                    ]
                })
            }],
            layers: [
                {id: 'park', type: 'background', slot: 'below-road'},
                {id: 'waterway', type: 'background', slot: 'below-road'},
                {id: 'water', type: 'background', slot: 'below-road'},
                {id: 'landuse', type: 'background', slot: 'below-pois'},
                {id: 'tunnel', type: 'background', slot: 'below-pois'},
                {id: 'bridge', type: 'background', slot: 'below-pois'}
            ]
        });

        style.on('style.load', () => {
            // Moving a layer before the layer in the same slot
            style.moveLayer('water', 'waterway');

            // Moving a layer before the layer in a different slot
            style.moveLayer('bridge', 'water');

            t.deepEqual(style.order, [
                makeFQID('land', 'streets'),
                makeFQID('park'),
                makeFQID('water'),
                makeFQID('waterway'),
                makeFQID('road', 'streets'),
                makeFQID('landuse'),
                makeFQID('tunnel'),
                makeFQID('bridge'),
                makeFQID('pois', 'streets'),
            ]);

            t.equal(stub.callCount, 1);
            t.end();
        });

        style.loadJSON(initialStyle);
    });

    t.test('supports nested slots', (t) => {
        const style = new Style(new StubMap());

        const initialStyle = createStyleJSON({
            imports: [
                {
                    id: 'streets',
                    url: 'mapbox://styles/mapbox/streets',
                    data: {
                        version: 8,
                        sources: {},
                        layers: [
                            {id: 'background', type: 'background'},
                            {id: 'below-fills', type: 'slot'},
                            {id: 'fill', type: 'background'},
                            {id: 'below-roads', type: 'slot'},
                            {id: 'roads', type: 'background'}
                        ]
                    }
                },
                {
                    id: 'overlay',
                    url: 'mapbox://styles/custom/overlay',
                    data: {
                        version: 8,
                        sources: {},
                        layers: [
                            {id: 'a', type: 'background', slot: 'below-fills'},
                            {id: 'c', type: 'background', slot: 'below-fills'},
                            {id: 'custom-points', type: 'slot', slot: 'below-fills'},
                            {id: 'b', type: 'background', slot: 'below-roads'},
                            {id: 'e', type: 'background', slot: 'below-roads'},
                            {id: 'd', type: 'background', slot: 'missing'}
                        ]
                    }
                }
            ],
            layers: [
                {id: 'a', type: 'background', slot: 'below-fills'},
                {id: 'b', type: 'background', slot: 'below-roads'},
                {id: 'c', type: 'background', slot: 'below-fills'},
                {id: 'd', type: 'background', slot: 'missing'},
                {id: 'e', type: 'background', slot: 'below-roads'},
                {id: 'f', type: 'background', slot: 'custom-points'}
            ]
        });

        style.on('style.load', () => {
            t.deepEqual(style.order, [
                makeFQID('background', 'streets'),
                makeFQID('a', 'overlay'),
                makeFQID('c', 'overlay'),
                makeFQID('f'),
                makeFQID('a'),
                makeFQID('c'),
                makeFQID('fill', 'streets'),
                makeFQID('b', 'overlay'),
                makeFQID('e', 'overlay'),
                makeFQID('b'),
                makeFQID('e'),
                makeFQID('roads', 'streets'),
                makeFQID('d', 'overlay'),
                makeFQID('d'),
            ]);

            t.end();
        });

        style.loadJSON(initialStyle);
    });

    t.end();
});

test('Style#getLights', (t) => {
    t.test('root style resolves lights from import', (t) => {
        const style = new Style(new StubMap());

        style.loadJSON(createStyleJSON({
            imports: [{
                id: 'streets',
                url: '/styles/streets-v12.json',
                data: createStyleJSON({lights: [
                    {id: 'sun', type: 'directional', properties: {intensity: 0.4}},
                    {id: 'environment', type: 'ambient', properties: {intensity: 0.4}}
                ]})
            }],
        }));

        style.on('style.load', () => {
            t.deepEqual(style.getLights(), [
                {id: 'sun', type: 'directional', properties: {intensity: 0.4}},
                {id: 'environment', type: 'ambient', properties: {intensity: 0.4}}
            ]);
            t.end();
        });
    });

    t.test('root style overrides lights in imports', (t) => {
        const style = new Style(new StubMap());

        style.loadJSON(createStyleJSON({
            lights: [
                {id: 'sun', type: 'directional', properties: {intensity: 0.4}},
                {id: 'environment', type: 'ambient', properties: {intensity: 0.4}}
            ],
            imports: [{
                id: 'streets',
                url: '/styles/streets-v12.json',
                data: createStyleJSON({lights: [
                    {id: 'sun', type: 'directional', properties: {intensity: 0.6}},
                    {id: 'environment', type: 'ambient', properties: {intensity: 0.6}}
                ]})
            }],
        }));

        style.on('style.load', () => {
            t.deepEqual(style.getLights(), [
                {id: 'sun', type: 'directional', properties: {intensity: 0.4}},
                {id: 'environment', type: 'ambient', properties: {intensity: 0.4}}
            ]);
            t.end();
        });
    });

    t.test('empty lights in import does not override lights in root style', (t) => {
        const style = new Style(new StubMap());

        style.loadJSON(createStyleJSON({
            lights: [
                {id: 'sun', type: 'directional', properties: {intensity: 0.4}},
                {id: 'environment', type: 'ambient', properties: {intensity: 0.4}}
            ],
            imports: [{
                id: 'streets',
                url: '/styles/streets-v12.json',
                data: createStyleJSON()
            }],
        }));

        style.on('style.load', () => {
            t.deepEqual(style.getLights(), [
                {id: 'sun', type: 'directional', properties: {intensity: 0.4}},
                {id: 'environment', type: 'ambient', properties: {intensity: 0.4}}
            ]);
            t.end();
        });
    });

    t.end();
});

test('Terrain', (t) => {
    t.beforeEach(() => {
        window.useFakeXMLHttpRequest();
        window.server.configure({respondImmediately: true});
    });

    t.afterEach(() => {
        window.restore();
    });

    t.test('root style resolves terrain from import', (t) => {
        const style = new Style(new StubMap());

        style.loadJSON(createStyleJSON({
            imports: [{
                id: 'streets',
                url: '/styles/streets-v12.json',
                data: createStyleJSON({
                    terrain: {source: 'mapbox-dem', exaggeration: 1.5},
                    sources: {
                        'mapbox-dem': {
                            type: 'raster-dem',
                            tiles: ['http://example.com/{z}/{x}/{y}.png'],
                            tileSize: 256,
                            maxzoom: 14
                        }
                    },
                })
            }],
        }));

        style.on('style.load', () => {
            t.deepEqual(style.getTerrain(), {source: 'mapbox-dem', exaggeration: 1.5});
            t.end();
        });
    });

    t.test('root style overrides terrain in imports', (t) => {
        const style = new Style(new StubMap());

        style.loadJSON(createStyleJSON({
            imports: [{
                id: 'first',
                url: '/styles/streets-v12.json',
                data: createStyleJSON({
                    terrain: {source: 'dem', exaggeration: 1},
                    sources: {
                        'dem': {
                            type: 'raster-dem',
                            tiles: ['http://example.com/{z}/{x}/{y}.png'],
                            tileSize: 256,
                            maxzoom: 14
                        }
                    },
                    imports: [{
                        id: 'second',
                        url: '/styles/streets-v12.json',
                        data: createStyleJSON({
                            terrain: {source: 'mapbox-dem', exaggeration: 1.5},
                            sources: {
                                'mapbox-dem': {
                                    type: 'raster-dem',
                                    tiles: ['http://example.com/{z}/{x}/{y}.png'],
                                    tileSize: 256,
                                    maxzoom: 14
                                }
                            },
                        })
                    }]
                })
            }],
        }));

        style.on('style.load', () => {
            t.deepEqual(style.getTerrain(), {source: 'dem', exaggeration: 1});
            t.end();
        });
    });

    t.test('empty root style terrain overrides terrain in imports', (t) => {
        const style = new Style(new StubMap());

        style.loadJSON(createStyleJSON({
            terrain: {source: 'mapbox-dem', exaggeration: 2},
            sources: {
                'mapbox-dem': {
                    type: 'raster-dem',
                    tiles: ['http://example.com/{z}/{x}/{y}.png'],
                    tileSize: 256,
                    maxzoom: 14
                }
            },
            imports: [{
                id: 'basemap',
                url: '/standard.json',
                data: createStyleJSON({
                    terrain: {source: 'mapbox-dem', exaggeration: 1.5},
                    sources: {
                        'mapbox-dem': {
                            type: 'raster-dem',
                            tiles: ['http://example.com/{z}/{x}/{y}.png'],
                            tileSize: 256,
                            maxzoom: 14
                        }
                    },
                })
            }],
        }));

        style.on('style.load', () => {
            style.setTerrain(null);
            t.deepEqual(style.getTerrain(), null);
            t.end();
        });
    });

    t.test('setState correctly overrides terrain in the root style', async (t) => {
        const map = new StubMap();
        const style = new Style(map);
        style.setEventedParent(map, {style});

        const importWithTerrain = {
            id: 'basemap',
            url: '/standard.json',
            data: createStyleJSON({
                terrain: {source: 'mapbox-dem', exaggeration: 1.5},
                sources: {
                    'mapbox-dem': {
                        type: 'raster-dem',
                        tiles: ['http://example.com/{z}/{x}/{y}.png'],
                        tileSize: 256,
                        maxzoom: 14
                    }
                },
            })
        };

        const rootWithTerrain = createStyleJSON({
            terrain: {source: 'mapbox-dem', exaggeration: 2},
            sources: {
                'mapbox-dem': {
                    type: 'raster-dem',
                    tiles: ['http://example.com/{z}/{x}/{y}.png'],
                    tileSize: 256,
                    maxzoom: 14
                }
            },
            imports: [importWithTerrain],
        });

        const rootWithoutTerrain = createStyleJSON({
            imports: [importWithTerrain],
        });

        // Using terrain from the root style
        style.loadJSON(rootWithTerrain);
        await new Promise((resolve) => map.on('style.load', resolve));
        t.equal(style.terrain.scope, style.scope);
        t.deepEqual(style.getTerrain(), {source: 'mapbox-dem', exaggeration: 2});

        // Using terrain from the imported style
        style.setState(rootWithoutTerrain);
        t.equal(style.terrain.scope, style.getFragmentStyle('basemap').scope);
        t.deepEqual(style.getTerrain(), {source: 'mapbox-dem', exaggeration: 1.5});

        // Using terrain from the root style again
        style.setState(rootWithTerrain);
        t.equal(style.terrain.scope, style.scope);
        t.deepEqual(style.getTerrain(), {source: 'mapbox-dem', exaggeration: 2});

        t.end();
    });

    t.test('empty terrain in import does not override terrain in root style', (t) => {
        const style = new Style(new StubMap());

        style.loadJSON(createStyleJSON({
            terrain: {source: 'mapbox-dem', exaggeration: 1.5},
            sources: {
                'mapbox-dem': {
                    type: 'raster-dem',
                    tiles: ['http://example.com/{z}/{x}/{y}.png'],
                    tileSize: 256,
                    maxzoom: 14
                }
            },
            imports: [{
                id: 'streets',
                url: '/styles/streets-v12.json',
                data: createStyleJSON({terrain: undefined})
            }],
        }));

        style.on('style.load', () => {
            t.deepEqual(style.getTerrain(), {source: 'mapbox-dem', exaggeration: 1.5});
            t.end();
        });
    });

    t.test('multiple imports should not reset the style changed state when terrain and 3d layers are present', (t) => {
        const map = new StubMap();
        const style = new Style(map);

        const initialStyle = createStyleJSON({
            imports: [
                {id: 'basemap', url: '/standard.json'},
                {id: 'navigation', url: '/navigation.json'}
            ],
        });

        const standardFragment = createStyleJSON({
            terrain: {source: 'mapbox-dem', exaggeration: 1.5},
            sources: {
                composite: {type: 'vector', tiles: []},
                'mapbox-dem': {
                    type: 'raster-dem',
                    tiles: ['http://example.com/{z}/{x}/{y}.png'],
                    tileSize: 256,
                    maxzoom: 14
                }
            },
            layers: [
                {id: 'land', type: 'background'},
                {id: '3d-building', type: 'fill-extrusion', source: 'composite', 'source-layer': 'building'}
            ]
        });

        const navigationFragment = createStyleJSON({
            sources: {composite: {type: 'vector', tiles: []}},
            layers: [{id: 'traffic', type: 'line', source: 'composite', 'source-layer': 'traffic'}]
        });

        map.on('style.import.load', () => {
            t.equals(style._changes.isDirty(), true, 'style must be dirty during import');
        });

        style.on('style.load', () => {
            t.equals(window.server.requests.length, 3);
            t.equals(style._changes.isDirty(), true, 'style must be dirty after load');
            t.end();
        });

        window.server.respondWith('/style.json', JSON.stringify(initialStyle));
        window.server.respondWith('/standard.json', JSON.stringify(standardFragment));
        window.server.respondWith('/navigation.json', JSON.stringify(navigationFragment));
        style.loadURL('/style.json');
    });

    t.test('supports config', (t) => {
        const style = new Style(new StubMap());

        const initialStyle = createStyleJSON({
            imports: [{
                id: 'standard',
                url: '/standard.json',
                config: {showTerrain: true},
                data: createStyleJSON({
                    terrain: {source: 'mapbox-dem', exaggeration: ['case', ['config', 'showTerrain'], 2, 0]},
                    sources: {
                        'mapbox-dem': {
                            type: 'raster-dem',
                            tiles: ['http://example.com/{z}/{x}/{y}.png']
                        }
                    },
                })
            }]
        });

        style.on('style.load', () => {
            t.equal(style.terrain.getExaggeration(0), 2);

            style.setConfigProperty('standard', 'showTerrain', false);
            style.update({});

            t.equal(style.terrain.getExaggeration(0), 0);
            t.end();
        });

        style.loadJSON(initialStyle);
    });

    t.end();
});

test('Style#getFog', (t) => {
    t.test('resolves fog from import', (t) => {
        const style = new Style(new StubMap());

        style.loadJSON(createStyleJSON({
            imports: [{
                id: 'streets',
                url: '/styles/streets-v12.json',
                data: createStyleJSON({fog: {range: [1, 2], color: 'white', 'horizon-blend': 0}})
            }],
        }));

        style.on('style.load', () => {
            const fog = style.getFog();
            t.ok(fog);
            t.equal(fog.color, 'white');
            t.deepEqual(fog.range, [1, 2]);
            t.equal(fog['horizon-blend'], 0);
            t.end();
        });
    });

    t.test('root style overrides fog in imports', (t) => {
        const style = new Style(new StubMap());

        style.loadJSON(createStyleJSON({
            imports: [{
                id: 'first',
                url: '/styles/streets-v12.json',
                data: createStyleJSON({
                    fog: {range: [1, 2], color: 'white', 'horizon-blend': 0},
                    imports: [{
                        id: 'second',
                        url: '/styles/streets-v12.json',
                        data: createStyleJSON({fog: {range: [0, 1], color: 'blue', 'horizon-blend': 0.5}})
                    }]
                })
            }],
        }));

        style.on('style.load', () => {
            const fog = style.getFog();
            t.ok(fog);
            t.equal(fog.color, 'white');
            t.deepEqual(fog.range, [1, 2]);
            t.equal(fog['horizon-blend'], 0);
            t.end();
        });
    });

    t.test('empty fog in import does not override fog in root style', (t) => {
        const style = new Style(new StubMap());

        style.loadJSON(createStyleJSON({
            fog: {range: [1, 2], color: 'white', 'horizon-blend': 0},
            imports: [{
                id: 'streets',
                url: '/styles/streets-v12.json',
                data: createStyleJSON({fog: undefined})
            }],
        }));

        style.on('style.load', () => {
            const fog = style.getFog();
            t.ok(fog);
            t.equal(fog.color, 'white');
            t.deepEqual(fog.range, [1, 2]);
            t.equal(fog['horizon-blend'], 0);
            t.end();
        });
    });

    t.end();
});

test('Camera', (t) => {
    t.test('resolves camera from import', (t) => {
        const map = new StubMap();
        const style = new Style(map);

        style.loadJSON(createStyleJSON({
            imports: [{
                id: 'streets',
                url: '/styles/streets-v12.json',
                data: createStyleJSON({camera: {'camera-projection': 'orthographic'}})
            }],
        }));

        style.on('style.load', () => {
            t.deepEqual(style.camera, {'camera-projection': 'orthographic'});
            t.end();
        });
    });

    t.test('sequential imports dont override orthographic camera with perspective', (t) => {
        const map = new StubMap();
        const style = new Style(map);

        style.loadJSON(createStyleJSON({
            imports: [
                {
                    id: 'basemap',
                    url: '/standard.json',
                    data: createStyleJSON({camera: {'camera-projection': 'orthographic'}})
                },
                {
                    id: 'navigation',
                    url: '/navigation.json',
                    data: createStyleJSON()
                }
            ],
        }));

        const spy = t.spy(map, '_triggerCameraUpdate');

        style.on('style.load', () => {
            t.deepEqual(style.camera, {'camera-projection': 'orthographic'});
            t.deepEqual(spy.lastCall.firstArg, {'camera-projection': 'orthographic'});
            t.end();
        });
    });

    t.test('root style overrides camera in imports', (t) => {
        const style = new Style(new StubMap());

        style.loadJSON(createStyleJSON({
            imports: [{
                id: 'first',
                url: '/styles/streets-v12.json',
                data: createStyleJSON({
                    camera: {'camera-projection': 'perspective'},
                    imports: [{
                        id: 'second',
                        url: '/styles/streets-v12.json',
                        data: createStyleJSON({camera: {'camera-projection': 'orthographic'}})
                    }]
                })
            }],
        }));

        style.on('style.load', () => {
            t.deepEqual(style.camera, {'camera-projection': 'perspective'});
            t.end();
        });
    });

    t.test('camera set by user overrides camera in imports', (t) => {
        const style = new Style(new StubMap());

        style.loadJSON(createStyleJSON({
            camera: {'camera-projection': 'perspective'},
            imports: [{
                id: 'first',
                url: '/styles/streets-v12.json',
                data: createStyleJSON()
            }],
        }));

        style.on('style.load', () => {
            style.setCamera({'camera-projection': 'orthographic'});
            t.deepEqual(style.camera, {'camera-projection': 'orthographic'});
            t.end();
        });
    });

    t.test('empty camera in import does not override camera in root style', (t) => {
        const style = new Style(new StubMap());

        style.loadJSON(createStyleJSON({
            camera: {'camera-projection': 'orthographic'},
            imports: [{
                id: 'streets',
                url: '/styles/streets-v12.json',
                data: createStyleJSON()
            }],
        }));

        style.on('style.load', () => {
            t.deepEqual(style.camera, {'camera-projection': 'orthographic'});
            t.end();
        });
    });

    t.end();
});

test('Projection', (t) => {
    t.test('resolves projection from import', (t) => {
        const map = new StubMap();
        const style = new Style(map);

        style.loadJSON(createStyleJSON({
            imports: [{
                id: 'streets',
                url: '/styles/streets-v12.json',
                data: createStyleJSON({projection: {name: 'globe'}})
            }],
        }));

        const spy = t.spy(map, '_prioritizeAndUpdateProjection');

        style.on('style.load', () => {
            t.deepEqual(style.projection, {name: 'globe'});
            t.deepEqual(spy.lastCall.args[1], {name: 'globe'});
            t.end();
        });
    });

    t.test('root style overrides projection in imports', (t) => {
        const map = new StubMap();
        const style = new Style(map);

        style.loadJSON(createStyleJSON({
            projection: {name: 'globe'},
            imports: [{
                id: 'streets',
                url: '/styles/streets-v12.json',
                data: createStyleJSON({projection: {name: 'albers'}})
            }],
        }));

        const spy = t.spy(map, '_prioritizeAndUpdateProjection');

        style.on('style.load', () => {
            t.deepEqual(style.projection, {name: 'globe'});
            t.deepEqual(spy.lastCall.args[1], {name: 'globe'});
            t.end();
        });
    });

    t.test('empty projection in import does not override projection in root style', (t) => {
        const map = new StubMap();
        const style = new Style(map);

        style.loadJSON(createStyleJSON({
            projection: {name: 'albers'},
            imports: [{
                id: 'streets',
                url: '/styles/streets-v12.json',
                data: createStyleJSON()
            }],
        }));

        const spy = t.spy(map, '_prioritizeAndUpdateProjection');

        style.on('style.load', () => {
            t.deepEqual(style.projection, {name: 'albers'});
            t.deepEqual(spy.lastCall.args[1], {name: 'albers'});
            t.end();
        });
    });

    t.end();
});

test('Transition', (t) => {
    t.test('resolves transition from import', (t) => {
        const style = new Style(new StubMap());

        style.on('style.load', () => {
            t.deepEqual(style.transition, {duration: 900, delay: 200}, 'Returns the fragment transition options');

            style.setTransition({duration: 0, delay: 0});
            t.deepEqual(style.transition, {duration: 0, delay: 0}, 'Returns the user-defined transition options');

            t.end();
        });

        style.loadJSON(createStyleJSON({
            imports: [{id: 'standard', url: '/standard.json', data: createStyleJSON({
                transition: {duration: 900, delay: 200},
            })}]
        }));
    });

    t.test('root style overrides transition in imports', (t) => {
        const style = new Style(new StubMap());

        style.on('style.load', () => {
            t.deepEqual(style.transition, {duration: 600, delay: 100}, 'Returns the root transition options');
            t.end();
        });

        style.loadJSON(createStyleJSON({
            transition: {duration: 600, delay: 100},
            imports: [{id: 'standard', url: '/standard.json', data: createStyleJSON({
                transition: {duration: 900, delay: 200},
            })}]
        }));
    });

    t.end();
});

test('Glyphs', (t) => {
    t.test('fallbacks to the default glyphs URL', (t) => {
        const style = new Style(new StubMap());

        style.loadJSON(createStyleJSON({
            fragment: true,
        }));

        style.on('style.load', () => {
            t.stub(GlyphManager, 'loadGlyphRange').callsFake((stack, range, urlTemplate) => {
                t.equal(urlTemplate, 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf');
                t.equal(style.serialize().glyphs, undefined);
                t.end();
            });

            style.glyphManager.getGlyphs({'Arial Unicode MS': [55]}, '');
        });
    });

    t.end();
});

test('Style#queryRenderedFeatures', (t) => {
    const style = new Style(new StubMap());
    const transform = new Transform();
    transform.resize(512, 512);

    function tilesInStub() {
        return [{
            queryGeometry: {},
            tilespaceGeometry: {},
            bufferedTilespaceGeometry: {},
            bufferedTilespaceBounds: {},
            tileID: new OverscaledTileID(0, 0, 0, 0, 0),
            tile: {tileID: new OverscaledTileID(0, 0, 0, 0, 0), queryRenderedFeatures: () => ({
                land: [{
                    featureIndex: 0,
                    feature: {type: 'Feature', geometry: {type: 'Point'}}
                }]
            })},
        }];
    }

    const fragment = createStyleJSON({
        sources: {mapbox: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}},
        layers: [{id: 'land', type: 'line', source: 'mapbox'}],
    });

    const initialStyle = createStyleJSON({
        sources: {mapbox: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}},
        layers: [{id: 'land', type: 'line', source: 'mapbox'}],
        imports: [{id: 'streets', url: '/styles/streets-v12.json', data: fragment}]
    });

    style.loadJSON(initialStyle);

    style.on('style.load', () => {
        style.getOwnSourceCache('mapbox').tilesIn = tilesInStub;
        style.getOwnSourceCache('mapbox').transform = transform;
        style.getSourceCache(makeFQID('mapbox', 'streets')).tilesIn = tilesInStub;
        style.getSourceCache(makeFQID('mapbox', 'streets')).transform = transform;

        t.test('returns features only from the root style', (t) => {
            const results = style.queryRenderedFeatures([0, 0], {}, transform);
            t.equals(results.length, 1);
            t.end();
        });

        t.test('returns features only from the root style when including layers', (t) => {
            const results = style.queryRenderedFeatures([0, 0], {layers: ['land', makeFQID('land', 'streets')]}, transform);
            t.equals(results.length, 1);
            t.end();
        });

        t.end();
    });
});

test('Style#setFeatureState', (t) => {
    const style = new Style(new StubMap());

    const fragment = createStyleJSON({
        sources: {mapbox: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}},
    });

    const initialStyle = createStyleJSON({
        sources: {mapbox: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}},
        imports: [{id: 'streets', url: '/styles/streets-v12.json', data: fragment}]
    });

    style.loadJSON(initialStyle);

    const spy = t.spy();
    style.on('error', spy);

    style.on('style.load', () => {
        style.setFeatureState({source: makeFQID('mapbox', 'streets'), id: 12345}, {'hover': true});
        t.ok(spy.calledOnce);
        t.match(spy.firstCall.firstArg.error, /does not exist in the map's style/);
        t.end();
    });
});

test('Style#getFeatureState', (t) => {
    const style = new Style(new StubMap());

    const fragment = createStyleJSON({
        sources: {mapbox: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}},
    });

    const initialStyle = createStyleJSON({
        sources: {mapbox: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}},
        imports: [{id: 'streets', url: '/styles/streets-v12.json', data: fragment}]
    });

    style.loadJSON(initialStyle);

    const spy = t.spy();
    style.on('error', spy);

    style.on('style.load', () => {
        t.notOk(style.getFeatureState({source: makeFQID('mapbox', 'streets'), id: 12345}));
        t.ok(spy.calledOnce);
        t.match(spy.firstCall.firstArg.error, /does not exist in the map's style/);
        t.end();
    });
});

test('Style#removeFeatureState', (t) => {
    const style = new Style(new StubMap());

    const fragment = createStyleJSON({
        sources: {mapbox: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}},
    });

    const initialStyle = createStyleJSON({
        sources: {mapbox: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}},
        imports: [{id: 'streets', url: '/styles/streets-v12.json', data: fragment}]
    });

    style.loadJSON(initialStyle);

    const spy = t.spy();
    style.on('error', spy);

    style.on('style.load', () => {
        style.removeFeatureState({source: makeFQID('mapbox', 'streets'), id: 12345}, 'hover');
        t.ok(spy.calledOnce);
        t.match(spy.firstCall.firstArg.error, /does not exist in the map's style/);
        t.end();
    });
});

test('Style#setLayoutProperty', (t) => {
    const style = new Style(new StubMap());

    const fragment = createStyleJSON({
        sources: {mapbox: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}},
        layers: [{id: 'land', type: 'line', source: 'mapbox', layout: {visibility: 'visible'}}],
    });

    const initialStyle = createStyleJSON({
        imports: [{id: 'streets', url: '/styles/streets-v12.json', data: fragment}]
    });

    style.loadJSON(initialStyle);

    const spy = t.spy();
    style.on('error', spy);

    style.on('style.load', () => {
        style.setLayoutProperty(makeFQID('land', 'streets'), 'visibility', 'none');
        t.match(spy.firstCall.firstArg.error, /does not exist in the map's style/);

        t.notOk(style.getLayoutProperty(makeFQID('land', 'streets'), 'visibility'));
        t.match(spy.secondCall.firstArg.error, /does not exist in the map's style/);

        t.equal(style.getLayer(makeFQID('land', 'streets')).serialize().layout['visibility'], 'visible');
        t.ok(spy.calledTwice);
        t.end();
    });
});

test('Style#setPaintProperty', (t) => {
    const style = new Style(new StubMap());

    const fragment = createStyleJSON({
        sources: {mapbox: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}},
        layers: [{id: 'land', type: 'background', source: 'mapbox', paint: {'background-color': 'blue'}}],
    });

    const initialStyle = createStyleJSON({
        imports: [{id: 'streets', url: '/styles/streets-v12.json', data: fragment}]
    });

    style.loadJSON(initialStyle);

    const spy = t.spy();
    style.on('error', spy);

    style.on('style.load', () => {
        style.setPaintProperty(makeFQID('land', 'streets'), 'background-color', 'red');
        t.match(spy.firstCall.firstArg.error, /does not exist in the map's style/);

        t.notOk(style.getPaintProperty(makeFQID('land', 'streets'), 'background-color'));
        t.match(spy.secondCall.firstArg.error, /does not exist in the map's style/);

        t.equal(style.getLayer(makeFQID('land', 'streets')).serialize().paint['background-color'], 'blue');
        t.ok(spy.calledTwice);
        t.end();
    });
});

test('Style#setLayerZoomRange', (t) => {
    const style = new Style(new StubMap());

    const fragment = createStyleJSON({
        sources: {mapbox: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}},
        layers: [{id: 'symbol', type: 'symbol', source: 'mapbox', minzoom: 0, maxzoom: 22}],
    });

    const initialStyle = createStyleJSON({
        imports: [{id: 'streets', url: '/styles/streets-v12.json', data: fragment}]
    });

    style.loadJSON(initialStyle);

    const spy = t.spy();
    style.on('error', spy);

    style.on('style.load', () => {
        style.setLayerZoomRange(makeFQID('symbol', 'streets'), 5, 12);
        t.match(spy.firstCall.firstArg.error, /does not exist in the map's style/);

        t.equal(style.getLayer(makeFQID('symbol', 'streets')).minzoom, 0, 'set minzoom');
        t.equal(style.getLayer(makeFQID('symbol', 'streets')).maxzoom, 22, 'set maxzoom');
        t.end();
    });
});

test('Style#setFilter', (t) => {
    const style = new Style(new StubMap());

    const fragment = createStyleJSON({
        sources: {mapbox: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}},
        layers: [{id: 'symbol', type: 'symbol', source: 'mapbox', filter: ['==', 'id', 0]}],
    });

    const initialStyle = createStyleJSON({
        imports: [{id: 'streets', url: '/styles/streets-v12.json', data: fragment}]
    });

    style.loadJSON(initialStyle);

    const spy = t.spy();
    style.on('error', spy);

    style.on('style.load', () => {
        style.setFilter(makeFQID('symbol', 'streets'), ['==', 'id', 1]);
        t.match(spy.firstCall.firstArg.error, /does not exist in the map's style/);

        t.notOk(style.getFilter(makeFQID('symbol', 'streets')));
        t.match(spy.secondCall.firstArg.error, /does not exist in the map's style/);

        t.deepEqual(style.getLayer(makeFQID('symbol', 'streets')).filter, ['==', 'id', 0]);
        t.end();
    });
});

test('Style#setGeoJSONSourceData', (t) => {
    const style = new Style(new StubMap());

    const fragment = createStyleJSON({
        sources: {mapbox: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}},
    });

    const initialStyle = createStyleJSON({
        imports: [{id: 'streets', url: '/styles/streets-v12.json', data: fragment}]
    });

    style.loadJSON(initialStyle);

    style.on('style.load', () => {
        t.throws(() =>
            style.setGeoJSONSourceData(makeFQID('mapbox', 'streets'), {type: 'FeatureCollection', features: []}),
            /There is no source with this ID/
        );

        t.end();
    });
});

test('Style#setConfigProperty', (t) => {
    t.test('Updates layers in scope', (t) => {
        const style = new Style(new StubMap());

        const initialStyle = createStyleJSON({
            imports: [{
                id: 'standard',
                url: '/standard.json',
                config: {showBackground: false},
                data: createStyleJSON({
                    layers: [{
                        id: 'background',
                        type: 'background',
                        layout: {visibility: ['case', ['config', 'showBackground'], 'visible', 'none']}}]
                })
            }]
        });

        style.on('style.load', () => {
            t.equal(style.getConfigProperty('standard', 'showBackground'), false);

            style.dispatcher.broadcast = function(key, value) {
                t.equal(key, 'updateLayers');
                t.equal(value.scope, 'standard');
                t.deepEqual(value.removedIds, []);
                t.deepEqual(value.options.get('showBackground').value, true);
                t.deepEqual(value.layers.map(layer => layer.id), ['background']);
                t.end();
            };

            style.setConfigProperty('standard', 'showBackground', true);
            t.equal(style.getConfigProperty('standard', 'showBackground'), true);
            style.update({});
        });

        style.loadJSON(initialStyle);
    });

    t.test('Reevaluates layer visibility', (t) => {
        const style = new Style(new StubMap());

        const initialStyle = createStyleJSON({
            imports: [{
                id: 'standard',
                url: '/standard.json',
                config: {showBackground: false},
                data: createStyleJSON({
                    layers: [{
                        id: 'background',
                        type: 'background',
                        layout: {visibility: ['case', ['config', 'showBackground'], 'visible', 'none']}}]
                })
            }]
        });

        style.on('style.load', () => {
            const layer = style.getLayer(makeFQID('background', 'standard'));
            t.equal(layer.getLayoutProperty('visibility'), 'none');

            style.setConfigProperty('standard', 'showBackground', true);
            t.equal(layer.getLayoutProperty('visibility'), 'visible');

            t.end();
        });

        style.loadJSON(initialStyle);
    });

    t.end();
});

test('Style#setState', (t) => {
    t.beforeEach(() => {
        window.useFakeXMLHttpRequest();
        window.server.configure({respondImmediately: true});
    });

    t.afterEach(() => {
        window.restore();
    });

    t.test('Adds fragment', async (t) => {
        const map = new StubMap();
        const style = new Style(map);
        style.setEventedParent(map, {style});

        const initialStyle = createStyleJSON();
        style.loadJSON(initialStyle);

        await new Promise((resolve) => map.on('style.load', resolve));

        const nextStyle = createStyleJSON({
            imports: [{id: 'a', url: '', data: createStyleJSON()}]
        });

        style.setState(nextStyle);
        await new Promise((resolve) => map.on('style.import.load', resolve));

        t.deepEqual(style.serialize(), nextStyle);

        t.end();
    });

    t.test('Adds fragment to the existing fragments', async (t) => {
        const map = new StubMap();
        const style = new Style(map);
        style.setEventedParent(map, {style});

        const initialStyle = createStyleJSON({
            imports: [{id: 'a', url: '', data: createStyleJSON()}]
        });

        style.loadJSON(initialStyle);
        await new Promise((resolve) => map.on('style.load', resolve));

        const nextStyle = createStyleJSON({
            imports: [{id: 'a', url: '', data: createStyleJSON()}, {id: 'b', url: '', data: createStyleJSON()}]
        });

        style.setState(nextStyle);
        await new Promise((resolve) => map.on('style.import.load', resolve));

        t.deepEqual(style.serialize(), nextStyle);

        t.end();
    });

    t.test('Adds fragment before another', async (t) => {
        const map = new StubMap();
        const style = new Style(map);
        style.setEventedParent(map, {style});

        const initialStyle = createStyleJSON({
            imports: [{id: 'b', url: '', data: createStyleJSON()}]
        });

        style.loadJSON(initialStyle);
        await new Promise((resolve) => map.on('style.load', resolve));

        const nextStyle = createStyleJSON({
            imports: [{id: 'a', url: '', data: createStyleJSON()}, {id: 'b', url: '', data: createStyleJSON()}]
        });

        style.setState(nextStyle);
        await new Promise((resolve) => map.on('style.import.load', resolve));

        t.deepEqual(style.serialize(), nextStyle);

        t.end();
    });

    t.test('Removes fragment', async (t) => {
        const style = new Style(new StubMap());

        const initialStyle = createStyleJSON({
            imports: [{id: 'a', url: '', data: createStyleJSON()}, {id: 'b', url: '', data: createStyleJSON()}]
        });

        style.loadJSON(initialStyle);
        await new Promise((resolve) => style.on('style.load', resolve));

        const nextStyle = createStyleJSON({
            imports: [{id: 'a', url: '', data: createStyleJSON()}]
        });

        style.setState(nextStyle);
        t.deepEqual(style.serialize(), nextStyle);

        t.end();
    });

    t.test('Removes 3D light independently', async (t) => {
        const style = new Style(new StubMap());

        const initialStyle = createStyleJSON({imports: [{id: 'basemap', url: '', data: createStyleJSON({
            lights: [
                {id: 'sun', type: 'directional', properties: {intensity: 0.5}},
                {id: 'environment', type: 'ambient', properties: {intensity: 0.5}}
            ]
        })}]});

        style.loadJSON(initialStyle);
        await new Promise((resolve) => style.on('style.load', resolve));

        t.ok(style.ambientLight);
        t.ok(style.directionalLight);

        const nextStyle = createStyleJSON({imports: [{id: 'basemap', url: '', data: createStyleJSON({
            lights: [
                {id: 'sun', type: 'directional', properties: {intensity: 0.5}},
            ]
        })}]});

        style.setState(nextStyle);
        t.deepEqual(style.serialize(), nextStyle);

        t.notOk(style.ambientLight);
        t.ok(style.directionalLight);

        t.end();
    });

    t.test('Removes all fragments', async (t) => {
        const style = new Style(new StubMap());

        const fragmentStyle = createStyleJSON({
            lights: [
                {id: 'sun', type: 'directional', properties: {intensity: 0.5}},
                {id: 'environment', type: 'ambient', properties: {intensity: 0.5}}
            ],
            fog: {range: [1, 2], color: 'white'},
            terrain: {source: 'mapbox-dem', exaggeration: 1.5},
            layers: [{id: 'land', type: 'background'}],
            sources: {'mapbox-dem': {type: 'raster-dem', tiles: ['http://example.com/{z}/{x}/{y}.png']}},
        });

        const initialStyle = createStyleJSON({imports: [{id: 'a', url: '', data: fragmentStyle}]});

        style.loadJSON(initialStyle);
        await new Promise((resolve) => style.on('style.load', resolve));

        const nextStyle = createStyleJSON({
            sources: {mapbox: {type: 'vector', tiles: []}},
            layers: [{id: 'land', type: 'background'}]
        });

        style.setState(nextStyle);
        t.deepEqual(style.serialize(), nextStyle);

        t.deepEqual(style.order, ['land']);
        t.deepEqual(style.getSources().map((s) => s.id), ['mapbox']);

        t.notOk(style.ambientLight);
        t.notOk(style.directionalLight);
        t.notOk(style.fog);
        t.notOk(style.terrain);

        t.end();
    });

    t.test('Moves fragment', async (t) => {
        const map = new StubMap();
        const style = new Style(map);
        style.setEventedParent(map, {style});

        const initialStyle = createStyleJSON({
            imports: [{id: 'a', url: '', data: createStyleJSON()}, {id: 'b', url: '', data: createStyleJSON()}]
        });

        style.loadJSON(initialStyle);
        await new Promise((resolve) => map.on('style.load', resolve));

        const nextStyle = createStyleJSON({
            imports: [{id: 'b', url: '', data: createStyleJSON()}, {id: 'a', url: '', data: createStyleJSON()}]
        });

        style.setState(nextStyle);
        await new Promise((resolve) => map.on('style.import.load', resolve));

        t.deepEqual(style.serialize(), nextStyle);

        t.end();
    });

    t.test('Updates fragment URL', (t) => {
        const map = new StubMap();
        const style = new Style(map);
        style.setEventedParent(map, {style});

        const data = createStyleJSON({layers: [{id: 'a', type: 'background'}]});
        window.server.respondWith('/style1.json', JSON.stringify(createStyleJSON()));
        window.server.respondWith('/style2.json', JSON.stringify(data));

        const initialStyle = createStyleJSON({
            imports: [{id: 'a', url: '/style1.json', config: {lightPreset: 'night'}}],
            layers: [{id: 'b', type: 'background', paint: {'background-color': 'red'}}]
        });

        const nextStyle = createStyleJSON({
            imports: [{id: 'a', url: '/style2.json', config: {lightPreset: 'night'}}],
            layers: [{id: 'b', type: 'background', paint: {'background-color': 'pink'}}]
        });

        map.on('style.load', () => {
            style.setState(nextStyle);

            t.deepEqual(style.serialize(), createStyleJSON({
                imports: [{id: 'a', url: '/style2.json', config: {lightPreset: 'night'}, data}],
                layers: [{id: 'b', type: 'background', paint: {'background-color': 'pink'}}]
            }));

            t.equal(style.getConfigProperty('a', 'lightPreset'), 'night');

            const updatedPaintProperties = style._changes.getUpdatedPaintProperties();
            t.equal(updatedPaintProperties.has('b'), true, 'Keeps previous changes intact');

            t.end();
        });

        style.loadJSON(initialStyle);
    });

    t.test('Updates fragment data', async (t) => {
        const style = new Style(new StubMap());

        const initialStyle = createStyleJSON({
            imports: [{id: 'a', url: '', data: createStyleJSON({layers: [{id: 'a', type: 'background'}]})}]
        });

        style.loadJSON(initialStyle);
        await new Promise((resolve) => style.on('style.load', resolve));

        const nextStyle = createStyleJSON({
            imports: [{id: 'a', url: '', data: createStyleJSON({layers: [{id: 'b', type: 'background'}]})}]
        });

        style.setState(nextStyle);
        t.deepEqual(style.serialize(), nextStyle);

        t.end();
    });

    t.test('Updates layer slot', async (t) => {
        const style = new Style(new StubMap());

        const initialStyle = createStyleJSON({
            imports: [{
                id: 'streets',
                url: '/style.json',
                data: createStyleJSON({
                    sources: {mapbox: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}},
                    layers: [
                        {id: 'land', type: 'background'},
                        {id: 'middle', type: 'slot'},
                        {id: 'water', type: 'background'},
                        {id: 'top', type: 'slot'},
                        {id: 'labels', type: 'symbol', source: 'mapbox'}
                    ]
                })
            }],
            layers: [{id: 'layer', type: 'background', slot: 'middle'}]
        });

        style.loadJSON(initialStyle);

        await new Promise((resolve) => style.on('style.load', resolve));

        t.deepEqual(style.order, [
            makeFQID('land', 'streets'),
            makeFQID('layer'),
            makeFQID('water', 'streets'),
            makeFQID('labels', 'streets'),
        ]);

        const nextStyle = createStyleJSON({
            imports: [{
                id: 'streets',
                url: '/style.json',
                data: createStyleJSON({
                    sources: {mapbox: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}},
                    layers: [
                        {id: 'land', type: 'background'},
                        {id: 'middle', type: 'slot'},
                        {id: 'water', type: 'background'},
                        {id: 'top', type: 'slot'},
                        {id: 'labels', type: 'symbol', source: 'mapbox'}
                    ]
                })
            }],
            layers: [{id: 'layer', type: 'background', slot: 'top'}]
        });

        style.setState(nextStyle);
        t.deepEqual(style.serialize(), nextStyle);

        t.deepEqual(style.order, [
            makeFQID('land', 'streets'),
            makeFQID('water', 'streets'),
            makeFQID('layer'),
            makeFQID('labels', 'streets'),
        ]);

        t.end();
    });

    t.end();
});

test('Style#serialize', (t) => {
    const style = new Style(new StubMap());

    const fragmentStyle = createStyleJSON({
        fog: {range: [1, 2], color: 'white', 'horizon-blend': 0},
        lights: [
            {id: 'sun', type: 'directional', properties: {intensity: 0.4}},
            {id: 'environment', type: 'ambient', properties: {intensity: 0.4}}
        ],
        camera: {'camera-projection': 'orthographic'},
        sources: {'mapbox-dem': {type: 'raster-dem', tiles: ['http://example.com/{z}/{x}/{y}.png']}},
        terrain: {source: 'mapbox-dem', exaggeration: 1.5},
        projection: {name: 'globe'},
        transition: {duration: 900, delay: 200}
    });

    const initialStyle = createStyleJSON({
        imports: [{id: 'basemap', url: '', data: fragmentStyle}]
    });

    style.on('style.load', () => {
        const serialized = style.serialize();

        t.notOk(serialized.fog);
        t.notOk(serialized.lights);
        t.notOk(serialized.camera);
        t.notOk(serialized.terrain);
        t.notOk(serialized.projection);
        t.notOk(serialized.transition);
        t.deepEqual(serialized.sources, {});

        t.end();
    });

    style.loadJSON(initialStyle);
});
