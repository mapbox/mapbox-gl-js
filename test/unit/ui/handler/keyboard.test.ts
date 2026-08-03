// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {test, expect, vi, createMap as globalCreateMap} from '../../../util/vitest';
import {Map} from '../../../../src/ui/map';
import simulate from '../../../util/simulate_interaction';

function createMap(options) {
    vi.spyOn(Map.prototype, '_detectMissingCSS').mockImplementation(() => {});
    return globalCreateMap({
        interactive: true,
        ...options,
    });
}

test('KeyboardHandler responds to keydown events', () => {
    const map = createMap();
    const h = map.keyboard;
    vi.spyOn(h, 'keydown');

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    simulate.keydown(map.getCanvas(), {keyCode: 32, key: " "});
    expect(h.keydown).toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(h.keydown.mock.calls[0][0].keyCode).toEqual(32);
});

test('KeyboardHandler pans map in response to arrow keys', () => {
    const map = createMap({zoom: 10, center: [0, 0]});
    vi.spyOn(map, 'easeTo');

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    simulate.keydown(map.getCanvas(), {keyCode: 32, key: " "});
    expect(map.easeTo).not.toHaveBeenCalled();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    simulate.keydown(map.getCanvas(), {keyCode: 37, key: "ArrowLeft"});
    expect(map.easeTo).toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    let easeToArgs = map.easeTo.mock.calls[0][0];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(easeToArgs.offset[0]).toEqual(100);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(easeToArgs.offset[1]).toEqual(-0);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    simulate.keydown(map.getCanvas(), {keyCode: 39, key: "ArrowRight"});
    expect(map.easeTo).toHaveBeenCalledTimes(2);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    easeToArgs = map.easeTo.mock.calls[1][0];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(easeToArgs.offset[0]).toEqual(-100);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(easeToArgs.offset[1]).toEqual(-0);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    simulate.keydown(map.getCanvas(), {keyCode: 40, key: "ArrowDown"});
    expect(map.easeTo).toHaveBeenCalledTimes(3);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    easeToArgs = map.easeTo.mock.calls[2][0];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(easeToArgs.offset[0]).toEqual(-0);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(easeToArgs.offset[1]).toEqual(-100);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    simulate.keydown(map.getCanvas(), {keyCode: 38, key: "ArrowUp"});
    expect(map.easeTo).toHaveBeenCalledTimes(4);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    easeToArgs = map.easeTo.mock.calls[3][0];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(easeToArgs.offset[0]).toEqual(-0);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(easeToArgs.offset[1]).toEqual(100);
});

test('KeyboardHandler pans map in response to arrow keys when disableRotation has been called', () => {
    const map = createMap({zoom: 10, center: [0, 0]});
    vi.spyOn(map, 'easeTo');
    map.keyboard.disableRotation();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    simulate.keydown(map.getCanvas(), {keyCode: 32, key: " "});
    expect(map.easeTo).not.toHaveBeenCalled();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    simulate.keydown(map.getCanvas(), {keyCode: 37, key: "ArrowLeft"});
    expect(map.easeTo).toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    let easeToArgs = map.easeTo.mock.calls[0][0];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(easeToArgs.offset[0]).toEqual(100);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(easeToArgs.offset[1]).toEqual(-0);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    simulate.keydown(map.getCanvas(), {keyCode: 39, key: "ArrowRight"});
    expect(map.easeTo).toHaveBeenCalledTimes(2);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    easeToArgs = map.easeTo.mock.calls[1][0];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(easeToArgs.offset[0]).toEqual(-100);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(easeToArgs.offset[1]).toEqual(-0);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    simulate.keydown(map.getCanvas(), {keyCode: 40, key: "ArrowDown"});
    expect(map.easeTo).toHaveBeenCalledTimes(3);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    easeToArgs = map.easeTo.mock.calls[2][0];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(easeToArgs.offset[0]).toEqual(-0);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(easeToArgs.offset[1]).toEqual(-100);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    simulate.keydown(map.getCanvas(), {keyCode: 38, key: "ArrowUp"});
    expect(map.easeTo).toHaveBeenCalledTimes(4);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    easeToArgs = map.easeTo.mock.calls[3][0];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(easeToArgs.offset[0]).toEqual(-0);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(easeToArgs.offset[1]).toEqual(100);
});

// eslint-disable-next-line @typescript-eslint/require-await
test('KeyboardHandler rotates map in response to Shift+left/right arrow keys', async () => {
    const map = createMap({zoom: 10, center: [0, 0], bearing: 0});
    vi.spyOn(map, 'easeTo');

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    simulate.keydown(map.getCanvas(), {keyCode: 32, key: " "});
    expect(map.easeTo).not.toHaveBeenCalled();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    simulate.keydown(map.getCanvas(), {keyCode: 37, key: "ArrowLeft", shiftKey: true});
    expect(map.easeTo).toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    let easeToArgs = map.easeTo.mock.calls[0][0];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(easeToArgs.bearing).toEqual(-15);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(easeToArgs.offset[0]).toEqual(-0);

    map.setBearing(0);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    simulate.keydown(map.getCanvas(), {keyCode: 39, key: "ArrowRight", shiftKey: true});
    expect(map.easeTo).toHaveBeenCalledTimes(2);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    easeToArgs = map.easeTo.mock.calls[1][0];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(easeToArgs.bearing).toEqual(15);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(easeToArgs.offset[0]).toEqual(-0);
});

// eslint-disable-next-line @typescript-eslint/require-await
test('KeyboardHandler does not rotate map in response to Shift+left/right arrow keys when disableRotation has been called', async () => {
    const map = createMap({zoom: 10, center: [0, 0], bearing: 0});
    vi.spyOn(map, 'easeTo');
    map.keyboard.disableRotation();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    simulate.keydown(map.getCanvas(), {keyCode: 32, key: " "});
    expect(map.easeTo).not.toHaveBeenCalled();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    simulate.keydown(map.getCanvas(), {keyCode: 37, key: "ArrowLeft", shiftKey: true});
    expect(map.easeTo).toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    let easeToArgs = map.easeTo.mock.calls[0][0];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(easeToArgs.bearing).toEqual(0);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(easeToArgs.offset[0]).toEqual(-0);

    map.setBearing(0);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    simulate.keydown(map.getCanvas(), {keyCode: 39, key: "ArrowRight", shiftKey: true});
    expect(map.easeTo).toHaveBeenCalledTimes(2);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    easeToArgs = map.easeTo.mock.calls[1][0];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(easeToArgs.bearing).toEqual(0);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(easeToArgs.offset[0]).toEqual(-0);
});

// eslint-disable-next-line @typescript-eslint/require-await
test('KeyboardHandler pitches map in response to Shift+up/down arrow keys', async () => {
    const map = createMap({zoom: 10, center: [0, 0], pitch: 30});
    vi.spyOn(map, 'easeTo');

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    simulate.keydown(map.getCanvas(), {keyCode: 32, key: " "});
    expect(map.easeTo).not.toHaveBeenCalled();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    simulate.keydown(map.getCanvas(), {keyCode: 40, key: "ArrowDown", shiftKey: true});
    expect(map.easeTo).toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    let easeToArgs = map.easeTo.mock.calls[0][0];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(easeToArgs.pitch).toEqual(20);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(easeToArgs.offset[1]).toEqual(-0);

    map.setPitch(30);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    simulate.keydown(map.getCanvas(), {keyCode: 38, key: "ArrowUp", shiftKey: true});
    expect(map.easeTo).toHaveBeenCalledTimes(2);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    easeToArgs = map.easeTo.mock.calls[1][0];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(easeToArgs.pitch).toEqual(40);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(easeToArgs.offset[1]).toEqual(-0);
});

// eslint-disable-next-line @typescript-eslint/require-await
test('KeyboardHandler does not pitch map in response to Shift+up/down arrow keys when disableRotation has been called', async () => {
    const map = createMap({zoom: 10, center: [0, 0], pitch: 30});
    vi.spyOn(map, 'easeTo');
    map.keyboard.disableRotation();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    simulate.keydown(map.getCanvas(), {keyCode: 32, key: " "});
    expect(map.easeTo).not.toHaveBeenCalled();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    simulate.keydown(map.getCanvas(), {keyCode: 40, key: "ArrowDown", shiftKey: true});
    expect(map.easeTo).toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    let easeToArgs = map.easeTo.mock.calls[0][0];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(easeToArgs.pitch).toEqual(30);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(easeToArgs.offset[1]).toEqual(-0);

    map.setPitch(30);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    simulate.keydown(map.getCanvas(), {keyCode: 38, key: "ArrowUp", shiftKey: true});
    expect(map.easeTo).toHaveBeenCalledTimes(2);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    easeToArgs = map.easeTo.mock.calls[1][0];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(easeToArgs.pitch).toEqual(30);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(easeToArgs.offset[1]).toEqual(-0);
});

test('KeyboardHandler zooms map in response to -/+ keys', () => {
    const map = createMap({zoom: 10, center: [0, 0]});
    vi.spyOn(map, 'easeTo');

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    simulate.keydown(map.getCanvas(), {keyCode: 187, key: "Equal"});
    expect(map.easeTo).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(map.easeTo.mock.calls[0][0].zoom).toEqual(11);

    map.setZoom(10);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    simulate.keydown(map.getCanvas(), {keyCode: 187, key: "Equal", shiftKey: true});
    expect(map.easeTo).toHaveBeenCalledTimes(2);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(map.easeTo.mock.calls[1][0].zoom).toEqual(12);

    map.setZoom(10);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    simulate.keydown(map.getCanvas(), {keyCode: 189, key: "Minus"});
    expect(map.easeTo).toHaveBeenCalledTimes(3);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(map.easeTo.mock.calls[2][0].zoom).toEqual(9);

    map.setZoom(10);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    simulate.keydown(map.getCanvas(), {keyCode: 189, key: "Minus", shiftKey: true});
    expect(map.easeTo).toHaveBeenCalledTimes(4);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(map.easeTo.mock.calls[3][0].zoom).toEqual(8);
});

test('KeyboardHandler zooms map in response to -/+ keys when disableRotation has been called', () => {
    const map = createMap({zoom: 10, center: [0, 0]});
    vi.spyOn(map, 'easeTo');
    map.keyboard.disableRotation();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    simulate.keydown(map.getCanvas(), {keyCode: 187, key: "Equal"});
    expect(map.easeTo).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(map.easeTo.mock.calls[0][0].zoom).toEqual(11);

    map.setZoom(10);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    simulate.keydown(map.getCanvas(), {keyCode: 187, key: "Equal", shiftKey: true});
    expect(map.easeTo).toHaveBeenCalledTimes(2);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(map.easeTo.mock.calls[1][0].zoom).toEqual(12);

    map.setZoom(10);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    simulate.keydown(map.getCanvas(), {keyCode: 189, key: "Minus"});
    expect(map.easeTo).toHaveBeenCalledTimes(3);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(map.easeTo.mock.calls[2][0].zoom).toEqual(9);

    map.setZoom(10);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    simulate.keydown(map.getCanvas(), {keyCode: 189, key: "Minus", shiftKey: true});
    expect(map.easeTo).toHaveBeenCalledTimes(4);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(map.easeTo.mock.calls[3][0].zoom).toEqual(8);
});

test('KeyboardHandler does not pan map in response to arrow keys when disablePan has been called', () => {
    const map = createMap({zoom: 10, center: [0, 0]});
    vi.spyOn(map, 'easeTo');
    map.keyboard.disablePan();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    simulate.keydown(map.getCanvas(), {keyCode: 37, key: "ArrowLeft"});
    expect(map.easeTo).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    let easeToArgs = map.easeTo.mock.calls[0][0];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(easeToArgs.offset[0]).toEqual(-0);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(easeToArgs.offset[1]).toEqual(-0);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    simulate.keydown(map.getCanvas(), {keyCode: 38, key: "ArrowUp"});
    expect(map.easeTo).toHaveBeenCalledTimes(2);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    easeToArgs = map.easeTo.mock.calls[1][0];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(easeToArgs.offset[0]).toEqual(-0);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(easeToArgs.offset[1]).toEqual(-0);
});

test('KeyboardHandler still zooms with +/- keys when disablePan has been called', () => {
    const map = createMap({zoom: 10, center: [0, 0]});
    vi.spyOn(map, 'easeTo');
    map.keyboard.disablePan();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    simulate.keydown(map.getCanvas(), {keyCode: 187, key: "Equal"});
    expect(map.easeTo).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(map.easeTo.mock.calls[0][0].zoom).toEqual(11);

    map.setZoom(10);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    simulate.keydown(map.getCanvas(), {keyCode: 189, key: "Minus"});
    expect(map.easeTo).toHaveBeenCalledTimes(2);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(map.easeTo.mock.calls[1][0].zoom).toEqual(9);
});

// eslint-disable-next-line @typescript-eslint/require-await
test('KeyboardHandler still rotates with Shift+left/right when disablePan has been called', async () => {
    const map = createMap({zoom: 10, center: [0, 0], bearing: 0});
    vi.spyOn(map, 'easeTo');
    map.keyboard.disablePan();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    simulate.keydown(map.getCanvas(), {keyCode: 39, key: "ArrowRight", shiftKey: true});
    expect(map.easeTo).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(map.easeTo.mock.calls[0][0].bearing).toEqual(15);
});

// eslint-disable-next-line @typescript-eslint/require-await
test('KeyboardHandler still pitches with Shift+up/down when disablePan has been called', async () => {
    const map = createMap({zoom: 10, center: [0, 0], pitch: 30});
    vi.spyOn(map, 'easeTo');
    map.keyboard.disablePan();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    simulate.keydown(map.getCanvas(), {keyCode: 40, key: "ArrowDown", shiftKey: true});
    expect(map.easeTo).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(map.easeTo.mock.calls[0][0].pitch).toEqual(20);
});

test('KeyboardHandler isRotationEnabled reflects disableRotation/enableRotation', () => {
    const map = createMap();
    expect(map.keyboard.isRotationEnabled()).toEqual(true);

    map.keyboard.disableRotation();
    expect(map.keyboard.isRotationEnabled()).toEqual(false);

    map.keyboard.enableRotation();
    expect(map.keyboard.isRotationEnabled()).toEqual(true);
});

test('KeyboardHandler isPanEnabled reflects disablePan/enablePan', () => {
    const map = createMap();
    expect(map.keyboard.isPanEnabled()).toEqual(true);

    map.keyboard.disablePan();
    expect(map.keyboard.isPanEnabled()).toEqual(false);

    map.keyboard.enablePan();
    expect(map.keyboard.isPanEnabled()).toEqual(true);
});

test('KeyboardHandler enablePan restores arrow-key panning', () => {
    const map = createMap({zoom: 10, center: [0, 0]});
    vi.spyOn(map, 'easeTo');
    map.keyboard.disablePan();
    map.keyboard.enablePan();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    simulate.keydown(map.getCanvas(), {keyCode: 37, key: "ArrowLeft"});
    expect(map.easeTo).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(map.easeTo.mock.calls[0][0].offset[0]).toEqual(100);
});

test('KeyboardHandler isZoomEnabled reflects disableZoom/enableZoom', () => {
    const map = createMap();
    expect(map.keyboard.isZoomEnabled()).toEqual(true);

    map.keyboard.disableZoom();
    expect(map.keyboard.isZoomEnabled()).toEqual(false);

    map.keyboard.enableZoom();
    expect(map.keyboard.isZoomEnabled()).toEqual(true);
});

test('KeyboardHandler does not zoom map in response to -/+ keys when disableZoom has been called', () => {
    const map = createMap({zoom: 10, center: [0, 0]});
    vi.spyOn(map, 'easeTo');
    map.keyboard.disableZoom();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    simulate.keydown(map.getCanvas(), {keyCode: 187, key: "Equal"});
    expect(map.easeTo).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(map.easeTo.mock.calls[0][0].zoom).toEqual(10);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    simulate.keydown(map.getCanvas(), {keyCode: 189, key: "Minus"});
    expect(map.easeTo).toHaveBeenCalledTimes(2);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(map.easeTo.mock.calls[1][0].zoom).toEqual(10);
});

test('KeyboardHandler still pans and rotates when disableZoom has been called', () => {
    const map = createMap({zoom: 10, center: [0, 0], bearing: 0});
    vi.spyOn(map, 'easeTo');
    map.keyboard.disableZoom();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    simulate.keydown(map.getCanvas(), {keyCode: 37, key: "ArrowLeft"});
    expect(map.easeTo).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(map.easeTo.mock.calls[0][0].offset[0]).toEqual(100);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    simulate.keydown(map.getCanvas(), {keyCode: 39, key: "ArrowRight", shiftKey: true});
    expect(map.easeTo).toHaveBeenCalledTimes(2);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(map.easeTo.mock.calls[1][0].bearing).toEqual(15);
});

test('KeyboardHandler enableZoom restores +/- zooming', () => {
    const map = createMap({zoom: 10, center: [0, 0]});
    vi.spyOn(map, 'easeTo');
    map.keyboard.disableZoom();
    map.keyboard.enableZoom();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    simulate.keydown(map.getCanvas(), {keyCode: 187, key: "Equal"});
    expect(map.easeTo).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(map.easeTo.mock.calls[0][0].zoom).toEqual(11);
});

test('KeyboardHandler isEnabled stays true while enable() is set and only some sub-interactions are disabled', () => {
    const map = createMap();
    map.keyboard.disablePan();
    map.keyboard.disableZoom();
    expect(map.keyboard.isEnabled()).toEqual(true);

    map.keyboard.disableRotation();
    expect(map.keyboard.isEnabled()).toEqual(false);
});

test('KeyboardHandler isEnabled is false when all sub-interactions are disabled even though enable() is set', () => {
    const map = createMap();
    expect(map.keyboard.isEnabled()).toEqual(true);

    map.keyboard.disablePan();
    map.keyboard.disableZoom();
    map.keyboard.disableRotation();
    expect(map.keyboard.isEnabled()).toEqual(false);

    map.keyboard.enableZoom();
    expect(map.keyboard.isEnabled()).toEqual(true);
});

test('KeyboardHandler ignores keydown events once all sub-interactions are disabled', () => {
    const map = createMap({zoom: 10, center: [0, 0]});
    vi.spyOn(map, 'easeTo');
    map.keyboard.disablePan();
    map.keyboard.disableZoom();
    map.keyboard.disableRotation();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    simulate.keydown(map.getCanvas(), {keyCode: 37, key: "ArrowLeft"});
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    simulate.keydown(map.getCanvas(), {keyCode: 187, key: "Equal"});
    expect(map.easeTo).not.toHaveBeenCalled();
});

test('KeyboardHandler isPitchEnabled reflects disablePitch/enablePitch', () => {
    const map = createMap();
    expect(map.keyboard.isPitchEnabled()).toEqual(true);

    map.keyboard.disablePitch();
    expect(map.keyboard.isPitchEnabled()).toEqual(false);

    map.keyboard.enablePitch();
    expect(map.keyboard.isPitchEnabled()).toEqual(true);
});

test('KeyboardHandler isBearingEnabled reflects disableBearing/enableBearing', () => {
    const map = createMap();
    expect(map.keyboard.isBearingEnabled()).toEqual(true);

    map.keyboard.disableBearing();
    expect(map.keyboard.isBearingEnabled()).toEqual(false);

    map.keyboard.enableBearing();
    expect(map.keyboard.isBearingEnabled()).toEqual(true);
});

// eslint-disable-next-line @typescript-eslint/require-await
test('KeyboardHandler does not pitch map in response to Shift+up/down arrow keys when disablePitch has been called', async () => {
    const map = createMap({zoom: 10, center: [0, 0], pitch: 30});
    vi.spyOn(map, 'easeTo');
    map.keyboard.disablePitch();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    simulate.keydown(map.getCanvas(), {keyCode: 40, key: "ArrowDown", shiftKey: true});
    expect(map.easeTo).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const easeToArgs = map.easeTo.mock.calls[0][0];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(easeToArgs.pitch).toEqual(30);
});

// eslint-disable-next-line @typescript-eslint/require-await
test('KeyboardHandler still rotates with Shift+left/right when disablePitch has been called', async () => {
    const map = createMap({zoom: 10, center: [0, 0], bearing: 0});
    vi.spyOn(map, 'easeTo');
    map.keyboard.disablePitch();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    simulate.keydown(map.getCanvas(), {keyCode: 39, key: "ArrowRight", shiftKey: true});
    expect(map.easeTo).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(map.easeTo.mock.calls[0][0].bearing).toEqual(15);
});

// eslint-disable-next-line @typescript-eslint/require-await
test('KeyboardHandler does not rotate map in response to Shift+left/right arrow keys when disableBearing has been called', async () => {
    const map = createMap({zoom: 10, center: [0, 0], bearing: 0});
    vi.spyOn(map, 'easeTo');
    map.keyboard.disableBearing();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    simulate.keydown(map.getCanvas(), {keyCode: 39, key: "ArrowRight", shiftKey: true});
    expect(map.easeTo).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const easeToArgs = map.easeTo.mock.calls[0][0];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(easeToArgs.bearing).toEqual(0);
});

// eslint-disable-next-line @typescript-eslint/require-await
test('KeyboardHandler still pitches with Shift+up/down when disableBearing has been called', async () => {
    const map = createMap({zoom: 10, center: [0, 0], pitch: 30});
    vi.spyOn(map, 'easeTo');
    map.keyboard.disableBearing();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    simulate.keydown(map.getCanvas(), {keyCode: 40, key: "ArrowDown", shiftKey: true});
    expect(map.easeTo).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(map.easeTo.mock.calls[0][0].pitch).toEqual(20);
});

test('KeyboardHandler disableRotation disables both pitch and bearing', () => {
    const map = createMap();
    map.keyboard.disableRotation();

    expect(map.keyboard.isPitchEnabled()).toEqual(false);
    expect(map.keyboard.isBearingEnabled()).toEqual(false);
    expect(map.keyboard.isRotationEnabled()).toEqual(false);
});

test('KeyboardHandler isRotationEnabled is false if only pitch or only bearing is disabled', () => {
    const map = createMap();

    map.keyboard.disablePitch();
    expect(map.keyboard.isRotationEnabled()).toEqual(false);
    expect(map.keyboard.isBearingEnabled()).toEqual(true);

    map.keyboard.enablePitch();
    map.keyboard.disableBearing();
    expect(map.keyboard.isRotationEnabled()).toEqual(false);
    expect(map.keyboard.isPitchEnabled()).toEqual(true);
});

test('KeyboardHandler isEnabled stays true when only pitch or only bearing is disabled', () => {
    const map = createMap();

    map.keyboard.disablePitch();
    expect(map.keyboard.isEnabled()).toEqual(true);

    map.keyboard.enablePitch();
    map.keyboard.disableBearing();
    expect(map.keyboard.isEnabled()).toEqual(true);
});

test('KeyboardHandler isEnabled is false when pitch, bearing, pan, and zoom are all disabled', () => {
    const map = createMap();

    map.keyboard.disablePitch();
    map.keyboard.disableBearing();
    map.keyboard.disablePan();
    map.keyboard.disableZoom();
    expect(map.keyboard.isEnabled()).toEqual(false);
});
