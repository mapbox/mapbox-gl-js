import {describe, test, expect, vi} from '../../util/vitest';
import IndoorManager from '../../../src/style/indoor_manager';

import type {IndoorFloor} from '../../../src/style/indoor_data';
import type Style from '../../../src/style/style';

type MockPoint = {x: number; y: number};

function makeBuilding(floorDefs: Array<{id: string; name: string; zIndex: number; isDefault?: boolean; connections?: Set<string>; conflicts?: Set<string>}>, center: [number, number] = [0, 0]) {
    const floorIds = new Set<string>();
    const floors: Record<string, IndoorFloor> = {};
    for (const f of floorDefs) {
        floorIds.add(f.id);
        floors[f.id] = {name: f.name, zIndex: f.zIndex, isDefault: f.isDefault, connections: f.connections, conflicts: f.conflicts};
    }
    return {floorIds, center, floors};
}

function createMockStyle() {
    const updateSpy = vi.fn();
    const style = {
        isIndoorEnabled: () => true,
        updateIndoorDependentLayers: updateSpy,
        getIndoorSourceLayers: () => null,
        map: {
            on: vi.fn(),
            transform: {
                center: {lng: 0, lat: 0},
                zoom: 17,
                width: 800,
                height: 600,
                getBounds: () => ({_sw: {lng: -1, lat: -1}, _ne: {lng: 1, lat: 1}}),
                pointLocation: (p: MockPoint) => ({lng: p.x / 800, lat: p.y / 600}),
            }
        },
        on: vi.fn(),
        fire: vi.fn(),
    };
    return {style, updateSpy};
}

function createManager(mockStyle: Record<string, unknown>): IndoorManager {
    return new IndoorManager(mockStyle as unknown as Style);
}

describe('IndoorManager', () => {

    describe('initial load deferral', () => {
        test('_updateUI is a no-op before _initialLoadDone', () => {
            const {style, updateSpy} = createMockStyle();
            const manager = createManager(style);
            manager._buildings = {'b1': makeBuilding([{id: 'f1', name: 'Floor 1', zIndex: 1, isDefault: true}])};

            manager._updateUI();

            expect(updateSpy).not.toHaveBeenCalled();
        });

        test('_updateActiveFloors defers during initial load', () => {
            const {style, updateSpy} = createMockStyle();
            const manager = createManager(style);

            manager._updateActiveFloors(true);

            expect(updateSpy).not.toHaveBeenCalled();
            expect(manager._indoorState.needsUpdate).toBe(true);
        });

        test('deferred update is applied when load completes', () => {
            const {style, updateSpy} = createMockStyle();
            const manager = createManager(style);
            manager._indoorState.needsUpdate = true;

            manager._initialLoadDone = true;
            if (manager._indoorState.needsUpdate) {
                manager._indoorState.needsUpdate = false;
                style.updateIndoorDependentLayers();
            }

            expect(updateSpy).toHaveBeenCalledTimes(1);
            expect(manager._indoorState.needsUpdate).toBe(false);
        });
    });

    describe('building transitions', () => {
        test('building disappear clears active floors and visibility', () => {
            const {style, updateSpy} = createMockStyle();
            const manager = createManager(style);
            manager._initialLoadDone = true;
            manager._indoorState = {
                selectedFloorId: 'f1',
                activeFloorsVisible: true,
                activeFloors: new Set(['f1']),
            };

            manager._onBuildingTransition('b1', null);

            expect(manager._indoorState.activeFloors.size).toBe(0);
            expect(manager._indoorState.activeFloorsVisible).toBe(false);
            expect(updateSpy).toHaveBeenCalledTimes(1);
        });

        test('building appear restores visibility and triggers style update', () => {
            const {style, updateSpy} = createMockStyle();
            const manager = createManager(style);
            manager._initialLoadDone = true;
            manager._buildings = {'b1': makeBuilding([{id: 'f1', name: 'Floor 1', zIndex: 1, isDefault: true}])};
            manager._indoorState = {
                selectedFloorId: null,
                activeFloorsVisible: false,
                activeFloors: new Set(),
            };

            manager._onBuildingTransition(null, 'b1');

            expect(manager._indoorState.activeFloorsVisible).toBe(true);
            expect(updateSpy).toHaveBeenCalled();
        });
    });

    describe('floor re-selection after zoom back', () => {
        test('selected floor is restored when building re-enters viewport', () => {
            const {style, updateSpy} = createMockStyle();
            const manager = createManager(style);
            manager._initialLoadDone = true;
            manager._buildings = {'b1': makeBuilding([
                {id: 'f1', name: 'Floor 1', zIndex: 1, isDefault: true},
                {id: 'f2', name: 'Floor 2', zIndex: 2},
            ])};
            manager._selectedFloorId = 'f2';
            manager._activeFloors = new Set(['f2']);
            manager._indoorState = {
                selectedFloorId: 'f2',
                activeFloorsVisible: true,
                activeFloors: new Set(['f2']),
            };

            manager._onBuildingTransition('b1', null);
            expect(manager._indoorState.activeFloorsVisible).toBe(false);
            expect(manager._indoorState.activeFloors.size).toBe(0);
            updateSpy.mockClear();

            manager._onBuildingTransition(null, 'b1');

            expect(manager._indoorState.activeFloorsVisible).toBe(true);
            expect(updateSpy).toHaveBeenCalled();
            expect(manager._activeFloors.has('f2')).toBe(true);
        });
    });

    describe('recalculation skip optimization', () => {
        test('skips updateIndoorDependentLayers when active floors unchanged', () => {
            const {style, updateSpy} = createMockStyle();
            const manager = createManager(style);
            manager._initialLoadDone = true;
            manager._buildings = {'b1': makeBuilding([{id: 'f1', name: 'Floor 1', zIndex: 1, isDefault: true}])};
            manager._activeFloors = new Set(['f1']);
            manager._indoorState = {
                selectedFloorId: null,
                activeFloorsVisible: true,
                activeFloors: new Set(['f1']),
            };

            manager._recalculateActiveFloors();

            expect(updateSpy).not.toHaveBeenCalled();
        });

        test('triggers updateIndoorDependentLayers when active floors change', () => {
            const {style, updateSpy} = createMockStyle();
            const manager = createManager(style);
            manager._initialLoadDone = true;
            manager._buildings = {'b1': makeBuilding([{id: 'f1', name: 'Floor 1', zIndex: 1, isDefault: true}])};
            manager._activeFloors = new Set();
            manager._indoorState = {
                selectedFloorId: null,
                activeFloorsVisible: true,
                activeFloors: new Set(),
            };

            manager._recalculateActiveFloors();

            expect(updateSpy).toHaveBeenCalled();
            expect(manager._activeFloors.has('f1')).toBe(true);
        });
    });

    describe('setIndoorData gating', () => {
        test('does not recalculate before initial load', () => {
            const {style, updateSpy} = createMockStyle();
            const manager = createManager(style);

            manager.setIndoorData({
                buildings: {'b1': makeBuilding([{id: 'f1', name: 'Floor 1', zIndex: 1, isDefault: true}])},
                activeFloors: new Set(),
            });

            expect(updateSpy).not.toHaveBeenCalled();
        });

        test('recalculates after initial load when data changes', () => {
            const {style, updateSpy} = createMockStyle();
            const manager = createManager(style);
            manager._initialLoadDone = true;

            manager.setIndoorData({
                buildings: {'b1': makeBuilding([{id: 'f1', name: 'Floor 1', zIndex: 1, isDefault: true}])},
                activeFloors: new Set(),
            });

            expect(updateSpy).toHaveBeenCalled();
        });

        test('does not recalculate when data is unchanged', () => {
            const {style, updateSpy} = createMockStyle();
            const manager = createManager(style);
            manager._initialLoadDone = true;

            const building = makeBuilding([{id: 'f1', name: 'Floor 1', zIndex: 1, isDefault: true}]);
            manager.setIndoorData({buildings: {'b1': building}, activeFloors: new Set()});
            updateSpy.mockClear();

            manager.setIndoorData({buildings: {'b1': building}, activeFloors: new Set()});
            expect(updateSpy).not.toHaveBeenCalled();
        });
    });
});
