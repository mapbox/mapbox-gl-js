import type {VectorTile, VectorTileFeature} from "@mapbox/vector-tile";
import type {IndoorData, IndoorDataBuilding, IndoorDataFloor} from "../style/indoor_data";

export function parseIndoorData(data: VectorTile, sourceLayerIds: Set<string>): IndoorData {
    const indoorFloors: Array<IndoorDataFloor> = [];
    const indoorBuildings: Array<IndoorDataBuilding> = [];
    const defaultFloors: Set<string> = new Set();

    for (const layerId of sourceLayerIds) {
        const sourceLayer = data.layers[layerId];
        if (!sourceLayer) {
            continue;
        }

        for (let index = 0; index < sourceLayer.length; index++) {
            const feature = sourceLayer.feature(index);

            // Introduce better logging in case of invalid feature with valid type
            if (isValidBuildingFeature(feature)) {
                const center = feature.properties.center.toString().split(";").map(Number) as [number, number];

                indoorBuildings.push({
                    id: feature.properties.id.toString(),
                    name: feature.properties.name.toString(),
                    center
                });
                continue;
            }

            // Introduce better logging in case of invalid feature with valid type
            if (isValidFloorFeature(feature)) {
                const isDefault = feature.properties.is_default ?
                    feature.properties.is_default as boolean :
                    false;
                const connectedFloorIds = feature.properties.connected_floor_ids ?
                    feature.properties.connected_floor_ids.toString().split(";") :
                    [];
                const conflictedFloorIds = feature.properties.conflicted_floor_ids ?
                    feature.properties.conflicted_floor_ids.toString().split(";") :
                    [];
                const buildingIds = feature.properties.building_ids ?
                    feature.properties.building_ids.toString().split(";") :
                    [];

                indoorFloors.push({
                    id: feature.properties.id.toString(),
                    name: feature.properties.name.toString(),
                    zIndex: feature.properties.z_index as number,
                    isDefault,
                    connectedFloorIds,
                    conflictedFloorIds,
                    buildingIds
                });

                if (feature.properties.is_default) {
                    defaultFloors.add(feature.properties.id.toString());
                }
                continue;
            }
        }
    }

    return {
        buildings: indoorBuildings,
        floors: indoorFloors,
        defaultFloors
    };
}

function hasRequiredProperties(feature: VectorTileFeature, requiredProps: string[]): boolean {
    return requiredProps.every(prop => feature.properties && feature.properties[prop] !== undefined && feature.properties[prop] !== null);
}

function isValidBuildingFeature(feature: VectorTileFeature): boolean {
    return hasRequiredProperties(feature, ['type', 'id', 'name']) &&
            feature.properties.type === "building";
}

function isValidFloorFeature(feature: VectorTileFeature): boolean {
    return hasRequiredProperties(feature, ['type', 'id', 'name', 'z_index']) &&
            feature.properties.type === "floor";
}
