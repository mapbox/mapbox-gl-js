import type {IndoorData, IndoorDataBuilding, IndoorDataFloor} from "./indoor_data";

export default class IndoorFeaturesStorage {
    _floors: Map<string, IndoorDataFloor>;
    _buildings: Map<string, IndoorDataBuilding>;

    constructor() {
        this._floors = new Map();
        this._buildings = new Map();
    }

    append(indoorData: IndoorData): boolean {
        let hasChanges = false;

        indoorData.buildings.forEach(newBuilding => {
            const buildingId = newBuilding.id;
            if (!hasChanges && !this._buildings.has(buildingId)) {
                hasChanges = true;
            }
            this._buildings.set(buildingId, newBuilding);
        });

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
                const isBuildingId = buildingIds.includes(buildingId);
                return isBuildingId;
            });
            return floors;
        }
        return floorFeatures;
    }

    getBuildings(): Array<IndoorDataBuilding> {
        return Array.from(this._buildings.values());
    }
}
