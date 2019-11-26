import {test} from '../../../util/test';
import {createMap} from '../../../util';
import NavigationControl from '../../../../src/ui/control/navigation_control';

test('NavigationControl adds zoom in/out and compass controls to top right by default', (t) => {
    const map = createMap(t);
    map.addControl(new NavigationControl());

    t.equal(map.getContainer().querySelectorAll('.mapboxgl-ctrl-top-right .mapboxgl-ctrl-zoom-in').length, 1);
    t.equal(map.getContainer().querySelectorAll('.mapboxgl-ctrl-top-right .mapboxgl-ctrl-zoom-out').length, 1);
    t.equal(map.getContainer().querySelectorAll('.mapboxgl-ctrl-top-right .mapboxgl-ctrl-compass').length, 1);
    t.end();
});

test('NavigationControl controls appear in the position specified by the position option', (t) => {
    const map = createMap(t);
    map.addControl(new NavigationControl(), 'top-left');

    t.equal(map.getContainer().querySelectorAll('.mapboxgl-ctrl-top-left .mapboxgl-ctrl-zoom-in').length, 1);
    t.equal(map.getContainer().querySelectorAll('.mapboxgl-ctrl-top-left .mapboxgl-ctrl-zoom-out').length, 1);
    t.equal(map.getContainer().querySelectorAll('.mapboxgl-ctrl-top-left .mapboxgl-ctrl-compass').length, 1);
    t.end();
});

test('NavigationControl compass should rotate after calling setBearing', (t) => {
    const map = createMap(t);
    const navcon = new NavigationControl();
    const selector = '.mapboxgl-ctrl-top-right .mapboxgl-ctrl-compass';
    map.addControl(navcon);

    let contents = map.getContainer().querySelector(selector).innerHTML;
    t.match(contents, /rotate\(0deg\)/);

    map.setBearing(90);
    contents = map.getContainer().querySelector(selector).innerHTML;
    t.match(contents, /rotate\(-90deg\)/);
    t.end();
});
