import {test, expect, waitFor, vi, createMap} from "../../../util/vitest.js";
import simulate, {constructTouch, simulateDoubleTap} from '../../../util/simulate_interaction.js';
import land from '../../../util/fixtures/land.json';

test('DoubleClickZoomHandler zooms on dblclick event', () => {
    const map = createMap({
        interactive: true
    });

    const zoom = vi.fn();
    map.on('zoomstart', zoom);

    simulate.dblclick(map.getCanvas());
    map._renderTaskQueue.run();

    expect(zoom).toHaveBeenCalled();

    map.remove();
});

test('DoubleClickZoomHandler does not zoom if preventDefault is called on the dblclick event', () => {
    const map = createMap({
        interactive: true
    });

    map.on('dblclick', e => e.preventDefault());

    const zoom = vi.fn();
    map.on('zoomstart', zoom);

    simulate.dblclick(map.getCanvas());
    map._renderTaskQueue.run();

    expect(zoom).not.toHaveBeenCalled();

    map.remove();
});

test('DoubleClickZoomHandler zooms on double tap if touchstart events are < 300ms apart', async () => {
    const map = createMap({
        interactive: true
    });

    await waitFor(map, 'style.load');

    await new Promise(resolve => {
        map.on('zoomstart', () => {
            resolve();
        });
        simulateDoubleTap(map, 100);
    });
});

test('DoubleClickZoomHandler does not zoom on double tap if touchstart events are > 500ms apart', () => {
    const map = createMap({
        interactive: true
    });

    const zoom = vi.fn();
    map.on('zoom', zoom);

    simulateDoubleTap(map, 500).then(() => {
        expect(zoom).not.toHaveBeenCalled();

        map.remove();
    });

});

test('DoubleClickZoomHandler does not zoom on double tap if touchstart events are in different locations', () => {
    const map = createMap({
        interactive: true
    });

    const zoom = vi.fn();
    map.on('zoom', zoom);

    const canvas = map.getCanvas();

    const simulateTwoDifferentTaps = () => {
        return new Promise(resolve => {
            simulate.touchstart(canvas, {touches: [constructTouch(canvas, {clientX: 0, clientY: 0})]});
            simulate.touchend(canvas);
            setTimeout(() => {
                simulate.touchstart(canvas, {touches: [constructTouch(canvas, {clientX: 30.5, clientY: 30.5})]});
                simulate.touchend(canvas);
                map._renderTaskQueue.run();
                resolve();
            }, 100);
        });
    };

    simulateTwoDifferentTaps().then(() => {
        expect(zoom).not.toHaveBeenCalled();

        map.remove();
    });

});

test('DoubleClickZoomHandler zooms on the second touchend event of a double tap', () => {
    const map = createMap({
        interactive: true
    });

    const zoom = vi.fn();
    map.on('zoomstart', zoom);

    const canvas = map.getCanvas();
    const touchOptions = {touches: [constructTouch(canvas, {target: canvas, clientX: 0.5, clientY: 0.5})]};

    simulate.touchstart(canvas, touchOptions);
    simulate.touchend(canvas);
    simulate.touchstart(canvas, touchOptions);
    map._renderTaskQueue.run();
    map._renderTaskQueue.run();
    expect(zoom).not.toHaveBeenCalled();

    simulate.touchcancel(canvas);
    simulate.touchend(canvas);
    map._renderTaskQueue.run();
    expect(zoom).not.toHaveBeenCalled();

    simulate.touchstart(canvas, touchOptions);
    simulate.touchend(canvas);
    simulate.touchstart(canvas, touchOptions);
    map._renderTaskQueue.run();
    expect(zoom).not.toHaveBeenCalled();

    simulate.touchend(canvas);
    map._renderTaskQueue.run();

    expect(zoom).toHaveBeenCalled();
});

test('DoubleClickZoomHandler does not zoom on double tap if second touchend is >300ms after first touchstart', () => {
    const map = createMap({
        interactive: true
    });

    const zoom = vi.fn();
    map.on('zoom', zoom);

    const canvas = map.getCanvas();

    const simulateSlowSecondTap = () => {
        return new Promise(resolve => {
            simulate.touchstart(canvas);
            simulate.touchend(canvas);
            simulate.touchstart(canvas);
            setTimeout(() => {
                simulate.touchend(canvas);
                map._renderTaskQueue.run();
                resolve();
            }, 300);
        });
    };

    simulateSlowSecondTap().then(() => {
        expect(zoom).not.toHaveBeenCalled();
    });
});

test("Double click at the center", async () => {
    const map = createMap({
        interactive: true,
        zoom: 1,
        fadeDuration: 0,
        center: [0, 0],
        style: {
            version: 8,
            sources: {
                land: {
                    type: 'geojson',
                    data: land
                }
            },
            layers: [
                {
                    id: 'background',
                    type: 'background',
                    paint: {
                        'background-color': '#72d0f2'
                    }
                },
                {
                    id: 'land',
                    type: 'fill',
                    source: 'land',
                    paint: {
                        'fill-color': '#f0e9e1'
                    }
                }
            ]
        }
    });

    await waitFor(map, 'load');
    await simulateDoubleTap(map);
    await waitFor(map, 'idle');

    expect(map.getZoom()).toEqual(2);
});
