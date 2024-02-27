import {test, expect, createMap as globalCreateMap} from "../../../util/vitest.js";
import VectorTileSource from '../../../../src/source/vector_tile_source.js';

function createMap(logoPosition, logoRequired, deleteStyle) {
    const options = {
        style: {
            version: 8,
            sources: {
                'composite': createSource({
                    minzoom: 1,
                    maxzoom: 10,
                    attribution: "Mapbox",
                    tiles: [
                        "http://example.com/{z}/{x}/{y}.png"
                    ]
                }, logoRequired)
            },
            layers: []
        },
        logoPosition: logoPosition || undefined,
        deleteStyle: deleteStyle || undefined
    };

    if (deleteStyle) delete options.style;
    return globalCreateMap(options);
}

function createSource(options, logoRequired) {
    const source = new VectorTileSource('id', options, {send () {}});
    source.onAdd({
        _requestManager: {
            _skuToken: '1234567890123',
            canonicalizeTileset: tileJSON => tileJSON.tiles
        },
        transform: {angle: 0, pitch: 0, showCollisionBoxes: false},
        _getMapId: () => 1
    });
    source.on('error', (e) => {
        throw e.error;
    });
    const logoFlag = "mapbox_logo";
    source[logoFlag] = logoRequired === undefined ? true : logoRequired;
    return source;
}

test('LogoControl appears in bottom-left by default', () => {
    const map = createMap();
    map.on('load', () => {
        expect(map.getContainer().querySelectorAll(
            '.mapboxgl-ctrl-bottom-left .mapboxgl-ctrl-logo'
        ).length).toEqual(1);
    });
});

test('LogoControl appears in the position specified by the position option', () => {
    const map = createMap('top-left');
    map.on('load', () => {
        expect(map.getContainer().querySelectorAll(
            '.mapboxgl-ctrl-top-left .mapboxgl-ctrl-logo'
        ).length).toEqual(1);
    });
});

test('LogoControl is displayed when no style is supplied', () => {
    const map = createMap('bottom-left', false, true, true);
    expect(
        map.getContainer().querySelector('.mapboxgl-ctrl-bottom-left .mapboxgl-ctrl').style.display
    ).toEqual('block');
});

test('LogoControl is not displayed when the mapbox_logo property is false', () => {
    const map = createMap('top-left', false);
    map.on('load', () => {
        expect(
            map.getContainer().querySelectorAll('.mapboxgl-ctrl-top-left > .mapboxgl-ctrl')[0].style.display
        ).toEqual('none');
    });
});

test('LogoControl is not added more than once', () => {
    const map = createMap();
    const source = createSource({
        minzoom: 1,
        maxzoom: 10,
        attribution: "Mapbox",
        tiles: [
            "http://example.com/{z}/{x}/{y}.png"
        ]
    });
    map.on('load', () => {
        expect(map.getContainer().querySelectorAll('.mapboxgl-ctrl-logo').length).toEqual(1);
        map.addSource('source2', source);
        map.on('sourcedata', (e) => {
            if (e.isSourceLoaded && e.sourceId === 'source2' && e.sourceDataType === 'metadata') {
                expect(map.getContainer().querySelectorAll('.mapboxgl-ctrl-logo').length).toEqual(1);
            }
        });
    });
});

test('LogoControl appears in compact mode if container is less then 250 pixel wide', () => {
    const map = createMap();
    const container = map.getContainer();

    Object.defineProperty(map.getContainer(), 'getBoundingClientRect', {value: () => ({height: 200, width: 255})});
    Object.defineProperty(map.getCanvasContainer(), 'offsetWidth', {value: 255, configurable: true});
    map.resize();

    expect(
        container.querySelectorAll('.mapboxgl-ctrl-logo:not(.mapboxgl-compact)').length
    ).toEqual(1);

    Object.defineProperty(map.getContainer(), 'getBoundingClientRect', {value: () => ({height: 200, width: 245})});
    Object.defineProperty(map.getCanvasContainer(), 'offsetWidth', {value: 245, configurable: true});
    map.resize();

    expect(container.querySelectorAll('.mapboxgl-ctrl-logo.mapboxgl-compact').length).toEqual(1);
});

test('LogoControl has `rel` nooper and nofollow', () => {
    const map = createMap();

    map.on('load', () => {
        const container = map.getContainer();
        const logo = container.querySelector('.mapboxgl-ctrl-logo');

        expect(logo.rel).toEqual('noopener nofollow');
    });
});
