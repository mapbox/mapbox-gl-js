// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import {test, expect} from '../../util/vitest';
import Point from '@mapbox/point-geometry';
import EXTENT from '../../../src/style-spec/data/extent';
import FeatureIndex from '../../../src/data/feature_index';
import FillExtrusionBucket from '../../../src/data/bucket/fill_extrusion_bucket';
import FillExtrusionStyleLayer from '../../../src/style/style_layer/fill_extrusion_style_layer';
import tileTransform from '../../../src/geo/projection/tile_transform';
import {CanonicalTileID, OverscaledTileID} from '../../../src/source/tile_id';
import {getProjection} from '../../../src/geo/projection/index';

const ZOOM = 15;

// A square polygon well inside the tile, so that it doesn't intersect any tile border
// and therefore gets a visible (non-hidden) centroid.
function createSquareFeature(id, properties, x, y, size) {
    return {
        id,
        type: 3,
        extent: EXTENT,
        properties,
        loadGeometry: () => [[
            new Point(x, y),
            new Point(x + size, y),
            new Point(x + size, y + size),
            new Point(x, y + size),
            new Point(x, y)
        ]]
    };
}

function populateBucket(features) {
    const layer = new FillExtrusionStyleLayer({
        id: 'test',
        type: 'fill-extrusion',
        paint: {'fill-extrusion-height': 10}
    }, '', null);
    layer.recalculate({zoom: ZOOM}, []);

    const tileID = new OverscaledTileID(ZOOM, 0, ZOOM, 0, 0);
    const canonical = new CanonicalTileID(ZOOM, 0, 0);
    const bucket = new FillExtrusionBucket({
        index: 0,
        layers: [layer],
        zoom: ZOOM,
        canonical,
        pixelRatio: 1,
        overscaling: 1,
        lut: null,
        projection: {name: 'mercator'},
        worldview: 'US'
    });

    bucket.populate(
        features.map((feature, index) => ({feature, id: feature.id, index, sourceLayerIndex: 0})),
        {featureIndex: new FeatureIndex(tileID), availableImages: [], patternDependencies: {}, brightness: null},
        canonical,
        tileTransform(canonical, getProjection({name: 'mercator'}))
    );

    return bucket;
}

test('FillExtrusionBucket merges centroids of parts sharing a numeric building_id', () => {
    const bucket = populateBucket([
        createSquareFeature(1, {'building_id': 7}, 1000, 1000, 500),
        createSquareFeature(2, {'building_id': 7}, 5000, 5000, 500)
    ]);

    const [first, second] = [bucket.centroidData.get(0), bucket.centroidData.get(1)];
    expect(first.centroidXY).toEqual(second.centroidXY);
    expect(first.min).toEqual(new Point(1000, 1000));
    expect(first.max).toEqual(new Point(5500, 5500));
});

test('FillExtrusionBucket keeps centroids of parts with distinct non-numeric building_ids apart', () => {
    const bucket = populateBucket([
        createSquareFeature(1, {'building_id': '2f6b3ee3-a3e4-4d1a-9e14-8a3f5e2d1c00'}, 1000, 1000, 500),
        createSquareFeature(2, {'building_id': '9c1d7a08-5b62-4f77-b0a1-6e2c4d9f3b11'}, 5000, 5000, 500)
    ]);

    const [first, second] = [bucket.centroidData.get(0), bucket.centroidData.get(1)];
    expect(first.centroidXY).not.toEqual(second.centroidXY);
    expect(first.max).toEqual(new Point(1500, 1500));
    expect(second.min).toEqual(new Point(5000, 5000));
});

test('FillExtrusionBucket groups parts with non-numeric building_id by feature id', () => {
    const bucket = populateBucket([
        createSquareFeature(3, {'building_id': 'a-b-c'}, 1000, 1000, 500),
        createSquareFeature(3, {'building_id': 'a-b-c'}, 5000, 5000, 500)
    ]);

    expect(bucket.centroidData.get(0).buildingId).toEqual(3);
    expect(bucket.centroidData.get(1).buildingId).toEqual(3);
});
