import type {IndoorData, IndoorDataBuilding, IndoorDataFloor} from "./indoor_data_query";

export default class IndoorFeaturesStorage {
    _floors: Map<string, IndoorDataFloor>;
    _buildings: Map<string, IndoorDataBuilding>;

    constructor() {
        this._floors = new Map();
        this._buildings = new Map();
    }

    append(indoorData: IndoorData): boolean {
        const building = indoorData.building;
        let hasChanges = false;
        if (building) {
            const buildingId = building.id;
            if (buildingId) {
                this._buildings.set(buildingId, building);
                if (!hasChanges && !this._buildings.has(buildingId)) {
                    hasChanges = true;
                }
            }
        }

        indoorData.floors.forEach(newFloor => {
            const floorId = newFloor.id;
            if (!hasChanges && !this._floors.has(floorId)) {
                hasChanges = true;
            }
            this._floors.set(floorId, newFloor);
        });

        return hasChanges;
    }

    clear() {
        this._floors.clear();
        this._buildings.clear();
    }

    getFloors(buildingId: string | null = null): Array<IndoorDataFloor> {
        const floorFeatures = Array.from(this._floors.values());
        if (buildingId) {
            const floors = floorFeatures.filter(floor => {
                const buildingIds = floor.buildingIds;
                if (!buildingIds) {
                    return false;
                }
                const buildingIdsArray = buildingIds.split(';');
                const isBuildingId = buildingIdsArray.includes(buildingId);
                return isBuildingId;
            });
            return floors;
        }
        return floorFeatures;
    }
}
