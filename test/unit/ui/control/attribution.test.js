import {test, expect, waitFor, createMap as globalCreateMap} from "../../../util/vitest.js";
import config from '../../../../src/util/config.js';
import AttributionControl from '../../../../src/ui/control/attribution_control.js';
import simulate from '../../../util/simulate_interaction.js';

function createMap() {
    return globalCreateMap({
        attributionControl: false,
        accessToken: 'pk.123',
        style: {
            version: 8,
            sources: {},
            layers: [],
            owner: 'mapbox',
            id: 'streets-v10',
        }
    });
}

test('AttributionControl appears in bottom-right by default', () => {
    const map = createMap();
    map.addControl(new AttributionControl());

    expect(
        map.getContainer().querySelectorAll('.mapboxgl-ctrl-bottom-right .mapboxgl-ctrl-attrib').length
    ).toEqual(1);
});

test('AttributionControl appears in the position specified by the position option', () => {
    const map = createMap();
    map.addControl(new AttributionControl(), 'top-left');

    expect(
        map.getContainer().querySelectorAll('.mapboxgl-ctrl-top-left .mapboxgl-ctrl-attrib').length
    ).toEqual(1);
});

test('AttributionControl appears in compact mode if compact option is used', () => {
    const map = createMap();
    Object.defineProperty(map.getContainer(), 'getBoundingClientRect', {value: () => ({height: 200, width: 700})});
    Object.defineProperty(map.getCanvasContainer(), 'offsetWidth', {value: 700, configurable: true});

    let attributionControl = new AttributionControl({
        compact: true
    });
    map.addControl(attributionControl);

    const container = map.getContainer();

    expect(
        container.querySelectorAll('.mapboxgl-ctrl-attrib.mapboxgl-compact').length
    ).toEqual(1);
    map.removeControl(attributionControl);

    Object.defineProperty(map.getContainer(), 'getBoundingClientRect', {value: () => ({height: 200, width: 600})});
    Object.defineProperty(map.getCanvasContainer(), 'offsetWidth', {value: 600, configurable: true});
    attributionControl = new AttributionControl({
        compact: false
    });

    map.addControl(attributionControl);
    expect(
        container.querySelectorAll('.mapboxgl-ctrl-attrib:not(.mapboxgl-compact)').length
    ).toEqual(1);
});

test('AttributionControl appears in compact mode if container is less then 640 pixel wide', () => {
    const map = createMap();
    Object.defineProperty(map.getContainer(), 'getBoundingClientRect', {value: () => ({height: 200, width: 700})});
    Object.defineProperty(map.getCanvasContainer(), 'offsetWidth', {value: 700, configurable: true});
    map.addControl(new AttributionControl());

    const container = map.getContainer();

    expect(
        container.querySelectorAll('.mapboxgl-ctrl-attrib:not(.mapboxgl-compact)').length
    ).toEqual(1);

    Object.defineProperty(map.getContainer(), 'getBoundingClientRect', {value: () => ({height: 200, width: 600})});
    Object.defineProperty(map.getCanvasContainer(), 'offsetWidth', {value: 600, configurable: true});
    map.resize();

    expect(
        container.querySelectorAll('.mapboxgl-ctrl-attrib.mapboxgl-compact').length
    ).toEqual(1);
});

test('AttributionControl compact mode control toggles attribution', () => {
    const map = createMap();
    map.addControl(new AttributionControl({
        compact: true
    }));

    const container = map.getContainer();
    const toggle = container.querySelector('.mapboxgl-ctrl-attrib-button');

    expect(container.querySelectorAll('.mapboxgl-compact-show').length).toEqual(0);

    simulate.click(toggle);

    expect(container.querySelectorAll('.mapboxgl-compact-show').length).toEqual(1);

    simulate.click(toggle);

    expect(container.querySelectorAll('.mapboxgl-compact-show').length).toEqual(0);
});

test('AttributionControl dedupes attributions that are substrings of others', async () => {
    const map = createMap();
    const attribution = new AttributionControl();
    map.addControl(attribution);

    await waitFor(map, 'load');

    map.addSource('1', {type: 'geojson', data: {type: 'FeatureCollection', features: []}, attribution: 'World'});
    map.addSource('2', {type: 'geojson', data: {type: 'FeatureCollection', features: []}, attribution: 'Hello World'});
    map.addSource('3', {type: 'geojson', data: {type: 'FeatureCollection', features: []}, attribution: 'Another Source'});
    map.addSource('4', {type: 'geojson', data: {type: 'FeatureCollection', features: []}, attribution: 'Hello'});
    map.addSource('5', {type: 'geojson', data: {type: 'FeatureCollection', features: []}, attribution: 'Hello World'});
    map.addSource('6', {type: 'geojson', data: {type: 'FeatureCollection', features: []}, attribution: 'Hello World'});
    map.addSource('7', {type: 'geojson', data: {type: 'FeatureCollection', features: []}, attribution: 'GeoJSON Source'});
    map.addLayer({id: '1', type: 'fill', source: '1'});
    map.addLayer({id: '2', type: 'fill', source: '2'});
    map.addLayer({id: '3', type: 'fill', source: '3'});
    map.addLayer({id: '4', type: 'fill', source: '4'});
    map.addLayer({id: '5', type: 'fill', source: '5'});
    map.addLayer({id: '6', type: 'fill', source: '6'});
    map.addLayer({id: '7', type: 'fill', source: '7'});

    let times = 0;

    const e = await waitFor(map, 'data');
    if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
        if (++times === 7) {
            expect(attribution._innerContainer.innerHTML).toEqual('Hello World | Another Source | GeoJSON Source');
        }
    }
});

test('AttributionControl has the correct edit map link', async () => {
    config.FEEDBACK_URL = "https://feedback.com";
    const map = createMap();
    const attribution = new AttributionControl();
    map.addControl(attribution);

    await waitFor(map, 'load');

    await new Promise(resolve => {
        map.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
                expect(attribution._editLink.rel).toEqual('noopener nofollow');
                expect(attribution._editLink.href).toEqual(
                    'https://feedback.com/?owner=mapbox&id=streets-v10&access_token=pk.123#/0/0/0'
                );
                map.setZoom(2);
                expect(attribution._editLink.href).toEqual(
                    'https://feedback.com/?owner=mapbox&id=streets-v10&access_token=pk.123#/0/0/2'
                );
                resolve();
            }
        });
        map.addSource('1', {type: 'geojson', data: {type: 'FeatureCollection', features: []}, attribution: '<a class="mapbox-improve-map" href="https://feedback.com" target="_blank">Improve this map</a>'});
        map.addLayer({id: '1', type: 'fill', source: '1'});
    });
});

test.skip('AttributionControl is hidden if empty', async () => {
    const map = createMap();
    const attribution = new AttributionControl();

    await new Promise((resolve) => {
        map.addControl(attribution);
        map.on('load', () => {
            map.addSource('1', {type: 'geojson', data: {type: 'FeatureCollection', features: []}});
            map.addLayer({id: '1', type: 'fill', source: '1'});
        });

        const container = map.getContainer();

        const checkEmptyFirst = () => {
            expect(attribution._innerContainer.innerHTML).toEqual('');
            expect(container.querySelectorAll('.mapboxgl-attrib-empty').length).toEqual(1);

            map.addSource('2', {type: 'geojson', data: {type: 'FeatureCollection', features: []}, attribution: 'Hello World'});
            map.addLayer({id: '2', type: 'fill', source: '2'});
        };

        const checkNotEmptyLater = () => {
            expect(attribution._innerContainer.innerHTML).toEqual('Hello World');
            expect(container.querySelectorAll('.mapboxgl-attrib-empty').length).toEqual(0);
            resolve();
        };

        let times = 0;
        map.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
                times++;
                if (times === 1) {
                    checkEmptyFirst();
                } else if (times === 2) {
                    checkNotEmptyLater();
                }
            }
        });
    });
});

test('AttributionControl shows custom attribution if customAttribution option is provided', () => {
    const map = createMap();
    const attributionControl = new AttributionControl({
        customAttribution: 'Custom string'
    });
    map.addControl(attributionControl);

    expect(attributionControl._innerContainer.innerHTML).toEqual('Custom string');
});

test('AttributionControl shows custom attribution if customAttribution option is provided, control is removed and added back', () => {
    const map = createMap();
    const attributionControl = new AttributionControl({
        customAttribution: 'Custom string'
    });
    map.addControl(attributionControl);
    map.removeControl(attributionControl);
    map.addControl(attributionControl);

    expect(attributionControl._innerContainer.innerHTML).toEqual('Custom string');
});

test('AttributionControl in compact mode shows custom attribution if customAttribution option is provided', () => {
    const map = createMap();
    const attributionControl = new AttributionControl({
        customAttribution: 'Custom string',
        compact: true
    });
    map.addControl(attributionControl);

    expect(attributionControl._innerContainer.innerHTML).toEqual('Custom string');
});

test('AttributionControl shows all custom attributions if customAttribution array of strings is provided', () => {
    const map = createMap();
    const attributionControl = new AttributionControl({
        customAttribution: ['Some very long custom string', 'Custom string', 'Another custom string']
    });
    map.addControl(attributionControl);

    expect(attributionControl._innerContainer.innerHTML).toEqual('Some very long custom string | Custom string | Another custom string');
});

test.skip('AttributionControl hides attributions for sources that are not currently visible', async () => {
    const map = createMap();
    const attribution = new AttributionControl();

    await new Promise(resolve => {
        map.addControl(attribution);
        map.on('load', () => {
            map.addSource('1', {type: 'geojson', data: {type: 'FeatureCollection', features: []}, attribution: 'Used'});
            map.addSource('2', {type: 'geojson', data: {type: 'FeatureCollection', features: []}, attribution: 'Not used'});
            map.addSource('3', {type: 'geojson', data: {type: 'FeatureCollection', features: []}, attribution: 'Visibility none'});
            map.addLayer({id: '1', type: 'fill', source: '1'});
            map.addLayer({id: '3', type: 'fill', source: '3', layout: {visibility: 'none'}});
        });

        let times = 0;

        map.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
                if (++times === 3) {
                    expect(attribution._innerContainer.innerHTML).toEqual('Used');
                    resolve();
                }
            }
        });
    });
});

test('AttributionControl shows attribution from both root style and its imports', async () => {
    const map =  globalCreateMap({
        attributionControl: false,
        accessToken: 'pk.123',
        style: {
            version: 8,
            imports: [{
                id: 'streets',
                url: '',
                data: {
                    version: 8,
                    sources: {
                        '2': {type: 'geojson', data: {type: 'FeatureCollection', features: []}, attribution: 'Hello'}
                    },
                    layers: [
                        {id: '2', type: 'fill', source: '2'}
                    ]
                }
            }],
            sources: {
                '1': {type: 'geojson', data: {type: 'FeatureCollection', features: []}, attribution: 'World'}
            },
            layers: [
                {id: '1', type: 'fill', source: '1'}
            ],
            owner: 'mapbox',
            id: 'test'
        }
    });
    const attribution = new AttributionControl();
    map.addControl(attribution);

    await waitFor(map, 'load');

    expect(attribution._innerContainer.innerHTML).toEqual('Hello | World');
});

test('AttributionControl toggles attributions for sources whose visibility changes when zooming', async () => {
    const map = createMap();
    const attribution = new AttributionControl();
    map.addControl(attribution);

    await waitFor(map, 'load');

    map.addSource('1', {type: 'geojson', data: {type: 'FeatureCollection', features: []}, attribution: 'Used'});
    map.addLayer({id: '1', type: 'fill', source: '1', minzoom: 12});

    await new Promise(resolve => {
        map.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
                expect(attribution._innerContainer.innerHTML).toEqual('');
                map.setZoom(13);
            }
            if (e.dataType === 'source' && e.sourceDataType === 'visibility') {
                if (map.getZoom() === 13) {
                    expect(attribution._innerContainer.innerHTML).toEqual('Used');
                    resolve();
                }
            }
        });
    });
});
