import {test, expect, vi, createMap} from "../../../util/vitest.js";
import FullscreenControl from '../../../../src/ui/control/fullscreen_control.js';

test('FullscreenControl appears when fullscreen is enabled', () => {
    window.document.fullscreenEnabled = true;

    const map = createMap();
    const fullscreen = new FullscreenControl();
    map.addControl(fullscreen);

    expect(map.getContainer().querySelectorAll('.mapboxgl-ctrl-fullscreen').length).toEqual(1);
});

test('FullscreenControl does not appear when fullscreen is not enabled', () => {
    vi.spyOn(window.document, 'fullscreenEnabled', 'get').mockImplementation(() => false);
    vi.spyOn(window.document, 'webkitFullscreenEnabled', 'get').mockImplementation(() => false);

    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const map = createMap();
    const fullscreen = new FullscreenControl();
    map.addControl(fullscreen);

    expect(map.getContainer().querySelectorAll('.mapboxgl-ctrl-fullscreen').length).toEqual(0);
    expect(consoleWarn.mock.calls[0][0]).toEqual('This device does not support fullscreen mode.');
});

test('FullscreenControl makes optional container element full screen', () => {
    vi.spyOn(window.document, 'fullscreenEnabled', 'get').mockImplementation(() => true);
    vi.spyOn(window.document, 'webkitFullscreenEnabled', 'get').mockImplementation(() => true);

    const map = createMap();
    const fullscreen = new FullscreenControl({container: window.document.querySelector('body')});
    map.addControl(fullscreen);
    const control = map._controls.find((ctrl) => {
        return ctrl.hasOwnProperty('_fullscreen');
    });
    control._container.requestFullscreen = () => {};
    control._onClickFullscreen();

    expect(control._container.tagName).toEqual('BODY');
});
