
import {test} from 'mapbox-gl-js-test';
import window from '../../../../src/util/window';
import Map from '../../../../src/ui/map';
import ScaleControl from '../../../../src/ui/control/scale_control';

function createMap() {
    const container = window.document.createElement('div');
    return new Map({
        container,
        style: {
            version: 8,
            sources: {},
            layers: []
        },
        hash: true
    });

}

test('ScaleControl appears in bottom-left by default', (t) => {
    const map = createMap();
    map.addControl(new ScaleControl());

    t.equal(map.getContainer().querySelectorAll('.mapboxgl-ctrl-bottom-left .mapboxgl-ctrl-scale').length, 1);
    t.end();
});

test('ScaleControl appears in the position specified by the position option', (t) => {
    const map = createMap();
    map.addControl(new ScaleControl(), 'top-left');

    t.equal(map.getContainer().querySelectorAll('.mapboxgl-ctrl-top-left .mapboxgl-ctrl-scale').length, 1);
    t.end();
});

test('ScaleControl should change unit of distance after calling setUnit', (t) => {
    const map = createMap();
    const scale = new ScaleControl();
    const selector = '.mapboxgl-ctrl-bottom-left .mapboxgl-ctrl-scale';
    map.addControl(scale);

    let contents = map.getContainer().querySelector(selector).innerHTML;
    t.match(contents, /km/);

    scale.setUnit('imperial');
    contents = map.getContainer().querySelector(selector).innerHTML;
    t.match(contents, /mi/);
    t.end();
});
