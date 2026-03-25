// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {test, expect, vi, describe, createMap} from '../../../util/vitest';
import NavigationControl from '../../../../src/ui/control/navigation_control';
import simulate from '../../../util/simulate_interaction';

describe('NavigationControl', () => {
    describe('compass drag', () => {
        test('mouse drag on compass updates bearing', () => {
            const map = createMap({interactive: true});
            const nav = new NavigationControl({showCompass: true});
            map.addControl(nav);

            const compass = map.getContainer().querySelector('.mapboxgl-ctrl-compass');
            expect(compass).toBeTruthy();

            const setBearingSpy = vi.spyOn(map, 'setBearing');

            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            simulate.mousedown(compass, {button: 0, buttons: 1, clientX: 0, clientY: 0});
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            simulate.mousemove(window.document, {buttons: 1, clientX: 10, clientY: 0});
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            simulate.mouseup(window.document, {button: 0, buttons: 0});

            expect(setBearingSpy).toHaveBeenCalled();

            map.remove();
        });

        test('mouse drag on compass updates pitch when visualizePitch is enabled', () => {
            const map = createMap({interactive: true});
            const nav = new NavigationControl({showCompass: true, visualizePitch: true});
            map.addControl(nav);

            const compass = map.getContainer().querySelector('.mapboxgl-ctrl-compass');
            expect(compass).toBeTruthy();

            const setPitchSpy = vi.spyOn(map, 'setPitch');

            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            simulate.mousedown(compass, {button: 0, buttons: 1, clientX: 0, clientY: 0});
            // Vertical movement to change pitch
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            simulate.mousemove(window.document, {buttons: 1, clientX: 0, clientY: -10});
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            simulate.mouseup(window.document, {button: 0, buttons: 0});

            expect(setPitchSpy).toHaveBeenCalled();

            map.remove();
        });

        test('mouse drag on compass does not update pitch when visualizePitch is disabled', () => {
            const map = createMap({interactive: true});
            const nav = new NavigationControl({showCompass: true, visualizePitch: false});
            map.addControl(nav);

            const compass = map.getContainer().querySelector('.mapboxgl-ctrl-compass');
            expect(compass).toBeTruthy();

            const setPitchSpy = vi.spyOn(map, 'setPitch');

            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            simulate.mousedown(compass, {button: 0, buttons: 1, clientX: 0, clientY: 0});
            // Vertical movement
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            simulate.mousemove(window.document, {buttons: 1, clientX: 0, clientY: -10});
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            simulate.mouseup(window.document, {button: 0, buttons: 0});

            expect(setPitchSpy).not.toHaveBeenCalled();

            map.remove();
        });
    });
});
