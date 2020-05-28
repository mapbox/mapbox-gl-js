
import {test} from '../../../util/test';
import {createMap} from '../../../util';
import ScaleControl from '../../../../src/ui/control/scale_control';

test('ScaleControl appears in bottom-left by default', (t) => {
    const map = createMap(t);
    map.addControl(new ScaleControl());

    t.equal(map.getContainer().querySelectorAll('.mapboxgl-ctrl-bottom-left .mapboxgl-ctrl-scale').length, 1);
    t.end();
});

test('ScaleControl appears in the position specified by the position option', (t) => {
    const map = createMap(t);
    map.addControl(new ScaleControl(), 'top-left');

    t.equal(map.getContainer().querySelectorAll('.mapboxgl-ctrl-top-left .mapboxgl-ctrl-scale').length, 1);
    t.end();
});

test('ScaleControl should change unit of distance after calling setUnit', (t) => {
    const map = createMap(t);
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

test('ScaleControl should respect the maxWidth regardless of the unit and actual scale', (t) => {
    const map = createMap(t);
    const maxWidth = 100;
    const scale = new ScaleControl({maxWidth, unit: 'nautical'});
    const selector = '.mapboxgl-ctrl-bottom-left .mapboxgl-ctrl-scale';
    map.addControl(scale);
    map.setZoom(12.5);

    const el = map.getContainer().querySelector(selector);
    t.ok(parseFloat(el.style.width, 10) <= maxWidth, 'ScaleControl respects maxWidth');
    t.end();
});
