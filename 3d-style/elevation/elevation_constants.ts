// Property for associating elevation features into regular features
export const PROPERTY_ELEVATION_ID = '3d_elevation_id';

// Property for marking the zLevel of elevated road markups(like elevated lines and elevated circles)
export const PROPERTY_ELEVATION_ROAD_MARKUP_Z_LEVEL = 'zLevel';

// Property for marking the zLevel for elevated base roads
export const PROPERTY_ELEVATION_ROAD_BASE_Z_LEVEL = 'level';

// Hard coded source layer name for HD road elevation data.
export const HD_ELEVATION_SOURCE_LAYER = 'hd_road_elevation';

export const ELEVATION_CLIP_MARGIN = 1;

export const MARKUP_ELEVATION_BIAS = 0.05;

// Fraction to extend subdivision edge endpoints in each direction to ensure the
// strip fully crosses the road polygon. Without this, tight ramp geometry can
// produce edges that don't span the full polygon width, causing invalid clipping output.
export const SUBDIVISION_EDGE_EXTENSION = 0.1;

export type ElevationType = 'none' | 'road' | 'offset';
