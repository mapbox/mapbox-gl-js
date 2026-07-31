import GridIndex from '../symbol/grid_index';
import {geometryElementsIntersect, extendGeometryElement} from './geometry';

import type {Geometry, GeometryElement, BoxGeometryElement} from './geometry';

/**
 * - `'outside-of-grid'`: every geometry element fully lies outside the grid
 * - `'intersects'`: at least one element, extended by `collisionPadding`, collides
 *   with a stored geometry and that collision was not ignored
 * - `'does-not-intersect'`: otherwise.
 */
export type IntersectionResult = 'outside-of-grid' | 'intersects' | 'does-not-intersect';

export class CollisionGrid<T> {
    _grid: GridIndex<number>;
    _cellSize: number;
    _padding: number;
    _screenWidth: number;
    _screenHeight: number;
    _workingArea: BoxGeometryElement;

    _geometries: Array<GeometryElement>;
    _geometryData: Array<T | undefined>;

    constructor(screenWidth: number, screenHeight: number, gridPadding: number, cellSize: number) {
        this._cellSize = cellSize;
        this._padding = gridPadding;
        this._screenWidth = screenWidth;
        this._screenHeight = screenHeight;
        this._grid = new GridIndex<number>(screenWidth + 2 * gridPadding, screenHeight + 2 * gridPadding, cellSize);
        this._workingArea = this._computeWorkingArea();

        this._geometries = [];
        this._geometryData = [];
    }

    clearAndResize(screenWidth: number, screenHeight: number) {
        if (screenWidth === this._screenWidth && screenHeight === this._screenHeight) {
            this._grid.clear();
        } else {
            this._screenWidth = screenWidth;
            this._screenHeight = screenHeight;
            this._grid = new GridIndex<number>(screenWidth + 2 * this._padding, screenHeight + 2 * this._padding, this._cellSize);
            this._workingArea = this._computeWorkingArea();
        }

        this._geometries.length = 0;
        this._geometryData.length = 0;
    }

    _computeWorkingArea(): BoxGeometryElement {
        return {
            kind: 'box',
            left: -this._padding,
            top: -this._padding,
            right: this._grid.xCellCount * this._cellSize - this._padding,
            bottom: this._grid.yCellCount * this._cellSize - this._padding,
        };
    }

    /**
     * Geometry inserted without `data` always counts as a collision.
     * Geometry inserted with `data` (i.e. parts of the same symbol) are treated as optional.
     * `ignoreIntersectionWith` is called with the stored data, and the collision only counts if it returns false.
     *
     * See `IntersectionResult` for what each outcome means.
     */
    intersects(geometry: Geometry, collisionPadding: number, ignoreIntersectionWith: (data: T) => boolean): IntersectionResult {
        let result: IntersectionResult = 'outside-of-grid';
        for (const element of geometry) {
            const elementResult = this._elementIntersects(element, collisionPadding, ignoreIntersectionWith);
            if (elementResult === 'intersects') return 'intersects';
            if (elementResult === 'does-not-intersect') result = 'does-not-intersect';
        }
        return result;
    }

    _elementIntersects(element: GeometryElement, collisionPadding: number, ignoreIntersectionWith: (data: T) => boolean): IntersectionResult {
        if (!geometryElementsIntersect(element, this._workingArea)) return 'outside-of-grid';

        const padding = this._padding;
        const extended = extendGeometryElement(element, collisionPadding);

        // GridIndex's own candidate test is a broad-phase check (touching counts as a hit);
        // re-verify the exact geometry here so touching-but-not-overlapping shapes don't count.
        const predicate = (geometryIndex: number): boolean => {
            if (!geometryElementsIntersect(this._geometries[geometryIndex]!, extended)) return false;
            const data = this._geometryData[geometryIndex];
            return data === undefined || !ignoreIntersectionWith(data);
        };

        const hit = extended.kind === 'box' ?
            this._grid.hitTest(extended.left + padding, extended.top + padding, extended.right + padding, extended.bottom + padding, predicate) :
            this._grid.hitTestCircle(extended.x + padding, extended.y + padding, extended.radius, predicate);

        return hit ? 'intersects' : 'does-not-intersect';
    }

    insert(geometry: Geometry, data?: T): boolean {
        const padding = this._padding;

        let inserted = false;
        for (const element of geometry) {
            if (!geometryElementsIntersect(element, this._workingArea)) continue;

            const geometryIndex = this._geometries.length;
            this._geometries.push(element);
            this._geometryData.push(data);

            if (element.kind === 'box') {
                this._grid.insert(geometryIndex, element.left + padding, element.top + padding, element.right + padding, element.bottom + padding);
            } else {
                this._grid.insertCircle(geometryIndex, element.x + padding, element.y + padding, element.radius);
            }
            inserted = true;
        }

        return inserted;
    }
}
