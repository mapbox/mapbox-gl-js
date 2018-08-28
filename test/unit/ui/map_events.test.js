import { test } from 'mapbox-gl-js-test';
import { createMap } from '../../util';
import simulate from 'mapbox-gl-js-test/simulate_interaction';

test('Map#on adds a non-delegated event listener', (t) => {
    const map = createMap(t);
    const spy = t.spy(function (e) {
        t.equal(this, map);
        t.equal(e.type, 'click');
    });

    map.on('click', spy);
    simulate.click(map.getCanvas());

    t.ok(spy.calledOnce);
    t.end();
});

test('Map#off removes a non-delegated event listener', (t) => {
    const map = createMap(t);
    const spy = t.spy();

    map.on('click', spy);
    map.off('click', spy);
    simulate.click(map.getCanvas());

    t.ok(spy.notCalled);
    t.end();
});

test('Map#on adds a listener for an event on a given layer', (t) => {
    const map = createMap(t);
    const features = [{}];

    t.stub(map, 'getLayer').returns({});
    t.stub(map, 'queryRenderedFeatures').callsFake((point, options) => {
        t.deepEqual(options, {layers: ['layer']});
        return features;
    });

    const spy = t.spy(function (e) {
        t.equal(this, map);
        t.equal(e.type, 'click');
        t.equal(e.features, features);
    });

    map.on('click', 'layer', spy);
    simulate.click(map.getCanvas());

    t.ok(spy.calledOnce);
    t.end();
});

test('Map#on adds a listener not triggered for events not matching any features', (t) => {
    const map = createMap(t);
    const features = [];

    t.stub(map, 'getLayer').returns({});
    t.stub(map, 'queryRenderedFeatures').callsFake((point, options) => {
        t.deepEqual(options, {layers: ['layer']});
        return features;
    });

    const spy = t.spy();

    map.on('click', 'layer', spy);
    simulate.click(map.getCanvas());

    t.ok(spy.notCalled);
    t.end();
});

test(`Map#on adds a listener not triggered when the specified layer does not exiist`, (t) => {
    const map = createMap(t);

    t.stub(map, 'getLayer').returns(null);

    const spy = t.spy();

    map.on('click', 'layer', spy);
    simulate.click(map.getCanvas());

    t.ok(spy.notCalled);
    t.end();
});

test('Map#on distinguishes distinct event types', (t) => {
    const map = createMap(t);

    t.stub(map, 'getLayer').returns({});
    t.stub(map, 'queryRenderedFeatures').returns([{}]);

    const spyDown = t.spy((e) => {
        t.equal(e.type, 'mousedown');
    });

    const spyUp = t.spy((e) => {
        t.equal(e.type, 'mouseup');
    });

    map.on('mousedown', 'layer', spyDown);
    map.on('mouseup', 'layer', spyUp);
    simulate.click(map.getCanvas());

    t.ok(spyDown.calledOnce);
    t.ok(spyUp.calledOnce);
    t.end();
});

test('Map#on distinguishes distinct layers', (t) => {
    const map = createMap(t);
    const featuresA = [{}];
    const featuresB = [{}];

    t.stub(map, 'getLayer').returns({});
    t.stub(map, 'queryRenderedFeatures').callsFake((point, options) => {
        return options.layers[0] === 'A' ? featuresA : featuresB;
    });

    const spyA = t.spy((e) => {
        t.equal(e.features, featuresA);
    });

    const spyB = t.spy((e) => {
        t.equal(e.features, featuresB);
    });

    map.on('click', 'A', spyA);
    map.on('click', 'B', spyB);
    simulate.click(map.getCanvas());

    t.ok(spyA.calledOnce);
    t.ok(spyB.calledOnce);
    t.end();
});

test('Map#on distinguishes distinct listeners', (t) => {
    const map = createMap(t);

    t.stub(map, 'getLayer').returns({});
    t.stub(map, 'queryRenderedFeatures').returns([{}]);

    const spyA = t.spy();
    const spyB = t.spy();

    map.on('click', 'layer', spyA);
    map.on('click', 'layer', spyB);
    simulate.click(map.getCanvas());

    t.ok(spyA.calledOnce);
    t.ok(spyB.calledOnce);
    t.end();
});

test('Map#off removes a delegated event listener', (t) => {
    const map = createMap(t);

    t.stub(map, 'getLayer').returns({});
    t.stub(map, 'queryRenderedFeatures').returns([{}]);

    const spy = t.spy();

    map.on('click', 'layer', spy);
    map.off('click', 'layer', spy);
    simulate.click(map.getCanvas());

    t.ok(spy.notCalled);
    t.end();
});

test('Map#off distinguishes distinct event types', (t) => {
    const map = createMap(t);

    t.stub(map, 'getLayer').returns({});
    t.stub(map, 'queryRenderedFeatures').returns([{}]);

    const spy = t.spy((e) => {
        t.equal(e.type, 'mousedown');
    });

    map.on('mousedown', 'layer', spy);
    map.on('mouseup', 'layer', spy);
    map.off('mouseup', 'layer', spy);
    simulate.click(map.getCanvas());

    t.ok(spy.calledOnce);
    t.end();
});

test('Map#off distinguishes distinct layers', (t) => {
    const map = createMap(t);
    const featuresA = [{}];

    t.stub(map, 'getLayer').returns({});
    t.stub(map, 'queryRenderedFeatures').callsFake((point, options) => {
        t.deepEqual(options, {layers: ['A']});
        return featuresA;
    });

    const spy = t.spy((e) => {
        t.equal(e.features, featuresA);
    });

    map.on('click', 'A', spy);
    map.on('click', 'B', spy);
    map.off('click', 'B', spy);
    simulate.click(map.getCanvas());

    t.ok(spy.calledOnce);
    t.end();
});

test('Map#off distinguishes distinct listeners', (t) => {
    const map = createMap(t);

    t.stub(map, 'getLayer').returns({});
    t.stub(map, 'queryRenderedFeatures').returns([{}]);

    const spyA = t.spy();
    const spyB = t.spy();

    map.on('click', 'layer', spyA);
    map.on('click', 'layer', spyB);
    map.off('click', 'layer', spyB);
    simulate.click(map.getCanvas());

    t.ok(spyA.calledOnce);
    t.ok(spyB.notCalled);
    t.end();
});

['mouseenter', 'mouseover'].forEach((event) => {
    test(`Map#on ${event} does not fire if the specified layer does not exist`, (t) => {
        const map = createMap(t);

        t.stub(map, 'getLayer').returns(null);

        const spy = t.spy();

        map.on(event, 'layer', spy);
        simulate.mousemove(map.getCanvas());
        simulate.mousemove(map.getCanvas());

        t.ok(spy.notCalled);
        t.end();
    });

    test(`Map#on ${event} fires when entering the specified layer`, (t) => {
        const map = createMap(t);
        const features = [{}];

        t.stub(map, 'getLayer').returns({});
        t.stub(map, 'queryRenderedFeatures').callsFake((point, options) => {
            t.deepEqual(options, {layers: ['layer']});
            return features;
        });

        const spy = t.spy(function (e) {
            t.equal(this, map);
            t.equal(e.type, event);
            t.equal(e.target, map);
            t.equal(e.features, features);
        });

        map.on(event, 'layer', spy);
        simulate.mousemove(map.getCanvas());

        t.ok(spy.calledOnce);
        t.end();
    });

    test(`Map#on ${event} does not fire on mousemove within the specified layer`, (t) => {
        const map = createMap(t);

        t.stub(map, 'getLayer').returns({});
        t.stub(map, 'queryRenderedFeatures').returns([{}]);

        const spy = t.spy();

        map.on(event, 'layer', spy);
        simulate.mousemove(map.getCanvas());
        simulate.mousemove(map.getCanvas());

        t.ok(spy.calledOnce);
        t.end();
    });

    test(`Map#on ${event} fires when reentering the specified layer`, (t) => {
        const map = createMap(t);

        t.stub(map, 'getLayer').returns({});
        t.stub(map, 'queryRenderedFeatures')
            .onFirstCall().returns([{}])
            .onSecondCall().returns([])
            .onThirdCall().returns([{}]);

        const spy = t.spy();

        map.on(event, 'layer', spy);
        simulate.mousemove(map.getCanvas());
        simulate.mousemove(map.getCanvas());
        simulate.mousemove(map.getCanvas());

        t.ok(spy.calledTwice);
        t.end();
    });

    test(`Map#on ${event} fires when reentering the specified layer after leaving the canvas`, (t) => {
        const map = createMap(t);

        t.stub(map, 'getLayer').returns({});
        t.stub(map, 'queryRenderedFeatures').returns([{}]);

        const spy = t.spy();

        map.on(event, 'layer', spy);
        simulate.mousemove(map.getCanvas());
        simulate.mouseout(map.getCanvas());
        simulate.mousemove(map.getCanvas());

        t.ok(spy.calledTwice);
        t.end();
    });

    test(`Map#on ${event} distinguishes distinct layers`, (t) => {
        const map = createMap(t);
        const featuresA = [{}];
        const featuresB = [{}];

        t.stub(map, 'getLayer').returns({});
        t.stub(map, 'queryRenderedFeatures').callsFake((point, options) => {
            return options.layers[0] === 'A' ? featuresA : featuresB;
        });

        const spyA = t.spy((e) => {
            t.equal(e.features, featuresA);
        });

        const spyB = t.spy((e) => {
            t.equal(e.features, featuresB);
        });

        map.on(event, 'A', spyA);
        map.on(event, 'B', spyB);

        simulate.mousemove(map.getCanvas());
        simulate.mousemove(map.getCanvas());

        t.ok(spyA.calledOnce);
        t.ok(spyB.calledOnce);
        t.end();
    });

    test(`Map#on ${event} distinguishes distinct listeners`, (t) => {
        const map = createMap(t);

        t.stub(map, 'getLayer').returns({});
        t.stub(map, 'queryRenderedFeatures').returns([{}]);

        const spyA = t.spy();
        const spyB = t.spy();

        map.on(event, 'layer', spyA);
        map.on(event, 'layer', spyB);
        simulate.mousemove(map.getCanvas());

        t.ok(spyA.calledOnce);
        t.ok(spyB.calledOnce);
        t.end();
    });

    test(`Map#off ${event} removes a delegated event listener`, (t) => {
        const map = createMap(t);

        t.stub(map, 'getLayer').returns({});
        t.stub(map, 'queryRenderedFeatures').returns([{}]);

        const spy = t.spy();

        map.on(event, 'layer', spy);
        map.off(event, 'layer', spy);
        simulate.mousemove(map.getCanvas());

        t.ok(spy.notCalled);
        t.end();
    });

    test(`Map#off ${event} distinguishes distinct layers`, (t) => {
        const map = createMap(t);
        const featuresA = [{}];

        t.stub(map, 'getLayer').returns({});
        t.stub(map, 'queryRenderedFeatures').callsFake((point, options) => {
            t.deepEqual(options, {layers: ['A']});
            return featuresA;
        });

        const spy = t.spy((e) => {
            t.equal(e.features, featuresA);
        });

        map.on(event, 'A', spy);
        map.on(event, 'B', spy);
        map.off(event, 'B', spy);
        simulate.mousemove(map.getCanvas());

        t.ok(spy.calledOnce);
        t.end();
    });

    test(`Map#off ${event} distinguishes distinct listeners`, (t) => {
        const map = createMap(t);

        t.stub(map, 'getLayer').returns({});
        t.stub(map, 'queryRenderedFeatures').returns([{}]);

        const spyA = t.spy();
        const spyB = t.spy();

        map.on(event, 'layer', spyA);
        map.on(event, 'layer', spyB);
        map.off(event, 'layer', spyB);
        simulate.mousemove(map.getCanvas());

        t.ok(spyA.calledOnce);
        t.ok(spyB.notCalled);
        t.end();
    });
});

['mouseleave', 'mouseout'].forEach((event) => {
    test(`Map#on ${event} does not fire if the specified layer does not exiist`, (t) => {
        const map = createMap(t);

        t.stub(map, 'getLayer').returns(null);

        const spy = t.spy();

        map.on(event, 'layer', spy);
        simulate.mousemove(map.getCanvas());
        simulate.mousemove(map.getCanvas());

        t.ok(spy.notCalled);
        t.end();
    });

    test(`Map#on ${event} does not fire on mousemove when entering or within the specified layer`, (t) => {
        const map = createMap(t);

        t.stub(map, 'getLayer').returns({});
        t.stub(map, 'queryRenderedFeatures').returns([{}]);

        const spy = t.spy();

        map.on(event, 'layer', spy);
        simulate.mousemove(map.getCanvas());
        simulate.mousemove(map.getCanvas());

        t.ok(spy.notCalled);
        t.end();
    });

    test(`Map#on ${event} fires when exiting the specified layer`, (t) => {
        const map = createMap(t);

        t.stub(map, 'getLayer').returns({});
        t.stub(map, 'queryRenderedFeatures')
            .onFirstCall().returns([{}])
            .onSecondCall().returns([]);

        const spy = t.spy(function (e) {
            t.equal(this, map);
            t.equal(e.type, event);
            t.equal(e.features, undefined);
        });

        map.on(event, 'layer', spy);
        simulate.mousemove(map.getCanvas());
        simulate.mousemove(map.getCanvas());

        t.ok(spy.calledOnce);
        t.end();
    });

    test(`Map#on ${event} fires when exiting the canvas`, (t) => {
        const map = createMap(t);

        t.stub(map, 'getLayer').returns({});
        t.stub(map, 'queryRenderedFeatures').returns([{}]);

        const spy = t.spy(function (e) {
            t.equal(this, map);
            t.equal(e.type, event);
            t.equal(e.features, undefined);
        });

        map.on(event, 'layer', spy);
        simulate.mousemove(map.getCanvas());
        simulate.mouseout(map.getCanvas());

        t.ok(spy.calledOnce);
        t.end();
    });

    test(`Map#off ${event} removes a delegated event listener`, (t) => {
        const map = createMap(t);

        t.stub(map, 'getLayer').returns({});
        t.stub(map, 'queryRenderedFeatures')
            .onFirstCall().returns([{}])
            .onSecondCall().returns([]);

        const spy = t.spy();

        map.on(event, 'layer', spy);
        map.off(event, 'layer', spy);
        simulate.mousemove(map.getCanvas());
        simulate.mousemove(map.getCanvas());
        simulate.mouseout(map.getCanvas());

        t.ok(spy.notCalled);
        t.end();
    });
});

test(`Map#on mousedown can have default behavior prevented and still fire subsequent click event`, (t) => {
    const map = createMap(t);

    map.on('mousedown', e => e.preventDefault());

    const click = t.spy();
    map.on('click', click);

    simulate.click(map.getCanvas());
    t.ok(click.callCount, 1);

    map.remove();
    t.end();
});

test(`Map#on mousedown doesn't fire subsequent click event if mousepos changes`, (t) => {
    const map = createMap(t);

    map.on('mousedown', e => e.preventDefault());

    const click = t.spy();
    map.on('click', click);
    const canvas = map.getCanvas();

    simulate.drag(canvas, {}, {clientX: 100, clientY: 100});
    t.ok(click.notCalled);

    map.remove();
    t.end();
});

test(`Map#on mousedown fires subsequent click event if mouse position changes less than click tolerance`, (t) => {
    const map = createMap(t, { clickTolerance: 4 });

    map.on('mousedown', e => e.preventDefault());

    const click = t.spy();
    map.on('click', click);
    const canvas = map.getCanvas();

    simulate.drag(canvas, {clientX: 100, clientY: 100}, {clientX: 100, clientY: 103});
    t.ok(click.called);

    map.remove();
    t.end();
});

test(`Map#on mousedown does not fire subsequent click event if mouse position changes more than click tolerance`, (t) => {
    const map = createMap(t, { clickTolerance: 4 });

    map.on('mousedown', e => e.preventDefault());

    const click = t.spy();
    map.on('click', click);
    const canvas = map.getCanvas();

    simulate.drag(canvas, {clientX: 100, clientY: 100}, {clientX: 100, clientY: 104});
    t.ok(click.notCalled);

    map.remove();
    t.end();
});
