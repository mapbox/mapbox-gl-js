import {describe, test, expect, vi, createMap as globalCreateMap, beforeAll, afterAll, waitFor} from "../../util/vitest.js";
import Marker from '../../../src/ui/marker.js';
import Popup from '../../../src/ui/popup.js';
import LngLat from '../../../src/geo/lng_lat.js';
import {Event} from '../../../src/util/evented.js';
import Point from '@mapbox/point-geometry';
import simulate, {constructTouch} from '../../util/simulate_interaction.js';

function createMap(options = {}) {
    const container = window.document.createElement('div');
    Object.defineProperty(container, 'getBoundingClientRect',
        {value: () => ({height: 512, width: 512})});
    return globalCreateMap({container, ...options});
}

test('Marker uses a default marker element with an appropriate offset', () => {
    const marker = new Marker();
    expect(marker.getElement()).toBeTruthy();
    expect(marker.getOffset().equals(new Point(0, -14))).toBeTruthy();
});

test('Marker uses a default marker element with custom color', () => {
    const marker = new Marker({color: '#123456'});
    expect(marker.getElement().innerHTML.includes('#123456')).toBeTruthy();
});

test('Marker uses a default marker element with custom scale', () => {
    const map = createMap();
    const defaultMarker = new Marker()
        .setLngLat([0, 0])
        .addTo(map);
    // scale smaller than default
    const smallerMarker = new Marker({scale: 0.8})
        .setLngLat([0, 0])
        .addTo(map);
    // scale larger than default
    const largerMarker = new Marker({scale: 2})
        .setLngLat([0, 0])
        .addTo(map);

    // initial dimensions of svg element
    expect(
        defaultMarker.getElement().firstChild.getAttribute('height').includes('41')
    ).toBeTruthy();
    expect(defaultMarker.getElement().firstChild.getAttribute('width').includes('27')).toBeTruthy();

    // (41 * 0.8) = 32.8, (27 * 0.8) = 21.6
    expect(
        smallerMarker.getElement().firstChild.getAttribute('height').includes(`32.8`)
    ).toBeTruthy();
    expect(
        smallerMarker.getElement().firstChild.getAttribute('width').includes(`21.6`)
    ).toBeTruthy();

    // (41 * 2) = 82, (27 * 2) = 54
    expect(largerMarker.getElement().firstChild.getAttribute('height').includes('82')).toBeTruthy();
    expect(largerMarker.getElement().firstChild.getAttribute('width').includes('54')).toBeTruthy();
});

test('Marker uses a default marker with custom offset', () => {
    const marker = new Marker({offset: [1, 2]});
    expect(marker.getElement()).toBeTruthy();
    expect(marker.getOffset().equals(new Point(1, 2))).toBeTruthy();
});

test('Marker uses the provided element', () => {
    const element = window.document.createElement('div');
    const marker = new Marker({element});
    expect(marker.getElement()).toEqual(element);
});

test('Marker#addTo adds the marker element to the canvas container', () => {
    const map = createMap();
    new Marker()
        .setLngLat([-77.01866, 38.888])
        .addTo(map);

    expect(map.getCanvasContainer().querySelectorAll('.mapboxgl-marker').length).toEqual(1);

    map.remove();
});

test('Marker adds classes from className option, methods for class manipulation work properly', () => {
    const map = createMap();
    const marker = new Marker({className: 'some classes'})
        .setLngLat([0, 0])
        .addTo(map);

    const markerElement = marker.getElement();
    expect(markerElement.classList.contains('some')).toBeTruthy();
    expect(markerElement.classList.contains('classes')).toBeTruthy();

    marker.addClassName('addedClass');
    expect(markerElement.classList.contains('addedClass')).toBeTruthy();

    marker.removeClassName('addedClass');
    expect(!markerElement.classList.contains('addedClass')).toBeTruthy();

    marker.toggleClassName('toggle');
    expect(markerElement.classList.contains('toggle')).toBeTruthy();

    marker.toggleClassName('toggle');
    expect(!markerElement.classList.contains('toggle')).toBeTruthy();
});

test('Marker adds classes from element option, make sure it persists between class manipulations', () => {
    const map = createMap();
    const el = window.document.createElement('div');
    el.className = 'marker';

    const marker = new Marker({element: el})
        .setLngLat([0, 0])
        .addTo(map);

    const markerElement = marker.getElement();
    expect(markerElement.classList.contains('marker')).toBeTruthy();

    marker.addClassName('addedClass');
    expect(markerElement.classList.contains('addedClass')).toBeTruthy();
    expect(markerElement.classList.contains('marker')).toBeTruthy();

    marker.removeClassName('addedClass');
    expect(!markerElement.classList.contains('addedClass')).toBeTruthy();
    expect(markerElement.classList.contains('marker')).toBeTruthy();

    marker.toggleClassName('toggle');
    expect(markerElement.classList.contains('toggle')).toBeTruthy();
    expect(markerElement.classList.contains('marker')).toBeTruthy();

    marker.toggleClassName('toggle');
    expect(!markerElement.classList.contains('toggle')).toBeTruthy();
    expect(markerElement.classList.contains('marker')).toBeTruthy();
});

test('Marker#addClassName adds classes when called before adding marker to map', () => {
    const map = createMap();
    const marker = new Marker();
    marker.addClassName('some');
    marker.addClassName('classes');

    marker.setLngLat([0, 0])
        .addTo(map);

    const markerElement = marker.getElement();
    expect(markerElement.classList.contains('some')).toBeTruthy();
    expect(markerElement.classList.contains('classes')).toBeTruthy();
});

test('Marker className option and addClassName both add classes', () => {
    const map = createMap();
    const marker = new Marker({className: 'some classes'});
    marker.addClassName('even')
        .addClassName('more');

    marker.setLngLat([0, 0])
        .addTo(map);

    marker.addClassName('one-more');

    const markerElement = marker.getElement();
    expect(markerElement.classList.contains('some')).toBeTruthy();
    expect(markerElement.classList.contains('classes')).toBeTruthy();
    expect(markerElement.classList.contains('even')).toBeTruthy();
    expect(markerElement.classList.contains('more')).toBeTruthy();
    expect(markerElement.classList.contains('one-more')).toBeTruthy();
});

test('Methods for class manipulation work properly when marker is not on map', () => {
    const map = createMap();
    const marker = new Marker()
        .setLngLat([0, 0])
        .addClassName('some')
        .addClassName('classes');

    let markerElement = marker.addTo(map).getElement();
    expect(markerElement.classList.contains('some')).toBeTruthy();
    expect(markerElement.classList.contains('classes')).toBeTruthy();

    marker.remove();
    marker.removeClassName('some');
    markerElement = marker.addTo(map).getElement();

    expect(!markerElement.classList.contains('some')).toBeTruthy();

    marker.remove();
    marker.toggleClassName('toggle');
    markerElement = marker.addTo(map).getElement();

    expect(markerElement.classList.contains('toggle')).toBeTruthy();

    marker.remove();
    marker.toggleClassName('toggle');
    markerElement = marker.addTo(map).getElement();

    expect(!markerElement.classList.contains('toggle')).toBeTruthy();
});

test('Marker provides LngLat accessors', () => {
    expect(new Marker().getLngLat()).toEqual(undefined);

    expect(new Marker().setLngLat([1, 2]).getLngLat() instanceof LngLat).toBeTruthy();
    expect(new Marker().setLngLat([1, 2]).getLngLat()).toEqual(new LngLat(1, 2));

    expect(new Marker().setLngLat(new LngLat(1, 2)).getLngLat() instanceof LngLat).toBeTruthy();
    expect(new Marker().setLngLat(new LngLat(1, 2)).getLngLat()).toEqual(new LngLat(1, 2));
});

test('Marker provides offset accessors', () => {
    expect(new Marker().setOffset([1, 2]).getOffset() instanceof Point).toBeTruthy();
    expect(new Marker().setOffset([1, 2]).getOffset()).toEqual(new Point(1, 2));

    expect(new Marker().setOffset(new Point(1, 2)).getOffset() instanceof Point).toBeTruthy();
    expect(new Marker().setOffset(new Point(1, 2)).getOffset()).toEqual(new Point(1, 2));
});

test('Marker#setPopup binds a popup', () => {
    const popup = new Popup();
    const marker = new Marker()
        .setPopup(popup);
    expect(marker.getPopup()).toEqual(popup);
});

test('Marker#setPopup unbinds a popup', () => {
    const marker = new Marker()
        .setPopup(new Popup())
        .setPopup();
    expect(!marker.getPopup()).toBeTruthy();
});

test('Marker#togglePopup opens a popup that was closed', () => {
    const map = createMap();
    const marker = new Marker()
        .setLngLat([0, 0])
        .addTo(map)
        .setPopup(new Popup())
        .togglePopup();

    expect(marker.getPopup().isOpen()).toBeTruthy();
    expect(marker.getElement().getAttribute('aria-expanded')).toEqual('true');

    map.remove();
});

test('Marker#togglePopup closes a popup that was open', () => {
    const map = createMap();
    const marker = new Marker()
        .setLngLat([0, 0])
        .addTo(map)
        .setPopup(new Popup())
        .togglePopup()
        .togglePopup();

    expect(!marker.getPopup().isOpen()).toBeTruthy();
    expect(marker.getElement().getAttribute('aria-expanded')).toEqual('false');

    map.remove();
});

test('Enter key on Marker opens a popup that was closed', () => {
    const map = createMap();
    const marker = new Marker()
        .setLngLat([0, 0])
        .addTo(map)
        .setPopup(new Popup());

    // popup not initially open
    expect(marker.getPopup().isOpen()).toBeFalsy();

    simulate.keypress(marker.getElement(), {code: 'Enter'});

    // popup open after Enter keypress
    expect(marker.getPopup().isOpen()).toBeTruthy();

    map.remove();
});

test('Interactive markers should have a default aria-label and a role attribute set to button', () => {
    const map = createMap();
    const element = window.document.createElement('div');
    const marker = new Marker({color: "#FFFFFF", element})
        .setLngLat([0, 0])
        .addTo(map)
        .setPopup(new Popup());

    expect(marker.getElement().hasAttribute('aria-label')).toBeTruthy();
    expect(marker.getElement().getAttribute('role')).toEqual('button');

    map.remove();
});

test('Space key on Marker opens a popup that was closed', () => {
    const map = createMap();
    const marker = new Marker()
        .setLngLat([0, 0])
        .addTo(map)
        .setPopup(new Popup());

    // popup not initially open
    expect(marker.getPopup().isOpen()).toBeFalsy();

    simulate.keypress(marker.getElement(), {code: 'Space'});

    // popup open after Enter keypress
    expect(marker.getPopup().isOpen()).toBeTruthy();

    map.remove();
});

test('Marker#setPopup sets a tabindex', () => {
    const popup = new Popup();
    const marker = new Marker()
        .setPopup(popup);
    expect(marker.getElement().getAttribute('tabindex')).toEqual("0");
});

test('Marker#setPopup removes tabindex when unset', () => {
    const popup = new Popup();
    const marker = new Marker()
        .setPopup(popup)
        .setPopup();
    expect(marker.getElement().getAttribute('tabindex')).toBeFalsy();
});

test('Marker#setPopup does not replace existing tabindex', () => {
    const element = window.document.createElement('div');
    element.setAttribute('tabindex', '5');
    const popup = new Popup();
    const marker = new Marker({element})
        .setPopup(popup);
    expect(marker.getElement().getAttribute('tabindex')).toEqual("5");
});

test('Marker anchor defaults to center', () => {
    const map = createMap();
    const marker = new Marker()
        .setLngLat([0, 0])
        .addTo(map);
    map._domRenderTaskQueue.run();

    expect(marker.getElement().classList.contains('mapboxgl-marker-anchor-center')).toBeTruthy();
    expect(marker.getElement().style.transform).toMatch(/translate\(-50%,\s?-50%\)/);

    map.remove();
});

test('Marker anchors as specified by the anchor option', () => {
    const map = createMap();
    const marker = new Marker({anchor: 'top'})
        .setLngLat([0, 0])
        .addTo(map);
    map._domRenderTaskQueue.run();

    expect(marker.getElement().classList.contains('mapboxgl-marker-anchor-top')).toBeTruthy();
    expect(marker.getElement().style.transform).toMatch(/translate\(-50%, 0px\)/);

    map.remove();
});

test('Transform reflects default offset', () => {
    const map = createMap();
    const marker = new Marker()
        .setLngLat([0, 0])
        .addTo(map);
    map._domRenderTaskQueue.run();

    expect(marker.getElement().style.transform).toMatch(/translate\(0px, -14px\)/);

    map.remove();
});

test('Marker is transformed to center of screen', () => {
    const map = createMap();
    const marker = new Marker()
        .setLngLat([0, 0])
        .addTo(map);
    map._domRenderTaskQueue.run();

    expect(marker.getElement().style.transform).toMatch("translate(256px, 256px");

    map.remove();
});

test('Marker accepts backward-compatible constructor parameters', () => {
    const element = window.document.createElement('div');

    const m1 = new Marker(element);
    expect(m1.getElement()).toEqual(element);

    const m2 = new Marker(element, {offset: [1, 2]});
    expect(m2.getElement()).toEqual(element);
    expect(m2.getOffset().equals(new Point(1, 2))).toBeTruthy();
});

test('Popup offsets around default Marker', () => {
    const map = createMap();

    const marker = new Marker()
        .setLngLat([0, 0])
        .setPopup(new Popup().setText('Test'))
        .addTo(map);
    map._domRenderTaskQueue.run();

    expect(marker.getPopup().options.offset.bottom[1] < 0).toBeTruthy();
    expect(marker.getPopup().options.offset.top[1] === 0).toBeTruthy();
    expect(marker.getPopup().options.offset.left[0] > 0).toBeTruthy();
    expect(marker.getPopup().options.offset.right[0] < 0).toBeTruthy();

    expect(marker.getPopup().options.offset['bottom-left'][0] > 0).toBeTruthy();
    expect(marker.getPopup().options.offset['bottom-left'][1] < 0).toBeTruthy();
    expect(marker.getPopup().options.offset['bottom-right'][0] < 0).toBeTruthy();
    expect(marker.getPopup().options.offset['bottom-right'][1] < 0).toBeTruthy();

    expect(marker.getPopup().options.offset['top-left']).toEqual([0, 0]);
    expect(marker.getPopup().options.offset['top-right']).toEqual([0, 0]);
});

test('Popup anchors around default Marker', () => {
    const map = createMap();

    const marker = new Marker()
        .setLngLat([0, 0])
        .setPopup(new Popup().setText('Test'))
        .addTo(map);

    // open the popup
    marker.togglePopup();

    const mapHeight = map._containerHeight;
    const markerTop = -marker.getPopup().options.offset.bottom[1]; // vertical distance from tip of marker to the top in pixels
    const markerRight = -marker.getPopup().options.offset.right[0]; // horizontal distance from the tip of the marker to the right in pixels

    // give the popup some height
    Object.defineProperty(marker.getPopup()._container, 'offsetWidth', {value: 100});
    Object.defineProperty(marker.getPopup()._container, 'offsetHeight', {value: 100});

    // marker should default to above since it has enough space
    map._domRenderTaskQueue.run();
    expect(
        marker.getPopup()._container.classList.contains('mapboxgl-popup-anchor-bottom')
    ).toBeTruthy();

    // move marker to the top forcing the popup to below
    marker.setLngLat(map.unproject([mapHeight / 2, markerTop]));
    map._domRenderTaskQueue.run();
    expect(
        marker.getPopup()._container.classList.contains('mapboxgl-popup-anchor-top')
    ).toBeTruthy();

    // move marker to the right forcing the popup to the left
    marker.setLngLat(map.unproject([mapHeight - markerRight, mapHeight / 2]));
    map._domRenderTaskQueue.run();
    expect(
        marker.getPopup()._container.classList.contains('mapboxgl-popup-anchor-right')
    ).toBeTruthy();

    // move marker to the left forcing the popup to the right
    marker.setLngLat(map.unproject([markerRight, mapHeight / 2]));
    map._domRenderTaskQueue.run();
    expect(
        marker.getPopup()._container.classList.contains('mapboxgl-popup-anchor-left')
    ).toBeTruthy();

    // move marker to the top left forcing the popup to the bottom right
    marker.setLngLat(map.unproject([markerRight, markerTop]));
    map._domRenderTaskQueue.run();
    expect(
        marker.getPopup()._container.classList.contains('mapboxgl-popup-anchor-top-left')
    ).toBeTruthy();

    // move marker to the top right forcing the popup to the bottom left
    marker.setLngLat(map.unproject([mapHeight - markerRight, markerTop]));
    map._domRenderTaskQueue.run();
    expect(
        marker.getPopup()._container.classList.contains('mapboxgl-popup-anchor-top-right')
    ).toBeTruthy();

    // move marker to the bottom left forcing the popup to the top right
    marker.setLngLat(map.unproject([markerRight, mapHeight]));
    map._domRenderTaskQueue.run();
    expect(
        marker.getPopup()._container.classList.contains('mapboxgl-popup-anchor-bottom-left')
    ).toBeTruthy();

    // move marker to the bottom right forcing the popup to the top left
    marker.setLngLat(map.unproject([mapHeight - markerRight, mapHeight]));
    map._domRenderTaskQueue.run();
    expect(
        marker.getPopup()._container.classList.contains('mapboxgl-popup-anchor-bottom-right')
    ).toBeTruthy();
});

test('Marker drag functionality can be added with drag option', () => {
    const map = createMap();
    const marker = new Marker({draggable: true})
        .setLngLat([0, 0])
        .addTo(map);

    expect(marker.isDraggable()).toEqual(true);

    map.remove();
});

test('Marker#setDraggable adds drag functionality', () => {
    const map = createMap();
    const marker = new Marker()
        .setLngLat([0, 0])
        .setDraggable(true)
        .addTo(map);

    expect(marker.isDraggable()).toEqual(true);

    map.remove();
});

test('Marker#setDraggable turns off drag functionality', () => {
    const map = createMap();
    const marker = new Marker({draggable: true})
        .setLngLat([0, 0])
        .addTo(map);

    expect(marker.isDraggable()).toEqual(true);

    marker.setDraggable(false);

    expect(marker.isDraggable()).toEqual(false);

    map.remove();
});

test('Marker#setOccludedOpacity functionality', () => {
    const map = createMap();
    const marker = new Marker({draggable: true, occludedOpacity: 0.8})
        .setLngLat([0, 0])
        .addTo(map);

    expect(marker.getOccludedOpacity()).toEqual(0.8);
    marker.setOccludedOpacity(0.5);
    expect(marker.getOccludedOpacity()).toEqual(0.5);

    map.remove();
});

test('Marker with draggable:true fires dragstart, drag, and dragend events at appropriate times in response to mouse-triggered drag with map-inherited clickTolerance', () => {
    const map = createMap();
    const marker = new Marker({draggable: true})
        .setLngLat([0, 0])
        .addTo(map);
    const el = marker.getElement();

    const dragstart = vi.fn();
    const drag      = vi.fn();
    const dragend   = vi.fn();

    marker.on('dragstart', dragstart);
    marker.on('drag',      drag);
    marker.on('dragend',   dragend);

    simulate.mousedown(el, {clientX: 0, clientY: 0});
    expect(dragstart).not.toHaveBeenCalled();
    expect(drag).not.toHaveBeenCalled();
    expect(dragend).not.toHaveBeenCalled();
    expect(el.style.pointerEvents).toEqual('');

    simulate.mousemove(el, {clientX: 2.9, clientY: 0});
    expect(dragstart).not.toHaveBeenCalled();
    expect(drag).not.toHaveBeenCalled();
    expect(dragend).not.toHaveBeenCalled();
    expect(el.style.pointerEvents).toEqual('');

    // above map's click tolerance
    simulate.mousemove(el, {clientX: 3.1, clientY: 0});
    expect(dragstart).toHaveBeenCalledTimes(1);
    expect(drag).toHaveBeenCalledTimes(1);
    expect(dragend).not.toHaveBeenCalled();
    expect(el.style.pointerEvents).toEqual('none');

    simulate.mousemove(el, {clientX: 0, clientY: 0});
    expect(dragstart).toHaveBeenCalledTimes(1);
    expect(drag).toHaveBeenCalledTimes(2);
    expect(dragend).not.toHaveBeenCalled();
    expect(el.style.pointerEvents).toEqual('none');

    simulate.mouseup(el);
    expect(dragstart).toHaveBeenCalledTimes(1);
    expect(drag).toHaveBeenCalledTimes(2);
    expect(dragend).toHaveBeenCalledTimes(1);
    expect(el.style.pointerEvents).toEqual('auto');

    map.remove();
});

test('Marker with draggable:true fires dragstart, drag, and dragend events at appropriate times in response to mouse-triggered drag with marker-specific clickTolerance', () => {
    const map = createMap();
    const marker = new Marker({draggable: true, clickTolerance: 4})
        .setLngLat([0, 0])
        .addTo(map);
    const el = marker.getElement();

    const dragstart = vi.fn();
    const drag      = vi.fn();
    const dragend   = vi.fn();

    marker.on('dragstart', dragstart);
    marker.on('drag',      drag);
    marker.on('dragend',   dragend);

    simulate.mousedown(el, {clientX: 0, clientY: 0});
    expect(dragstart).not.toHaveBeenCalled();
    expect(drag).not.toHaveBeenCalled();
    expect(dragend).not.toHaveBeenCalled();
    expect(el.style.pointerEvents).toEqual('');

    simulate.mousemove(el, {clientX: 3.9, clientY: 0});
    expect(dragstart).not.toHaveBeenCalled();
    expect(drag).not.toHaveBeenCalled();
    expect(dragend).not.toHaveBeenCalled();
    expect(el.style.pointerEvents).toEqual('');

    // above map's click tolerance
    simulate.mousemove(el, {clientX: 4.1, clientY: 0});
    expect(dragstart).toHaveBeenCalledTimes(1);
    expect(drag).toHaveBeenCalledTimes(1);
    expect(dragend).not.toHaveBeenCalled();
    expect(el.style.pointerEvents).toEqual('none');

    simulate.mousemove(el, {clientX: 0, clientY: 0});
    expect(dragstart).toHaveBeenCalledTimes(1);
    expect(drag).toHaveBeenCalledTimes(2);
    expect(dragend).not.toHaveBeenCalled();
    expect(el.style.pointerEvents).toEqual('none');

    simulate.mouseup(el);
    expect(dragstart).toHaveBeenCalledTimes(1);
    expect(drag).toHaveBeenCalledTimes(2);
    expect(dragend).toHaveBeenCalledTimes(1);
    expect(el.style.pointerEvents).toEqual('auto');

    map.remove();
});

test('Marker with draggable:false does not fire dragstart, drag, and dragend events in response to a mouse-triggered drag', () => {
    const map = createMap();
    const marker = new Marker({})
        .setLngLat([0, 0])
        .addTo(map);
    const el = marker.getElement();

    const dragstart = vi.fn();
    const drag      = vi.fn();
    const dragend   = vi.fn();

    marker.on('dragstart', dragstart);
    marker.on('drag',      drag);
    marker.on('dragend',   dragend);

    simulate.mousedown(el, {clientX: 0, clientY: 0});
    expect(dragstart).not.toHaveBeenCalled();
    expect(drag).not.toHaveBeenCalled();
    expect(dragend).not.toHaveBeenCalled();

    simulate.mousemove(el, {clientX: 3, clientY: 1});
    expect(dragstart).not.toHaveBeenCalled();
    expect(drag).not.toHaveBeenCalled();
    expect(dragend).not.toHaveBeenCalled();

    simulate.mouseup(el);
    expect(dragstart).not.toHaveBeenCalled();
    expect(drag).not.toHaveBeenCalled();
    expect(dragend).not.toHaveBeenCalled();

    map.remove();
});

test('Marker with draggable:true fires dragstart, drag, and dragend events at appropriate times in response to a touch-triggered drag with map-inherited clickTolerance', () => {
    const map = createMap();
    const marker = new Marker({draggable: true})
        .setLngLat([0, 0])
        .addTo(map);
    const el = marker.getElement();

    const dragstart = vi.fn();
    const drag      = vi.fn();
    const dragend   = vi.fn();

    marker.on('dragstart', dragstart);
    marker.on('drag',      drag);
    marker.on('dragend',   dragend);

    simulate.touchstart(el, {touches: [constructTouch(el, {clientX: 0, clientY: 0})]});
    expect(dragstart).not.toHaveBeenCalled();
    expect(drag).not.toHaveBeenCalled();
    expect(dragend).not.toHaveBeenCalled();
    expect(el.style.pointerEvents).toEqual('');

    simulate.touchmove(el, {touches: [constructTouch(el, {clientX: 2.9, clientY: 0})]});
    expect(dragstart).not.toHaveBeenCalled();
    expect(drag).not.toHaveBeenCalled();
    expect(dragend).not.toHaveBeenCalled();
    expect(el.style.pointerEvents).toEqual('');

    // above map's click tolerance
    simulate.touchmove(el, {touches: [constructTouch(el, {clientX: 3.1, clientY: 0})]});
    expect(dragstart).toHaveBeenCalledTimes(1);
    expect(drag).toHaveBeenCalledTimes(1);
    expect(dragend).not.toHaveBeenCalled();
    expect(el.style.pointerEvents).toEqual('none');

    simulate.touchmove(el, {touches: [constructTouch(el, {clientX: 0, clientY: 0})]});
    expect(dragstart).toHaveBeenCalledTimes(1);
    expect(drag).toHaveBeenCalledTimes(2);
    expect(dragend).not.toHaveBeenCalled();
    expect(el.style.pointerEvents).toEqual('none');

    simulate.touchend(el);
    expect(dragstart).toHaveBeenCalledTimes(1);
    expect(drag).toHaveBeenCalledTimes(2);
    expect(dragend).toHaveBeenCalledTimes(1);
    expect(el.style.pointerEvents).toEqual('auto');

    map.remove();
});

test('Marker with draggable:true fires dragstart, drag, and dragend events at appropriate times in response to a touch-triggered drag with marker-specific clickTolerance', () => {
    const map = createMap();
    const marker = new Marker({draggable: true, clickTolerance: 4})
        .setLngLat([0, 0])
        .addTo(map);
    const el = marker.getElement();

    const dragstart = vi.fn();
    const drag      = vi.fn();
    const dragend   = vi.fn();

    marker.on('dragstart', dragstart);
    marker.on('drag',      drag);
    marker.on('dragend',   dragend);

    simulate.touchstart(el, {touches: [constructTouch(el, {clientX: 0, clientY: 0})]});
    expect(dragstart).not.toHaveBeenCalled();
    expect(drag).not.toHaveBeenCalled();
    expect(dragend).not.toHaveBeenCalled();
    expect(el.style.pointerEvents).toEqual('');

    simulate.touchmove(el, {touches: [constructTouch(el, {clientX: 3.9, clientY: 0})]});
    expect(dragstart).not.toHaveBeenCalled();
    expect(drag).not.toHaveBeenCalled();
    expect(dragend).not.toHaveBeenCalled();
    expect(el.style.pointerEvents).toEqual('');

    // above map's click tolerance
    simulate.touchmove(el, {touches: [constructTouch(el, {clientX: 4.1, clientY: 0})]});
    expect(dragstart).toHaveBeenCalledTimes(1);
    expect(drag).toHaveBeenCalledTimes(1);
    expect(dragend).not.toHaveBeenCalled();
    expect(el.style.pointerEvents).toEqual('none');

    simulate.touchmove(el, {touches: [constructTouch(el, {clientX: 0, clientY: 0})]});
    expect(dragstart).toHaveBeenCalledTimes(1);
    expect(drag).toHaveBeenCalledTimes(2);
    expect(dragend).not.toHaveBeenCalled();
    expect(el.style.pointerEvents).toEqual('none');

    simulate.touchend(el);
    expect(dragstart).toHaveBeenCalledTimes(1);
    expect(drag).toHaveBeenCalledTimes(2);
    expect(dragend).toHaveBeenCalledTimes(1);
    expect(el.style.pointerEvents).toEqual('auto');

    map.remove();
});

test('Marker with draggable:false does not fire dragstart, drag, and dragend events in response to a touch-triggered drag', () => {
    const map = createMap();
    const marker = new Marker({})
        .setLngLat([0, 0])
        .addTo(map);
    const el = marker.getElement();

    const dragstart = vi.fn();
    const drag      = vi.fn();
    const dragend   = vi.fn();

    marker.on('dragstart', dragstart);
    marker.on('drag',      drag);
    marker.on('dragend',   dragend);

    simulate.touchstart(el, {touches: [constructTouch(el, {clientX: 0, clientY: 0})]});
    expect(dragstart).not.toHaveBeenCalled();
    expect(drag).not.toHaveBeenCalled();
    expect(dragend).not.toHaveBeenCalled();

    simulate.touchmove(el, {touches: [constructTouch(el, {clientX: 0, clientY: 0})]});
    expect(dragstart).not.toHaveBeenCalled();
    expect(drag).not.toHaveBeenCalled();
    expect(dragend).not.toHaveBeenCalled();

    simulate.touchend(el);
    expect(dragstart).not.toHaveBeenCalled();
    expect(drag).not.toHaveBeenCalled();
    expect(dragend).not.toHaveBeenCalled();

    map.remove();
});

test('Marker with draggable:true moves to new position in response to a mouse-triggered drag', () => {
    const map = createMap();
    const marker = new Marker({draggable: true})
        .setLngLat([0, 0])
        .addTo(map);
    const el = marker.getElement();
    const startPos = map.project(marker.getLngLat());
    simulate.mousedown(el);
    simulate.mousemove(el, {clientX: 10, clientY: 10});
    simulate.mouseup(el);

    const endPos = map.project(marker.getLngLat());
    expect(Math.round(endPos.x)).toEqual(startPos.x + 10);
    expect(Math.round(endPos.y)).toEqual(startPos.y + 10);

    map.remove();
});

test('Marker with draggable:false does not move to new position in response to a mouse-triggered drag', () => {
    const map = createMap();
    const marker = new Marker({})
        .setLngLat([0, 0])
        .addTo(map);
    const el = marker.getElement();
    const startPos = map.project(marker.getLngLat());

    simulate.mousedown(el);
    simulate.mousemove(el);
    simulate.mouseup(el);

    const endPos = map.project(marker.getLngLat());

    expect(startPos.x).toEqual(endPos.x);
    expect(startPos.y).toEqual(endPos.y);

    map.remove();
});

test('Marker with draggable:true does not error if removed on mousedown', () => {
    const map = createMap();
    const marker = new Marker({draggable: true})
        .setLngLat([0, 0])
        .addTo(map);
    const el = marker.getElement();
    simulate.mousedown(el);
    simulate.mousemove(el, {clientX: 10, clientY: 10});

    marker.remove();
    expect(map.fire('mouseup')).toBeTruthy();
});

test('Marker can set rotationAlignment and pitchAlignment', () => {
    const map = createMap();
    const marker = new Marker({rotationAlignment: 'map', pitchAlignment: 'map'})
        .setLngLat([0, 0])
        .addTo(map);

    expect(marker.getRotationAlignment()).toEqual('map');
    expect(marker.getPitchAlignment()).toEqual('map');

    map.remove();
});

test('Marker can set and update rotation', () => {
    const map = createMap();
    const marker = new Marker({rotation: 45})
        .setLngLat([0, 0])
        .addTo(map);

    expect(marker.getRotation()).toEqual(45);

    marker.setRotation(90);
    expect(marker.getRotation()).toEqual(90);

    map.remove();
});

test('Marker transforms rotation with the map', () => {
    const map = createMap();
    const marker = new Marker({rotationAlignment: 'map'})
        .setLngLat([0, 0])
        .addTo(map);
    map._domRenderTaskQueue.run();

    const rotationRegex = /rotateZ\(-?([0-9]+)deg\)/;
    expect(marker.getElement().style.transform.match(rotationRegex)).toBeFalsy();

    map.setBearing(map.getBearing() + 180);
    map._domRenderTaskQueue.run();

    const finalRotation = marker.getElement().style.transform.match(rotationRegex)[1];
    expect(finalRotation).toBe("180");

    map.remove();
});

test('Marker transforms pitch with the map', () => {
    const map = createMap();
    const marker = new Marker({pitchAlignment: 'map'})
        .setLngLat([0, 0])
        .addTo(map);

    map.setPitch(0);
    map._domRenderTaskQueue.run();

    const rotationRegex = /rotateX\(-?([0-9]+)deg\)/;
    expect(marker.getElement().style.transform.match(rotationRegex)).toBeFalsy();

    map.setPitch(45);
    map._domRenderTaskQueue.run();

    const finalPitch = marker.getElement().style.transform.match(rotationRegex)[1];
    expect(finalPitch).toBe("45");

    map.remove();
});

test('Unset pitchAlignment default to rotationAlignment', () => {
    const map = createMap();
    const marker = new Marker()
        .setLngLat([0, 0])
        .addTo(map);

    expect(marker.getRotationAlignment()).toEqual('viewport');
    expect(marker.getPitchAlignment()).toEqual('viewport');

    marker.setRotationAlignment('map');
    expect(marker.getRotationAlignment()).toEqual('map');
    expect(marker.getPitchAlignment()).toEqual('map');

    marker.setRotationAlignment('auto');
    expect(marker.getRotationAlignment()).toEqual('viewport');
    expect(marker.getPitchAlignment()).toEqual('viewport');

    map.remove();
});

test('Marker pitchAlignment when set to auto defaults to rotationAlignment', () => {
    const map = createMap();
    const marker = new Marker({rotationAlignment: 'map', pitchAlignment: 'auto'})
        .setLngLat([0, 0])
        .addTo(map);

    expect(marker.getRotationAlignment()).toEqual(marker.getPitchAlignment());

    map.remove();
});

test('Marker pitchAlignment when set to auto defaults to rotationAlignment (setter/getter)', () => {
    const map = createMap();
    const marker = new Marker({pitchAlignment: 'map'})
        .setLngLat([0, 0])
        .addTo(map);

    expect(marker.getPitchAlignment()).toEqual('map');
    marker.setRotationAlignment('viewport');
    marker.setPitchAlignment('auto');
    expect(marker.getRotationAlignment()).toEqual(marker.getPitchAlignment());

    map.remove();
});

test('Drag above horizon clamps', () => {
    const map = createMap();
    map.setPitch(85);
    const marker = new Marker({draggable: true})
        .setLngLat(map.unproject([map.transform.width / 2, map.transform.horizonLineFromTop() + 20]))
        .addTo(map);
    const el = marker.getElement();
    const startPos = map.project(marker.getLngLat());
    const atHorizon = map.project(map.unproject([map.transform.width / 2, map.transform.horizonLineFromTop()]));
    expect(atHorizon.y < startPos.y + 5).toBeTruthy();

    simulate.mousedown(el);
    simulate.mousemove(el, {clientX: 0, clientY: -40});
    simulate.mouseup(el);

    const endPos = map.project(marker.getLngLat());
    expect(Math.abs(endPos.x - startPos.x) < 0.00000000001).toBeTruthy();
    expect(endPos.y).toEqual(atHorizon.y);

    map.remove();
});

test('Drag below / behind camera', () => {
    const map = createMap({zoom: 3});
    map.setPitch(85);
    const marker = new Marker({draggable: true})
        .setLngLat(map.unproject([map.transform.width / 2, map.transform.height - 20]))
        .addTo(map);
    const el = marker.getElement();
    const startPos = map.project(marker.getLngLat());

    simulate.mousedown(el);
    simulate.mousemove(el, {clientX: 0, clientY: 40});
    simulate.mouseup(el);

    const endPos = map.project(marker.getLngLat());
    expect(Math.abs(endPos.x - startPos.x) < 0.00000000001).toBeTruthy();
    expect(Math.round(endPos.y)).toEqual(Math.round(startPos.y) + 40);

    map.remove();
});

test('When toggling projections, markers update with correct position', () => {
    const map = createMap();
    const marker = new Marker()
        .setLngLat([12, 55])
        .addTo(map);

    map.setCenter([-179, 0]);
    expect(marker.getLngLat().lng).toEqual(-348);

    map.setProjection('albers');

    map._domRenderTaskQueue.run();

    map.once('render', () => {
        expect(marker.getLngLat().lng).toEqual(12);
        map.remove();
    });
});

test('When disabling render world copies, markers update with correct position', () => {
    const map = createMap();
    const marker = new Marker()
        .setLngLat([12, 55])
        .addTo(map);

    map.setCenter([-179, 0]);
    expect(marker.getLngLat().lng).toEqual(-348);

    map.setRenderWorldCopies(false);

    map._domRenderTaskQueue.run();

    map.once('render', () => {
        expect(marker.getLngLat().lng).toEqual(12);
        map.remove();
    });
});

describe('Marker and fog', () => {
    let map, marker;

    beforeAll(async () => {
        map = createMap();
        marker = new Marker({draggable: true})
            .setLngLat([0, 0])
            .addTo(map)
            .setPopup(new Popup().setHTML(`a popup content`))
            .togglePopup();
        await waitFor(map, 'load');
        map.setFog({
            "range": [0.5, 10.5]
        });
        await waitFor(map, 'render');
        map.setZoom(10);
        map.setCenter([0, 0]);
    });

    test('not occluded', async () => {
        expect(map.getFog()).toBeTruthy();
        marker.setLngLat([0, 0]);

        await new Promise(resolve => {
            setTimeout(() => {
                expect(marker.getElement().style.opacity).toEqual("1");
                resolve();
            }, 100);
        });
    });

    test('occluded high', async () => {
        map.setBearing(90);
        map.setPitch(70);
        marker.setLngLat([1.0, 0]);

        await new Promise(resolve => {
            setTimeout(() => {
                expect(marker.getElement().style.opacity).toEqual('0.59002');
                resolve();
            }, 100);
        });
    });

    test('occluded mid', async () => {
        map.setBearing(90);
        map.setPitch(70);
        marker.setLngLat([1.2, 0]);

        await new Promise(resolve => {
            setTimeout(() => {
                expect(marker.getElement().style.opacity).toEqual('0.458001');
                resolve();
            }, 100);
        });
    });

    test('occluded low', async () => {
        map.setBearing(90);
        map.setPitch(70);
        marker.setLngLat([2.5, 0]);

        await new Promise(resolve => {
            setTimeout(() => {
                expect(marker.getElement().style.opacity).toEqual('0.0534554');
                resolve();
            }, 100);
        });
    });

    test('occluded', async () => {
        map.setBearing(90);
        map.setPitch(70);
        marker.setLngLat([4, 0]);

        await new Promise(resolve => {
            setTimeout(() => {
                expect(marker.getElement().style.opacity).toEqual('0');
                resolve();
            }, 100);
        });
    });
});

describe('Globe', () => {
    test('Marker is transformed to center of screen', () => {
        const map = createMap();
        const marker = new Marker()
            .setLngLat([0, 0])
            .addTo(map);
        map._domRenderTaskQueue.run();

        expect(marker.getElement().style.transform).toMatch("translate(256px, 256px");
        map.setProjection('globe');
        map.once('render', () => {
            expect(marker.getElement().style.transform).toMatch("translate(256px, 256px");
            map.remove();
        });
    });

    test('Marker is positioned on globe edge', async () => {
        const map = createMap();
        const marker = new Marker()
            .setLngLat([82, 0])
            .addTo(map);
        map._domRenderTaskQueue.run();

        expect(marker.getElement().style.transform).toMatch("translate(373px, 256px)");
        map.setProjection('globe');

        await new Promise(resolve => {
            map.once('render', () => {
                expect(marker.getElement().style.transform).toMatch("translate(357px, 256px)");
                expect(marker.getElement().style.opacity).toBe('1');
                expect(marker.getElement().style.pointerEvents).toBe('auto');
                map.remove();
                resolve();
            });
        });
    });

    test('Marker is occluded on the far side of the globe', async () => {
        const map = createMap();
        const marker = new Marker()
            .setLngLat([180, 0])
            .addTo(map);
        map._domRenderTaskQueue.run();

        expect(marker.getElement().style.transform).toMatch("translate(512px, 256px)");
        map.setProjection('globe');

        await new Promise(resolve => {
            map.once('render', () => {
                expect(marker.getElement().style.transform).toMatch("translate(256px, 256px)");
                expect(marker.getElement().style.opacity).toBe('0');
                expect(marker.getElement().style.pointerEvents).toBe('none');
                map.remove();
                resolve();
            });

        });
    });

    function transform(marker) { return marker.getElement().style.transform; }

    function rotation(marker, dimension) {
        const transform = marker.getElement().style.transform;
        const reg = new RegExp(`rotate${dimension}\\(([-.e0-9]+)deg\\)`);
        return +Number.parseFloat(transform.match(reg)[1]).toFixed();
    }

    test('Globe with pitchAlignment and rotationAlignment: map, changing longitude', async () => {
        const map = createMap();
        map.setProjection('globe');
        const marker = new Marker({rotationAlignment: 'map', pitchAlignment: 'map'})
            .setLngLat([0, 0])
            .addTo(map);
        map._domRenderTaskQueue.run();

        expect(transform(marker)).toMatch("translate(256px, 256px)");
        expect(transform(marker)).not.toMatch("rotateX");
        expect(transform(marker)).not.toMatch("rotateZ");

        marker.setLngLat([82, 0]);

        await new Promise(resolve => {
            map.once('render', () => {
                expect(transform(marker)).toMatch("translate(357px, 256px)");
                expect(rotation(marker, "X")).toBe(0);
                expect(rotation(marker, "Y")).toBe(89);
                expect(marker.getElement().style.opacity).toBe('1');
                map.remove();
                resolve();
            });
        });
    });

    test('Globe with pitchAlignment and rotationAlignment: map, changing lattitude', () => {
        const map = createMap();
        map.setProjection('globe');
        const marker = new Marker({rotationAlignment: 'map', pitchAlignment: 'map'})
            .setLngLat([0, 82])
            .addTo(map);
        map._domRenderTaskQueue.run();

        expect(transform(marker)).toMatch("translate(256px, 155px)");
        expect(rotation(marker, "X")).toBe(89);
        expect(rotation(marker, "Y")).toBe(0);

        marker.setLngLat([-45, 45]);
        map.on('render', () => {
            expect(transform(marker)).toMatch("translate(202px, 180px)");
            expect(rotation(marker, "X")).toBe(39);
            expect(rotation(marker, "Y")).toBe(-28);
            expect(rotation(marker, "Z")).toBe(39);
            map.remove();
        });
    });

    test('Globe with pitchAlignment and rotationAlingment: map, changing pitch', () => {
        const map = createMap();
        map.setProjection('globe');
        const m1 = new Marker({rotationAlignment: 'map', pitchAlignment: 'map'})
            .setLngLat([0, 0])
            .addTo(map);
        const m2 = new Marker({rotationAlignment: 'map', pitchAlignment: 'map'})
            .setLngLat([0, 45])
            .addTo(map);
        const m3 = new Marker({rotationAlignment: 'map', pitchAlignment: 'map'})
            .setLngLat([0, -30])
            .addTo(map);
        const m4 = new Marker({rotationAlignment: 'map', pitchAlignment: 'map'})
            .setLngLat([45, -45])
            .addTo(map);
        map._domRenderTaskQueue.run();

        expect(transform(m1)).toMatch("translate(256px, 256px)");
        expect(transform(m1)).not.toMatch("rotateX");
        expect(transform(m1)).not.toMatch("rotateY");
        expect(transform(m1)).not.toMatch("rotateZ");

        expect(transform(m2)).toMatch("translate(256px, 178px)");
        expect(rotation(m2, "X")).toBe(51);
        expect(rotation(m2, "Y")).toBe(0);
        expect(transform(m1)).not.toMatch("rotateZ");

        expect(transform(m3)).toMatch("translate(256px, 312px)");
        expect(rotation(m3, "X")).toBe(-34);
        expect(rotation(m3, "Y")).toBe(0);
        expect(transform(m1)).not.toMatch("rotateZ");

        expect(transform(m4)).toMatch("translate(310px, 332px)");
        expect(rotation(m4, "X")).toBe(-39);
        expect(rotation(m4, "Y")).toBe(28);
        expect(rotation(m4, "Z")).toBe(39);

        map.setPitch(45);
        map.once('render', () => {
            expect(transform(m1)).toMatch("translate(256px, 256px)");
            expect(rotation(m1, "X")).toBe(45);
            expect(rotation(m1, "Y")).toBe(0);
            expect(transform(m1)).not.toMatch("rotateZ");

            expect(transform(m2)).toMatch("translate(256px, 225px)");
            expect(rotation(m2, "X")).toBe(92);
            expect(rotation(m2, "Y")).toBe(0);
            expect(transform(m1)).not.toMatch("rotateZ");

            expect(transform(m3)).toMatch("translate(256px, 310px)");
            expect(rotation(m3, "X")).toBe(11);
            expect(rotation(m3, "Y")).toBe(0);
            expect(transform(m1)).not.toMatch("rotateZ");

            expect(transform(m4)).toMatch("translate(315px, 357px)");
            expect(rotation(m4, "X")).toBe(-12);
            expect(rotation(m4, "Y")).toBe(26);
            expect(rotation(m4, "Z")).toBe(29);

            map.setPitch(30);
            map.once('render', () => {
                expect(transform(m1)).toMatch("translate(256px, 256px)");
                expect(rotation(m1, "X")).toBe(30);
                expect(rotation(m1, "Y")).toBe(0);
                expect(transform(m1)).not.toMatch("rotateZ");

                expect(transform(m2)).toMatch("translate(256px, 207px)");
                expect(rotation(m2, "X")).toBe(79);
                expect(rotation(m2, "Y")).toBe(0);
                expect(transform(m1)).not.toMatch("rotateZ");

                expect(transform(m3)).toMatch("translate(256px, 315px)");
                expect(rotation(m3, "X")).toBe(-4);
                expect(rotation(m3, "Y")).toBe(0);
                expect(transform(m1)).not.toMatch("rotateZ");

                expect(transform(m4)).toMatch("translate(313px, 354px)");
                expect(rotation(m4, "X")).toBe(-21);
                expect(rotation(m4, "Y")).toBe(25);
                expect(rotation(m4, "Z")).toBe(31);

                map.remove();
            });
        });
    });

    test('rotationAlignment: horizon rotates at low zoom', () => {
        const map = createMap();
        map.setProjection('globe');
        const marker = new Marker({rotationAlignment: 'horizon'})
            .setLngLat([0, 1])
            .addTo(map);
        map._domRenderTaskQueue.run();

        expect(transform(marker)).not.toMatch("rotateZ");

        marker.setLngLat([0, -1]);
        map._domRenderTaskQueue.run();
        expect(rotation(marker, "Z")).toBe(180);
        expect(transform(marker)).not.toMatch("rotateX");
        expect(transform(marker)).not.toMatch("rotateY");

        marker.setLngLat([1, 1]);
        map._domRenderTaskQueue.run();
        expect(rotation(marker, "Z")).toBe(45);
        expect(transform(marker)).not.toMatch("rotateX");
        expect(transform(marker)).not.toMatch("rotateY");

        marker.setLngLat([1, -1]);
        map._domRenderTaskQueue.run();
        expect(rotation(marker, "Z")).toBe(135);
        expect(transform(marker)).not.toMatch("rotateX");
        expect(transform(marker)).not.toMatch("rotateY");

        marker.setLngLat([-1, -1]);
        map._domRenderTaskQueue.run();
        expect(rotation(marker, "Z")).toBe(-135);
        expect(transform(marker)).not.toMatch("rotateX");
        expect(transform(marker)).not.toMatch("rotateY");

        marker.setLngLat([-1, 1]);
        map._domRenderTaskQueue.run();
        expect(rotation(marker, "Z")).toBe(-45);
        expect(transform(marker)).not.toMatch("rotateX");
        expect(transform(marker)).not.toMatch("rotateY");

        map.setBearing(90);
        map._domRenderTaskQueue.run();
        expect(rotation(marker, "Z")).toBe(-135);
        expect(transform(marker)).not.toMatch("rotateX");
        expect(transform(marker)).not.toMatch("rotateY");

        map.remove();
    });

    test('rotationAlignment: horizon does not rotate at high zoom', () => {
        const map = createMap();
        map.setProjection('globe');
        map.setZoom(10);
        const marker = new Marker({rotationAlignment: 'horizon'})
            .setLngLat([0, 1])
            .addTo(map);
        map._domRenderTaskQueue.run();

        expect(transform(marker)).not.toMatch("rotateZ");

        marker.setLngLat([0, -1]);
        map._domRenderTaskQueue.run();
        expect(transform(marker)).not.toMatch("rotateZ");
        expect(transform(marker)).not.toMatch("rotateX");
        expect(transform(marker)).not.toMatch("rotateY");

        marker.setLngLat([1, 1]);
        map._domRenderTaskQueue.run();
        expect(transform(marker)).not.toMatch("rotateZ");
        expect(transform(marker)).not.toMatch("rotateX");
        expect(transform(marker)).not.toMatch("rotateY");

        map.setBearing(90);
        map._domRenderTaskQueue.run();
        expect(transform(marker)).not.toMatch("rotateZ");
        expect(transform(marker)).not.toMatch("rotateX");
        expect(transform(marker)).not.toMatch("rotateY");

        map.remove();
    });

    test('rotationAlignment: horizon rotates partially during transition', () => {
        const map = createMap();
        map.setProjection('globe');
        map.setZoom(5); // halfway through transition
        const marker = new Marker({rotationAlignment: 'horizon'})
            .setLngLat([0, 1])
            .addTo(map);
        map._domRenderTaskQueue.run();

        expect(rotation(marker, "Z")).toBe(0);

        marker.setLngLat([0, -1]);
        map._domRenderTaskQueue.run();
        expect(rotation(marker, "Z")).toBe(-0);
        expect(transform(marker)).not.toMatch("rotateX");
        expect(transform(marker)).not.toMatch("rotateY");

        marker.setLngLat([1, 1]);
        map._domRenderTaskQueue.run();
        expect(rotation(marker, "Z")).toBe(4);
        expect(transform(marker)).not.toMatch("rotateX");
        expect(transform(marker)).not.toMatch("rotateY");

        marker.setLngLat([1, -1]);
        map._domRenderTaskQueue.run();
        expect(rotation(marker, "Z")).toBe(6);
        expect(transform(marker)).not.toMatch("rotateX");
        expect(transform(marker)).not.toMatch("rotateY");

        marker.setLngLat([-1, -1]);
        map._domRenderTaskQueue.run();
        expect(rotation(marker, "Z")).toBe(-6);
        expect(transform(marker)).not.toMatch("rotateX");
        expect(transform(marker)).not.toMatch("rotateY");

        marker.setLngLat([-1, 1]);
        map._domRenderTaskQueue.run();
        expect(rotation(marker, "Z")).toBe(-4);
        expect(transform(marker)).not.toMatch("rotateX");
        expect(transform(marker)).not.toMatch("rotateY");

        map.setBearing(90);
        map._domRenderTaskQueue.run();
        expect(rotation(marker, "Z")).toBe(-6);
        expect(transform(marker)).not.toMatch("rotateX");
        expect(transform(marker)).not.toMatch("rotateY");

        map.remove();
    });

    test('rotationAlignment: horizon behaves as viewport in non-globe projections', () => {
        const map = createMap();
        map.setProjection('albers');
        const marker = new Marker({rotationAlignment: 'horizon'})
            .setLngLat([0, 1])
            .addTo(map);
        map._domRenderTaskQueue.run();

        expect(transform(marker)).not.toMatch("rotateZ");

        marker.setLngLat([0, -1]);
        map._domRenderTaskQueue.run();
        expect(transform(marker)).not.toMatch("rotateZ");
        expect(transform(marker)).not.toMatch("rotateX");
        expect(transform(marker)).not.toMatch("rotateY");

        marker.setLngLat([1, 1]);
        map._domRenderTaskQueue.run();
        expect(transform(marker)).not.toMatch("rotateZ");
        expect(transform(marker)).not.toMatch("rotateX");
        expect(transform(marker)).not.toMatch("rotateY");

        map.setBearing(90);
        map._domRenderTaskQueue.run();
        expect(transform(marker)).not.toMatch("rotateZ");
        expect(transform(marker)).not.toMatch("rotateX");
        expect(transform(marker)).not.toMatch("rotateY");

        map.remove();
    });
});

test('Markers on globe account for rotation', () => {
    const map = createMap();
    map.setProjection('globe');
    map._domRenderTaskQueue.run();
    const markerMap = new Marker({rotationAlignment: 'map', rotation: 45})
        .setLngLat([0, 0])
        .addTo(map);
    const markerView = new Marker({rotation: 45})
        .setLngLat([0, 0])
        .addTo(map);

    const rotationRegex = /rotateZ\(-?([0-9]+)deg\)/;

    expect(markerView.getElement().style.transform.match(rotationRegex)[1]).toBe("45");
    expect(markerMap.getElement().style.transform.match(rotationRegex)[1]).toBe("45");

    map.setBearing(map.getBearing() + 180);
    map._domRenderTaskQueue.run();

    expect(markerView.getElement().style.transform.match(rotationRegex)[1]).toBe("45");
    expect(markerMap.getElement().style.transform.match(rotationRegex)[1]).toBe("135");

    map.remove();
});

describe('Snap To Pixel', () => {
    let map, marker;

    beforeAll(() => {
        map = createMap();
        marker = new Marker({draggable: true})
            .setLngLat([1, 2])
            .addTo(map);
    });
    test("Snap To Pixel immediately after initializing marker", () => {
        expect(marker._pos).toStrictEqual(marker._pos.round());
    });
    test("Not Immediately Snap To Pixel After setLngLat", async () => {
        marker.setLngLat([2, 1]);
        const pos = marker._pos;
        await new Promise(resolve => {
            setTimeout(() => {
                expect(marker._pos).not.toStrictEqual(pos);
                expect(marker._pos).toStrictEqual(pos.round());
                resolve();
            }, 100);
        });
    });
    test("Immediately Snap To Pixel on moveend", () => {
        map.fire(new Event("moveend"));
        expect(marker._pos).toStrictEqual(marker._pos.round());
    });
    test("Not Immediately Snap To Pixel when Map move", async () => {
        map.fire(new Event("move"));
        expect(marker._pos).not.toBe(marker._pos.round());
        await new Promise(resolve => {
            window.requestAnimationFrame(() => {
                expect(marker._pos).toStrictEqual(marker._pos.round());
                resolve();
            });
        });
    });
    test("Not Immediately Snap To Pixel when Map move and setLngLat", async () => {
        marker.setLngLat([1, 2]);
        map.fire(new Event("move"));
        expect(marker._pos).not.toBe(marker._pos.round());
        await new Promise(resolve => {
            setTimeout(() => {
                expect(marker._pos).toStrictEqual(marker._pos.round());
                resolve();
            }, 100);
        });
    });

    afterAll(() => {
        map.remove();
    });
});
