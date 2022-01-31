import {test} from '../../../util/test.js';
import Transform from '../../../../src/geo/transform.js';

test('Globe', (t) => {
    t.test('pointCoordinate', (t) => {
        const tr = new Transform();
        tr.resize(100, 100);
        tr.zoom = 0;
        tr.setProjection({name: 'globe'});

        let tileTransform = tr.projection.createTileTransform(tr, tr.worldSize);

        let point = tileTransform.pointCoordinate(50, 50);
        t.same(point.x.toFixed(2), 0.5);
        t.same(point.y.toFixed(2), 0.5);

        point = tileTransform.pointCoordinate(0, 50);
        t.same(point.x.toFixed(4), 0.3736);
        t.same(point.y.toFixed(4), 0.5);

        point = tileTransform.pointCoordinate(50, 0);
        t.same(point.x.toFixed(4), 0.5);
        t.same(point.y.toFixed(4), 0.3577);

        tr.center = {lng:180, lat:0};
        tileTransform = tr.projection.createTileTransform(tr, tr.worldSize);

        point = tileTransform.pointCoordinate(50, 50);
        t.same(point.x.toFixed(2), 1.0);
        t.same(point.y.toFixed(2), 0.5);

        point = tileTransform.pointCoordinate(0, 50);
        t.same(point.x.toFixed(4), 0.8736);
        t.same(point.y.toFixed(4), 0.5);

        // Expect x-coordinate not to wrap
        point = tileTransform.pointCoordinate(100, 50);
        t.same(point.x.toFixed(4), 1.1264);
        t.same(point.y.toFixed(4), 0.5);

        t.end();
    });

    t.end();
});
