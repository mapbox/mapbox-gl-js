/**
 * Which render source partition this tile is parsed for.
 * Mirrors C++ RenderVectorSource splits in vector_source_factory.cpp.
 * Undefined/null = no filtering (single source, all layers).
 */
export const RenderSourceType = {
    Other: 0,
    Symbol: 1,
    FillExtrusion: 2,
    HdRoadCoverage: 3,
    HdRoadElevation: 4,
} as const;
export type RenderSourceType = typeof RenderSourceType[keyof typeof RenderSourceType];
