import type {TargetFeature} from "../util/vectortile_to_geojson";
import type {IndoorData} from "./indoor_data_query";

export default class IndoorFeaturesStorage {
    _floors: Map<string, TargetFeature>;
    _buildings: Map<string, TargetFeature>;

    constructor() {
        this._floors = new Map();
        this._buildings = new Map();
    }

    append(indoorData: IndoorData) {
        const building = indoorData.building;
        const buildingId = building.properties.id as string;
        if (buildingId) {
            this._buildings.set(buildingId, building);
        }

        indoorData.floors.forEach(newFloor => {
            this._floors.set(newFloor.properties.id as string, newFloor);
        });
    }

    clear() {
        this._floors.clear();
        this._buildings.clear();
    }

    getFloors(buildingId: string | null = null): Array<TargetFeature> {
        if (buildingId) {
            return Array.from(this._floors.values()).filter(floor => {
                const buildingIds = floor.properties.building_ids as string;
                if (!buildingIds) {
                    return false;
                }
                const buildingIdsArray = buildingIds.split(';');
                return buildingIdsArray.includes(buildingId);
            });
        }
        return Array.from(this._floors.values());
    }
}
