/// Road class to FRC level mapping (motorway=0 .. pedestrian/path=8).
const roadTypeToFrcMap: Record<string, number> = {
    'motorway': 0, 'motorway_link': 0,
    'trunk': 1, 'trunk_link': 1,
    'primary': 2, 'primary_link': 2,
    'secondary': 3, 'secondary_link': 3,
    'tertiary': 4, 'tertiary_link': 4,
    'unclassified': 5, 'unclassified_link': 5,
    'street': 6, 'street_limited': 6, 'residential': 6,
    'service': 7, 'living_street': 7,
    'pedestrian': 8, 'track': 8, 'path': 8,
    'footway': 8, 'cycleway': 8, 'sidewalk': 8, 'crossing': 8,
};

export function featureFrcLevel(featureProperties: Record<string, unknown>): number | null {
    for (const key of ['class', 'incident_class']) {
        const cls = featureProperties[key];
        if (typeof cls !== 'string') continue;
        const frc = roadTypeToFrcMap[cls];
        if (frc !== undefined) return frc;
    }
    return null;
}

export function isFeatureCoveredByFrcMask(featureProperties: Record<string, unknown>, frcMask: number): boolean {
    const frc = featureFrcLevel(featureProperties);
    return frc !== null && (frcMask & (1 << frc)) !== 0;
}

/// Check whether a source/sourceLayer pair is in the coverage list.
/// Entry forms:
///   "sourceLayer"              — matches any source
///   "(sourceId)sourceLayer"    — matches specific source and source-layer
export function matchesCoverageSourceLayer(entries: string[], source: string, sourceLayer: string): boolean {
    for (const entry of entries) {
        if (entry.startsWith('(')) {
            const close = entry.indexOf(')');
            if (close === -1) continue;
            if (entry.slice(1, close) === source && entry.slice(close + 1) === sourceLayer) return true;
        } else {
            if (entry === sourceLayer) return true;
        }
    }
    return false;
}
