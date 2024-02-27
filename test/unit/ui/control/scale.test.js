
import {test, expect, createMap} from "../../../util/vitest.js";
import ScaleControl from '../../../../src/ui/control/scale_control.js';

test('ScaleControl appears in bottom-left by default', () => {
    const map = createMap();
    map.addControl(new ScaleControl());
    map._domRenderTaskQueue.run();

    expect(
        map.getContainer().querySelectorAll('.mapboxgl-ctrl-bottom-left .mapboxgl-ctrl-scale').length
    ).toEqual(1);
});

test('ScaleControl appears in the position specified by the position option', () => {
    const map = createMap();
    map.addControl(new ScaleControl(), 'top-left');
    map._domRenderTaskQueue.run();

    expect(
        map.getContainer().querySelectorAll('.mapboxgl-ctrl-top-left .mapboxgl-ctrl-scale').length
    ).toEqual(1);
});

test('ScaleControl should change unit of distance after calling setUnit', () => {
    const map = createMap();
    const scale = new ScaleControl();
    const selector = '.mapboxgl-ctrl-bottom-left .mapboxgl-ctrl-scale';
    map.addControl(scale);
    map._domRenderTaskQueue.run();

    let contents = map.getContainer().querySelector(selector).innerHTML;
    expect(contents).toMatch(/km/);

    scale.setUnit('imperial');
    map._domRenderTaskQueue.run();
    contents = map.getContainer().querySelector(selector).innerHTML;
    expect(contents).toMatch(/mi/);
});

test('ScaleControl should change language after calling map.setLanguage', () => {
    const map = createMap();
    const scale = new ScaleControl();
    const selector = '.mapboxgl-ctrl-bottom-left .mapboxgl-ctrl-scale';
    map.addControl(scale);
    map._domRenderTaskQueue.run();

    let contents = map.getContainer().querySelector(selector).innerHTML;
    expect(contents).toMatch(/km/);

    map.setLanguage('ru');
    map._domRenderTaskQueue.run();
    contents = map.getContainer().querySelector(selector).innerHTML;
    expect(contents).toMatch(/км/);
});

test('ScaleControl should respect the maxWidth regardless of the unit and actual scale', () => {
    const map = createMap();
    const maxWidth = 100;
    const scale = new ScaleControl({maxWidth, unit: 'nautical'});
    const selector = '.mapboxgl-ctrl-bottom-left .mapboxgl-ctrl-scale';
    map.addControl(scale);
    map.setZoom(12.5);
    map._domRenderTaskQueue.run();

    const el = map.getContainer().querySelector(selector);
    expect(parseFloat(el.style.width, 10) <= maxWidth).toBeTruthy();
});

test('ScaleControl should support different projections', () => {
    const map = createMap({
        center: [-180, 0]
    });

    const scale = new ScaleControl();
    const selector = '.mapboxgl-ctrl-bottom-left .mapboxgl-ctrl-scale';
    map.addControl(scale);
    map.setZoom(12.5);

    map._domRenderTaskQueue.run();
    let contents = map.getContainer().querySelector(selector).innerHTML;
    expect(contents).not.toMatch(/NaN|undefined/);

    const projections = [
        'albers',
        'equalEarth',
        'equirectangular',
        'lambertConformalConic',
        'mercator',
        'globe',
        'naturalEarth',
        'winkelTripel',
    ];

    for (const projection of projections) {
        map.setProjection(projection);
        map._domRenderTaskQueue.run();
        contents = map.getContainer().querySelector(selector).innerHTML;
        expect(contents).not.toMatch(/NaN|undefined/);
    }
});

test('ScaleControl should work in legacy safari', () => {
    const realNumberFormat = Intl.NumberFormat;
    Intl.NumberFormat = function(arg, options) {
        if (options && options.style === 'unit') {
            throw new Error('not supported');
        }
        return realNumberFormat.call(Intl, arg, options);
    };
    try {
        const map = createMap();
        const scale = new ScaleControl();
        const selector = '.mapboxgl-ctrl-bottom-left .mapboxgl-ctrl-scale';
        map.addControl(scale);
        map._domRenderTaskQueue.run();

        const contents = map.getContainer().querySelector(selector).innerHTML;
        expect(contents).toMatch(/km/);
    } finally {
        Intl.NumberFormat = realNumberFormat;
    }
});
