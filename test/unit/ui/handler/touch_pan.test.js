import {test} from '../../../util/test.js';
import window from '../../../../src/util/window.js';
import Map from '../../../../src/ui/map.js';
import DOM from '../../../../src/util/dom.js';
import simulate from '../../../util/simulate_interaction.js';

function createMapWithCooperativeGestures(t) {
    t.stub(Map.prototype, '_detectMissingCSS');
    t.stub(Map.prototype, '_authenticate');
    return new Map({
        container: DOM.create('div', '', window.document.body),
        cooperativeGestures: true
    });
}

test('If cooperativeGestures option is set to true, a `.mapboxgl-touch-pan-blocker` element is added to map', (t) => {
    const map = createMapWithCooperativeGestures(t);

    t.equal(map.getContainer().querySelectorAll('.mapboxgl-touch-pan-blocker').length, 1);
    t.end();
});

test('If cooperativeGestures option is set to true, touch pan is prevented when one finger is used to pan', (t) => {
    const map = createMapWithCooperativeGestures(t);
    const target = map.getCanvas();

    const moveSpy = t.spy();
    map.on('move', moveSpy);

    simulate.touchstart(map.getCanvas(), {touches: [{target, identifier: 1, clientX: 0, clientY: -50}]});
    map._renderTaskQueue.run();

    simulate.touchmove(map.getCanvas(), {touches: [{target, identifier: 1, clientX: 0, clientY: -40}]});
    map._renderTaskQueue.run();

    t.equal(moveSpy.callCount, 0);
    t.end();
});

test('If cooperativeGestures option is set to true, touch pan is triggered when two fingers are used to pan', (t) => {
    const map = createMapWithCooperativeGestures(t);
    const target = map.getCanvas();

    const moveSpy = t.spy();
    map.on('move', moveSpy);

    simulate.touchstart(map.getCanvas(), {touches: [{target, identifier: 1, clientX: 0, clientY: -40}, {target, identifier: 2, clientX: 0, clientY: -30}]});
    map._renderTaskQueue.run();

    simulate.touchmove(map.getCanvas(), {touches: [{target, identifier: 1, clientX: 0, clientY: -50}, {target, identifier: 2, clientX: 0, clientY: -40}]});
    map._renderTaskQueue.run();

    t.equal(moveSpy.callCount, 1);
    t.end();
});

test('Disabling touch pan removes the `.mapboxgl-touch-pan-blocker` element', (t) => {
    const map = createMapWithCooperativeGestures(t);

    map.handlers._handlersById.touchPan.disable();

    t.equal(map.getContainer().querySelectorAll('.mapboxgl-touch-pan-blocker').length, 0);
    t.end();
});
