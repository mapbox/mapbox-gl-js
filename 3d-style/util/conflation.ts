import type Point from '@mapbox/point-geometry';
import type TriangleGridIndex from '../../src/util/triangle_grid_index';
import type {UnwrappedTileID} from '../../src/source/tile_id';

export type Footprint = {
    vertices: Array<Point>;
    indices: Array<number>;
    grid: TriangleGridIndex;
    min: Point;
    max: Point;
    buildingId?: number;
};

export type TileFootprint = {
    footprint: Footprint;
    id: UnwrappedTileID;
};

export const LayerTypeMask = {
    None: 0,
    Model: 1,
    Symbol: 2,
    FillExtrusion: 4,
    All: 7
} as const;
