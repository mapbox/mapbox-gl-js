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

//mock MacIntel as window.navigator.platform for tests
Object.defineProperty(window.navigator, 'platform', {value: 'MacIntel', configurable: true});

test('ScrollZoomBlocker#onAdd adds a .mapboxgl-scroll-zoom-blocker-control element', (t) => {
    const map = createMap(t);

    const scrollZoomBlockerControl = new ScrollZoomBlockerControl();
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

test('ScrollZoomBlockerControl content can be set via setText', (t) => {
    const map = createMap(t);

    const scrollZoomBlockerControl = new ScrollZoomBlockerControl().setText('Hello World');
    map.addControl(scrollZoomBlockerControl);

    t.equal(scrollZoomBlockerControl.getElement().textContent, 'Hello World');
    t.end();
});

test('ScrollZoomBlockerControl can be set via setDOMContent', (t) => {
    const map = createMap(t);
    const content = window.document.createElement('span');

    const scrollZoomBlockerControl = new ScrollZoomBlockerControl().setDOMContent(content);
    map.addControl(scrollZoomBlockerControl);

    t.equal(scrollZoomBlockerControl.getElement().querySelector('.mapboxgl-scroll-zoom-blocker-control-content').firstChild, content);
    t.end();
});

test('ScrollZoomBlockerControl alert opacity is set to 1 when wheel event occurs without CTRL/CMD key pressed', (t) => {
    const map = createMap(t);

    const scrollZoomBlockerControl = new ScrollZoomBlockerControl();
    map.addControl(scrollZoomBlockerControl);

    map.on('wheel', () => {
        t.equal(scrollZoomBlockerControl.getElement().style.opacity, '1');
    });

    simulate.wheel(map.getCanvas());

    t.end();
});

test('ScrollZoomBlockerControl alert is visible when wheel event occurs without CTRL/CMD key pressed', (t) => {
    const map = createMap(t);

    const scrollZoomBlockerControl = new ScrollZoomBlockerControl();
    map.addControl(scrollZoomBlockerControl);

    map.on('wheel', () => {
        t.equal(scrollZoomBlockerControl.getElement().style.visibility, 'visible');
    });

    simulate.wheel(map.getCanvas());

    t.end();
});

test('ScrollZoomBlockerControl alert, when showAlert option is set to false, does not display when wheel event occurs without CTRL/CMD key pressed', (t) => {
    const map = createMap(t);

    const scrollZoomBlockerControl = new ScrollZoomBlockerControl({showAlert: false});
    map.addControl(scrollZoomBlockerControl);

    map.on('wheel', () => {
        t.equal(scrollZoomBlockerControl.getElement().style.length, 0);
    });

    simulate.wheel(map.getCanvas());

    t.end();
});

test('ScrollZoomBlockerControl#onAdd prevents scroll zoom when CTRL or CMD key are not pressed during wheel event', (t) => {
    const map = createMap(t);

    const scrollZoomBlockerControl = new ScrollZoomBlockerControl();
    map.addControl(scrollZoomBlockerControl);

    const zoomSpy = t.spy();
    map.on('zoom', zoomSpy);

    simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta});

    t.equal(zoomSpy.callCount, 0);
    t.end();
});

test('ScrollZoomBlockerControl#onAdd allows scroll zoom when CTRL key is pressed during wheel event', (t) => {
    const map = createMap(t);

    const scrollZoomBlockerControl = new ScrollZoomBlockerControl();
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

    const scrollZoomBlockerControl = new ScrollZoomBlockerControl();
    map.addControl(scrollZoomBlockerControl);

    const zoomSpy = t.spy();
    map.on('zoom', zoomSpy);

    simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta, metaKey: true});

    map._renderTaskQueue.run();

    t.equal(zoomSpy.callCount, 1);
    t.end();
});

test('ScrollZoomBlockerControl adds classes from className option, methods for class manipulation work properly', (t) => {
    const map = createMap(t);

    const scrollZoomBlockerControl = new ScrollZoomBlockerControl({className: 'some classes'});
    map.addControl(scrollZoomBlockerControl);

    const scrollZoomBlockerControlEl = scrollZoomBlockerControl.getElement();
    t.ok(scrollZoomBlockerControlEl.classList.contains('some'));
    t.ok(scrollZoomBlockerControlEl.classList.contains('classes'));

    scrollZoomBlockerControl.addClassName('addedClass');
    t.ok(scrollZoomBlockerControlEl.classList.contains('addedClass'));

    scrollZoomBlockerControl.removeClassName('addedClass');
    t.ok(!scrollZoomBlockerControlEl.classList.contains('addedClass'));

    scrollZoomBlockerControl.toggleClassName('toggle');
    t.ok(scrollZoomBlockerControlEl.classList.contains('toggle'));

    scrollZoomBlockerControl.toggleClassName('toggle');
    t.ok(!scrollZoomBlockerControlEl.classList.contains('toggle'));

    t.end();
});

test('scrollZoomBlockerControl className option and addClassName both add classes', (t) => {
    const map = createMap(t);
    const scrollZoomBlockerControl = new ScrollZoomBlockerControl({className: 'some classes'});
    scrollZoomBlockerControl.addClassName('even')
        .addClassName('more');

    map.addControl(scrollZoomBlockerControl);
    scrollZoomBlockerControl.addClassName('one-more');

    const scrollZoomBlockerControlEl = scrollZoomBlockerControl.getElement();
    t.ok(scrollZoomBlockerControlEl.classList.contains('some'));
    t.ok(scrollZoomBlockerControlEl.classList.contains('classes'));
    t.ok(scrollZoomBlockerControlEl.classList.contains('even'));
    t.ok(scrollZoomBlockerControlEl.classList.contains('more'));
    t.ok(scrollZoomBlockerControlEl.classList.contains('one-more'));
    t.end();
});

test('scrollZoomBlockerControl removeControl removes scrollZoomBlockerControl', (t) => {
    const map = createMap(t);

    const scrollZoomBlockerControl = new ScrollZoomBlockerControl();
    map.addControl(scrollZoomBlockerControl);

    const zoomSpy = t.spy();
    map.on('zoom', zoomSpy);

    map.on('load', () => {
        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta});

        map.removeControl(scrollZoomBlockerControl);

        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta});

        t.equal(zoomSpy.callCount, 1);
    });

    t.end();
});
