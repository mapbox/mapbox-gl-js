// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {describe, test, expect, vi, createMap} from '../../../util/vitest';

describe('Map#control', () => {
    test('#addControl', () => {
        const map = createMap();
        const control = {
            onAdd(_) {
                expect(map).toEqual(_);
                return window.document.createElement('div');
            },
            onRemove() {}
        };
        map.addControl(control);
        expect(map._controls[1]).toEqual(control);
    });

    test('#removeControl errors on invalid arguments', () => {
        const map = createMap();
        const control: Record<string, any> = {};
        const stub = vi.spyOn(console, 'error').mockImplementation(() => {});

        map.addControl(control);
        map.removeControl(control);
        expect(stub).toHaveBeenCalledTimes(2);
    });

    test('#removeControl', () => {
        const map = createMap();
        const control = {
            onAdd() {
                return window.document.createElement('div');
            },
            onRemove(_) {
                expect(map).toEqual(_);
            }
        };
        map.addControl(control);
        map.removeControl(control);
        expect(map._controls.length).toEqual(1);
    });

    test('#addControl accepts an options object with position', () => {
        const map = createMap();
        let container: HTMLElement;
        const control = {
            onAdd() {
                container = window.document.createElement('div');
                return container;
            },
            onRemove() {}
        };
        map.addControl(control, {position: 'bottom-left'});
        const positionContainer = map.getContainer().querySelector('.mapboxgl-ctrl-bottom-left');
        expect(positionContainer.contains(container)).toBeTruthy();
    });

    test('#addControl applies offset to the edges the control is anchored to', () => {
        const map = createMap();
        let container: HTMLElement;
        const control = {
            onAdd() {
                container = window.document.createElement('div');
                return container;
            },
            onRemove() {}
        };
        map.addControl(control, {position: 'top-right', offset: {x: 12, y: 8}});
        expect(container.style.marginTop).toEqual('8px');
        expect(container.style.marginRight).toEqual('12px');
        expect(container.style.marginBottom).toEqual('');
        expect(container.style.marginLeft).toEqual('');
    });

    test('#addControl ignores the axis a position is centered on', () => {
        const map = createMap();
        let container: HTMLElement;
        const control = {
            onAdd() {
                container = window.document.createElement('div');
                return container;
            },
            onRemove() {}
        };
        // 'top' is horizontally centered, so `x` has no corresponding edge to offset.
        map.addControl(control, {position: 'top', offset: {x: 12, y: 8}});
        expect(container.style.marginTop).toEqual('8px');
        expect(container.style.marginLeft).toEqual('');
        expect(container.style.marginRight).toEqual('');
    });

    test('#addControl clamps negative offset values to 0', () => {
        const map = createMap();
        let container: HTMLElement;
        const control = {
            onAdd() {
                container = window.document.createElement('div');
                return container;
            },
            onRemove() {}
        };
        map.addControl(control, {position: 'top-right', offset: {x: -12, y: -8}});
        expect(container.style.marginTop).toEqual('0px');
        expect(container.style.marginRight).toEqual('0px');
    });

    test('#addControl resets offset when a control is re-added without one', () => {
        const map = createMap();
        const container = window.document.createElement('div');
        const control = {
            onAdd() {
                return container;
            },
            onRemove() {}
        };
        map.addControl(control, {position: 'top-right', offset: {x: 12, y: 8}});
        map.removeControl(control);
        map.addControl(control, 'top-right');
        expect(container.style.marginTop).toEqual('');
        expect(container.style.marginRight).toEqual('');
    });

    test('#hasControl', () => {
        const map = createMap();
        function Ctrl() {}
        Ctrl.prototype = {
            onAdd(_) {
                return window.document.createElement('div');
            },
            onRemove() {}
        };

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const control = new Ctrl();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        expect(map.hasControl(control)).toEqual(false);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        map.addControl(control);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        expect(map.hasControl(control)).toEqual(true);
    });
});
