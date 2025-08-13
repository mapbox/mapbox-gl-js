import Point from '@mapbox/point-geometry';

import type {TargetFeature} from "../util/vectortile_to_geojson";
import type {QueryRenderedFeaturesetParams} from "./style";
import type {Map} from "../ui/map";
import type {PointLike} from "../types/point-like";

export type IndoorData = {
    building: TargetFeature;
    floors: Array<TargetFeature>;
};

export class IndoorDataQuery {
    _scope: string;
    _buildingQueryParams: QueryRenderedFeaturesetParams;
    _floorQueryParams: QueryRenderedFeaturesetParams;

    // eslint-disable-next-line no-warning-comments
    // TODO: Don't use hardcoded featureset ids
    constructor(scope: string) {
        this._scope = scope;
        this._buildingQueryParams = {
            target: {
                featuresetId: "building-outline",
                importId: this._scope
            }
        };
        this._floorQueryParams = {
            target: {
                featuresetId: "floor-outline",
                importId: this._scope
            }
        };
    }

    execute(map: Map): IndoorData | null {
        const buildingsQueryArea = this._makeBuildingsQueryArea(map);
        const floorsQueryArea = this._makeFloorsQueryArea(map);

        const buildingFeatures = map.queryRenderedFeatures(buildingsQueryArea, this._buildingQueryParams).reduce((unique, feature) => {
            const id = feature.properties.id as string;
            const shapeType = feature.properties.type as string;
            if (shapeType === "building" && !unique.some(existing => existing.properties.id === id)) {
                unique.push(feature);
            }
            return unique;
        }, [] as Array<TargetFeature>);

        const floorFeatures = map.queryRenderedFeatures(floorsQueryArea, this._floorQueryParams).reduce((unique, feature) => {
            const id = feature.properties.id as string;
            const shapeType = feature.properties.type as string;
            if (shapeType === "floor" && !unique.some(existing => existing.properties.id === id)) {
                unique.push(feature);
            }
            return unique;
        }, [] as Array<TargetFeature>);

        const centerPoint: [number, number] = [map.getCenter().lng, map.getCenter().lat];
        const closestBuilding = this._findBuildingAtCenter(centerPoint, buildingFeatures);
        const anyBuilding = buildingFeatures.length > 0 ? buildingFeatures[0] : null;

        return {
            floors: floorFeatures,
            building: closestBuilding ? closestBuilding : anyBuilding
        };
    }

    _makeBuildingsQueryArea(map: Map) : [PointLike, PointLike] {
        const width = map.transform.width;
        const height = map.transform.height;
        const minDimension = Math.min(width, height);
        const areaSize = minDimension * (1 / 8); // 1/8 of the screen size as smaller query area for building detection

        const offsetX = 0.5 * (width - areaSize);
        const offsetY = 0.5 * (height - areaSize);
        const partialScreen: [PointLike, PointLike] = [
            new Point(offsetX, offsetY),
            new Point(offsetX + areaSize, offsetY + areaSize)
        ];

        return partialScreen;
    }

    _makeFloorsQueryArea(map: Map) : [PointLike, PointLike] {
        const width = map.transform.width;
        const height = map.transform.height;
        return [new Point(0, 0), new Point(width, height)];
    }

    _findBuildingAtCenter(centerPoint: [number, number], buildings: Array<TargetFeature>): TargetFeature | null {
        for (const building of buildings) {
            if (building.geometry.type === 'Polygon') {
                const coordinates = building.geometry.coordinates[0];
                if (this._pointInPolygon(centerPoint, coordinates)) {
                    return building;
                }
            }
        }
        return null;
    }

    _pointInPolygon(point: [number, number], polygon: Array<Array<number>>): boolean {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i][0];
            const yi = polygon[i][1];
            const xj = polygon[j][0];
            const yj = polygon[j][1];

            const intersect = ((yi > point[1]) !== (yj > point[1])) &&
                (point[0] < (xj - xi) * (point[1] - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }
}
