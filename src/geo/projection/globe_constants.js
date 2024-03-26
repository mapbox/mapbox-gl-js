// @flow

import EXTENT from '../../style-spec/data/extent.js';

export const GLOBE_RADIUS = EXTENT / Math.PI / 2.0;

export const GLOBE_ZOOM_THRESHOLD_MIN = 5;
export const GLOBE_ZOOM_THRESHOLD_MAX = 6;

// At low zoom levels the globe gets rendered so that the scale at this
// latitude matches it's scale in a mercator map. The choice of latitude is
// a bit arbitrary. Different choices will match mercator more closely in different
// views. 45 is a good enough choice because:
// - it's half way from the pole to the equator
// - matches most middle latitudes reasonably well
// - biases towards increasing size rather than decreasing
// - makes the globe slightly larger at very low zoom levels, where it already
//   covers less pixels than mercator (due to the curved surface)
//
//   Changing this value will change how large a globe is rendered and could affect
//   end users. This should only be done of the tradeoffs between change and improvement
//   are carefully considered.
export const GLOBE_SCALE_MATCH_LATITUDE = 45;

const GLOBE_NORMALIZATION_BIT_RANGE = 15;
export const GLOBE_NORMALIZATION_MASK = (1 << (GLOBE_NORMALIZATION_BIT_RANGE - 1)) - 1;
export const GLOBE_VERTEX_GRID_SIZE = 64;
export const GLOBE_LATITUDINAL_GRID_LOD_TABLE = [GLOBE_VERTEX_GRID_SIZE, GLOBE_VERTEX_GRID_SIZE / 2, GLOBE_VERTEX_GRID_SIZE / 4];
export const TILE_SIZE = 512;

export const GLOBE_MIN = -GLOBE_RADIUS;
export const GLOBE_MAX = GLOBE_RADIUS;
