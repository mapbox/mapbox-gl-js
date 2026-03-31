import Point from '@mapbox/point-geometry';
import {bindAll} from '../util/util';
import {Event, Evented} from '../util/evented';
import {ViewportIntersectionStrategy} from './indoor_building_detection';
import {IndoorActiveFloorStrategy} from './indoor_active_floor_strategy';

import type {IndoorBuilding, IndoorData, IndoorEvents, IndoorState, IndoorTileOptions, IndoorFloor} from './indoor_data';
import type Style from './style';

export function setsEqual(a: Set<string> | null, b: Set<string> | null): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    if (a.size !== b.size) return false;
    for (const item of a) {
        if (!b.has(item)) return false;
    }
    return true;
}

export default class IndoorManager extends Evented<IndoorEvents> {
    _style: Style;
    _selectedFloorId: string | null;
    _closestBuildingId: string | null;
    _buildings: Record<string, IndoorBuilding> | null;
    _activeFloors: Set<string> | null;
    _indoorState: IndoorState | null;
    _buildingDetectionStrategy: ViewportIntersectionStrategy;
    _initialLoadDone: boolean;

    constructor(style: Style) {
        super();
        this._style = style;
        this._buildings = {};
        this._activeFloors = new Set();
        this._closestBuildingId = null;
        this._indoorState = {selectedFloorId: null, activeFloorsVisible: true, activeFloors: this._activeFloors};
        this._buildingDetectionStrategy = new ViewportIntersectionStrategy();
        this._initialLoadDone = false;
        bindAll(['_updateUI'], this);
        const setupObservers = () => {
            if (this._style.isIndoorEnabled()) {
                this._style.map.on('load', () => {
                    this._initialLoadDone = true;
                    if (this._indoorState && this._indoorState.needsUpdate) {
                        this._indoorState.needsUpdate = false;
                        this._style.updateIndoorDependentLayers();
                    }
                    this._updateUI();
                });
                this._style.map.on('move', this._updateUI);
                this._style.map.on('idle', this._updateUI);
            }
        };
        this._style.on('style.load', setupObservers);
    }

    destroy() {
        this._buildings = {};
        this._activeFloors = new Set();
        this._indoorState = null;
    }

    selectFloor(floorId: string | null) {
        if (floorId === this._selectedFloorId && this._indoorState && this._indoorState.activeFloorsVisible) {
            return;
        }
        this._selectedFloorId = floorId;
        this._recalculateActiveFloors();
    }

    setActiveFloorsVisibility(activeFloorsVisible: boolean) {
        this._updateActiveFloors(activeFloorsVisible);
        this._updateIndoorSelector();
    }

    setIndoorData(indoorData: IndoorData) {
        let changed = false;
        for (const [id, building] of Object.entries(indoorData.buildings)) {
            if (this._buildings[id]) {
                for (const floorId of building.floorIds) {
                    this._buildings[id].floorIds.add(floorId);
                    if (this._buildings[id].floors[floorId]) {
                        this._mergeFloors(this._buildings[id].floors[floorId], building.floors[floorId]);
                    } else {
                        this._buildings[id].floors[floorId] = building.floors[floorId];
                        this._buildings[id].floorIds.add(floorId);
                        changed = true;
                    }
                }
            } else {
                this._buildings[id] = building;
                changed = true;
            }
        }
        if (changed) {
            this._recalculateActiveFloors();
        }
    }

    getIndoorTileOptions(sourceId: string, scope: string): IndoorTileOptions | null {
        if (!this._indoorState) {
            return null;
        }
        const sourceLayers = this._style.getIndoorSourceLayers(sourceId, scope);
        const indoorState = this._indoorState;
        return {sourceLayers, indoorState};
    }

    getControlState() {
        const buildings = this._buildings;
        const closestBuildingId = this._closestBuildingId;
        const closestBuilding = (closestBuildingId && buildings) ? buildings[closestBuildingId] : undefined;
        if (!closestBuilding) {
            return {
                selectedFloorId: null,
                activeFloorsVisible: this._indoorState ? this._indoorState.activeFloorsVisible : false,
                floors: []
            };
        }
        let buildingActiveFloorId: string | null = null;
        for (const floorId of closestBuilding.floorIds) {
            if (this._activeFloors && this._activeFloors.has(floorId)) {
                buildingActiveFloorId = floorId;
                break;
            }
        }
        const floors = Array.from(closestBuilding.floorIds)
            .map((floorId) => ({
                id: floorId,
                name: closestBuilding.floors[floorId].name,
                zIndex: closestBuilding.floors[floorId].zIndex,
            }))
            .sort((a, b) => b.zIndex - a.zIndex)
            .filter((floor, idx, arr) => idx === 0 || floor.zIndex !== arr[idx - 1].zIndex);
        return {
            selectedFloorId: buildingActiveFloorId,
            activeFloorsVisible: this._indoorState ? this._indoorState.activeFloorsVisible : false,
            floors
        };
    }

    _updateUI() {
        this._initialLoadDone = true;
        const transform = this._style.map.transform;
        const closestBuildingId = this._buildingDetectionStrategy.findClosestBuilding(
            this._buildings,
            transform.center,
            transform.zoom,
            transform.getBounds(),
            this._makeViewportPolygon()
        );

        if (closestBuildingId !== this._closestBuildingId) {
            const previousBuildingId = this._closestBuildingId;
            this._closestBuildingId = closestBuildingId;
            this._onBuildingTransition(previousBuildingId, closestBuildingId);
            this._updateIndoorSelector();
        }
    }

    _onBuildingTransition(previousId: string | null, currentId: string | null) {
        if (!this._indoorState) return;

        const disappeared = !currentId && !!previousId;
        const appeared = !!currentId && !previousId;

        if (disappeared) {
            this._indoorState.activeFloors = new Set();
            this._indoorState.activeFloorsVisible = false;
            this._style.updateIndoorDependentLayers();
        } else if (appeared) {
            this._recalculateActiveFloors();
            this._updateActiveFloors(true);
        }
    }

    _updateIndoorSelector() {
        this.fire(new Event('selector-update', this.getControlState()));
    }

    _updateActiveFloors(visible: boolean) {
        this._indoorState = {selectedFloorId: this._selectedFloorId, activeFloorsVisible: visible, activeFloors: this._activeFloors};
        if (!this._initialLoadDone) {
            this._indoorState.needsUpdate = true;
            return;
        }
        this._style.updateIndoorDependentLayers();
    }

    _recalculateActiveFloors() {
        if (!this._buildings) return;

        const newActiveFloors = IndoorActiveFloorStrategy.calculate(
            this._buildings,
            this._selectedFloorId,
            this._activeFloors
        );

        // Skip expensive style update if active floors haven't changed
        if (setsEqual(newActiveFloors, this._activeFloors)) {
            return;
        }

        this._activeFloors = newActiveFloors;
        const visible = this._indoorState ? this._indoorState.activeFloorsVisible : false;
        this._updateActiveFloors(visible);
        this._updateIndoorSelector();
    }

    _mergeFloors(target: IndoorFloor, source: IndoorFloor) {
        if (!source.geometry) return;

        if (!target.geometry) {
            target.geometry = source.geometry;
            return;
        }

        if (target.geometry.type === 'Polygon') {
            target.geometry = {
                type: 'MultiPolygon',
                coordinates: [target.geometry.coordinates]
            };
        }

        if (source.geometry.type === 'Polygon') {
            (target.geometry.coordinates as number[][][][]).push(source.geometry.coordinates);
        } else if (source.geometry.type === 'MultiPolygon') {
            (target.geometry.coordinates as number[][][][]).push(...source.geometry.coordinates);
        }
    }

    _makeViewportPolygon() {
        const transform = this._style.map.transform;
        const width = transform.width;
        const height = transform.height;
        const corners = [
            transform.pointLocation(new Point(0, 0)),
            transform.pointLocation(new Point(width, 0)),
            transform.pointLocation(new Point(width, height)),
            transform.pointLocation(new Point(0, height))
        ];
        return corners.map(c => new Point(c.lng, c.lat));
    }
}
