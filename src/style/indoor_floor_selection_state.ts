import IndoorFeaturesStorage from './indoor_features_storage';

import type {IndoorData, IndoorDataFloor} from './indoor_data_query';

export default class IndoorFloorSelectionState {
    _selectedFloorId: string | null;
    _selectedBuildingId: string | null;
    _showBuildingsOverview: boolean;
    _lastActiveFloors: Array<IndoorDataFloor>;
    _featuresStorage: IndoorFeaturesStorage;

    constructor() {
        this._selectedFloorId = null;
        this._selectedBuildingId = null;
        this._lastActiveFloors = [];
        this._showBuildingsOverview = false;
        this._featuresStorage = new IndoorFeaturesStorage();
    }

    setIndoorData(indoorData: IndoorData): boolean {
        const hasChanges = this._featuresStorage.append(indoorData);
        this._selectedBuildingId = indoorData.building ? indoorData.building.id : null;
        return hasChanges;
    }

    getShowBuildingsOverview(): boolean {
        return this._showBuildingsOverview;
    }

    setShowBuildingsOverview(showBuildingsOverview: boolean): void {
        this._showBuildingsOverview = showBuildingsOverview;
    }

    setFloorId(floorId: string | null): boolean {
        const hasChanges = (this._selectedFloorId !== floorId) || (this._showBuildingsOverview !== false);
        if (hasChanges) {
            this._selectedFloorId = floorId;
            this._showBuildingsOverview = false;
        }
        return hasChanges;
    }

    getCurrentBuildingSelection(): {selectedFloorId: string | null, floors: Array<IndoorDataFloor>} {
        if (!this._selectedBuildingId) {
            return {
                selectedFloorId: null,
                floors: []
            };
        }

        const currentBuildingFloors = this._featuresStorage.getFloors(this._selectedBuildingId);
        const activeFloors = this.getActiveFloors();
        const currentBuildingActiveFloor = activeFloors.find(floor => {
            const buildingIdsString = floor.buildingIds;
            if (!buildingIdsString) {
                return false;
            }
            const buildingIds = buildingIdsString.split(';');
            return this._selectedBuildingId ? buildingIds.includes(this._selectedBuildingId) : false;
        });

        return {
            selectedFloorId: currentBuildingActiveFloor ? currentBuildingActiveFloor.id : null,
            floors: currentBuildingFloors
        };
    }

    getActiveFloors(isExplicitSelection: boolean = false): Array<IndoorDataFloor> {
        const allFloors = this._featuresStorage.getFloors();
        const selectedFloor = allFloors.find(floor => floor.id === this._selectedFloorId);
        const defaultFloors = allFloors.filter(floor => floor.isDefault === true);
        let currentActiveFloors: Array<IndoorDataFloor> = [];

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
        const activeFloors: Array<IndoorDataFloor> = [...currentActiveFloors, ...nonConflictedFloors];
        this._lastActiveFloors = activeFloors;
        return activeFloors;
    }

    hasBuildingChanged(indoorData: IndoorData): boolean {
        return this._selectedBuildingId !== (indoorData.building ? indoorData.building.id : null);
    }

    hasActiveBuilding(): boolean {
        return this._selectedBuildingId !== null;
    }

    isEmpty(): boolean {
        return this._selectedFloorId === null && this._selectedBuildingId === null && this._lastActiveFloors.length === 0;
    }

    _calculateCurrentActiveFloors(allFloors: Array<IndoorDataFloor>, selectedFloor: IndoorDataFloor, defaultFloors: Array<IndoorDataFloor>, isExplicitSelection: boolean): Array<IndoorDataFloor> {
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

    _getConnectedFloors(selectedFloor: IndoorDataFloor, allFloors: Array<IndoorDataFloor>): Array<IndoorDataFloor> {
        const connectedFloorsString = selectedFloor.connectedFloorIds;
        if (!connectedFloorsString) return [];

        const connectedFloorIds = new Set(connectedFloorsString.split(';'));
        return allFloors.filter(floor => connectedFloorIds.has(floor.id));
    }

    _buildExplicitSelectionFloors(selectedFloor: IndoorDataFloor, connectedFloors: Array<IndoorDataFloor>, defaultFloors: Array<IndoorDataFloor>): Array<IndoorDataFloor> {
        const baseFloors = [selectedFloor, ...connectedFloors];

        const nonConflictingLastActive = this._getNonConflictingLastActiveFloors(baseFloors);
        const allActiveFloors = [...baseFloors, ...nonConflictingLastActive];

        const uniqueActiveFloors = this._deduplicateFloors(allActiveFloors);
        const conflictingIds = this._getConflictingFloorIdsFrom(uniqueActiveFloors);
        const nonConflictingDefaults = defaultFloors.filter(floor => !conflictingIds.has(floor.id));

        const result = [...uniqueActiveFloors, ...nonConflictingDefaults];
        this._lastActiveFloors = result;
        return result;
    }

    _buildImplicitSelectionFloors(connectedFloors: Array<IndoorDataFloor>, defaultFloors: Array<IndoorDataFloor>): Array<IndoorDataFloor> {
        const conflictingIds = this._getConflictingFloorIdsFrom(this._lastActiveFloors);
        const nonConflictingDefaults = defaultFloors.filter(floor => !conflictingIds.has(floor.id));

        const result = this._deduplicateFloors([...this._lastActiveFloors, ...nonConflictingDefaults]);
        this._lastActiveFloors = result;
        return result;
    }

    _getNonConflictingDefaultFloors(lastActiveFloors: Array<IndoorDataFloor>, defaultFloors: Array<IndoorDataFloor>): Array<IndoorDataFloor> {
        const conflictingIds = this._getConflictingFloorIdsFrom(lastActiveFloors);
        const nonConflictingDefaults = defaultFloors.filter(floor => !conflictingIds.has(floor.id));

        const result = this._deduplicateFloors([...lastActiveFloors, ...nonConflictingDefaults]);
        this._lastActiveFloors = result;
        return result;
    }

    _deduplicateFloors(floors: Array<IndoorDataFloor>): Array<IndoorDataFloor> {
        const seenIds = new Set<string>();
        return floors.filter(floor => {
            const id = floor.id;
            if (seenIds.has(id)) return false;
            seenIds.add(id);
            return true;
        });
    }

    _getConflictingFloorIdsFrom(floors: Array<IndoorDataFloor>): Set<string> {
        const conflictingIds = new Set<string>();
        floors.forEach(floor => {
            const conflictedIds = floor.conflictedFloorIds;
            if (conflictedIds) {
                conflictedIds.split(';').forEach(id => conflictingIds.add(id));
            }
        });
        return conflictingIds;
    }

    _getNonConflictingLastActiveFloors(currentActiveFloors: Array<IndoorDataFloor>): Array<IndoorDataFloor> {
        if (!this._lastActiveFloors || this._lastActiveFloors.length === 0) {
            return [];
        }

        const activeFloorIds = new Set(currentActiveFloors.map(floor => floor.id));
        const activeFloorConflictedIds = this._getConflictingFloorIdsFrom(currentActiveFloors);

        return this._lastActiveFloors.filter(floor => {
            const floorId = floor.id;
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
    _isFloorConflicted(floor: IndoorDataFloor, activeFloors: Array<IndoorDataFloor>): boolean {
        const floorId = floor.id;
        const hasFloorConflict = activeFloors.some(activeFloor => {
            const conflictedFloorIdsString = activeFloor.conflictedFloorIds;
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
        this._showBuildingsOverview = false;
        this._featuresStorage.clear();
    }
}
