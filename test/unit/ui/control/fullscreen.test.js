import {test} from '../../../util/test.js';
import window from '../../../../src/util/window.js';
import {createMap} from '../../../util/index.js';
import getUIString from '../../../../src/ui/get_ui_string.js';
import FullscreenControl from '../../../../src/ui/control/fullscreen_control.js';

test('FullscreenControl appears when fullscreen is enabled', (t) => {
    window.document.fullscreenEnabled = true;

    const map = createMap(t);
    const fullscreen = new FullscreenControl();
    map.addControl(fullscreen);

    t.equal(map.getContainer().querySelectorAll('.mapboxgl-ctrl-fullscreen').length, 1);
    t.end();
});

test('FullscreenControl does not appear when fullscreen is not enabled', (t) => {
    window.document.fullscreenEnabled = false;

    const consoleWarn = t.stub(console, 'warn');

    const map = createMap(t);
    const fullscreen = new FullscreenControl();
    map.addControl(fullscreen);

    t.equal(map.getContainer().querySelectorAll('.mapboxgl-ctrl-fullscreen').length, 0);
    t.equal(consoleWarn.getCall(0).args[0], 'This device does not support fullscreen mode.');
    t.end();
});

test('FullscreenControl makes optional container element full screen', (t) => {
    window.document.fullscreenEnabled = true;

    const map = createMap(t);
    const fullscreen = new FullscreenControl({container: window.document.querySelector('body')});
    map.addControl(fullscreen);
    const control = map._controls.find((ctrl) => {
        return ctrl.hasOwnProperty('_fullscreen');
    });
    control._onClickFullscreen();

    t.equal(control._container.tagName, 'BODY');
    t.end();
});

test('FullscreenControl changes language after setLanguage', (t) => {
    const selector = '.mapboxgl-ctrl-fullscreen';

    const map = createMap(t);
    const fullscreen = new FullscreenControl();
    map.addControl(fullscreen);
    map._domRenderTaskQueue.run();

    let contents = map.getContainer().querySelector(selector).firstChild.title;
    t.equal(contents, getUIString('en', 'FullscreenControl.Enter'));

    map.setLanguage('fi');
    map._domRenderTaskQueue.run();

    contents = map.getContainer().querySelector(selector).firstChild.title;
    t.equal(contents, getUIString('fi', 'FullscreenControl.Enter'));
    t.end();
});
