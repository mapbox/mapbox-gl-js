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

    setIndoorData(indoorData: IndoorData): boolean {
        const hasChanges = this._featuresStorage.append(indoorData);
        this._selectedBuildingId = indoorData.building ? indoorData.building.properties.id as string : null;
        return hasChanges;
    }

    setFloorId(floorId: string | null): boolean {
        const hasChanges = this._selectedFloorId !== floorId;
        if (hasChanges) {
            this._selectedFloorId = floorId;
        }
        return hasChanges;
    }

    getCurrentBuildingSelection(): {selectedFloorId: string | null, floors: Array<TargetFeature>} {
        if (!this._selectedBuildingId) {
            return {
                selectedFloorId: null,
                floors: []
            };
        }

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

    getActiveFloors(isExplicitSelection: boolean = false): Array<TargetFeature> {
        const allFloors = this._featuresStorage.getFloors();
        const selectedFloor = allFloors.find(floor => floor.properties.id as string === this._selectedFloorId);
        const defaultFloors = allFloors.filter(floor => floor.properties.is_default === true);
        let currentActiveFloors: Array<TargetFeature> = [];

        if (!selectedFloor) {
            if (defaultFloors.length === 0) {
                const buildingFloors = this._featuresStorage.getFloors(this._selectedBuildingId);
                currentActiveFloors = buildingFloors.length > 0 ? [buildingFloors[0]] : [];
            } else {
                currentActiveFloors = defaultFloors;
            }
        } else {
            currentActiveFloors = this._calculateCurrentActiveFloors(allFloors, selectedFloor, defaultFloors, isExplicitSelection);
            return currentActiveFloors;
        }

        const nonConflictedFloors = this._getNonConflictingLastActiveFloors(currentActiveFloors);
        const activeFloors: Array<TargetFeature> = [...currentActiveFloors, ...nonConflictedFloors];
        this._lastActiveFloors = activeFloors;
        return activeFloors;
    }

    hasBuildingChanged(indoorData: IndoorData): boolean {
        return this._selectedBuildingId !== (indoorData.building ? indoorData.building.properties.id : null);
    }

    hasActiveBuilding(): boolean {
        return this._selectedBuildingId !== null;
    }

    isEmpty(): boolean {
        return this._selectedFloorId === null && this._selectedBuildingId === null && this._lastActiveFloors.length === 0;
    }

    _calculateCurrentActiveFloors(allFloors: Array<TargetFeature>, selectedFloor: TargetFeature, defaultFloors: Array<TargetFeature>, isExplicitSelection: boolean): Array<TargetFeature> {
        if (!selectedFloor) {
            return this._getNonConflictingDefaultFloors(this._lastActiveFloors, defaultFloors);
        }

        const connectedFloors = this._getConnectedFloors(selectedFloor, allFloors);
        if (isExplicitSelection) {
            // Explicit selection: prioritize selected and connected floors
            return this._buildExplicitSelectionFloors(selectedFloor, connectedFloors, defaultFloors);
        } else {
            // Implicit selection: prioritize last active floors
            return this._buildImplicitSelectionFloors(connectedFloors, defaultFloors);
        }
    }

    _getConnectedFloors(selectedFloor: TargetFeature, allFloors: Array<TargetFeature>): Array<TargetFeature> {
        const connectedFloorsString = selectedFloor.properties.connected_floor_ids as string;
        if (!connectedFloorsString) return [];

        const connectedFloorIds = new Set(connectedFloorsString.split(';'));
        return allFloors.filter(floor => connectedFloorIds.has(floor.properties.id as string));
    }

    _buildExplicitSelectionFloors(selectedFloor: TargetFeature, connectedFloors: Array<TargetFeature>, defaultFloors: Array<TargetFeature>): Array<TargetFeature> {
        const baseFloors = [selectedFloor, ...connectedFloors];

        const nonConflictingLastActive = this._getNonConflictingLastActiveFloors(baseFloors);
        const allActiveFloors = [...baseFloors, ...nonConflictingLastActive];

        const uniqueActiveFloors = this._deduplicateFloors(allActiveFloors);
        const conflictingIds = this._getConflictingFloorIdsFrom(uniqueActiveFloors);
        const nonConflictingDefaults = defaultFloors.filter(floor => !conflictingIds.has(floor.properties.id as string));

        const result = [...uniqueActiveFloors, ...nonConflictingDefaults];
        this._lastActiveFloors = result;
        return result;
    }

    _buildImplicitSelectionFloors(connectedFloors: Array<TargetFeature>, defaultFloors: Array<TargetFeature>): Array<TargetFeature> {
        const conflictingIds = this._getConflictingFloorIdsFrom(this._lastActiveFloors);
        const nonConflictingDefaults = defaultFloors.filter(floor => !conflictingIds.has(floor.properties.id as string));

        const result = this._deduplicateFloors([...this._lastActiveFloors, ...nonConflictingDefaults]);
        this._lastActiveFloors = result;
        return result;
    }

    _getNonConflictingDefaultFloors(lastActiveFloors: Array<TargetFeature>, defaultFloors: Array<TargetFeature>): Array<TargetFeature> {
        const conflictingIds = this._getConflictingFloorIdsFrom(lastActiveFloors);
        const nonConflictingDefaults = defaultFloors.filter(floor => !conflictingIds.has(floor.properties.id as string));

        const result = this._deduplicateFloors([...lastActiveFloors, ...nonConflictingDefaults]);
        this._lastActiveFloors = result;
        return result;
    }

    _deduplicateFloors(floors: Array<TargetFeature>): Array<TargetFeature> {
        const seenIds = new Set<string>();
        return floors.filter(floor => {
            const id = floor.properties.id as string;
            if (seenIds.has(id)) return false;
            seenIds.add(id);
            return true;
        });
    }

    _getConflictingFloorIdsFrom(floors: Array<TargetFeature>): Set<string> {
        const conflictingIds = new Set<string>();
        floors.forEach(floor => {
            const conflictedIds = floor.properties.conflicted_floor_ids as string;
            if (conflictedIds) {
                conflictedIds.split(';').forEach(id => conflictingIds.add(id));
            }
        });
        return conflictingIds;
    }

    _getNonConflictingLastActiveFloors(currentActiveFloors: Array<TargetFeature>): Array<TargetFeature> {
        if (!this._lastActiveFloors || this._lastActiveFloors.length === 0) {
            return [];
        }

        const activeFloorIds = new Set(currentActiveFloors.map(floor => floor.properties.id as string));
        const activeFloorConflictedIds = this._getConflictingFloorIdsFrom(currentActiveFloors);

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

    // Check if a floor is conflicted with any of the active floors
    _isFloorConflicted(floor: TargetFeature, activeFloors: Array<TargetFeature>): boolean {
        const floorId = floor.properties.id as string;
        const hasFloorConflict = activeFloors.some(activeFloor => {
            const conflictedFloorIdsString = activeFloor.properties.conflicted_floor_ids as string;
            if (!conflictedFloorIdsString) {
                return false;
            }
            const conflictedFloorIds = conflictedFloorIdsString.split(';');
            return conflictedFloorIds.includes(floorId);
        });

        return hasFloorConflict;
    }

    reset() {
        this._selectedFloorId = null;
        this._selectedBuildingId = null;
        this._lastActiveFloors = [];
        this._featuresStorage.clear();
    }
}
