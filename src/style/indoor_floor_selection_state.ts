import IndoorFeaturesStorage from './indoor_features_storage';

import type {TargetFeature} from '../util/vectortile_to_geojson';
import type {IndoorData} from './indoor_data_query';

export default class IndoorFloorSelectionState {
    _selectedFloorId: string | null;
    _selectedBuildingId: string | null;
    _lastActiveFloors: Array<TargetFeature>;
    _featuresStorage: IndoorFeaturesStorage;

    constructor() {
        this._selectedFloorId = null;
        this._selectedBuildingId = null;
        this._lastActiveFloors = [];
        this._featuresStorage = new IndoorFeaturesStorage();
    }

    setIndoorData(indoorData: IndoorData) {
        this._featuresStorage.append(indoorData);
        this._selectedBuildingId = indoorData.building ? indoorData.building.properties.id as string : null;
    }

    setFloorId(floorId: string | null) {
        this._selectedFloorId = floorId;
    }

    getActiveFloors(): Array<TargetFeature> {
        const allFloors = this._featuresStorage.getFloors();
        const selectedFloor = allFloors.find(floor => floor.properties.id as string === this._selectedFloorId);
        const defaultFloors = allFloors.filter(floor => floor.properties.is_default === true);
        let currentActiveFloors = [];

        if (!selectedFloor) {
            if (defaultFloors.length === 0) {
                const buildingFloors = this._featuresStorage.getFloors(this._selectedBuildingId);
                currentActiveFloors = buildingFloors.length > 0 ? [buildingFloors[0]] : [];
            } else {
                currentActiveFloors = defaultFloors;
            }
        } else {
            const connectedFloorsString = selectedFloor ? selectedFloor.properties.connected_floor_ids as string : null;
            const connectedFloorsArray = connectedFloorsString ? connectedFloorsString.split(';') : [];
            const connectedFloors = allFloors.filter(floor => connectedFloorsArray.includes(floor.properties.id as string));
            currentActiveFloors = [selectedFloor, ...connectedFloors];
        }

        const nonConflictedFloors = this._getPreviouslyActiveNonConflictedFloors(currentActiveFloors);
        const activeFloors: Array<TargetFeature> = [...currentActiveFloors, ...nonConflictedFloors];
        this._lastActiveFloors = activeFloors;
        return activeFloors;
    }

    hasBuildingChanged(indoorData: IndoorData): boolean {
        return this._selectedBuildingId !== (indoorData.building ? indoorData.building.properties.id : null);
    }

    /**
     * Find floors from lastActiveFloors that are not conflicted with any of the allConnectedActiveFloors
     * @param allConnectedActiveFloors - The currently active connected floors
     * @returns Array of floors from lastActiveFloors that are not conflicted
     */
    _getPreviouslyActiveNonConflictedFloors(currentActiveFloors: Array<TargetFeature>): Array<TargetFeature> {
        if (!this._lastActiveFloors || this._lastActiveFloors.length === 0) {
            return [];
        }

        const activeFloorIds = new Set(currentActiveFloors.map(floor => floor.properties.id as string));
        const activeFloorConflictedIds = new Set(currentActiveFloors.flatMap(floor => {
            const conflictedIds = floor.properties.conflicted_floor_ids as string;
            return conflictedIds ? conflictedIds.split(';') : [];
        }));

        return this._lastActiveFloors.filter(floor => {
            const floorId = floor.properties.id as string;
            if (activeFloorIds.has(floorId)) {
                return false;
            }

            if (activeFloorConflictedIds.has(floorId)) {
                return false;
            }

            return true;
        });
    }

    /**
     * Check if a floor is conflicted with any of the active floors
     * @param floor - The floor to check
     * @param activeFloors - The currently active floors
     * @returns true if the floor is conflicted, false otherwise
     */
    _isFloorConflicted(floor: TargetFeature, activeFloors: Array<TargetFeature>): boolean {
        const floorId = floor.properties.id as string;
        // Check for building conflicts (different buildings)
        const hasFloorConflict = activeFloors.some(activeFloor => {
            const conflictedFloorIdsString = activeFloor.properties.conflicted_floor_ids as string;
            if (!conflictedFloorIdsString) {
                return false;
            }
            // Split the string by semicolon delimiter to get array of conflicted floor IDs
            const conflictedFloorIds = conflictedFloorIdsString.split(';');
            return conflictedFloorIds.includes(floorId);
        });

        return hasFloorConflict;
    }

    getCurrentBuildingSelection(): {selectedFloorId: string | null, floors: Array<TargetFeature>} {
        const currentBuildingFloors = this._featuresStorage.getFloors(this._selectedBuildingId);
        const activeFloors = this.getActiveFloors();
        const currentBuildingActiveFloor = activeFloors.find(floor => {
            const buildingIdsString = floor.properties.building_ids as string;
            if (!buildingIdsString) {
                return false;
            }
            const buildingIds = buildingIdsString.split(';');
            return this._selectedBuildingId ? buildingIds.includes(this._selectedBuildingId) : false;
        });

        return {
            selectedFloorId: currentBuildingActiveFloor ? currentBuildingActiveFloor.properties.id as string : null,
            floors: currentBuildingFloors
        };
    }

    reset() {
        this._selectedFloorId = null;
        this._selectedBuildingId = null;
        this._lastActiveFloors = [];
        this._featuresStorage.clear();
    }
}
