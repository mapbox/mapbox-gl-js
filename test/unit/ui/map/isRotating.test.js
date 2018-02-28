import { test } from 'mapbox-gl-js-test';
import window from '../../../../src/util/window';
import Map from '../../../../src/ui/map';
import DOM from '../../../../src/util/dom';
import simulate from 'mapbox-gl-js-test/simulate_interaction';

function createMap() {
    return new Map({ container: DOM.create('div', '', window.document.body) });
}

test('Map#isRotating returns false by default', (t) => {
    const map = createMap();
    t.equal(map.isRotating(), false);
    map.remove();
    t.end();
});

test('Map#isRotating returns true during a camera rotate animation', (t) => {
    const map = createMap();

    map.on('rotatestart', () => {
        t.equal(map.isRotating(), true);
    });

    map.on('rotateend', () => {
        t.equal(map.isRotating(), false);
        map.remove();
        t.end();
    });

    map.rotateTo(5, { duration: 0 });
});

test('Map#isRotating returns true when drag rotating', (t) => {
    const map = createMap();

    map.on('rotatestart', () => {
        t.equal(map.isRotating(), true);
    });

    map.on('rotateend', () => {
        t.equal(map.isRotating(), false);
        map.remove();
        t.end();
    });

    simulate.mousedown(map.getCanvas(), {buttons: 2, button: 2});
    map._updateCamera();

    simulate.mousemove(map.getCanvas(), {buttons: 2});
    map._updateCamera();

    simulate.mouseup(map.getCanvas(),   {buttons: 0, button: 2});
    map._updateCamera();
});
