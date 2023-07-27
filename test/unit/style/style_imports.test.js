import Style from '../../../src/style/style.js';
import Transform from '../../../src/geo/transform.js';
import StyleLayer from '../../../src/style/style_layer.js';
import VectorTileSource from '../../../src/source/vector_tile_source.js';
import {Event, Evented} from '../../../src/util/evented.js';
import {RequestManager} from '../../../src/util/mapbox.js';

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

            const {style: fragmentStyle} = style.imports[0];
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

            const {style: fragmentStyle} = style.imports[0];
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

            const {id: parentStyleId, style: parentStyle} = style.imports[0];
            t.equal(parentStyleId, expectedImport.id);
            t.deepEqual(parentStyle.stylesheet.layers, expectedImport.data.layers);
            t.deepEqual(parentStyle.stylesheet.sources, expectedImport.data.sources);

            for (let i = 0; i < parentStyle.imports.length; i++) {
                const {id: childStyleId, style: childStyle} = parentStyle.imports[i];
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
            t.equal(spy.callCount, 3);

            // initial root style 'data' event
            t.equal(spy.getCall(0).args[0].target, map);
            t.equal(spy.getCall(0).args[0].dataType, 'style');
            t.equal(spy.getCall(0).args[0].style.scope, '');

            // child style 'data' event
            t.equal(spy.getCall(1).args[0].target, map);
            t.equal(spy.getCall(1).args[0].dataType, 'style');
            t.equal(spy.getCall(1).args[0].style.scope, 'streets');

            // final root style 'data' event
            t.equal(spy.getCall(2).args[0].target, map);
            t.equal(spy.getCall(2).args[0].dataType, 'style');
            t.equal(spy.getCall(2).args[0].style.scope, '');

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

            const {style: fragmentStyle} = style.imports[0];
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

            const {style: fragmentStyle} = style.imports[0];
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
                nestedStyle = nestedStyle.imports[0].style;
                t.ok(nestedStyle);
            }

            t.ok(stub.calledOnce);
            t.equal(nestedStyle.imports.length, 0);
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
            t.equal(spy.callCount, 3);

            // initial root style 'data' event
            t.equal(spy.getCall(0).args[0].target, map);
            t.equal(spy.getCall(0).args[0].dataType, 'style');
            t.equal(spy.getCall(0).args[0].style.scope, '');

            // child style 'data' event
            t.equal(spy.getCall(1).args[0].target, map);
            t.equal(spy.getCall(1).args[0].dataType, 'style');
            t.equal(spy.getCall(1).args[0].style.scope, 'streets');

            // final root style 'data' event
            t.equal(spy.getCall(2).args[0].target, map);
            t.equal(spy.getCall(2).args[0].dataType, 'style');
            t.equal(spy.getCall(2).args[0].style.scope, '');

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
            imports: [{id: 'streets', url: '/style.json', data: createStyleJSON({
                sources: {mapbox: {type: 'vector', tiles: []}}
            })}],
        });

        style.on('style.load', () => {
            t.ok(style.getSource(makeFQID('mapbox', 'streets')) instanceof VectorTileSource);
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
            t.ok(style.getLayer(makeFQID('background', 'streets')) instanceof StyleLayer);
            t.ok(style.getSource(makeFQID('mapbox', 'streets')) instanceof VectorTileSource);

            t.ok(style.getOwnLayer('background') instanceof StyleLayer);
            t.ok(style.getOwnSource('mapbox') instanceof VectorTileSource);
            t.notOk(style.getOwnLayer(makeFQID('background', 'streets')) instanceof StyleLayer);
            t.notOk(style.getOwnSource(makeFQID('mapbox', 'streets')) instanceof VectorTileSource);

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
    t.test('same id in different scopes is intact', (t) => {
        const style = new Style(new StubMap());

        const initialStyle = createStyleJSON({
            sources: {mapbox: {type: 'vector', tiles: []}},
            imports: [{id: 'streets', url: '/style.json', data: createStyleJSON({
                sources: {mapbox: {type: 'vector', tiles: []}}
            })}],
        });

        style.on('style.load', () => {
            style.removeSource('mapbox');
            t.ok(style.getSource(makeFQID('mapbox', 'streets')) instanceof VectorTileSource);
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
            t.deepEqual(e.layer, {id: makeFQID('background', 'streets')});
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

            t.deepEqual(style._order, [
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
            t.match(error.error, /does not exist in the map\'s style and cannot be removed/);
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
                t.match(error.message, /does not exist in the map\'s style and cannot be moved/);
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
                        {id: 'water', type: 'background'}
                    ]
                })
            }],
            layers: [{id: 'national-park', type: 'background', slot: 'below-water'}]
        });

        style.on('style.load', () => {
            t.deepEqual(style.order, [
                makeFQID('land', 'streets'),
                makeFQID('national-park'),
                makeFQID('water', 'streets'),
            ]);

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
    t.test('resolves lights from import', (t) => {
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

    t.test('overrides lights in imports', (t) => {
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
                {id: 'sun', type: 'directional', properties: {intensity: 0.6}},
                {id: 'environment', type: 'ambient', properties: {intensity: 0.6}}
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

test('Style#getTerrain', (t) => {
    t.test('resolves terrain from import', (t) => {
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

    t.test('overrides terrain in imports', (t) => {
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
            t.deepEqual(style.getTerrain(), {source: 'mapbox-dem', exaggeration: 1.5});
            t.end();
        });
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

    t.test('overrides fog in imports', (t) => {
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
            t.equal(fog.color, 'blue');
            t.deepEqual(fog.range, [0, 1]);
            t.equal(fog['horizon-blend'], 0.5);
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
            t.deepEqual(style.stylesheet.camera, {'camera-projection': 'orthographic'});
            t.end();
        });
    });

    t.test('overrides camera in imports', (t) => {
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
            t.deepEqual(style.stylesheet.camera, {'camera-projection': 'orthographic'});
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
            t.deepEqual(style.stylesheet.camera, {'camera-projection': 'orthographic'});
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
            t.deepEqual(style.stylesheet.projection, {name: 'globe'});
            t.deepEqual(spy.lastCall.args[1], {name: 'globe'});
            t.end();
        });
    });

    t.test('overrides projection in imports', (t) => {
        const style = new Style(new StubMap());

        style.loadJSON(createStyleJSON({
            imports: [{
                id: 'first',
                url: '/styles/streets-v12.json',
                data: createStyleJSON({
                    projection: {name: 'globe'},
                    imports: [{
                        id: 'second',
                        url: '/styles/streets-v12.json',
                        data: createStyleJSON({projection: {name: 'albers'}})
                    }]
                })
            }],
        }));

        style.on('style.load', () => {
            t.deepEqual(style.stylesheet.projection, {name: 'albers'});
            t.end();
        });
    });

    t.test('empty projection in import does not override projection in root style', (t) => {
        const style = new Style(new StubMap());

        style.loadJSON(createStyleJSON({
            projection: {name: 'albers'},
            imports: [{
                id: 'streets',
                url: '/styles/streets-v12.json',
                data: createStyleJSON()
            }],
        }));

        style.on('style.load', () => {
            t.deepEqual(style.stylesheet.projection, {name: 'albers'});
            t.end();
        });
    });

    t.end();
});
