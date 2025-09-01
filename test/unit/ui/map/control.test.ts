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
            }
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

    test('#hasControl', () => {
        const map = createMap();
        function Ctrl() {}
        Ctrl.prototype = {
            onAdd(_) {
                return window.document.createElement('div');
            }
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
