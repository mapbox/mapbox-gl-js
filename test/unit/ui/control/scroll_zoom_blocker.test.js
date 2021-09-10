import {test} from '../../../util/test.js';
import window from '../../../../src/util/window.js';
import Map from '../../../../src/ui/map.js';
import DOM from '../../../../src/util/dom.js';
import simulate from '../../../util/simulate_interaction.js';
import ScrollZoomBlockerControl from '../../../../src/ui/control/scroll_zoom_control.js';
import {extend} from '../../../../src/util/util.js';

function createMap(t, options) {
    t.stub(Map.prototype, '_detectMissingCSS');
    t.stub(Map.prototype, '_authenticate');
    return new Map(extend({
        container: DOM.create('div', '', window.document.body),
    }, options));
}

test('ScrollZoomBlocker#onAdd adds a .mapboxgl-scroll-zoom-blocker-control element', (t) => {
    const map = createMap(t);

    const scrollZoomBlockerControl = new ScrollZoomBlockerControl().setHTML();
    map.addControl(scrollZoomBlockerControl);

    t.equal(map.getContainer().querySelectorAll('.mapboxgl-scroll-zoom-blocker-control').length, 1);
    t.end();
});

test('ScrollZoomBlockerControl alert content can be set via setHTML', (t) => {
    const map = createMap(t);

    const scrollZoomBlockerControl = new ScrollZoomBlockerControl().setHTML("<span>Test</span>");
    map.addControl(scrollZoomBlockerControl);

    t.equal(scrollZoomBlockerControl.getElement().querySelector('.mapboxgl-scroll-zoom-blocker-control-content').innerHTML, "<span>Test</span>");
    t.end();
});

test('ScrollZoomBlockerControl alert opacity is set to 1 when wheel event occurs without CTRL/CMD key pressed', (t) => {
    const map = createMap(t);

    const scrollZoomBlockerControl = new ScrollZoomBlockerControl().setHTML();
    map.addControl(scrollZoomBlockerControl);

    map.on('wheel', () => {
        t.equal(scrollZoomBlockerControl.getElement().style.opacity, '1');
    });

    simulate.wheel(map.getCanvas());

    t.end();
});

test('ScrollZoomBlockerControl alert is visible when wheel event occurs without CTRL/CMD key pressed', (t) => {
    const map = createMap(t);

    const scrollZoomBlockerControl = new ScrollZoomBlockerControl().setHTML();
    map.addControl(scrollZoomBlockerControl);

    map.on('wheel', () => {
        t.equal(scrollZoomBlockerControl.getElement().style.visibility, 'visible');
    });

    simulate.wheel(map.getCanvas());

    t.end();
});

test('ScrollZoomBlockerControl alert, when showAlert option is set to false, does not display when wheel event occurs without CTRL/CMD key pressed', (t) => {
    const map = createMap(t);

    const scrollZoomBlockerControl = new ScrollZoomBlockerControl({showAlert: false}).setHTML();
    map.addControl(scrollZoomBlockerControl);

    map.on('wheel', () => {
        t.equal(scrollZoomBlockerControl.getElement().style.length, 0);
    });

    simulate.wheel(map.getCanvas());

    t.end();
});

test('ScrollZoomBlockerControl#onAdd prevents scroll zoom when CTRL or CMD key are not pressed during wheel event', (t) => {
    const map = createMap(t);

    const scrollZoomBlockerControl = new ScrollZoomBlockerControl().setHTML();
    map.addControl(scrollZoomBlockerControl);

    const zoomSpy = t.spy();
    map.on('zoom', zoomSpy);

    simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta});

    t.equal(zoomSpy.callCount, 0);
    t.end();
});

test('ScrollZoomBlockerControl#onAdd allows scroll zoom when CTRL key is pressed during wheel event', (t) => {
    const map = createMap(t);

    const scrollZoomBlockerControl = new ScrollZoomBlockerControl().setHTML();
    map.addControl(scrollZoomBlockerControl);

    const zoomSpy = t.spy();
    map.on('zoom', zoomSpy);

    simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta, ctrlKey: true});

    map._renderTaskQueue.run();

    t.equal(zoomSpy.callCount, 1);
    t.end();
});

test('ScrollZoomBlockerControl#onAdd allows scroll zoom when CMD key is pressed during wheel event', (t) => {
    const map = createMap(t);

    const scrollZoomBlockerControl = new ScrollZoomBlockerControl().setHTML();
    map.addControl(scrollZoomBlockerControl);

    const zoomSpy = t.spy();
    map.on('zoom', zoomSpy);

    simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta, metaKey: true});

    map._renderTaskQueue.run();

    t.equal(zoomSpy.callCount, 1);
    t.end();
});
