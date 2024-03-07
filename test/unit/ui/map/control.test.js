import {describe, test, expect, vi, createMap} from '../../../util/vitest.js';

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
        const control = {};
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

        const control = new Ctrl();
        expect(map.hasControl(control)).toEqual(false);
        map.addControl(control);
        expect(map.hasControl(control)).toEqual(true);
    });
});
