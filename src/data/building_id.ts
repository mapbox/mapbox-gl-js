import {warnOnce} from '../util/util';

// `building_id` groups the parts of one building so that they share a centroid. It must be
// numeric to be comparable to feature ids. Values that don't convert (e.g. UUID strings)
// would all become NaN, and because Map and Set keys treat NaN as equal to itself, every
// such feature would end up in the same group. Report them as absent, which falls back to
// grouping by feature id.
export function resolveBuildingId(properties?: Record<PropertyKey, unknown> | null): number | undefined {
    const value = properties?.['building_id'];
    if (value === undefined) return undefined;

    // Number() maps null, '' and booleans to 0 or 1, so only take numbers and numeric strings.
    const buildingId = typeof value === 'number' || (typeof value === 'string' && value !== '') ? Number(value) : NaN;
    if (!Number.isFinite(buildingId)) {
        warnOnce('Ignoring non-numeric "building_id" feature property. Such features are grouped by feature id instead.');
        return undefined;
    }

    return buildingId;
}
