import type {TargetFeature} from "../util/vectortile_to_geojson";
import type {IndoorData} from "./indoor_data_query";

export default class IndoorFeaturesStorage {
    _floors: Map<string, TargetFeature>;
    _buildings: Map<string, TargetFeature>;

    constructor() {
        this._floors = new Map();
        this._buildings = new Map();
    }

    append(indoorData: IndoorData): boolean {
        const building = indoorData.building;
        let hasChanges = false;
        if (building) {
            const buildingId = building.properties.id as string;
            if (buildingId) {
                this._buildings.set(buildingId, building);
                if (!hasChanges && !this._buildings.has(buildingId)) {
                    hasChanges = true;
                }
            }
        }

        indoorData.floors.forEach(newFloor => {
            const floorId = newFloor.properties.id as string;
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

    getFloors(buildingId: string | null = null): Array<TargetFeature> {
        const floorFeatures = Array.from(this._floors.values());
        if (buildingId) {
            const floors = floorFeatures.filter(floor => {
                const buildingIds = floor.properties.building_ids as string;
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
