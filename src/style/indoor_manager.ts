import {bindAll} from '../util/util';
import {Event, Evented} from '../util/evented';
import IndoorFloorSelectionState from './indoor_floor_selection_state';
import IndoorFeaturesStorage from './indoor_features_storage';
import LngLat from '../geo/lng_lat';

import type {IndoorData, IndoorDataBuilding, IndoorEvents} from './indoor_data';
import type Style from './style';
import type {LngLatBounds} from '../geo/lng_lat';

export default class IndoorManager extends Evented<IndoorEvents> {
    _style: Style;
    _floorSelectionState: IndoorFloorSelectionState | null;
    _featuresStorage: IndoorFeaturesStorage | null;
    _indoorMinimumZoom: number = 16.0;

    constructor(style: Style) {
        super();
        this._style = style;
        const featuresStorage = new IndoorFeaturesStorage();
        this._featuresStorage = featuresStorage;
        this._floorSelectionState = new IndoorFloorSelectionState(featuresStorage);

        bindAll([
            '_updateUI',
        ], this);
    }

    destroy() {
        this._floorSelectionState = null;
        this._featuresStorage = null;
    }

    selectFloor(floorId: string | null) {
        const hasChanges = this._floorSelectionState.setFloorId(floorId);
        if (hasChanges) {
            this._updateActiveFloors(true);
            this._updateIndoorSelector();
        }
    }

    setShowBuildingsOverview(showBuildingsOverview: boolean) {
        this._floorSelectionState.setShowBuildingsOverview(showBuildingsOverview);
        this._updateActiveFloors(false);
        this._updateIndoorSelector();
    }

    setIndoorData(indoorData: IndoorData) {
        if (indoorData.buildings.length > 0 || indoorData.floors.length > 0) {
            this._floorSelectionState.setIndoorData(indoorData);
        }
    }

    _updateUI(zoom: number, mapCenter: LngLat, mapBounds: LngLatBounds) {
        if (zoom < this._indoorMinimumZoom) {
            this._clearIndoorData();
            return;
        }

        const buildings = this._featuresStorage.getBuildings();
        const closestBuildingId = findClosestBuildingId(buildings, mapCenter, mapBounds);
        const hasChanges = this._floorSelectionState.setBuildingId(closestBuildingId);
        if (hasChanges) {
            this._updateIndoorSelector();
        }
    }

    _clearIndoorData() {
        if (this._floorSelectionState.isEmpty()) {
            return;
        }

        this._floorSelectionState.reset();
        this._updateIndoorSelector();
        this._style._setActiveFloors(null);
    };

    _updateIndoorSelector() {
        const currentBuildingSelection = this._floorSelectionState.getCurrentBuildingSelection();
        const floors = currentBuildingSelection.floors.map((floor) => ({
            id: floor.id,
            name: floor.name,
            shortName: floor.zIndex.toString(),
            levelOrder: floor.zIndex
        }));

        this.fire(new Event('indoorupdate', {
            selectedFloorId: currentBuildingSelection.selectedFloorId,
            showBuildingsOverview: this._floorSelectionState.getShowBuildingsOverview(),
            floors
        }));
    }

    _updateActiveFloors(isExplicitSelection: boolean = false) {
        if (this._floorSelectionState.getShowBuildingsOverview()) {
            return;
        }

        const activeFloors = this._floorSelectionState.getActiveFloors(isExplicitSelection);
        const activeFloorsIds = activeFloors.map(floor => floor.id) || [];
        this._style._setActiveFloors(new Set(activeFloorsIds));
    }
}

function findClosestBuildingId(buildings: Array<IndoorDataBuilding>, mapCenter: LngLat, mapBounds: LngLatBounds): string | null {
    let closestBuildingId: string | null = null;
    let minDistance = Number.MAX_SAFE_INTEGER;

    for (const building of buildings) {
        const buildingCenter = building.center;
        if (buildingCenter) {
            const distance = mapCenter.distanceTo(LngLat.convert(buildingCenter));
            if (distance < minDistance && mapBounds.contains(buildingCenter)) {
                minDistance = distance;
                closestBuildingId = building.id;
            }
        }
    }

    return closestBuildingId;
}
