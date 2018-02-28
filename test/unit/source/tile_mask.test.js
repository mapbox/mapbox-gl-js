import { test } from 'mapbox-gl-js-test';
import updateTileMasks from '../../../src/render/tile_mask';
import { OverscaledTileID } from '../../../src/source/tile_id';


test('computeTileMasks', (t) => {
    class Tile {
        constructor(z, x, y, w) {
            const sourceMaxZoom = 16;
            this.tileID = new OverscaledTileID(z, w || 0, Math.min(sourceMaxZoom, z), x, y);
        }

        setMask(mask) {
            this.mask = mask;
        }

        getMask() {
            return this.mask;
        }

        hasData() {
            return true;
        }
    }

    t.test('no children', (t) => {
        const renderables = [new Tile(0, 0, 0) ];
        updateTileMasks(renderables);
        t.deepEqual(Object.keys(renderables[0].mask), [new OverscaledTileID(0, 0, 0, 0, 0).key]);

        const renderables2 = [new Tile(4, 3, 8)];
        updateTileMasks(renderables2);
        t.deepEqual(Object.keys(renderables2[0].mask), [new OverscaledTileID(0, 0, 0, 0, 0).key]);

        const renderables3 = [new Tile(1, 0, 0), new Tile(1, 1, 1)];
        updateTileMasks(renderables3);
        t.deepEqual(renderables3.map((r)=>{ return Object.keys(r.mask); }), [[new OverscaledTileID(0, 0, 0, 0, 0).key], [new OverscaledTileID(0, 0, 0, 0, 0).key]]);

        const renderables4 = [new Tile(1, 0, 0), new Tile(2, 2, 3)];
        updateTileMasks(renderables4);
        t.deepEqual(renderables4.map((r)=>{ return Object.keys(r.mask); }), [[new OverscaledTileID(0, 0, 0, 0, 0).key], [new OverscaledTileID(0, 0, 0, 0, 0).key]]);
        t.end();
    });

    t.test('parents with all four children', (t) => {
        const renderables = [new Tile(0, 0, 0), new Tile(1, 0, 0), new Tile(1, 0, 1), new Tile(1, 1, 0), new Tile(1, 1, 1)];
        updateTileMasks(renderables);
        t.deepEqual(renderables.map((r)=>{ return Object.keys(r.mask); }), [
            // empty mask -- i.e. don't draw anything because child tiles cover the whole parent tile
            [],
            [new OverscaledTileID(0, 0, 0, 0, 0).key],
            [new OverscaledTileID(0, 0, 0, 0, 0).key],
            [new OverscaledTileID(0, 0, 0, 0, 0).key],
            [new OverscaledTileID(0, 0, 0, 0, 0).key]]);
        t.end();
    });

    t.test('parent and one child', (t) => {
        const renderables = [new Tile(0, 0, 0), new Tile(1, 0, 0)];
        updateTileMasks(renderables);
        t.deepEqual(renderables.map((r)=>{ return Object.keys(r.mask); }), [
            [
                new OverscaledTileID(1, 0, 1, 1, 0).key,
                new OverscaledTileID(1, 0, 1, 0, 1).key,
                new OverscaledTileID(1, 0, 1, 1, 1).key
            ],
            [new OverscaledTileID(0, 0, 0, 0, 0).key]
        ]);
        t.end();
    });

    t.test('complex masks', (t) => {
        const renderables = [new Tile(12, 1028, 1456),
            new Tile(13, 2056, 2912),
            new Tile(13, 2056, 2913),
            new Tile(14, 4112, 5824),
            new Tile(14, 4112, 5827),
            new Tile(14, 4114, 5824),
            new Tile(14, 4114, 5825)];
        updateTileMasks(renderables);
        t.deepEqual(renderables.map((r)=>{ return Object.keys(r.mask); }), [
            [
                new OverscaledTileID(1, 0, 1, 1, 1).key.toString(),
                new OverscaledTileID(2, 0, 2, 3, 0).key.toString(),
                new OverscaledTileID(2, 0, 2, 3, 1).key.toString(),
            ],
            [
                new OverscaledTileID(1, 0, 1, 1, 0).key.toString(),
                new OverscaledTileID(1, 0, 1, 0, 1).key.toString(),
                new OverscaledTileID(1, 0, 1, 1, 1).key.toString()
            ],
            [
                new OverscaledTileID(1, 0, 1, 0, 0).key.toString(),
                new OverscaledTileID(1, 0, 1, 1, 0).key.toString(),
                new OverscaledTileID(1, 0, 1, 1, 1).key.toString()
            ],
            [new OverscaledTileID(0, 0, 0, 0, 0).key.toString()],
            [new OverscaledTileID(0, 0, 0, 0, 0).key.toString()],
            [new OverscaledTileID(0, 0, 0, 0, 0).key.toString()],
            [new OverscaledTileID(0, 0, 0, 0, 0).key.toString()]
        ]);
        t.end();
    });

    t.test('deep descendent masks', (t)=>{
        const renderables = [ new Tile(0, 0, 0), new Tile(4, 4, 4)];
        updateTileMasks(renderables);
        t.deepEqual(renderables.map((r)=>{ return Object.keys(r.mask); }), [
            [
                new OverscaledTileID(2, 0, 2, 0, 0).key.toString(),
                new OverscaledTileID(1, 0, 1, 1, 0).key.toString(),
                new OverscaledTileID(2, 0, 2, 1, 0).key.toString(),
                new OverscaledTileID(1, 0, 1, 0, 1).key.toString(),
                new OverscaledTileID(1, 0, 1, 1, 1).key.toString(),
                new OverscaledTileID(2, 0, 2, 0, 1).key.toString(),
                new OverscaledTileID(3, 0, 3, 3, 2).key.toString(),
                new OverscaledTileID(3, 0, 3, 2, 3).key.toString(),
                new OverscaledTileID(3, 0, 3, 3, 3).key.toString(),
                new OverscaledTileID(4, 0, 4, 5, 4).key.toString(),
                new OverscaledTileID(4, 0, 4, 4, 5).key.toString(),
                new OverscaledTileID(4, 0, 4, 5, 5).key.toString(),
            ],
            [
                new OverscaledTileID(0, 0, 0, 0, 0).key.toString()
            ]
        ]);
        t.end();
    });

    t.test('wrapped tile masks', (t) =>{
        const renderables = [new Tile(0, 0, 0, 1), new Tile(1, 0, 0, 1), new Tile(2, 2, 2, 1), new Tile(3, 7, 7, 1), new Tile(3, 6, 6, 1)];
        updateTileMasks(renderables);
        t.deepEqual(renderables.map((r)=>{ return Object.keys(r.mask); }), [
            [
                new OverscaledTileID(1, 0, 1, 1, 0).key.toString(),
                new OverscaledTileID(1, 0, 1, 0, 1).key.toString(),
                new OverscaledTileID(2, 0, 2, 3, 2).key.toString(),
                new OverscaledTileID(2, 0, 2, 2, 3).key.toString(),
                new OverscaledTileID(3, 0, 3, 7, 6).key.toString(),
                new OverscaledTileID(3, 0, 3, 6, 7).key.toString()
            ],
            [new OverscaledTileID(0, 0, 0, 0, 0).key.toString()],
            [new OverscaledTileID(0, 0, 0, 0, 0).key.toString()],
            [new OverscaledTileID(0, 0, 0, 0, 0).key.toString()],
            [new OverscaledTileID(0, 0, 0, 0, 0).key.toString()]

        ]);
        t.end();
    });

    t.end();
});
