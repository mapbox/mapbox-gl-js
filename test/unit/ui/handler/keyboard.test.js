import {test, expect, vi, createMap as globalCreateMap} from "../../../util/vitest.js";
import {Map} from '../../../../src/ui/map.js';
import simulate from '../../../util/simulate_interaction.js';

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

    simulate.keydown(map.getCanvas(), {keyCode: 32, key: " "});
    expect(h.keydown).toHaveBeenCalled();
    expect(h.keydown.mock.calls[0][0].keyCode).toEqual(32);
});

test('KeyboardHandler pans map in response to arrow keys', () => {
    const map = createMap({zoom: 10, center: [0, 0]});
    vi.spyOn(map, 'easeTo');

    simulate.keydown(map.getCanvas(), {keyCode: 32, key: " "});
    expect(map.easeTo).not.toHaveBeenCalled();

    simulate.keydown(map.getCanvas(), {keyCode: 37, key: "ArrowLeft"});
    expect(map.easeTo).toHaveBeenCalled();
    let easeToArgs = map.easeTo.mock.calls[0][0];
    expect(easeToArgs.offset[0]).toEqual(100);
    expect(easeToArgs.offset[1]).toEqual(-0);

    simulate.keydown(map.getCanvas(), {keyCode: 39, key: "ArrowRight"});
    expect(map.easeTo).toHaveBeenCalledTimes(2);
    easeToArgs = map.easeTo.mock.calls[1][0];
    expect(easeToArgs.offset[0]).toEqual(-100);
    expect(easeToArgs.offset[1]).toEqual(-0);

    simulate.keydown(map.getCanvas(), {keyCode: 40, key: "ArrowDown"});
    expect(map.easeTo).toHaveBeenCalledTimes(3);
    easeToArgs = map.easeTo.mock.calls[2][0];
    expect(easeToArgs.offset[0]).toEqual(-0);
    expect(easeToArgs.offset[1]).toEqual(-100);

    simulate.keydown(map.getCanvas(), {keyCode: 38, key: "ArrowUp"});
    expect(map.easeTo).toHaveBeenCalledTimes(4);
    easeToArgs = map.easeTo.mock.calls[3][0];
    expect(easeToArgs.offset[0]).toEqual(-0);
    expect(easeToArgs.offset[1]).toEqual(100);
});

test('KeyboardHandler pans map in response to arrow keys when disableRotation has been called', () => {
    const map = createMap({zoom: 10, center: [0, 0]});
    vi.spyOn(map, 'easeTo');
    map.keyboard.disableRotation();

    simulate.keydown(map.getCanvas(), {keyCode: 32, key: " "});
    expect(map.easeTo).not.toHaveBeenCalled();

    simulate.keydown(map.getCanvas(), {keyCode: 37, key: "ArrowLeft"});
    expect(map.easeTo).toHaveBeenCalled();
    let easeToArgs = map.easeTo.mock.calls[0][0];
    expect(easeToArgs.offset[0]).toEqual(100);
    expect(easeToArgs.offset[1]).toEqual(-0);

    simulate.keydown(map.getCanvas(), {keyCode: 39, key: "ArrowRight"});
    expect(map.easeTo).toHaveBeenCalledTimes(2);
    easeToArgs = map.easeTo.mock.calls[1][0];
    expect(easeToArgs.offset[0]).toEqual(-100);
    expect(easeToArgs.offset[1]).toEqual(-0);

    simulate.keydown(map.getCanvas(), {keyCode: 40, key: "ArrowDown"});
    expect(map.easeTo).toHaveBeenCalledTimes(3);
    easeToArgs = map.easeTo.mock.calls[2][0];
    expect(easeToArgs.offset[0]).toEqual(-0);
    expect(easeToArgs.offset[1]).toEqual(-100);

    simulate.keydown(map.getCanvas(), {keyCode: 38, key: "ArrowUp"});
    expect(map.easeTo).toHaveBeenCalledTimes(4);
    easeToArgs = map.easeTo.mock.calls[3][0];
    expect(easeToArgs.offset[0]).toEqual(-0);
    expect(easeToArgs.offset[1]).toEqual(100);
});

test('KeyboardHandler rotates map in response to Shift+left/right arrow keys', async () => {
    const map = createMap({zoom: 10, center: [0, 0], bearing: 0});
    vi.spyOn(map, 'easeTo');

    simulate.keydown(map.getCanvas(), {keyCode: 32, key: " "});
    expect(map.easeTo).not.toHaveBeenCalled();

    simulate.keydown(map.getCanvas(), {keyCode: 37, key: "ArrowLeft", shiftKey: true});
    expect(map.easeTo).toHaveBeenCalled();
    let easeToArgs = map.easeTo.mock.calls[0][0];
    expect(easeToArgs.bearing).toEqual(-15);
    expect(easeToArgs.offset[0]).toEqual(-0);

    map.setBearing(0);
    simulate.keydown(map.getCanvas(), {keyCode: 39, key: "ArrowRight", shiftKey: true});
    expect(map.easeTo).toHaveBeenCalledTimes(2);
    easeToArgs = map.easeTo.mock.calls[1][0];
    expect(easeToArgs.bearing).toEqual(15);
    expect(easeToArgs.offset[0]).toEqual(-0);
});

test('KeyboardHandler does not rotate map in response to Shift+left/right arrow keys when disableRotation has been called', async () => {
    const map = createMap({zoom: 10, center: [0, 0], bearing: 0});
    vi.spyOn(map, 'easeTo');
    map.keyboard.disableRotation();

    simulate.keydown(map.getCanvas(), {keyCode: 32, key: " "});
    expect(map.easeTo).not.toHaveBeenCalled();

    simulate.keydown(map.getCanvas(), {keyCode: 37, key: "ArrowLeft", shiftKey: true});
    expect(map.easeTo).toHaveBeenCalled();
    let easeToArgs = map.easeTo.mock.calls[0][0];
    expect(easeToArgs.bearing).toEqual(0);
    expect(easeToArgs.offset[0]).toEqual(-0);

    map.setBearing(0);
    simulate.keydown(map.getCanvas(), {keyCode: 39, key: "ArrowRight", shiftKey: true});
    expect(map.easeTo).toHaveBeenCalledTimes(2);
    easeToArgs = map.easeTo.mock.calls[1][0];
    expect(easeToArgs.bearing).toEqual(0);
    expect(easeToArgs.offset[0]).toEqual(-0);
});

test('KeyboardHandler pitches map in response to Shift+up/down arrow keys', async () => {
    const map = createMap({zoom: 10, center: [0, 0], pitch: 30});
    vi.spyOn(map, 'easeTo');

    simulate.keydown(map.getCanvas(), {keyCode: 32, key: " "});
    expect(map.easeTo).not.toHaveBeenCalled();

    simulate.keydown(map.getCanvas(), {keyCode: 40, key: "ArrowDown", shiftKey: true});
    expect(map.easeTo).toHaveBeenCalled();
    let easeToArgs = map.easeTo.mock.calls[0][0];
    expect(easeToArgs.pitch).toEqual(20);
    expect(easeToArgs.offset[1]).toEqual(-0);

    map.setPitch(30);
    simulate.keydown(map.getCanvas(), {keyCode: 38, key: "ArrowUp", shiftKey: true});
    expect(map.easeTo).toHaveBeenCalledTimes(2);
    easeToArgs = map.easeTo.mock.calls[1][0];
    expect(easeToArgs.pitch).toEqual(40);
    expect(easeToArgs.offset[1]).toEqual(-0);
});

test('KeyboardHandler does not pitch map in response to Shift+up/down arrow keys when disableRotation has been called', async () => {
    const map = createMap({zoom: 10, center: [0, 0], pitch: 30});
    vi.spyOn(map, 'easeTo');
    map.keyboard.disableRotation();

    simulate.keydown(map.getCanvas(), {keyCode: 32, key: " "});
    expect(map.easeTo).not.toHaveBeenCalled();

    simulate.keydown(map.getCanvas(), {keyCode: 40, key: "ArrowDown", shiftKey: true});
    expect(map.easeTo).toHaveBeenCalled();
    let easeToArgs = map.easeTo.mock.calls[0][0];
    expect(easeToArgs.pitch).toEqual(30);
    expect(easeToArgs.offset[1]).toEqual(-0);

    map.setPitch(30);
    simulate.keydown(map.getCanvas(), {keyCode: 38, key: "ArrowUp", shiftKey: true});
    expect(map.easeTo).toHaveBeenCalledTimes(2);
    easeToArgs = map.easeTo.mock.calls[1][0];
    expect(easeToArgs.pitch).toEqual(30);
    expect(easeToArgs.offset[1]).toEqual(-0);
});

test('KeyboardHandler zooms map in response to -/+ keys', () => {
    const map = createMap({zoom: 10, center: [0, 0]});
    vi.spyOn(map, 'easeTo');

    simulate.keydown(map.getCanvas(), {keyCode: 187, key: "Equal"});
    expect(map.easeTo).toHaveBeenCalledTimes(1);
    expect(map.easeTo.mock.calls[0][0].zoom).toEqual(11);

    map.setZoom(10);
    simulate.keydown(map.getCanvas(), {keyCode: 187, key: "Equal", shiftKey: true});
    expect(map.easeTo).toHaveBeenCalledTimes(2);
    expect(map.easeTo.mock.calls[1][0].zoom).toEqual(12);

    map.setZoom(10);
    simulate.keydown(map.getCanvas(), {keyCode: 189, key: "Minus"});
    expect(map.easeTo).toHaveBeenCalledTimes(3);
    expect(map.easeTo.mock.calls[2][0].zoom).toEqual(9);

    map.setZoom(10);
    simulate.keydown(map.getCanvas(), {keyCode: 189, key: "Minus", shiftKey: true});
    expect(map.easeTo).toHaveBeenCalledTimes(4);
    expect(map.easeTo.mock.calls[3][0].zoom).toEqual(8);
});

test('KeyboardHandler zooms map in response to -/+ keys when disableRotation has been called', () => {
    const map = createMap({zoom: 10, center: [0, 0]});
    vi.spyOn(map, 'easeTo');
    map.keyboard.disableRotation();

    simulate.keydown(map.getCanvas(), {keyCode: 187, key: "Equal"});
    expect(map.easeTo).toHaveBeenCalledTimes(1);
    expect(map.easeTo.mock.calls[0][0].zoom).toEqual(11);

    map.setZoom(10);
    simulate.keydown(map.getCanvas(), {keyCode: 187, key: "Equal", shiftKey: true});
    expect(map.easeTo).toHaveBeenCalledTimes(2);
    expect(map.easeTo.mock.calls[1][0].zoom).toEqual(12);

    map.setZoom(10);
    simulate.keydown(map.getCanvas(), {keyCode: 189, key: "Minus"});
    expect(map.easeTo).toHaveBeenCalledTimes(3);
    expect(map.easeTo.mock.calls[2][0].zoom).toEqual(9);

    map.setZoom(10);
    simulate.keydown(map.getCanvas(), {keyCode: 189, key: "Minus", shiftKey: true});
    expect(map.easeTo).toHaveBeenCalledTimes(4);
    expect(map.easeTo.mock.calls[3][0].zoom).toEqual(8);
});
