import {bindAll} from '../util/util';
import {Event, Evented} from '../util/evented';
import LngLat from '../geo/lng_lat';

import type {IndoorBuilding, IndoorData, IndoorEvents, IndoorState, IndoorTileOptions} from './indoor_data';
import type Style from './style';
import type {LngLatBounds} from '../geo/lng_lat';
export default class IndoorManager extends Evented<IndoorEvents> {
    _style: Style;
    _selectedFloorId: string | null;
    _closestBuildingId: string | null;
    _buildings: Record<string, IndoorBuilding> | null;
    _activeFloors: Set<string> | null;
    _indoorState: IndoorState | null;
    _activeFloorsVisible: boolean;
    constructor(style: Style) {
        super();
        this._style = style;
        this._buildings = {};

        this._activeFloors = new Set();
        this._activeFloorsVisible = true;
        this._indoorState = {selectedFloorId: null, lastActiveFloors: null, activeFloorsVisible: true};
        bindAll(['_updateUI'], this);
        const setupObservers = () => {
            if (this._style.isIndoorEnabled()) {
                this._style.map.on('load', this._updateUI);
                this._style.map.on('move', this._updateUI);
                this._style.map.on('idle', this._updateUI);
                this._updateUI();
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
        if (floorId === this._selectedFloorId && this._activeFloorsVisible) {
            return;
        }
        this._selectedFloorId = floorId;
        this._activeFloorsVisible = true;
        this._updateActiveFloors();
    }
    setActiveFloorsVisibility(activeFloorsVisible: boolean) {
        this._activeFloorsVisible = activeFloorsVisible;
        this._updateActiveFloors();
        this._updateIndoorSelector();
    }
    /// Fan in data sent from different tiles and sources and merge it into the one state
    /// Both buildings and active floors updates are additive-only
    setIndoorData(indoorData: IndoorData) {
        for (const [id, building] of Object.entries(indoorData.buildings)) {
            if (this._buildings[id]) {
                for (const floorId of building.floorIds) {
                    if (this._buildings[id].floors[floorId]) {
                        continue;
                    }
                    this._buildings[id].floors[floorId] = building.floors[floorId];
                }
            } else {
                this._buildings[id] = building;
            }
        }
        for (const floorId of indoorData.activeFloors) {
            this._activeFloors.add(floorId);
        }
        // Next step: Add debouncing to prevent excessive selector updates, though not visible
        this._updateIndoorSelector();
    }
    getIndoorTileOptions(sourceId: string, scope: string): IndoorTileOptions | null {
        const sourceLayers = this._style.getIndoorSourceLayers(sourceId, scope);
        if (!sourceLayers || !this._indoorState) {
            return null;
        }
        return {
            sourceLayers,
            indoorState: this._indoorState
        };
    }
    _updateUI() {
        const transform = this._style.map.transform;
        const closestBuildingId = findClosestBuildingId(this._buildings, transform.center, transform.getBounds(), transform.zoom);
        if (closestBuildingId !== this._closestBuildingId) {
            this._closestBuildingId = closestBuildingId;
            this._updateIndoorSelector();
        }
    }
    getControlState() {
        const buildings = this._buildings;
        const closestBuildingId = this._closestBuildingId;
        const closestBuilding = (closestBuildingId && buildings) ? buildings[closestBuildingId] : undefined;
        if (!closestBuilding) {
            return {
                selectedFloorId: null,
                activeFloorsVisible: this._activeFloorsVisible,
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
        // Dedupe floors by zIndex before sending to the control:
        // we should only show one floor per zIndex for a given building.
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
            activeFloorsVisible: this._activeFloorsVisible,
            floors
        };
    }
    _updateIndoorSelector() {
        this.fire(new Event('selector-update', this.getControlState()));
    }
    // Update previous state and pass it to tiles
    // Resolve active floors to construct new set based on data from tiles
    // Tiles will resolve individual subsets of activeFloors and send it in setIndoorData
    _updateActiveFloors() {
        const lastActiveFloors = this._activeFloors;
        this._activeFloors = new Set();
        this._indoorState = {selectedFloorId: this._selectedFloorId, lastActiveFloors, activeFloorsVisible: this._activeFloorsVisible};
        this._style.updateIndoorDependentLayers();
    }
}
function findClosestBuildingId(buildings: Record<string, IndoorBuilding>, mapCenter: LngLat, mapBounds: LngLatBounds, zoom: number): string | null {
    const indoorMinimumZoom: number = 16.0;
    let closestBuildingId: string | null = null;
    let minDistance = Number.MAX_SAFE_INTEGER;
    if (zoom < indoorMinimumZoom) {
        return null;
    }
    for (const [id, building] of Object.entries(buildings)) {
        const buildingCenter = building.center;
        if (buildingCenter) {
            const distance = mapCenter.distanceTo(LngLat.convert(buildingCenter));
            if (distance < minDistance && mapBounds.contains(buildingCenter)) {
                minDistance = distance;
                closestBuildingId = id;
            }
        }
    }
    return closestBuildingId;
}
