import {test, expect, vi, createMap as globalCreateMap} from "../../../util/vitest.js";
import Marker from '../../../../src/ui/marker.js';
import simulate, {constructTouch} from '../../../util/simulate_interaction.js';

function createMap(options = {}) {
    return globalCreateMap({
        ...options,
        interactive: true
    });
}

test('TouchZoomRotateHandler fires zoomstart, zoom, and zoomend events at appropriate times in response to a pinch-zoom gesture', () => {
    const map = createMap();
    const target = map.getCanvas();

    const zoomstart = vi.fn();
    const zoom      = vi.fn();
    const zoomend   = vi.fn();

    map.handlers._handlersById.tapZoom.disable();
    map.touchPitch.disable();
    map.on('zoomstart', zoomstart);
    map.on('zoom',      zoom);
    map.on('zoomend',   zoomend);

    simulate.touchstart(map.getCanvas(), {touches: [constructTouch(target, {target, identifier: 1, clientX: 0, clientY: -50}), constructTouch(target, {target, identifier: 2, clientX: 0, clientY: 50})]});
    map._renderTaskQueue.run();
    expect(zoomstart).not.toHaveBeenCalled();
    expect(zoom).not.toHaveBeenCalled();
    expect(zoomend).not.toHaveBeenCalled();

    simulate.touchmove(map.getCanvas(), {touches: [constructTouch(target, {target, identifier: 1, clientX: 0, clientY: -100}), constructTouch(target, {target, identifier: 2, clientX: 0, clientY: 100})]});
    map._renderTaskQueue.run();
    expect(zoomstart).toHaveBeenCalledTimes(1);
    expect(zoom).toHaveBeenCalledTimes(1);
    expect(zoomend).not.toHaveBeenCalled();

    simulate.touchmove(map.getCanvas(), {touches: [constructTouch(target, {target, identifier: 1, clientX: 0, clientY: -60}), constructTouch(target, {target, identifier: 2, clientX: 0, clientY: 60})]});
    map._renderTaskQueue.run();
    expect(zoomstart).toHaveBeenCalledTimes(1);
    expect(zoom).toHaveBeenCalledTimes(2);
    expect(zoomend).not.toHaveBeenCalled();

    simulate.touchend(map.getCanvas(), {touches: []});
    map._renderTaskQueue.run();

    // incremented because inertia starts a second zoom
    expect(zoomstart).toHaveBeenCalledTimes(2);
    map._renderTaskQueue.run();
    expect(zoom).toHaveBeenCalledTimes(3);
    expect(zoomend).toHaveBeenCalledTimes(1);

    map.remove();
});

test('TouchZoomRotateHandler fires rotatestart, rotate, and rotateend events at appropriate times in response to a pinch-rotate gesture', () => {
    const map = createMap();
    const target = map.getCanvas();

    const rotatestart = vi.fn();
    const rotate      = vi.fn();
    const rotateend   = vi.fn();

    map.on('rotatestart', rotatestart);
    map.on('rotate',      rotate);
    map.on('rotateend',   rotateend);

    simulate.touchstart(map.getCanvas(), {touches: [constructTouch(target, {target, identifier: 0, clientX: 0, clientY: -50}), constructTouch(target, {target, identifier: 1, clientX: 0, clientY: 50})]});
    map._renderTaskQueue.run();
    expect(rotatestart).not.toHaveBeenCalled();
    expect(rotate).not.toHaveBeenCalled();
    expect(rotateend).not.toHaveBeenCalled();

    simulate.touchmove(map.getCanvas(), {touches: [constructTouch(target, {target, identifier: 0, clientX: -50, clientY: 0}), constructTouch(target, {target, identifier: 1, clientX: 50, clientY: 0})]});
    map._renderTaskQueue.run();
    expect(rotatestart).toHaveBeenCalledTimes(1);
    expect(rotate).toHaveBeenCalledTimes(1);
    expect(rotateend).not.toHaveBeenCalled();

    simulate.touchmove(map.getCanvas(), {touches: [constructTouch(target, {target, identifier: 0, clientX: 0, clientY: -50}), constructTouch(target, {target, identifier: 1, clientX: 0, clientY: 50})]});
    map._renderTaskQueue.run();
    expect(rotatestart).toHaveBeenCalledTimes(1);
    expect(rotate).toHaveBeenCalledTimes(2);
    expect(rotateend).not.toHaveBeenCalled();

    simulate.touchend(map.getCanvas(), {touches: []});
    map._renderTaskQueue.run();
    expect(rotatestart).toHaveBeenCalledTimes(1);
    expect(rotate).toHaveBeenCalledTimes(2);
    expect(rotateend).toHaveBeenCalledTimes(1);

    map.remove();
});

test('TouchZoomRotateHandler does not begin a gesture if preventDefault is called on the touchstart event', () => {
    const map = createMap();
    const target = map.getCanvas();

    map.on('touchstart', e => e.preventDefault());

    const move = vi.fn();
    map.on('move', move);

    simulate.touchstart(map.getCanvas(), {touches: [constructTouch(target, {target, clientX: 0, clientY: 0}), constructTouch(target, {target, clientX: 5, clientY: 0})]});
    map._renderTaskQueue.run();

    simulate.touchmove(map.getCanvas(), {touches: [constructTouch(target, {target, clientX: 0, clientY: 0}), constructTouch(target, {target, clientX: 0, clientY: 5})]});
    map._renderTaskQueue.run();

    simulate.touchend(map.getCanvas(), {touches: []});
    map._renderTaskQueue.run();

    expect(move).not.toHaveBeenCalled();

    map.remove();
});

test('TouchZoomRotateHandler starts zoom immediately when rotation disabled', () => {
    const map = createMap();
    const target = map.getCanvas();
    map.touchZoomRotate.disableRotation();
    map.handlers._handlersById.tapZoom.disable();

    const zoomstart = vi.fn();
    const zoom      = vi.fn();
    const zoomend   = vi.fn();

    map.on('zoomstart', zoomstart);
    map.on('zoom',      zoom);
    map.on('zoomend',   zoomend);

    simulate.touchstart(map.getCanvas(), {touches: [constructTouch(target, {target, identifier: 0, clientX: 0, clientY: -5}), constructTouch(target, {target, identifier: 2, clientX: 0, clientY: 5})]});
    map._renderTaskQueue.run();
    expect(zoomstart).not.toHaveBeenCalled();
    expect(zoom).not.toHaveBeenCalled();
    expect(zoomend).not.toHaveBeenCalled();

    simulate.touchmove(map.getCanvas(), {touches: [constructTouch(target, {target, identifier: 0, clientX: 0, clientY: -5}), constructTouch(target, {target, identifier: 2, clientX: 0, clientY: 6})]});
    map._renderTaskQueue.run();
    expect(zoomstart).toHaveBeenCalledTimes(1);
    expect(zoom).toHaveBeenCalledTimes(1);
    expect(zoomend).not.toHaveBeenCalled();

    simulate.touchmove(map.getCanvas(), {touches: [constructTouch(target, {target, identifier: 0, clientX: 0, clientY: -5}), constructTouch(target, {target, identifier: 2, clientX: 0, clientY: 4})]});
    map._renderTaskQueue.run();
    expect(zoomstart).toHaveBeenCalledTimes(1);
    expect(zoom).toHaveBeenCalledTimes(2);
    expect(zoomend).not.toHaveBeenCalled();

    simulate.touchend(map.getCanvas(), {touches: []});
    map._renderTaskQueue.run();
    // incremented because inertia starts a second zoom
    expect(zoomstart).toHaveBeenCalledTimes(2);
    map._renderTaskQueue.run();
    expect(zoom).toHaveBeenCalledTimes(3);
    expect(zoomend).toHaveBeenCalledTimes(1);

    map.remove();
});

test('TouchZoomRotateHandler adds css class used for disabling default touch behavior in some browsers', () => {
    const map = createMap();

    const className = 'mapboxgl-touch-zoom-rotate';
    expect(map.getCanvasContainer().classList.contains(className)).toBeTruthy();
    map.touchZoomRotate.disable();
    expect(map.getCanvasContainer().classList.contains(className)).toBeFalsy();
    map.touchZoomRotate.enable();
    expect(map.getCanvasContainer().classList.contains(className)).toBeTruthy();
});

test('TouchZoomRotateHandler zooms when touching two markers on the same map', () => {
    const map = createMap();

    const marker1 = new Marker()
        .setLngLat([0, 0])
        .addTo(map);
    const marker2 = new Marker()
        .setLngLat([0, 0])
        .addTo(map);
    const target1 = marker1.getElement();
    const target2 = marker2.getElement();

    const zoomstart = vi.fn();
    const zoom      = vi.fn();
    const zoomend   = vi.fn();

    map.handlers._handlersById.tapZoom.disable();
    map.touchPitch.disable();
    map.on('zoomstart', zoomstart);
    map.on('zoom',      zoom);
    map.on('zoomend',   zoomend);

    const target = map.getCanvas();

    simulate.touchstart(target, {touches: [constructTouch(target1, {target: target1, identifier: 1, clientX: 0, clientY: -50})]});
    simulate.touchstart(target, {touches: [constructTouch(target1, {target: target1, identifier: 1, clientX: 0, clientY: -50}), constructTouch(target2, {target: target2, identifier: 2, clientX: 0, clientY: 50})]});
    map._renderTaskQueue.run();
    expect(zoomstart).not.toHaveBeenCalled();
    expect(zoom).not.toHaveBeenCalled();
    expect(zoomend).not.toHaveBeenCalled();

    simulate.touchmove(target, {touches: [constructTouch(target1, {target: target1, identifier: 1, clientX: 0, clientY: -100}), constructTouch(target2, {target: target2, identifier: 2, clientX: 0, clientY: 100})]});
    map._renderTaskQueue.run();
    expect(zoomstart).toHaveBeenCalledTimes(1);
    expect(zoom).toHaveBeenCalledTimes(1);
    expect(zoomend).not.toHaveBeenCalled();

    simulate.touchmove(target, {touches: [constructTouch(target1, {target: target1, identifier: 1, clientX: 0, clientY: -60}), constructTouch(target2, {target: target2, identifier: 2, clientX: 0, clientY: 60})]});
    map._renderTaskQueue.run();
    expect(zoomstart).toHaveBeenCalledTimes(1);
    expect(zoom).toHaveBeenCalledTimes(2);
    expect(zoomend).not.toHaveBeenCalled();

    simulate.touchend(target, {touches: []});
    map._renderTaskQueue.run();

    // incremented because inertia starts a second zoom
    expect(zoomstart).toHaveBeenCalledTimes(2);
    map._renderTaskQueue.run();
    expect(zoom).toHaveBeenCalledTimes(3);
    expect(zoomend).toHaveBeenCalledTimes(1);

    map.remove();
});

test('TouchZoomRotateHandler does not zoom when touching an element not on the map', () => {
    const map = createMap();

    const marker1 = new Marker()
        .setLngLat([0, 0])
        .addTo(map);
    const marker2 = new Marker()
        .setLngLat([0, 0]);

    const target1 = marker1.getElement(); // on map
    const target2 = marker2.getElement(); // not on map

    const zoomstart = vi.fn();
    const zoom      = vi.fn();
    const zoomend   = vi.fn();

    map.handlers._handlersById.tapZoom.disable();
    map.touchPitch.disable();
    map.dragPan.disable();
    map.on('zoomstart', zoomstart);
    map.on('zoom',      zoom);
    map.on('zoomend',   zoomend);

    simulate.touchstart(map.getCanvas(), {touches: [constructTouch(target1, {target: target1, identifier: 1, clientX: 0, clientY: -50})]});
    simulate.touchstart(map.getCanvas(), {touches: [constructTouch(target1, {target: target1, identifier: 1, clientX: 0, clientY: -50}), constructTouch(target2, {target: target2, identifier: 2, clientX: 0, clientY: 50})]});
    map._renderTaskQueue.run();
    expect(zoomstart).not.toHaveBeenCalled();
    expect(zoom).not.toHaveBeenCalled();
    expect(zoomend).not.toHaveBeenCalled();

    simulate.touchmove(map.getCanvas(), {touches: [constructTouch(target1, {target: target1, identifier: 1, clientX: 0, clientY: -100}), constructTouch(target2, {target: target2, identifier: 2, clientX: 0, clientY: 100})]});
    map._renderTaskQueue.run();
    expect(zoomstart).not.toHaveBeenCalled();
    expect(zoom).not.toHaveBeenCalled();
    expect(zoomend).not.toHaveBeenCalled();

    simulate.touchmove(map.getCanvas(), {touches: [constructTouch(target1, {target: target1, identifier: 1, clientX: 0, clientY: -60}), constructTouch(target2, {target: target2, identifier: 2, clientX: 0, clientY: 60})]});
    map._renderTaskQueue.run();
    expect(zoomstart).not.toHaveBeenCalled();
    expect(zoom).not.toHaveBeenCalled();
    expect(zoomend).not.toHaveBeenCalled();

    simulate.touchend(map.getCanvas(), {touches: []});
    map._renderTaskQueue.run();

    // incremented because inertia starts a second zoom
    expect(zoomstart).not.toHaveBeenCalled();
    map._renderTaskQueue.run();
    expect(zoom).not.toHaveBeenCalled();
    expect(zoomend).not.toHaveBeenCalled();

    map.remove();
});

test('Drag up with two fingers fires pitch event', () => {
    const map = createMap();
    const target = map.getCanvas();

    const pitchstart = vi.fn();
    const pitch      = vi.fn();
    const pitchend   = vi.fn();

    map.on('pitchstart', pitchstart);
    map.on('pitch',      pitch);
    map.on('pitchend',   pitchend);

    simulate.touchstart(map.getCanvas(), {touches: [constructTouch(target, {target, identifier: 1, clientX: -50, clientY: 0})]});
    simulate.touchstart(map.getCanvas(), {touches: [constructTouch(target, {target, identifier: 1, clientX: -50, clientY: 0}), constructTouch(target, {target, identifier: 2, clientX: 50, clientY: 0})]});
    simulate.touchmove(map.getCanvas(), {touches: [constructTouch(target, {target, identifier: 1, clientX: -50, clientY: -100}), constructTouch(target, {target, identifier: 2, clientX: 50, clientY: -100})]});
    map._renderTaskQueue.run();
    expect(pitchstart).toHaveBeenCalledTimes(1);
    expect(pitch).toHaveBeenCalledTimes(1);
    expect(pitchend).not.toHaveBeenCalled();

    simulate.touchend(map.getCanvas(), {touches: []});
    map._renderTaskQueue.run();

    expect(pitchstart).toHaveBeenCalledTimes(1);
    expect(pitch).toHaveBeenCalledTimes(1);
    expect(pitchend).toHaveBeenCalledTimes(1);
});

test('Touch pitching requires three fingers with cooperative gestures', () => {
    const map = createMap({cooperativeGestures: true});
    const target = map.getCanvas();

    const pitchstart = vi.fn();
    const pitch      = vi.fn();
    const pitchend   = vi.fn();

    map.on('pitchstart', pitchstart);
    map.on('pitch',      pitch);
    map.on('pitchend',   pitchend);

    // two finger drag
    simulate.touchstart(map.getCanvas(), {touches: [constructTouch(target, {target, identifier: 1, clientX: -50, clientY: 0})]});
    simulate.touchstart(map.getCanvas(), {touches: [constructTouch(target, {target, identifier: 1, clientX: -50, clientY: 0}), constructTouch(target, {target, identifier: 2, clientX: 50, clientY: 0})]});
    simulate.touchmove(map.getCanvas(), {touches: [constructTouch(target, {target, identifier: 1, clientX: -50, clientY: -100}), constructTouch(target, {target, identifier: 2, clientX: 50, clientY: -100})]});
    map._renderTaskQueue.run();
    expect(pitchstart).not.toHaveBeenCalled();
    expect(pitch).not.toHaveBeenCalled();
    expect(pitchend).not.toHaveBeenCalled();

    simulate.touchend(map.getCanvas(), {touches: []});
    map._renderTaskQueue.run();

    expect(pitchstart).not.toHaveBeenCalled();
    expect(pitch).not.toHaveBeenCalled();
    expect(pitchend).not.toHaveBeenCalled();

    // three finger drag
    simulate.touchstart(map.getCanvas(), {touches: [constructTouch(target, {target, identifier: 1, clientX: -50, clientY: 0}), constructTouch(target, {target, identifier: 2, clientX: 0, clientY: 0}), constructTouch(target, {target, identifier: 3, clientX: 50, clientY: 0})]});
    simulate.touchmove(map.getCanvas(), {touches: [constructTouch(target, {target, identifier: 1, clientX: -50, clientY: -100}), constructTouch(target, {target, identifier: 2, clientX: 0, clientY: -100}), constructTouch(target, {target, identifier: 3, clientX: 50, clientY: -100})]});
    map._renderTaskQueue.run();
    expect(pitchstart).toHaveBeenCalledTimes(1);
    expect(pitch).toHaveBeenCalledTimes(1);
    expect(pitchend).not.toHaveBeenCalled();

    simulate.touchend(map.getCanvas(), {touches: []});
    map._renderTaskQueue.run();

    expect(pitchstart).toHaveBeenCalledTimes(2);
    expect(pitch).toHaveBeenCalledTimes(1);
    expect(pitchend).toHaveBeenCalledTimes(1);
});

test('with cooperative gesture enabled but in fullscreen, touch pitching works with two fingers', () => {
    const map = createMap({cooperativeGestures: true});
    const target = map.getCanvas();
    vi.spyOn(window.document, 'fullscreenElement', 'get').mockImplementation(() => true);

    const pitchstart = vi.fn();
    const pitch      = vi.fn();
    const pitchend   = vi.fn();

    map.on('pitchstart', pitchstart);
    map.on('pitch',      pitch);
    map.on('pitchend',   pitchend);

    simulate.touchstart(map.getCanvas(), {touches: [constructTouch(target, {target, identifier: 1, clientX: -50, clientY: 0})]});
    simulate.touchstart(map.getCanvas(), {touches: [constructTouch(target, {target, identifier: 1, clientX: -50, clientY: 0}), constructTouch(target, {target, identifier: 2, clientX: 50, clientY: 0})]});
    simulate.touchmove(map.getCanvas(), {touches: [constructTouch(target, {target, identifier: 1, clientX: -50, clientY: -100}), constructTouch(target, {target, identifier: 2, clientX: 50, clientY: -100})]});
    map._renderTaskQueue.run();
    expect(pitchstart).toHaveBeenCalledTimes(1);
    expect(pitch).toHaveBeenCalledTimes(1);
    expect(pitchend).not.toHaveBeenCalled();

    simulate.touchend(map.getCanvas(), {touches: []});
    map._renderTaskQueue.run();

    expect(pitchstart).toHaveBeenCalledTimes(1);
    expect(pitch).toHaveBeenCalledTimes(1);
    expect(pitchend).toHaveBeenCalledTimes(1);
});
