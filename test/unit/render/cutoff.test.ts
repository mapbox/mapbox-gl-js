import {test, expect, describe} from '../../util/vitest';
import {getCutoffParams} from '../../../src/render/cutoff';

// getCutoffParams reads specific fields from Painter and Transform.
// We provide minimal fixtures with just the fields the function accesses,
// avoiding mocking internal domain objects per the test guidelines.
function createPainterFixture(overrides: Record<string, unknown> = {}) {
    return {
        terrain: null,
        minCutoffZoom: 5,
        transform: {
            pitch: 60,
            _zoom: 10,
            _nearZ: 10,
            _farZ: 5000,
            height: 800,
            cameraToCenterDistance: 1000,
            isLODDisabled: () => false,
        },
        ...overrides,
    };
}

describe('getCutoffParams', () => {
    test('returns shouldRenderCutoff false when cutoffFadeRange is zero', () => {
        const painter = createPainterFixture();
        const result = getCutoffParams(painter as never, 0);
        expect(result.shouldRenderCutoff).toBe(false);
    });

    test('returns shouldRenderCutoff false when terrain is active', () => {
        const painter = createPainterFixture({terrain: {}});
        const result = getCutoffParams(painter as never, 0.5);
        expect(result.shouldRenderCutoff).toBe(false);
    });

    test('returns shouldRenderCutoff false when pitch is below activation threshold', () => {
        const painter = createPainterFixture({
            transform: {
                pitch: 5,
                _zoom: 10,
                _nearZ: 10,
                _farZ: 5000,
                height: 800,
                cameraToCenterDistance: 1000,
                isLODDisabled: () => false,
            },
        });
        const result = getCutoffParams(painter as never, 0.5);
        expect(result.shouldRenderCutoff).toBe(false);
    });

    test('returns finite cutoff params when zRange is near zero', () => {
        const painter = createPainterFixture({
            transform: {
                pitch: 60,
                _zoom: 10,
                _nearZ: 100,
                _farZ: 100, // farZ == nearZ → zRange would be 0 without guard
                height: 800,
                cameraToCenterDistance: 1000,
                isLODDisabled: () => false,
            },
        });
        const result = getCutoffParams(painter as never, 0.5);
        const params = result.uniformValues['u_cutoff_params'];
        expect(Number.isFinite(params[2])).toBe(true);
        expect(Number.isFinite(params[3])).toBe(true);
    });

    test('returns finite cutoff params when farZ is less than nearZ', () => {
        const painter = createPainterFixture({
            transform: {
                pitch: 60,
                _zoom: 10,
                _nearZ: 200,
                _farZ: 50, // farZ < nearZ → zRange would be negative without guard
                height: 800,
                cameraToCenterDistance: 1000,
                isLODDisabled: () => false,
            },
        });
        const result = getCutoffParams(painter as never, 0.5);
        const params = result.uniformValues['u_cutoff_params'];
        expect(Number.isFinite(params[2])).toBe(true);
        expect(Number.isFinite(params[3])).toBe(true);
    });

    test('returns shouldRenderCutoff true at high pitch with valid fade range', () => {
        const painter = createPainterFixture();
        const result = getCutoffParams(painter as never, 0.5);
        expect(result.shouldRenderCutoff).toBe(true);
    });
});
