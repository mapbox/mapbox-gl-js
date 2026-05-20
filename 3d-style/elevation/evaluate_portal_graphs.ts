import assert from '../../src/style-spec/util/assert';
import FillBucket from '../../src/data/bucket/fill_bucket';
import {ElevationPortalGraph} from './elevation_graph';

import type {VectorTile} from '@mapbox/vector-tile';
import type {Bucket, PopulateParameters} from '../../src/data/bucket';
import type {CanonicalTileID} from '../../src/source/tile_id';
import type DictionaryCoder from '../../src/util/dictionary_coder';

/**
 * Context object for post-populate HD tile work. Using a named shape keeps the
 * core → HD boundary stable as more HD features plug into the same hook.
 *
 * @private
 */
export type PostprocessTileContext = {
    buckets: {[_: string]: Bucket};
    data: VectorTile;
    sourceLayerCoder: DictionaryCoder;
    canonical: CanonicalTileID;
    options: PopulateParameters;
};

/**
 * Cross-bucket portal graph evaluation pass.
 *
 * Multiple layers in a tile may contribute to the elevation of the same geometry, so
 * the unevaluated portal graphs from each `FillBucket` are merged into a single graph
 * describing polygon connectivity across the tile. The evaluated graph is then pushed
 * back into each contributing bucket so per-bucket elevation queries can resolve
 * connections that span layer boundaries.
 *
 * No-op when `options.elevationFeatures` is unset or empty — tiles with no HD elevation
 * features do not allocate portal graph state on any bucket.
 *
 * @private
 */
export function evaluatePortalGraphs({buckets, data, sourceLayerCoder, canonical, options}: PostprocessTileContext): void {
    if (!options.elevationFeatures || options.elevationFeatures.length === 0) {
        return;
    }

    const unevaluatedPortals = [];
    for (const bucket of Object.values(buckets)) {
        if (bucket instanceof FillBucket && bucket.hdExt) {
            const graph = bucket.hdExt.getUnevaluatedPortalGraph();
            if (graph) {
                unevaluatedPortals.push(graph);
            }
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const evaluatedPortals = ElevationPortalGraph.evaluate(unevaluatedPortals);

    for (const bucket of Object.values(buckets)) {
        if (bucket instanceof FillBucket && bucket.hdExt) {
            const vtLayer = data.layers[sourceLayerCoder.decode(bucket.sourceLayerIndex)];
            assert(vtLayer);
            bucket.hdExt.setEvaluatedPortalGraph(evaluatedPortals, vtLayer, canonical, options.availableImages, options.brightness, bucket.worldview);
        }
    }
}
