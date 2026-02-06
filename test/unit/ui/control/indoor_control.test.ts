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

    test('renders max 3 floors and scroll buttons', () => {
        const indoorManager = createMockIndoorManager();
        const map = createMockMap(indoorManager);
        map._setIndoorActiveFloorsVisibility = vi.fn();
        map._selectIndoorFloor = vi.fn();

        const control = new IndoorControl();
        control.onAdd(map);

        const floors = [
            {id: '0', name: 'F0', zIndex: 0},
            {id: '1', name: 'F1', zIndex: 1},
            {id: '2', name: 'F2', zIndex: 2},
            {id: '3', name: 'F3', zIndex: 3},
            {id: '4', name: 'F4', zIndex: 4},
            {id: '5', name: 'F5', zIndex: 5}
        ];

        control._onIndoorUpdate({floors, selectedFloorId: '0', activeFloorsVisible: true});

        const container = control._container;
        if (!container) throw new Error('Container not initialized');

        const buttons = container.querySelectorAll('.mapboxgl-ctrl-level-button');
        const upButton = container.querySelector('.mapboxgl-ctrl-arrow-up');
        const downButton = container.querySelector('.mapboxgl-ctrl-arrow-down');

        expect(buttons.length).toBe(3);
        expect(upButton).toBeTruthy();
        expect(downButton).toBeTruthy();
    });

    test('scrolling updates visible floors', () => {
        const indoorManager = createMockIndoorManager();
        const map = createMockMap(indoorManager);
        const control = new IndoorControl();
        control.onAdd(map);

        const floors = Array.from({length: 6}, (_, i) => ({id: `${i}`, name: `F${i}`, zIndex: i}));

        control._onIndoorUpdate({floors, selectedFloorId: '0', activeFloorsVisible: true});

        const container = control._container;
        if (!container) throw new Error('Container not initialized');

        expect(container.textContent).toContain('F0');
        expect(container.textContent).not.toContain('F3');

        const downButton = container.querySelector('.mapboxgl-ctrl-arrow-down');
        if (!(downButton instanceof HTMLButtonElement)) throw new Error('Down button missing');
        downButton.click();

        expect(container.textContent).toContain('F1');
        expect(container.textContent).toContain('F3');
        expect(container.textContent).not.toContain('F0');
    });

    test('clicking selected floor does not trigger update (blink fix)', () => {
        const indoorManager = createMockIndoorManager();
        const map = createMockMap(indoorManager);
        map._setIndoorActiveFloorsVisibility = vi.fn();
        map._selectIndoorFloor = vi.fn();

        const control = new IndoorControl();
        control.onAdd(map);

        const floors = [{id: '0', name: 'F0', zIndex: 0}];

        control._onIndoorUpdate({floors, selectedFloorId: '0', activeFloorsVisible: true});

        const container = control._container;
        if (!container) throw new Error('Container not initialized');

        const button = container.querySelector('.mapboxgl-ctrl-level-button');
        if (!(button instanceof HTMLButtonElement)) throw new Error('Button missing');

        button.click();

        expect(map._selectIndoorFloor).not.toHaveBeenCalled();
    });

    test('clicking unselected floor triggers update', () => {
        const indoorManager = createMockIndoorManager();
        const map = createMockMap(indoorManager);
        map._setIndoorActiveFloorsVisibility = vi.fn();
        map._selectIndoorFloor = vi.fn();

        const control = new IndoorControl();
        control.onAdd(map);

        const floors = [
            {id: '0', name: 'F0', zIndex: 0},
            {id: '1', name: 'F1', zIndex: 1}
        ];

        control._onIndoorUpdate({floors, selectedFloorId: '0', activeFloorsVisible: true});

        const container = control._container;
        if (!container) throw new Error('Container not initialized');

        const buttons = container.querySelectorAll('.mapboxgl-ctrl-level-button');
        const targetButton = buttons[1];
        if (!(targetButton instanceof HTMLButtonElement)) throw new Error('Button missing');
        targetButton.click();

        expect(map._selectIndoorFloor).toHaveBeenCalledWith('1');
    });

    test('scroll position persists if floors content is same', () => {
        const indoorManager = createMockIndoorManager();
        const map = createMockMap(indoorManager);
        const control = new IndoorControl();
        control.onAdd(map);

        const floors = Array.from({length: 6}, (_, i) => ({id: `${i}`, name: `F${i}`, zIndex: i}));

        control._onIndoorUpdate({floors, selectedFloorId: '1', activeFloorsVisible: true});

        const container = control._container;
        if (!container) throw new Error('Container not initialized');

        const downButton = container.querySelector('.mapboxgl-ctrl-arrow-down');
        if (!(downButton instanceof HTMLButtonElement)) throw new Error('Down button missing');
        downButton.click();

        expect(control._visibleFloorStart).toBe(1);

        const sameFloors = [...floors];

        control._onIndoorUpdate({floors: sameFloors, selectedFloorId: '1', activeFloorsVisible: true});

        expect(control._visibleFloorStart).toBe(1);

        const differentFloors = floors.slice(0, 5);

        control._onIndoorUpdate({floors: differentFloors, selectedFloorId: '1', activeFloorsVisible: true});

        expect(control._visibleFloorStart).toBe(0);
    });

    test('initial load ensures selected floor is visible', () => {
        const indoorManager = createMockIndoorManager();
        const map = createMockMap(indoorManager);
        const control = new IndoorControl();
        control.onAdd(map);

        const floors = Array.from({length: 10}, (_, i) => ({id: `${i}`, name: `F${i}`, zIndex: i}));

        control._onIndoorUpdate({floors, selectedFloorId: '8', activeFloorsVisible: true});

        expect(control._visibleFloorStart).toBe(6);
    });
});
