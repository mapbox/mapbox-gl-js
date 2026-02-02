import {test, describe, expect, vi} from '../../../util/vitest';
import IndoorControl from '../../../../src/ui/control/indoor_control';

import type {Map} from '../../../../src/ui/map';

const createMockIndoorManager = (overrides = {}) => ({
    on: vi.fn(),
    off: vi.fn(),
    getControlState: vi.fn().mockReturnValue({floors: [], activeFloorsVisible: true}),
    updateControl: vi.fn(),
    ...overrides
});

type Mock = ReturnType<typeof vi.fn>;

type MockIndoorManager = ReturnType<typeof createMockIndoorManager>;

const createMockMap = (indoorManager?: MockIndoorManager, overrides = {}) => ({
    on: vi.fn(),
    off: vi.fn(),
    style: indoorManager ? {indoorManager} : undefined,
    ...overrides
} as unknown as Map);

describe('IndoorControl', () => {
    test('default position is top-right', () => {
        const control = new IndoorControl();
        expect(control.getDefaultPosition()).toBe('top-right');
    });

    test('onAdd subscribes to styledata and requests initial state', () => {
        const indoorManager = createMockIndoorManager();
        const map = createMockMap(indoorManager);

        const control = new IndoorControl();
        control.onAdd(map);

        expect(map.on).toHaveBeenCalledWith('styledata', expect.any(Function));
        expect(indoorManager.on).toHaveBeenCalledWith('selector-update', expect.any(Function));
        expect(indoorManager.getControlState).toHaveBeenCalled();
    });

    test('re-binds on styledata event', () => {
        const indoorManager = createMockIndoorManager();
        const map = createMockMap(indoorManager);

        const control = new IndoorControl();
        control.onAdd(map);

        const styleDataListener = (map.on as Mock).mock.calls[0][1] as () => void;

        styleDataListener();

        expect(indoorManager.off).toHaveBeenCalledWith('selector-update', expect.any(Function));
        expect(indoorManager.on).toHaveBeenCalledTimes(2);
        expect(indoorManager.getControlState).toHaveBeenCalledTimes(2);
    });

    test('onRemove cleans up listeners', () => {
        const indoorManager = createMockIndoorManager();
        const map = createMockMap(indoorManager);

        const control = new IndoorControl();
        control.onAdd(map);
        control.onRemove();

        expect(map.off).toHaveBeenCalledWith('styledata', expect.any(Function));
        expect(indoorManager.off).toHaveBeenCalledWith('selector-update', expect.any(Function));
    });

    test('handles missing style or indoorManager gracefully', () => {
        const map = createMockMap(undefined);

        const control = new IndoorControl();
        control.onAdd(map);

        expect(map.on).toHaveBeenCalledWith('styledata', expect.any(Function));
    });
});
