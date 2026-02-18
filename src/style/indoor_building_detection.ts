import Point from '@mapbox/point-geometry';
import {polygonIntersectsPolygon, polygonIntersectsMultiPolygon} from '../util/intersection_tests';

import type LngLat from '../geo/lng_lat';
import type {LngLatBounds} from '../geo/lng_lat';
import type {IndoorBuilding} from './indoor_data';

export class ViewportIntersectionStrategy {
    _previousClosestBuildingId: string | null = null;
    _hysteresisRatio: number = 0.8;
    _indoorMinimumZoom: number = 16.0;

    findClosestBuilding(
        buildings: Record<string, IndoorBuilding>,
        mapCenter: LngLat,
        zoom: number,
        mapBounds: LngLatBounds,
        viewportPolygon?: Point[]
    ): string | null {
        if (zoom < this._indoorMinimumZoom) {
            this._previousClosestBuildingId = null;
            return null;
        }

        let nextClosestBuildingId: string | null = null;
        let minDistance = Number.MAX_VALUE;

        let currentBuildingDistance = Number.MAX_VALUE;
        let currentInBounds = false;

        const previousBuilding = this._previousClosestBuildingId ? buildings[this._previousClosestBuildingId] : null;

        if (this._previousClosestBuildingId && previousBuilding) {
            const isVisible = this._isBuildingVisible(previousBuilding, mapBounds, viewportPolygon);
            if (isVisible) {
                currentInBounds = true;
                currentBuildingDistance = this._calculateDistance(mapCenter, previousBuilding);
            }
        }

        for (const [id, building] of Object.entries(buildings)) {
            const isVisible = this._isBuildingVisible(building, mapBounds, viewportPolygon);
            if (!isVisible) continue;

            const distance = this._calculateDistance(mapCenter, building);

            if (distance < minDistance) {
                minDistance = distance;
                nextClosestBuildingId = id;
            }
        }

        // Switch to a new closest building only if it is significantly closer (hysteresis)
        if (currentInBounds && nextClosestBuildingId && this._previousClosestBuildingId && nextClosestBuildingId !== this._previousClosestBuildingId) {
            if (minDistance > currentBuildingDistance * this._hysteresisRatio) {
                nextClosestBuildingId = this._previousClosestBuildingId;
            }
        } else if (currentInBounds && !nextClosestBuildingId) {
            nextClosestBuildingId = this._previousClosestBuildingId;
        }

        this._previousClosestBuildingId = nextClosestBuildingId;
        return nextClosestBuildingId;
    }

    _calculateDistance(mapCenter: LngLat, building: IndoorBuilding): number {
        if (!building.center) return Number.MAX_VALUE;
        // Simple squared euclidean distance
        const dLat = mapCenter.lat - building.center[1];
        const dLng = mapCenter.lng - building.center[0];
        return dLat * dLat + dLng * dLng;
    }

    _isBuildingVisible(building: IndoorBuilding, mapBounds: LngLatBounds, viewportPolygon?: Point[]): boolean {
        if (!viewportPolygon) {
            return false;
        }

        // Check intersection with viewport polygon, if any floor is visible
        for (const floorId of building.floorIds) {
            const floor = building.floors[floorId];
            if (!floor.geometry) continue;

            const geometry = floor.geometry;
            if (geometry.type === 'Polygon') {
                const floorPoly = this._convertRingToPoints(geometry.coordinates[0]);
                if (polygonIntersectsPolygon(floorPoly, viewportPolygon)) {
                    return true;
                }
            } else if (geometry.type === 'MultiPolygon') {
                const floorMultiPoly = this._convertMultiPolygonToPoints(geometry.coordinates);
                if (polygonIntersectsMultiPolygon(viewportPolygon, floorMultiPoly)) {
                    return true;
                }
            }
        }

        return false;
    }

    _convertRingToPoints(ring: number[][]): Point[] {
        return ring.map(c => new Point(c[0], c[1]));
    }

    _convertMultiPolygonToPoints(multiPoly: number[][][][]): Point[][] {
        // Convert each polygon's exterior ring
        return multiPoly.map(poly => {
            if (poly.length === 0) return [];
            return poly[0].map(c => new Point(c[0], c[1]));
        });
    }
}
