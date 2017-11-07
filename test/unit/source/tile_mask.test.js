'use strict';

const test = require('mapbox-gl-js-test').test;
const updateTileMasks = require('../../../src/render/tile_mask');
const TileCoord = require('../../../src/source/tile_coord');


test('computeTileMasks', (t) => {
    class Tile {
        constructor(z, x, y, w) {
            this.coord = new TileCoord(z, x, y, w);
            this.sourceMaxZoom = 16;
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
        t.deepEqual(Object.keys(renderables[0].mask), [new TileCoord(0, 0, 0).id]);

        const renderables2 = [new Tile(4, 3, 8)];
        updateTileMasks(renderables2);
        t.deepEqual(Object.keys(renderables2[0].mask), [new TileCoord(0, 0, 0).id]);

        const renderables3 = [new Tile(1, 0, 0), new Tile(1, 1, 1)];
        updateTileMasks(renderables3);
        t.deepEqual(renderables3.map((r)=>{ return Object.keys(r.mask); }), [[new TileCoord(0, 0, 0).id], [new TileCoord(0, 0, 0).id]]);

        const renderables4 = [new Tile(1, 0, 0), new Tile(2, 2, 3)];
        updateTileMasks(renderables4);
        t.deepEqual(renderables4.map((r)=>{ return Object.keys(r.mask); }), [[new TileCoord(0, 0, 0).id], [new TileCoord(0, 0, 0).id]]);
        t.end();
    });

    t.test('parents with all four children', (t) => {
        const renderables = [new Tile(0, 0, 0), new Tile(1, 0, 0), new Tile(1, 0, 1), new Tile(1, 1, 0), new Tile(1, 1, 1)];
        updateTileMasks(renderables);
        t.deepEqual(renderables.map((r)=>{ return Object.keys(r.mask); }), [
            // empty mask -- i.e. don't draw anything because child tiles cover the whole parent tile
            [],
            [new TileCoord(0, 0, 0).id],
            [new TileCoord(0, 0, 0).id],
            [new TileCoord(0, 0, 0).id],
            [new TileCoord(0, 0, 0).id]]);
        t.end();
    });

    t.test('parent and one child', (t) => {
        const renderables = [new Tile(0, 0, 0), new Tile(1, 0, 0)];
        updateTileMasks(renderables);
        t.deepEqual(renderables.map((r)=>{ return Object.keys(r.mask); }), [
            [
                new TileCoord(1, 1, 0).id,
                new TileCoord(1, 0, 1).id,
                new TileCoord(1, 1, 1).id
            ],
            [new TileCoord(0, 0, 0).id]
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
                new TileCoord(1, 1, 1).id.toString(),
                new TileCoord(2, 3, 0).id.toString(),
                new TileCoord(2, 3, 1).id.toString(),
            ],
            [
                new TileCoord(1, 1, 0).id.toString(),
                new TileCoord(1, 0, 1).id.toString(),
                new TileCoord(1, 1, 1).id.toString()
            ],
            [
                new TileCoord(1, 0, 0).id.toString(),
                new TileCoord(1, 1, 0).id.toString(),
                new TileCoord(1, 1, 1).id.toString()
            ],
            [new TileCoord(0, 0, 0).id.toString()],
            [new TileCoord(0, 0, 0).id.toString()],
            [new TileCoord(0, 0, 0).id.toString()],
            [new TileCoord(0, 0, 0).id.toString()]
        ]);
        t.end();
    });

    t.test('deep descendent masks', (t)=>{
        const renderables = [ new Tile(0, 0, 0), new Tile(4, 4, 4)];
        updateTileMasks(renderables);
        t.deepEqual(renderables.map((r)=>{ return Object.keys(r.mask); }), [
            [
                new TileCoord(2, 0, 0).id.toString(),
                new TileCoord(1, 1, 0).id.toString(),
                new TileCoord(2, 1, 0).id.toString(),
                new TileCoord(1, 0, 1).id.toString(),
                new TileCoord(1, 1, 1).id.toString(),
                new TileCoord(2, 0, 1).id.toString(),
                new TileCoord(3, 3, 2).id.toString(),
                new TileCoord(3, 2, 3).id.toString(),
                new TileCoord(3, 3, 3).id.toString(),
                new TileCoord(4, 5, 4).id.toString(),
                new TileCoord(4, 4, 5).id.toString(),
                new TileCoord(4, 5, 5).id.toString(),
            ],
            [
                new TileCoord(0, 0, 0).id.toString()
            ]
        ]);
        t.end();
    });

    t.test('wrapped tile masks', (t) =>{
        const renderables = [new Tile(0, 0, 0, 1), new Tile(1, 0, 0, 1), new Tile(2, 2, 2, 1), new Tile(3, 7, 7, 1), new Tile(3, 6, 6, 1)];
        updateTileMasks(renderables);
        t.deepEqual(renderables.map((r)=>{ return Object.keys(r.mask); }), [
            [
                new TileCoord(1, 1, 0).id.toString(),
                new TileCoord(1, 0, 1).id.toString(),
                new TileCoord(2, 3, 2).id.toString(),
                new TileCoord(2, 2, 3).id.toString(),
                new TileCoord(3, 7, 6).id.toString(),
                new TileCoord(3, 6, 7).id.toString()
            ],
            [new TileCoord(0, 0, 0).id.toString()],
            [new TileCoord(0, 0, 0).id.toString()],
            [new TileCoord(0, 0, 0).id.toString()],
            [new TileCoord(0, 0, 0).id.toString()]

        ]);
        t.end();
    });

    t.end();
});
