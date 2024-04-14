import {describe, test, expect, waitFor, vi, createMap} from '../../../util/vitest.js';
import {createStyle} from './util.js';
import {Map} from '../../../../src/ui/map.js';
import {extend} from '../../../../src/util/util.js';

describe('Map#remove', () => {
    test('#remove', () => {
        const map = createMap();
        expect(map.getContainer().childNodes.length).toEqual(3);
        map.remove();
        expect(map.getContainer().childNodes.length).toEqual(0);
    });

    test('#remove calls onRemove on added controls', () => {
        const map = createMap();
        const control = {
            onRemove: vi.fn(),
            onAdd (_) {
                return window.document.createElement('div');
            }
        };
        map.addControl(control);
        map.remove();
        expect(control.onRemove).toHaveBeenCalledTimes(1);
    });

    test('#remove calls onRemove on added controls before style is destroyed', async () => {
        const map = createMap();
        let onRemoveCalled = 0;
        const control = {
            onRemove(map) {
                onRemoveCalled++;
                expect(map.getStyle()).toEqual(style);
            },
            onAdd (_) {
                return window.document.createElement('div');
            }
        };

        map.addControl(control);

        await waitFor(map, "style.load");
        const style = map.getStyle();
        map.remove();
        expect(onRemoveCalled).toEqual(1);
    });

    test('#remove deletes gl resources used by the globe', async () => {
        const style = extend(createStyle(), {zoom: 1});
        const map = createMap({style});
        map.setProjection("globe");

        await waitFor(map, "style.load");
        await waitFor(map, "render");
        map.remove();
        const buffers = map.painter.globeSharedBuffers;
        expect(buffers).toBeTruthy();

        const checkBuffer = (name) => buffers[name] && ('buffer' in buffers[name]);

        expect(checkBuffer('_poleIndexBuffer')).toBeFalsy();
        expect(checkBuffer('_gridBuffer')).toBeFalsy();
        expect(checkBuffer('_gridIndexBuffer')).toBeFalsy();
        expect(checkBuffer('_poleNorthVertexBuffer')).toBeFalsy();
        expect(checkBuffer('_poleSouthVertexBuffer')).toBeFalsy();
        expect(checkBuffer('_wireframeIndexBuffer')).toBeFalsy();
    });

    test('#remove deletes gl resources used by the atmosphere', async () => {
        const styleWithAtmosphere = {
            'version': 8,
            'sources': {},
            'fog':  {
                'color': '#0F2127',
                'high-color': '#000',
                'horizon-blend': 0.5,
                'space-color': '#000'
            },
            'layers': [],
            'zoom': 2,
            'projection': {
                name: 'globe'
            }
        };

        const map = createMap({style:styleWithAtmosphere});

        await waitFor(map, "style.load");
        await waitFor(map, "render");
        const atmosphereBuffer = map.painter._atmosphere.atmosphereBuffer;
        const starsVx = map.painter._atmosphere.starsVx;
        const starsIdx = map.painter._atmosphere.starsIdx;
        expect(atmosphereBuffer.vertexBuffer.buffer).toBeTruthy();
        expect(atmosphereBuffer.indexBuffer.buffer).toBeTruthy();
        expect(starsVx.buffer).toBeTruthy();
        expect(starsIdx.buffer).toBeTruthy();

        map.remove();

        expect(atmosphereBuffer.vertexBuffer.buffer).toBeFalsy();
        expect(atmosphereBuffer.indexBuffer.buffer).toBeFalsy();
        expect(starsVx.buffer).toBeFalsy();
        expect(starsIdx.buffer).toBeFalsy();
    });

    test('#remove does not leak event listeners on container', () => {
        const container = window.document.createElement('div');
        container.addEventListener = vi.fn();
        container.removeEventListener = vi.fn();

        vi.spyOn(Map.prototype, '_detectMissingCSS').mockImplementation(() => {});
        vi.spyOn(Map.prototype, '_authenticate').mockImplementation(() => {});

        const map = new Map({
            container,
            testMode: true
        });
        map.remove();

        expect(container.addEventListener.callCount).toEqual(container.removeEventListener.callCount);
        expect(container.addEventListener).toHaveBeenCalledTimes(1);
        expect(container.removeEventListener).toHaveBeenCalledTimes(1);
    });
});
