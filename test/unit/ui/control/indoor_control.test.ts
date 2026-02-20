import {test, describe, expect, vi} from '../../../util/vitest';
import IndoorControl from '../../../../src/ui/control/indoor_control';

import type {Map} from '../../../../src/ui/map';

const createMockIndoorManager = (overrides = {}) => ({
    on: vi.fn(),
    off: vi.fn(),
    getControlState: vi.fn().mockReturnValue({floors: [], activeFloorsVisible: true}),
    updateControl: vi.fn(),
    setActiveFloorsVisibility: vi.fn(),
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

    test('renders all floors if <= 5 floors (no arrows)', () => {
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
            {id: '4', name: 'F4', zIndex: 4}
        ];

        control._onIndoorUpdate({floors, selectedFloorId: '0', activeFloorsVisible: true});

        const container = control._container;
        if (!container) throw new Error('Container not initialized');

        const buttons = container.querySelectorAll('.mapboxgl-ctrl-level-button');
        const upButton = container.querySelector('.mapboxgl-ctrl-arrow-up');
        const downButton = container.querySelector('.mapboxgl-ctrl-arrow-down');

        expect(buttons.length).toBe(5);
        expect(upButton).toBeNull();
        expect(downButton).toBeNull();
    });

    test('renders 4 floors at start/end if > 5 floors', () => {
        const indoorManager = createMockIndoorManager();
        const map = createMockMap(indoorManager);
        const control = new IndoorControl();
        control.onAdd(map);

        const floors = Array.from({length: 6}, (_, i) => ({id: `${i}`, name: `F${i}`, zIndex: i}));
        control._onIndoorUpdate({floors, selectedFloorId: '0', activeFloorsVisible: true});

        const container = control._container;
        if (!container) throw new Error('Container not initialized');

        let buttons = container.querySelectorAll('.mapboxgl-ctrl-level-button');
        let upButton = container.querySelector('.mapboxgl-ctrl-arrow-up');
        let downButton = container.querySelector('.mapboxgl-ctrl-arrow-down');

        expect(buttons.length).toBe(4); // F0..F3
        expect(upButton).toBeNull();
        expect(downButton).toBeTruthy();

        control._onIndoorUpdate({floors, selectedFloorId: '5', activeFloorsVisible: true});

        buttons = container.querySelectorAll('.mapboxgl-ctrl-level-button');
        upButton = container.querySelector('.mapboxgl-ctrl-arrow-up');
        downButton = container.querySelector('.mapboxgl-ctrl-arrow-down');

        expect(buttons.length).toBe(4); // F2..F5
        expect(upButton).toBeTruthy();
        expect(downButton).toBeNull();
    });

    test('renders floors even when indoor disabled', () => {
        const indoorManager = createMockIndoorManager();
        const map = createMockMap(indoorManager);

        const control = new IndoorControl();
        control.onAdd(map);

        const floors = [
            {id: '0', name: 'F0', zIndex: 0},
            {id: '1', name: 'F1', zIndex: 1}
        ];

        control._onIndoorUpdate({floors, selectedFloorId: '0', activeFloorsVisible: false});

        const container = control._container;
        if (!container) throw new Error('Container not initialized');

        const buttons = container.querySelectorAll('.mapboxgl-ctrl-level-button');
        const toggleButton = container.querySelector('.mapboxgl-ctrl-indoor-toggle');

        expect(buttons.length).toBe(2); // Floors rendered!
        expect(toggleButton).toBeTruthy();
        expect(toggleButton?.classList.contains('mapboxgl-ctrl-level-button-selected')).toBe(true);
    });

    test('clicking toggle button only disables visibility', () => {
        const indoorManager = createMockIndoorManager();
        const map = createMockMap(indoorManager);

        const control = new IndoorControl();
        control.onAdd(map);

        control._onIndoorUpdate({floors: [{id: '0', name: 'F0', zIndex: 0}], selectedFloorId: '0', activeFloorsVisible: true});
        const container = control._container;
        if (!container) throw new Error('Container not initialized');
        let toggleButton = container.querySelector('.mapboxgl-ctrl-indoor-toggle');
        if (!toggleButton) throw new Error('Toggle button missing');

        (toggleButton as HTMLButtonElement).click();
        expect(indoorManager.setActiveFloorsVisibility).toHaveBeenCalledWith(false);
        (indoorManager.setActiveFloorsVisibility as Mock).mockClear();

        control._onIndoorUpdate({floors: [{id: '0', name: 'F0', zIndex: 0}], selectedFloorId: '0', activeFloorsVisible: false});
        toggleButton = container.querySelector('.mapboxgl-ctrl-indoor-toggle');

        if (!toggleButton) throw new Error('Toggle button missing');
        (toggleButton as HTMLButtonElement).click();
        expect(indoorManager.setActiveFloorsVisibility).not.toHaveBeenCalled();
    });

    test('clicking floor button re-enables visibility', () => {
        const indoorManager = createMockIndoorManager();
        const map = createMockMap(indoorManager);
        map._selectIndoorFloor = vi.fn();

        const control = new IndoorControl();
        control.onAdd(map);

        const floors = [{id: '0', name: 'F0', zIndex: 0}];
        control._onIndoorUpdate({floors, selectedFloorId: '0', activeFloorsVisible: false});

        const container = control._container;
        if (!container) throw new Error('Container not initialized');

        const buttons = container.querySelectorAll('.mapboxgl-ctrl-level-button');
        const floorButton = buttons[0] as HTMLButtonElement;
        floorButton.click();

        expect(map._selectIndoorFloor).toHaveBeenCalledWith('0');
        expect(map._selectIndoorFloor).toHaveBeenCalledWith('0');
    });

    test('clicking floor button when visibility is disabled re-enables visibility', () => {
        const indoorManager = createMockIndoorManager();
        const map = createMockMap(indoorManager);
        map._selectIndoorFloor = vi.fn();

        const control = new IndoorControl();
        control.onAdd(map);

        const floors = [{id: '0', name: 'F0', zIndex: 0}];
        // Initial state: hidden
        control._onIndoorUpdate({floors, selectedFloorId: '0', activeFloorsVisible: false});

        const container = control._container;
        if (!container) throw new Error('Container not initialized');

        const buttons = container.querySelectorAll('.mapboxgl-ctrl-level-button');
        const floorButton = buttons[0] as HTMLButtonElement;
        floorButton.click();

        expect(indoorManager.setActiveFloorsVisibility).toHaveBeenCalledWith(true);
        expect(map._selectIndoorFloor).toHaveBeenCalledWith('0');
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
        expect(container.textContent).toContain('F3');
        expect(container.textContent).not.toContain('F4');

        const downButton = container.querySelector('.mapboxgl-ctrl-arrow-down');
        if (!(downButton instanceof HTMLButtonElement)) throw new Error('Down button missing');
        downButton.click();

        expect(container.textContent).toContain('F2');
        expect(container.textContent).toContain('F4');
        expect(container.textContent).not.toContain('F1');
        expect(container.querySelector('.mapboxgl-ctrl-arrow-up')).toBeTruthy();
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

    test('selecting visible floor at limits does not scroll', () => {
        const indoorManager = createMockIndoorManager();
        const map = createMockMap(indoorManager);
        const control = new IndoorControl();
        control.onAdd(map);

        const floors = Array.from({length: 6}, (_, i) => ({id: `${i}`, name: `F${i}`, zIndex: i}));

        control._onIndoorUpdate({floors, selectedFloorId: '0', activeFloorsVisible: true});
        const container = control._container;
        if (!container) throw new Error('Container not initialized');

        expect(container.textContent).toContain('F3');
        expect(container.querySelector('.mapboxgl-ctrl-arrow-up')).toBeNull();

        control._onIndoorUpdate({floors, selectedFloorId: '3', activeFloorsVisible: true});

        expect(container.querySelector('.mapboxgl-ctrl-arrow-up')).toBeNull();
        expect(container.textContent).toContain('F0');
        expect(container.textContent).toContain('F3');

        control._onIndoorUpdate({floors, selectedFloorId: '4', activeFloorsVisible: true});

        expect(container.querySelector('.mapboxgl-ctrl-arrow-up')).toBeTruthy();
        expect(container.textContent).toContain('F2');
        expect(container.textContent).toContain('F4');
        expect(container.textContent).not.toContain('F0');
    });

    test('toggling visibility does not reset scroll position', () => {
        const indoorManager = createMockIndoorManager();
        const map = createMockMap(indoorManager);
        const control = new IndoorControl();
        control.onAdd(map);

        const floors = Array.from({length: 10}, (_, i) => ({id: `${i}`, name: `F${i}`, zIndex: i}));

        control._onIndoorUpdate({floors, selectedFloorId: '0', activeFloorsVisible: true});
        const container = control._container;
        if (!container) throw new Error('Container not initialized');
        const downButton = container.querySelector('.mapboxgl-ctrl-arrow-down');
        if (!(downButton instanceof HTMLButtonElement)) throw new Error('Down button missing');
        downButton.click();

        expect(container.textContent).toContain('F2');
        expect(container.textContent).not.toContain('F0');

        control._onIndoorUpdate({floors, selectedFloorId: '0', activeFloorsVisible: false});

        expect(container.textContent).toContain('F2');
        expect(container.textContent).not.toContain('F0');
    });
});
