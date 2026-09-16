import {describe, test, expect, createMap, waitFor} from '../../util/vitest';
import {vi} from 'vitest';
import {mat4} from 'gl-matrix';

import type {CustomLayerRenderParameters, CustomLayerInterface} from '../../../src/style/style_layer/custom_style_layer';
import type {Map} from '../../../src/ui/map';

function firstMatrixMismatch(a: ArrayLike<number>, b: ArrayLike<number>, rel = 1e-4, abs = 1e-4) {
    for (let i = 0; i < 16; i++) {
        const diff = Math.abs(a[i] - b[i]);
        const tol = abs + rel * Math.max(Math.abs(a[i]), Math.abs(b[i]));
        if (diff > tol) return {i, a: a[i], b: b[i], diff, tol};
    }
    return null;
}

function makeRecordingLayer(id: string) {
    const calls: Array<{args: any[]; input: CustomLayerRenderParameters | undefined}> = [];
    const layer = {
        id,
        type: 'custom' as const,
        renderingMode: '3d' as const,
        onAdd: () => {},
        render() {
            // eslint-disable-next-line prefer-rest-params
            const args = Array.from(arguments);
            calls.push({args, input: args[7] as CustomLayerRenderParameters | undefined});
        }
    } as CustomLayerInterface;
    return {layer, calls};
}

async function loadMapWith(layer: CustomLayerInterface): Promise<Map> {
    const map = createMap({
        style: {
            version: 8,
            sources: {},
            layers: []
        }
    });
    await waitFor(map, 'style.load');
    map.addLayer(layer);
    map.triggerRepaint();
    await waitFor(map, 'render');
    return map;
}

describe('CustomLayerInterface renderParameters', () => {
    test('passes a CustomLayerRenderParameters as the 8th positional argument', async () => {
        const {layer, calls} = makeRecordingLayer('recording');
        const map = await loadMapWith(layer);

        expect(calls.length).toBeGreaterThan(0);
        const {input} = calls[0];
        expect(input).toBeDefined();
        expect(input.projectionMatrix).toBeInstanceOf(Float64Array);
        expect(input.viewMatrix).toBeInstanceOf(Float64Array);
        expect(input.viewMatrix.length).toBe(16);
        expect(input.projectionMatrix.length).toBe(16);
        expect('globeClippingPlane' in input).toBe(true);
        expect('globeCenterInScreenPixels' in input).toBe(true);
        expect(Object.keys(input).sort()).toEqual(['globeCenterInScreenPixels', 'globeClippingPlane', 'projectionMatrix', 'viewMatrix']);

        map.remove();
    });

    test('projectionMatrix is camera→clip and composes with viewMatrix to the world→clip matrix (mercator)', async () => {
        const {layer, calls} = makeRecordingLayer('recording');
        const map = await loadMapWith(layer);
        const {input} = calls.at(-1);
        const tr = map.transform;
        expect(tr.projection.name).toBe('mercator');

        const composed = mat4.multiply([], Array.from(input.projectionMatrix), Array.from(input.viewMatrix));
        expect(firstMatrixMismatch(composed, tr.projMatrix as unknown as number[])).toBeNull();

        // Guards against exposing the combined projMatrix as projectionMatrix.
        expect(firstMatrixMismatch(input.projectionMatrix, tr.projMatrix as unknown as number[])).not.toBeNull();

        map.remove();
    });

    test('matrices keep double precision at high zoom (mercator)', async () => {
        const {layer, calls} = makeRecordingLayer('recording-high-zoom');
        const map = createMap({
            center: [13.4, 52.5],
            zoom: 20,
            style: {version: 8, sources: {}, layers: []}
        });
        await waitFor(map, 'style.load');
        map.addLayer(layer);
        map.triggerRepaint();
        await waitFor(map, 'render');

        const {input} = calls.at(-1);
        const tr = map.transform;

        // At zoom 20 the view translation exceeds the 24-bit Float32 mantissa.
        expect(Array.from(input.viewMatrix)).toEqual(Array.from(tr.getWorldToCameraMatrix()));
        expect(Array.from(input.projectionMatrix)).toEqual(Array.from(tr.getCameraToClipMatrix()));

        const composed = mat4.multiply([], Array.from(input.projectionMatrix), Array.from(input.viewMatrix));
        expect(firstMatrixMismatch(composed, tr.projMatrix as unknown as number[], 1e-9, 1e-9)).toBeNull();

        map.remove();
    });

    test('projectionMatrix composes with viewMatrix to the ECEF→clip matrix (globe)', async () => {
        const {layer, calls} = makeRecordingLayer('recording-globe');
        const map = createMap({
            zoom: 1.5,
            projection: {name: 'globe'},
            style: {version: 8, sources: {}, layers: []}
        });
        await waitFor(map, 'style.load');
        map.addLayer(layer);
        map.triggerRepaint();
        await waitFor(map, 'render');
        await vi.waitUntil(() => !!map.painter.globeSharedBuffers, {timeout: 3000});

        const {input} = calls.at(-1);
        const tr = map.transform;
        expect(tr.projection.name).toBe('globe');

        // In globe, viewMatrix includes globeMatrix, so the product equals projMatrix * globeMatrix.
        const composed = mat4.multiply([], Array.from(input.projectionMatrix), Array.from(input.viewMatrix));
        const expected = mat4.multiply([], tr.projMatrix, tr.globeMatrix);
        expect(firstMatrixMismatch(composed, expected, 2e-3, 1e-4)).toBeNull();

        map.remove();
    });

    test('all custom layers in one frame share the same renderParameters instance', async () => {
        const rec1 = makeRecordingLayer('rec-1');
        const rec2 = makeRecordingLayer('rec-2');

        const map = createMap({
            style: {
                version: 8,
                sources: {},
                layers: []
            }
        });
        await waitFor(map, 'style.load');
        map.addLayer(rec1.layer);
        map.addLayer(rec2.layer);
        map.triggerRepaint();
        await waitFor(map, 'render');

        expect(rec1.calls.length).toBeGreaterThan(0);
        expect(rec2.calls.length).toBeGreaterThan(0);
        const args1 = rec1.calls.at(-1).input;
        const args2 = rec2.calls.at(-1).input;
        expect(args1).toBe(args2);

        map.remove();
    });

    test('layer declaring only (gl, matrix) still works', async () => {
        const seen: Array<{argCount: number; matrix: any}> = [];
        const layer: CustomLayerInterface = {
            id: 'legacy',
            type: 'custom',
            onAdd: () => {},
            render(gl, matrix) {
                seen.push({argCount: arguments.length, matrix});
            }
        };
        const map = await loadMapWith(layer);

        expect(seen.length).toBeGreaterThan(0);
        expect(seen[0].argCount).toBeGreaterThanOrEqual(2);
        expect(Array.isArray(seen[0].matrix) || seen[0].matrix instanceof Float32Array || seen[0].matrix instanceof Float64Array).toBe(true);

        map.remove();
    });

    test('globeClippingPlane is null in mercator mode', async () => {
        const {layer, calls} = makeRecordingLayer('recording');
        const map = await loadMapWith(layer);
        expect(map.transform.projection.name).toBe('mercator');
        expect(calls[0].input.globeClippingPlane).toBeNull();
        map.remove();
    });

    test('globeCenterInScreenPixels is null in mercator mode and matches projection.globeCenterToScreenPoint in globe mode', async () => {
        const {layer: mercatorLayer, calls: mercatorCalls} = makeRecordingLayer('recording-mercator');
        const mercatorMap = await loadMapWith(mercatorLayer);
        expect(mercatorMap.transform.projection.name).toBe('mercator');
        expect(mercatorCalls[0].input.globeCenterInScreenPixels).toBeNull();
        mercatorMap.remove();

        const {layer: globeLayer, calls: globeCalls} = makeRecordingLayer('recording-globe-center');
        const globeMap = createMap({
            style: {version: 8, sources: {}, layers: []},
            projection: {name: 'globe'},
            pitch: 45,
            center: [10, 25],
            zoom: 2
        });
        await waitFor(globeMap, 'style.load');
        globeMap.addLayer(globeLayer);
        globeMap.triggerRepaint();
        await waitFor(globeMap, 'render');
        await vi.waitUntil(() => !!globeMap.painter.globeSharedBuffers, {timeout: 3000});

        const tr = globeMap.transform;
        expect(tr.projection.name).toBe('globe');
        const expectedCenter = tr.projection.globeCenterToScreenPoint(tr);
        const {input} = globeCalls.at(-1);
        const actual = input.globeCenterInScreenPixels;
        expect(actual).not.toBeNull();
        expect(expectedCenter).not.toBeNull();
        expect(actual[0]).toBeCloseTo(expectedCenter.x, 4);
        expect(actual[1]).toBeCloseTo(expectedCenter.y, 4);

        globeMap.remove();
    });

    test('globeClippingPlane: camera-facing points pass, antipode fails', async () => {
        const {layer, calls} = makeRecordingLayer('recording');
        const map = createMap({
            style: {version: 8, sources: {}, layers: []},
            projection: {name: 'globe'},
            center: [10, 25],
            zoom: 2
        });
        await waitFor(map, 'style.load');
        map.addLayer(layer);
        map.triggerRepaint();
        await waitFor(map, 'render');
        await vi.waitUntil(() => !!map.painter.globeSharedBuffers, {timeout: 3000});

        const input = calls[0].input;
        expect(map.transform.projection.name).toBe('globe');
        const plane = input.globeClippingPlane;
        expect(plane).not.toBeNull();

        // Same axis convention as latLngToECEF.
        const {GLOBE_RADIUS} = await import('../../../src/geo/projection/globe_constants');
        const toEcef = (lngDeg: number, latDeg: number) => {
            const lng = lngDeg * Math.PI / 180;
            const lat = latDeg * Math.PI / 180;
            return [
                Math.cos(lat) * Math.sin(lng) * GLOBE_RADIUS,
                -Math.sin(lat) * GLOBE_RADIUS,
                Math.cos(lat) * Math.cos(lng) * GLOBE_RADIUS
            ];
        };
        const side = (lng: number, lat: number) => {
            const p = toEcef(lng, lat);
            return plane[0] * p[0] + plane[1] * p[1] + plane[2] * p[2] + plane[3];
        };

        expect(side(10, 25)).toBeGreaterThan(0);
        expect(side(10 + 180, -25)).toBeLessThan(0);
        const nLen = Math.hypot(plane[0], plane[1], plane[2]);
        expect(nLen).toBeCloseTo(1, 5);

        // Rotates the view center toward the antipode along the great circle by `deg`.
        const greatCirclePoint = (deg: number) => {
            const c = toEcef(10, 25);
            const a = toEcef(190, -25);
            const ax = [
                c[1] * a[2] - c[2] * a[1],
                c[2] * a[0] - c[0] * a[2],
                c[0] * a[1] - c[1] * a[0]
            ];
            const axLen = Math.hypot(ax[0], ax[1], ax[2]);
            const k = ax.map(v => v / axLen);
            const th = (deg * Math.PI) / 180;
            const cos = Math.cos(th);
            const sin = Math.sin(th);
            // Rodrigues rotation of c around unit axis k.
            const dot = c[0] * k[0] + c[1] * k[1] + c[2] * k[2];
            return [
                c[0] * cos + (k[1] * c[2] - k[2] * c[1]) * sin + k[0] * dot * (1 - cos),
                c[1] * cos + (k[2] * c[0] - k[0] * c[2]) * sin + k[1] * dot * (1 - cos),
                c[2] * cos + (k[0] * c[1] - k[1] * c[0]) * sin + k[2] * dot * (1 - cos)
            ];
        };
        const sideAtDeg = (deg: number) => {
            const p = greatCirclePoint(deg);
            return plane[0] * p[0] + plane[1] * p[1] + plane[2] * p[2] + plane[3];
        };
        let lo = 0;
        let hi = 180;
        for (let i = 0; i < 40; i++) {
            const mid = (lo + hi) / 2;
            if (sideAtDeg(mid) > 0) lo = mid;
            else hi = mid;
        }
        // The sign flip must sit acos(R / |C|) degrees from the view center, with |C| = -R^2/d.
        const camDist = -(GLOBE_RADIUS * GLOBE_RADIUS) / plane[3];
        const expectedDeg = (Math.acos(GLOBE_RADIUS / camDist) * 180) / Math.PI;
        expect((lo + hi) / 2).toBeGreaterThan(expectedDeg - 2);
        expect((lo + hi) / 2).toBeLessThan(expectedDeg + 2);

        map.remove();
    });

    test('prerender also receives renderParameters at position 8', async () => {
        const prerenderCalls: any[] = [];
        const layer: CustomLayerInterface = {
            id: 'with-prerender',
            type: 'custom',
            renderingMode: '3d',
            onAdd: () => {},
            prerender() {
                // eslint-disable-next-line prefer-rest-params
                prerenderCalls.push(Array.from(arguments));
            },
            render: () => {}
        };
        const map = await loadMapWith(layer);

        expect(prerenderCalls.length).toBeGreaterThan(0);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const input = prerenderCalls[0][7] as CustomLayerRenderParameters;
        expect(input).toBeDefined();
        expect(input.projectionMatrix).toBeInstanceOf(Float64Array);
        expect(input.viewMatrix).toBeInstanceOf(Float64Array);

        map.remove();
    });
});
