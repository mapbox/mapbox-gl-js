import {test, expect, vi, createMap as globalCreateMap} from "../../util/vitest.js";
import simulate, {window} from '../../util/simulate_interaction.js';

function createMap(options) {
    return globalCreateMap({
        interactive: true,
        ...options
    });
}

test('Map#on adds a non-delegated event listener', () => {
    const map = createMap();
    const spy = vi.fn(function (e) {
        expect(this).toEqual(map);
        expect(e.type).toEqual('click');
    });

    map.on('click', spy);
    simulate.click(map.getCanvas());

    expect(spy).toHaveBeenCalledTimes(1);
});

test('Map#off removes a non-delegated event listener', () => {
    const map = createMap();
    const spy = vi.fn();

    map.on('click', spy);
    map.off('click', spy);
    simulate.click(map.getCanvas());

    expect(spy).not.toHaveBeenCalled();
});

test('Map#on adds a listener for an event on a given layer', () => {
    const map = createMap();
    const features = [{}];

    vi.spyOn(map, 'getLayer').mockImplementation(() => ({}));
    vi.spyOn(map, 'queryRenderedFeatures').mockImplementation((point, options) => {
        expect(options).toEqual({layers: ['layer']});
        return features;
    });

    const spy = vi.fn(function (e) {
        expect(this).toEqual(map);
        expect(e.type).toEqual('click');
        expect(e.features).toEqual(features);
    });

    map.on('click', 'layer', spy);
    simulate.click(map.getCanvas());

    expect(spy).toHaveBeenCalledTimes(1);
});

test('Map#on adds a listener not triggered for events not matching any features', () => {
    const map = createMap();
    const features = [];

    vi.spyOn(map, 'getLayer').mockImplementation(() =>  ({}));
    vi.spyOn(map, 'queryRenderedFeatures').mockImplementation((point, options) => {
        expect(options).toEqual({layers: ['layer']});
        return features;
    });

    const spy = vi.fn();

    map.on('click', 'layer', spy);
    simulate.click(map.getCanvas());

    expect(spy).not.toHaveBeenCalled();
});

test(`Map#on adds a listener not triggered when the specified layer does not exist`, () => {
    const map = createMap();

    vi.spyOn(map, 'getLayer').mockImplementation(() => null);

    const spy = vi.fn();

    map.on('click', 'layer', spy);
    simulate.click(map.getCanvas());

    expect(spy).not.toHaveBeenCalled();
});

test('Map#on distinguishes distinct event types', () => {
    const map = createMap();

    vi.spyOn(map, 'getLayer').mockImplementation(() =>  ({}));
    vi.spyOn(map, 'queryRenderedFeatures').mockImplementation(() => [{}]);

    const spyDown = vi.fn((e) => {
        expect(e.type).toEqual('mousedown');
    });

    const spyUp = vi.fn((e) => {
        expect(e.type).toEqual('mouseup');
    });

    map.on('mousedown', 'layer', spyDown);
    map.on('mouseup', 'layer', spyUp);
    simulate.click(map.getCanvas());

    expect(spyDown).toHaveBeenCalledTimes(1);
    expect(spyUp).toHaveBeenCalledTimes(1);
});

test('Map#on distinguishes distinct layers', () => {
    const map = createMap();
    const featuresA = [{}];
    const featuresB = [{}];

    vi.spyOn(map, 'getLayer').mockImplementation(() =>  ({}));
    vi.spyOn(map, 'queryRenderedFeatures').mockImplementation((point, options) => {
        return options.layers[0] === 'A' ? featuresA : featuresB;
    });

    const spyA = vi.fn((e) => {
        expect(e.features).toEqual(featuresA);
    });

    const spyB = vi.fn((e) => {
        expect(e.features).toEqual(featuresB);
    });

    map.on('click', 'A', spyA);
    map.on('click', 'B', spyB);
    simulate.click(map.getCanvas());

    expect(spyA).toHaveBeenCalledTimes(1);
    expect(spyB).toHaveBeenCalledTimes(1);
});

test('Map#on distinguishes distinct listeners', () => {
    const map = createMap();

    vi.spyOn(map, 'getLayer').mockImplementation(() =>  ({}));
    vi.spyOn(map, 'queryRenderedFeatures').mockImplementation(() => [{}]);

    const spyA = vi.fn();
    const spyB = vi.fn();

    map.on('click', 'layer', spyA);
    map.on('click', 'layer', spyB);
    simulate.click(map.getCanvas());

    expect(spyA).toHaveBeenCalledTimes(1);
    expect(spyB).toHaveBeenCalledTimes(1);
});

test('Map#off removes a delegated event listener', () => {
    const map = createMap();

    vi.spyOn(map, 'getLayer').mockImplementation(() =>  ({}));
    vi.spyOn(map, 'queryRenderedFeatures').mockImplementation(() => [{}]);

    const spy = vi.fn();

    map.on('click', 'layer', spy);
    map.off('click', 'layer', spy);
    simulate.click(map.getCanvas());

    expect(spy).not.toHaveBeenCalled();
});

test('Map#off distinguishes distinct event types', () => {
    const map = createMap();

    vi.spyOn(map, 'getLayer').mockImplementation(() =>  ({}));
    vi.spyOn(map, 'queryRenderedFeatures').mockImplementation(() => [{}]);

    const spy = vi.fn((e) => {
        expect(e.type).toEqual('mousedown');
    });

    map.on('mousedown', 'layer', spy);
    map.on('mouseup', 'layer', spy);
    map.off('mouseup', 'layer', spy);
    simulate.click(map.getCanvas());

    expect(spy).toHaveBeenCalledTimes(1);
});

test('Map#off distinguishes distinct layers', () => {
    const map = createMap();
    const featuresA = [{}];

    vi.spyOn(map, 'getLayer').mockImplementation(() =>  ({}));
    vi.spyOn(map, 'queryRenderedFeatures').mockImplementation((point, options) => {
        expect(options).toEqual({layers: ['A']});
        return featuresA;
    });

    const spy = vi.fn((e) => {
        expect(e.features).toEqual(featuresA);
    });

    map.on('click', 'A', spy);
    map.on('click', 'B', spy);
    map.off('click', 'B', spy);
    simulate.click(map.getCanvas());

    expect(spy).toHaveBeenCalledTimes(1);
});

test('Map#off distinguishes distinct listeners', () => {
    const map = createMap();

    vi.spyOn(map, 'getLayer').mockImplementation(() =>  ({}));
    vi.spyOn(map, 'queryRenderedFeatures').mockImplementation(() => [{}]);

    const spyA = vi.fn();
    const spyB = vi.fn();

    map.on('click', 'layer', spyA);
    map.on('click', 'layer', spyB);
    map.off('click', 'layer', spyB);
    simulate.click(map.getCanvas());

    expect(spyA).toHaveBeenCalledTimes(1);
    expect(spyB).not.toHaveBeenCalled();
});

['mouseenter', 'mouseover'].forEach((event) => {
    test(`Map#on ${event} does not fire if the specified layer does not exist`, () => {
        const map = createMap();

        vi.spyOn(map, 'getLayer').mockImplementation(() => null);

        const spy = vi.fn();

        map.on(event, 'layer', spy);
        simulate.mousemove(map.getCanvas());
        simulate.mousemove(map.getCanvas());

        expect(spy).not.toHaveBeenCalled();
    });

    test(`Map#on ${event} fires when entering the specified layer`, () => {
        const map = createMap();
        const features = [{}];

        vi.spyOn(map, 'getLayer').mockImplementation(() =>  ({}));
        vi.spyOn(map, 'queryRenderedFeatures').mockImplementation((point, options) => {
            expect(options).toEqual({layers: ['layer']});
            return features;
        });

        const spy = vi.fn(function (e) {
            expect(this).toEqual(map);
            expect(e.type).toEqual(event);
            expect(e.target).toEqual(map);
            expect(e.features).toEqual(features);
        });

        map.on(event, 'layer', spy);
        simulate.mousemove(map.getCanvas());

        expect(spy).toHaveBeenCalledTimes(1);
    });

    test(`Map#on ${event} does not fire on mousemove within the specified layer`, () => {
        const map = createMap();

        vi.spyOn(map, 'getLayer').mockImplementation(() =>  ({}));
        vi.spyOn(map, 'queryRenderedFeatures').mockImplementation(() => [{}]);

        const spy = vi.fn();

        map.on(event, 'layer', spy);
        simulate.mousemove(map.getCanvas());
        simulate.mousemove(map.getCanvas());

        expect(spy).toHaveBeenCalledTimes(1);
    });

    test(`Map#on ${event} fires when reentering the specified layer`, () => {
        const map = createMap();

        vi.spyOn(map, 'getLayer').mockImplementation(() =>  ({}));
        vi.spyOn(map, 'queryRenderedFeatures').mockImplementation(() => {})
            .mockImplementationOnce(() => [{}])
            .mockImplementationOnce(() => [])
            .mockImplementationOnce(() => [{}]);

        const spy = vi.fn();

        map.on(event, 'layer', spy);
        simulate.mousemove(map.getCanvas());
        simulate.mousemove(map.getCanvas());
        simulate.mousemove(map.getCanvas());

        expect(spy).toHaveBeenCalledTimes(2);
    });

    test(`Map#on ${event} fires when reentering the specified layer after leaving the canvas`, () => {
        const map = createMap();

        vi.spyOn(map, 'getLayer').mockImplementation(() =>  ({}));
        vi.spyOn(map, 'queryRenderedFeatures').mockImplementation(() => [{}]);

        const spy = vi.fn();

        map.on(event, 'layer', spy);
        simulate.mousemove(map.getCanvas());
        simulate.mouseout(map.getCanvas());
        simulate.mousemove(map.getCanvas());

        expect(spy).toHaveBeenCalledTimes(2);
    });

    test(`Map#on ${event} distinguishes distinct layers`, () => {
        const map = createMap();
        const featuresA = [{}];
        const featuresB = [{}];

        vi.spyOn(map, 'getLayer').mockImplementation(() =>  ({}));
        vi.spyOn(map, 'queryRenderedFeatures').mockImplementation((point, options) => {
            return options.layers[0] === 'A' ? featuresA : featuresB;
        });

        const spyA = vi.fn((e) => {
            expect(e.features).toEqual(featuresA);
        });

        const spyB = vi.fn((e) => {
            expect(e.features).toEqual(featuresB);
        });

        map.on(event, 'A', spyA);
        map.on(event, 'B', spyB);

        simulate.mousemove(map.getCanvas());
        simulate.mousemove(map.getCanvas());

        expect(spyA).toHaveBeenCalledTimes(1);
        expect(spyB).toHaveBeenCalledTimes(1);
    });

    test(`Map#on ${event} distinguishes distinct listeners`, () => {
        const map = createMap();

        vi.spyOn(map, 'getLayer').mockImplementation(() =>  ({}));
        vi.spyOn(map, 'queryRenderedFeatures').mockImplementation(() => [{}]);

        const spyA = vi.fn();
        const spyB = vi.fn();

        map.on(event, 'layer', spyA);
        map.on(event, 'layer', spyB);
        simulate.mousemove(map.getCanvas());

        expect(spyA).toHaveBeenCalledTimes(1);
        expect(spyB).toHaveBeenCalledTimes(1);
    });

    test(`Map#off ${event} removes a delegated event listener`, () => {
        const map = createMap();

        vi.spyOn(map, 'getLayer').mockImplementation(() =>  ({}));
        vi.spyOn(map, 'queryRenderedFeatures').mockImplementation(() => [{}]);

        const spy = vi.fn();

        map.on(event, 'layer', spy);
        map.off(event, 'layer', spy);
        simulate.mousemove(map.getCanvas());

        expect(spy).not.toHaveBeenCalled();
    });

    test(`Map#off ${event} distinguishes distinct layers`, () => {
        const map = createMap();
        const featuresA = [{}];

        vi.spyOn(map, 'getLayer').mockImplementation(() =>  ({}));
        vi.spyOn(map, 'queryRenderedFeatures').mockImplementation((point, options) => {
            expect(options).toEqual({layers: ['A']});
            return featuresA;
        });

        const spy = vi.fn((e) => {
            expect(e.features).toEqual(featuresA);
        });

        map.on(event, 'A', spy);
        map.on(event, 'B', spy);
        map.off(event, 'B', spy);
        simulate.mousemove(map.getCanvas());

        expect(spy).toHaveBeenCalledTimes(1);
    });

    test(`Map#off ${event} distinguishes distinct listeners`, () => {
        const map = createMap();

        vi.spyOn(map, 'getLayer').mockImplementation(() =>  ({}));
        vi.spyOn(map, 'queryRenderedFeatures').mockImplementation(() => [{}]);

        const spyA = vi.fn();
        const spyB = vi.fn();

        map.on(event, 'layer', spyA);
        map.on(event, 'layer', spyB);
        map.off(event, 'layer', spyB);
        simulate.mousemove(map.getCanvas());

        expect(spyA).toHaveBeenCalledTimes(1);
        expect(spyB).not.toHaveBeenCalled();
    });
});

['mouseleave', 'mouseout'].forEach((event) => {
    test(`Map#on ${event} does not fire if the specified layer does not exist`, () => {
        const map = createMap();

        vi.spyOn(map, 'getLayer').mockImplementation(() => null);

        const spy = vi.fn();

        map.on(event, 'layer', spy);
        simulate.mousemove(map.getCanvas());
        simulate.mousemove(map.getCanvas());

        expect(spy).not.toHaveBeenCalled();
    });

    test(`Map#on ${event} does not fire on mousemove when entering or within the specified layer`, () => {
        const map = createMap();

        vi.spyOn(map, 'getLayer').mockImplementation(() =>  ({}));
        vi.spyOn(map, 'queryRenderedFeatures').mockImplementation(() => [{}]);

        const spy = vi.fn();

        map.on(event, 'layer', spy);
        simulate.mousemove(map.getCanvas());
        simulate.mousemove(map.getCanvas());

        expect(spy).not.toHaveBeenCalled();
    });

    test(`Map#on ${event} fires when exiting the specified layer`, () => {
        const map = createMap();

        vi.spyOn(map, 'getLayer').mockImplementation(() =>  ({}));
        vi.spyOn(map, 'queryRenderedFeatures').mockImplementation(() => {})
            .mockImplementationOnce(() => [{}])
            .mockImplementationOnce(() => []);

        const spy = vi.fn(function (e) {
            expect(this).toEqual(map);
            expect(e.type).toEqual(event);
            expect(e.features).toEqual(undefined);
        });

        map.on(event, 'layer', spy);
        simulate.mousemove(map.getCanvas());
        simulate.mousemove(map.getCanvas());

        expect(spy).toHaveBeenCalledTimes(1);
    });

    test(`Map#on ${event} fires when exiting the canvas`, () => {
        const map = createMap();

        vi.spyOn(map, 'getLayer').mockImplementation(() =>  ({}));
        vi.spyOn(map, 'queryRenderedFeatures').mockImplementation(() => [{}]);

        const spy = vi.fn(function (e) {
            expect(this).toEqual(map);
            expect(e.type).toEqual(event);
            expect(e.features).toEqual(undefined);
        });

        map.on(event, 'layer', spy);
        simulate.mousemove(map.getCanvas());
        simulate.mouseout(map.getCanvas());

        expect(spy).toHaveBeenCalledTimes(1);
    });

    test(`Map#off ${event} removes a delegated event listener`, () => {
        const map = createMap();

        vi.spyOn(map, 'getLayer').mockImplementation(() =>  ({}));
        vi.spyOn(map, 'queryRenderedFeatures').mockImplementation(() => {})
            .mockImplementationOnce(() => [{}])
            .mockImplementationOnce(() => []);

        const spy = vi.fn();

        map.on(event, 'layer', spy);
        map.off(event, 'layer', spy);
        simulate.mousemove(map.getCanvas());
        simulate.mousemove(map.getCanvas());
        simulate.mouseout(map.getCanvas());

        expect(spy).not.toHaveBeenCalled();
    });
});

test(`Map#on mousedown can have default behavior prevented and still fire subsequent click event`, () => {
    const map = createMap();

    map.on('mousedown', e => e.preventDefault());

    const click = vi.fn();
    map.on('click', click);

    simulate.click(map.getCanvas());
    expect(click).toHaveBeenCalledTimes(1);

    map.remove();
});

test(`Map#on mousedown doesn't fire subsequent click event if mousepos changes`, () => {
    const map = createMap();

    map.on('mousedown', e => e.preventDefault());

    const click = vi.fn();
    map.on('click', click);
    const canvas = map.getCanvas();

    simulate.drag(canvas, {}, {clientX: 100, clientY: 100});
    expect(click).not.toHaveBeenCalled();

    map.remove();
});

test(`Map#on mousedown fires subsequent click event if mouse position changes less than click tolerance`, () => {
    const map = createMap({clickTolerance: 4});

    map.on('mousedown', e => e.preventDefault());

    const click = vi.fn();
    map.on('click', click);
    const canvas = map.getCanvas();

    simulate.drag(canvas, {clientX: 100, clientY: 100}, {clientX: 100, clientY: 103});
    expect(click).toHaveBeenCalled();

    map.remove();
});

test(`Map#on mousedown does not fire subsequent click event if mouse position changes more than click tolerance`, () => {
    const map = createMap({clickTolerance: 4});

    map.on('mousedown', e => e.preventDefault());

    const click = vi.fn();
    map.on('click', click);
    const canvas = map.getCanvas();

    simulate.drag(canvas, {clientX: 100, clientY: 100}, {clientX: 100, clientY: 104});
    expect(click).not.toHaveBeenCalled();

    map.remove();
});

test(`Map#on click fires subsequent click event if there is no corresponding mousedown/mouseup event`, () => {
    const map = createMap({clickTolerance: 4});

    const click = vi.fn();
    map.on('click', click);
    const canvas = map.getCanvas();

    const MouseEvent = window(canvas).MouseEvent;
    const event = new MouseEvent('click', {bubbles: true, clientX: 100, clientY: 100});
    canvas.dispatchEvent(event);
    expect(click).toHaveBeenCalled();

    map.remove();
});

test("Map#isMoving() returns false in mousedown/mouseup/click with no movement", () => {
    const map = createMap({interactive: true, clickTolerance: 4});
    let mousedown, mouseup, click;
    map.on('mousedown', () => { mousedown = map.isMoving(); });
    map.on('mouseup', () => { mouseup = map.isMoving(); });
    map.on('click', () => { click = map.isMoving(); });

    const canvas = map.getCanvas();
    const MouseEvent = window(canvas).MouseEvent;

    canvas.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, clientX: 100, clientY: 100}));
    expect(mousedown).toEqual(false);
    map._renderTaskQueue.run();
    expect(mousedown).toEqual(false);

    canvas.dispatchEvent(new MouseEvent('mouseup', {bubbles: true, clientX: 100, clientY: 100}));
    expect(mouseup).toEqual(false);
    map._renderTaskQueue.run();
    expect(mouseup).toEqual(false);

    canvas.dispatchEvent(new MouseEvent('click', {bubbles: true, clientX: 100, clientY: 100}));
    expect(click).toEqual(false);
    map._renderTaskQueue.run();
    expect(click).toEqual(false);

    map.remove();
});

test("Map#on click should fire preclick before click", () => {
    const map = createMap();
    const preclickSpy = vi.fn(function (e) {
        expect(this).toEqual(map);
        expect(e.type).toEqual('preclick');
    });

    const clickSpy = vi.fn(function (e) {
        expect(this).toEqual(map);
        expect(e.type).toEqual('click');
    });

    map.on('click', clickSpy);
    map.on('preclick', preclickSpy);
    map.once('preclick', () => {
        expect(clickSpy).not.toHaveBeenCalled();
    });

    simulate.click(map.getCanvas());

    expect(preclickSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);

    map.remove();
});

test('Map#on adds a listener for an event on multiple layers which do not exist', () => {
    const map = createMap();
    const features = [{}];

    vi.spyOn(map, 'getLayer').mockImplementation(() => undefined);
    vi.spyOn(map, 'queryRenderedFeatures').mockImplementation((point, options) => {
        expect(options).toEqual({layers: []});
        return features;
    });

    const spy = vi.fn();

    map.on('click', ['layer1', 'layer2'], spy);
    simulate.click(map.getCanvas());

    expect(spy).not.toHaveBeenCalled();
});

test('Map#on adds a listener for an event on multiple layers which some do not exist', () => {
    const map = createMap();
    const features = [{}];

    const getLayerCB = vi.spyOn(map, 'getLayer').mockImplementation(() =>  ({}));
    getLayerCB.mockImplementationOnce(() => undefined);
    getLayerCB.mockImplementationOnce(() => ({}));
    getLayerCB.mockImplementationOnce(() => ({}));

    vi.spyOn(map, 'queryRenderedFeatures').mockImplementation((point, options) => {
        expect(options).toEqual({layers: ['background']});
        return features;
    });

    const spy = vi.fn(function (e) {
        expect(this).toEqual(map);
        expect(e.type).toEqual('click');
        expect(e.features).toEqual(features);
    });

    map.on('click', ['layer', 'background'], spy);
    simulate.click(map.getCanvas());

    expect(spy).toHaveBeenCalledTimes(1);
});

test('Map#on distinguishes distinct event types - multiple layers', () => {
    const map = createMap();

    vi.spyOn(map, 'getLayer').mockImplementation(() =>  ({}));
    vi.spyOn(map, 'queryRenderedFeatures').mockImplementation((point, options) => {
        expect(options).toEqual({layers: ['layer1', 'layer2']});
        return [{}];
    });

    const spyDown = vi.fn((e) => {
        expect(e.type).toEqual('mousedown');
    });

    const spyUp = vi.fn((e) => {
        expect(e.type).toEqual('mouseup');
    });

    map.on('mousedown', ['layer1', 'layer2'], spyDown);
    map.on('mouseup', ['layer1', 'layer2'], spyUp);
    simulate.click(map.getCanvas());

    expect(spyDown).toHaveBeenCalledTimes(1);
    expect(spyUp).toHaveBeenCalledTimes(1);
});

test('Map#on distinguishes distinct multiple layers', () => {
    const map = createMap();
    const featuresA = [{}];
    const featuresB = [{}];

    vi.spyOn(map, 'getLayer').mockImplementation(() =>  ({}));
    vi.spyOn(map, 'queryRenderedFeatures').mockImplementation((point, options) => {
        return options.layers[0] === 'A' ? featuresA : featuresB;
    });

    const spyA = vi.fn((e) => {
        expect(e.features).toEqual(featuresA);
    });

    const spyB = vi.fn((e) => {
        expect(e.features).toEqual(featuresB);
    });

    map.on('click', ['A', 'A2'], spyA);
    map.on('click', ['B', 'B2'], spyB);
    simulate.click(map.getCanvas());

    expect(spyA).toHaveBeenCalledTimes(1);
    expect(spyB).toHaveBeenCalledTimes(1);
});

test('Map#off removes a delegated event listener -  multiple layers', () => {
    const map = createMap();

    vi.spyOn(map, 'getLayer').mockImplementation(() =>  ({}));
    vi.spyOn(map, 'queryRenderedFeatures').mockImplementation(() => [{}]);

    const spy = vi.fn();

    map.on('click', ['layer1', 'layer2'], spy);
    map.off('click', ['layer2', 'layer1'], spy);
    simulate.click(map.getCanvas());

    expect(spy).not.toHaveBeenCalled();
});

test('Map#off distinguishes distinct event types -  multiple layers', () => {
    const map = createMap();

    vi.spyOn(map, 'getLayer').mockImplementation(() =>  ({}));
    vi.spyOn(map, 'queryRenderedFeatures').mockImplementation(() => [{}]);

    const spy = vi.fn((e) => {
        expect(e.type).toEqual('mousedown');
    });

    map.on('mousedown', ['layer1', 'layer2'], spy);
    map.on('mouseup', ['layer1', 'layer2'], spy);
    map.off('mouseup', ['layer1', 'layer2'], spy);
    simulate.click(map.getCanvas());

    expect(spy).toHaveBeenCalledTimes(1);
});

test('Map#off distinguishes distinct layers -  multiple layers', () => {
    const map = createMap();
    const featuresA = [{}];

    vi.spyOn(map, 'getLayer').mockImplementation(() =>  ({}));
    vi.spyOn(map, 'queryRenderedFeatures').mockImplementation((point, options) => {
        expect(options).toEqual({layers: ['A', 'B']});
        return featuresA;
    });

    const spy = vi.fn((e) => {
        expect(e.features).toEqual(featuresA);
    });

    map.on('click', ['A', 'B'], spy);
    map.on('click', ['C', 'D'], spy);
    map.off('click', ['C', 'D'], spy);
    simulate.click(map.getCanvas());

    expect(spy).toHaveBeenCalledTimes(1);
});

test('Map#off distinguishes distinct listeners -  multiple layers', () => {
    const map = createMap();

    vi.spyOn(map, 'getLayer').mockImplementation(() =>  ({}));
    vi.spyOn(map, 'queryRenderedFeatures').mockImplementation(() => [{}]);

    const spyA = vi.fn();
    const spyB = vi.fn();

    map.on('click', ['layer1', 'layer2'], spyA);
    map.on('click', ['layer1', 'layer2'], spyB);
    map.off('click', ['layer1', 'layer2'], spyB);
    simulate.click(map.getCanvas());

    expect(spyA).toHaveBeenCalledTimes(1);
    expect(spyB).not.toHaveBeenCalled();
});

['mouseenter', 'mouseover'].forEach((event) => {
    test(`Map#on ${event} does not fire if the specified layer does not exist -  multiple layers`, () => {
        const map = createMap();

        vi.spyOn(map, 'getLayer').mockImplementation(() => null);

        const spy = vi.fn();

        map.on(event, ['layer1', 'layer2'], spy);
        simulate.mousemove(map.getCanvas());
        simulate.mousemove(map.getCanvas());

        expect(spy).not.toHaveBeenCalled();
    });

    test(`Map#on ${event} fires when entering the specified layer -  multiple layers`, () => {
        const map = createMap();
        const features = [{}];

        vi.spyOn(map, 'getLayer').mockImplementation(() =>  ({}));
        vi.spyOn(map, 'queryRenderedFeatures').mockImplementation((point, options) => {
            expect(options).toEqual({layers: ['layer1', 'layer2']});
            return features;
        });

        const spy = vi.fn(function (e) {
            expect(this).toEqual(map);
            expect(e.type).toEqual(event);
            expect(e.target).toEqual(map);
            expect(e.features).toEqual(features);
        });

        map.on(event, ['layer1', 'layer2'], spy);
        simulate.mousemove(map.getCanvas());

        expect(spy).toHaveBeenCalledTimes(1);
    });

    test(`Map#on ${event} does not fire on mousemove within the specified layer -  multiple layers`, () => {
        const map = createMap();

        vi.spyOn(map, 'getLayer').mockImplementation(() =>  ({}));
        vi.spyOn(map, 'queryRenderedFeatures').mockImplementation(() => [{}]);

        const spy = vi.fn();

        map.on(event, ['layer1', 'layer2'], spy);
        simulate.mousemove(map.getCanvas());
        simulate.mousemove(map.getCanvas());

        expect(spy).toHaveBeenCalledTimes(1);
    });

    test(`Map#on ${event} fires when reentering the specified layer -  multiple layers`, () => {
        const map = createMap();

        vi.spyOn(map, 'getLayer').mockImplementation(() =>  ({}));
        vi.spyOn(map, 'queryRenderedFeatures').mockImplementation(() => {})
            .mockImplementationOnce(() => [{}])
            .mockImplementationOnce(() => [])
            .mockImplementationOnce(() => [{}]);

        const spy = vi.fn();

        map.on(event, ['layer1', 'layer2'], spy);
        simulate.mousemove(map.getCanvas());
        simulate.mousemove(map.getCanvas());
        simulate.mousemove(map.getCanvas());

        expect(spy).toHaveBeenCalledTimes(2);
    });

    test(`Map#on ${event} fires when reentering the specified layer after leaving the canvas -  multiple layers`, () => {
        const map = createMap();

        vi.spyOn(map, 'getLayer').mockImplementation(() =>  ({}));
        vi.spyOn(map, 'queryRenderedFeatures').mockImplementation(() => [{}]);

        const spy = vi.fn();

        map.on(event, ['layer1', 'layer2'], spy);
        simulate.mousemove(map.getCanvas());
        simulate.mouseout(map.getCanvas());
        simulate.mousemove(map.getCanvas());

        expect(spy).toHaveBeenCalledTimes(2);
    });

    test(`Map#on ${event} distinguishes distinct layers -  multiple layers`, () => {
        const map = createMap();
        const featuresA = [{}];
        const featuresB = [{}];

        vi.spyOn(map, 'getLayer').mockImplementation(() =>  ({}));
        vi.spyOn(map, 'queryRenderedFeatures').mockImplementation((point, options) => {
            return options.layers[0] === 'A' ? featuresA : featuresB;
        });

        const spyA = vi.fn((e) => {
            expect(e.features).toEqual(featuresA);
        });

        const spyB = vi.fn((e) => {
            expect(e.features).toEqual(featuresB);
        });

        map.on(event, ['A', 'A2'], spyA);
        map.on(event, ['B', 'B2'], spyB);

        simulate.mousemove(map.getCanvas());
        simulate.mousemove(map.getCanvas());

        expect(spyA).toHaveBeenCalledTimes(1);
        expect(spyB).toHaveBeenCalledTimes(1);
    });

    test(`Map#on ${event} distinguishes distinct listeners -  multiple layers`, () => {
        const map = createMap();

        vi.spyOn(map, 'getLayer').mockImplementation(() =>  ({}));
        vi.spyOn(map, 'queryRenderedFeatures').mockImplementation(() => [{}]);

        const spyA = vi.fn();
        const spyB = vi.fn();

        map.on(event, ['layer1', 'layer2'], spyA);
        map.on(event, ['layer1', 'layer2'], spyB);
        simulate.mousemove(map.getCanvas());

        expect(spyA).toHaveBeenCalledTimes(1);
        expect(spyB).toHaveBeenCalledTimes(1);
    });

    test(`Map#off ${event} removes a delegated event listener -  multiple layers`, () => {
        const map = createMap();

        vi.spyOn(map, 'getLayer').mockImplementation(() =>  ({}));
        vi.spyOn(map, 'queryRenderedFeatures').mockImplementation(() => [{}]);

        const spy = vi.fn();

        map.on(event, ['layer1', 'layer2'], spy);
        map.off(event, ['layer1', 'layer2'], spy);
        simulate.mousemove(map.getCanvas());

        expect(spy).not.toHaveBeenCalled();
    });

    test(`Map#off ${event} distinguishes distinct layers -  multiple layers`, () => {
        const map = createMap();
        const featuresA = [{}];

        vi.spyOn(map, 'getLayer').mockImplementation(() =>  ({}));
        vi.spyOn(map, 'queryRenderedFeatures').mockImplementation((point, options) => {
            expect(options).toEqual({layers: ['A', 'A2']});
            return featuresA;
        });

        const spy = vi.fn((e) => {
            expect(e.features).toEqual(featuresA);
        });

        map.on(event, ['A', 'A2'], spy);
        map.on(event, ['B', 'B2'], spy);
        map.off(event, ['B', 'B2'], spy);
        simulate.mousemove(map.getCanvas());

        expect(spy).toHaveBeenCalledTimes(1);
    });

    test(`Map#off ${event} distinguishes distinct listeners -  multiple layers`, () => {
        const map = createMap();

        vi.spyOn(map, 'getLayer').mockImplementation(() =>  ({}));
        vi.spyOn(map, 'queryRenderedFeatures').mockImplementation(() => [{}]);

        const spyA = vi.fn();
        const spyB = vi.fn();

        map.on(event, ['layer1', 'layer2'], spyA);
        map.on(event, ['layer1', 'layer2'], spyB);
        map.off(event, ['layer1', 'layer2'], spyB);
        simulate.mousemove(map.getCanvas());

        expect(spyA).toHaveBeenCalledTimes(1);
        expect(spyB).not.toHaveBeenCalled();
    });
});

['mouseleave', 'mouseout'].forEach((event) => {
    test(`Map#on ${event} does not fire if the specified layer does not exist -  multiple layers`, () => {
        const map = createMap();

        vi.spyOn(map, 'getLayer').mockImplementation(() => null);

        const spy = vi.fn();

        map.on(event, ['layer1', 'layer2'], spy);
        simulate.mousemove(map.getCanvas());
        simulate.mousemove(map.getCanvas());

        expect(spy).not.toHaveBeenCalled();
    });

    test(`Map#on ${event} does not fire on mousemove when entering or within the specified layer -  multiple layers`, () => {
        const map = createMap();

        vi.spyOn(map, 'getLayer').mockImplementation(() =>  ({}));
        vi.spyOn(map, 'queryRenderedFeatures').mockImplementation(() => [{}]);

        const spy = vi.fn();

        map.on(event, ['layer1', 'layer2'], spy);
        simulate.mousemove(map.getCanvas());
        simulate.mousemove(map.getCanvas());

        expect(spy).not.toHaveBeenCalled();
    });

    test(`Map#on ${event} fires when exiting the specified layer -  multiple layers`, () => {
        const map = createMap();

        vi.spyOn(map, 'getLayer').mockImplementation(() =>  ({}));
        vi.spyOn(map, 'queryRenderedFeatures').mockImplementation(() => {})
            .mockImplementationOnce(() => [{}])
            .mockImplementationOnce(() => []);

        const spy = vi.fn(function (e) {
            expect(this).toEqual(map);
            expect(e.type).toEqual(event);
            expect(e.features).toEqual(undefined);
        });

        map.on(event, ['layer1', 'layer2'], spy);
        simulate.mousemove(map.getCanvas());
        simulate.mousemove(map.getCanvas());

        expect(spy).toHaveBeenCalledTimes(1);
    });

    test(`Map#on ${event} fires when exiting the canvas -  multiple layers`, () => {
        const map = createMap();

        vi.spyOn(map, 'getLayer').mockImplementation(() =>  ({}));
        vi.spyOn(map, 'queryRenderedFeatures').mockImplementation(() => [{}]);

        const spy = vi.fn(function (e) {
            expect(this).toEqual(map);
            expect(e.type).toEqual(event);
            expect(e.features).toEqual(undefined);
        });

        map.on(event, ['layer1', 'layer2'], spy);
        simulate.mousemove(map.getCanvas());
        simulate.mouseout(map.getCanvas());

        expect(spy).toHaveBeenCalledTimes(1);
    });

    test(`Map#off ${event} removes a delegated event listener -  multiple layers`, () => {
        const map = createMap();

        vi.spyOn(map, 'getLayer').mockImplementation(() =>  ({}));
        vi.spyOn(map, 'queryRenderedFeatures').mockImplementation(() => {})
            .mockImplementationOnce(() => [{}])
            .mockImplementationOnce(() => []);

        const spy = vi.fn();

        map.on(event, ['layer1', 'layer2'], spy);
        map.off(event, ['layer1', 'layer2'], spy);
        simulate.mousemove(map.getCanvas());
        simulate.mousemove(map.getCanvas());
        simulate.mouseout(map.getCanvas());

        expect(spy).not.toHaveBeenCalled();
    });
});
