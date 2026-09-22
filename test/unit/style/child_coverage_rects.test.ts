import {test, expect} from '../../util/vitest';
import {OverscaledTileID} from '../../../src/source/tile_id';
import {computeChildCoverageRects} from '../../../src/style/style';

import type Tile from '../../../src/source/tile';

function makeTile(overscaledZ: number, wrap: number, z: number, x: number, y: number): Tile {
    return {tileID: new OverscaledTileID(overscaledZ, wrap, z, x, y)} as unknown as Tile;
}

test('computeChildCoverageRects returns an empty map for fewer than two tiles', () => {
    expect(computeChildCoverageRects([])).toEqual(new Map());
    expect(computeChildCoverageRects([makeTile(0, 0, 0, 0, 0)])).toEqual(new Map());
});

test('computeChildCoverageRects returns an empty map for unrelated sibling tiles', () => {
    const siblingA = makeTile(1, 0, 1, 0, 0);
    const siblingB = makeTile(1, 0, 1, 1, 0);
    expect(computeChildCoverageRects([siblingA, siblingB])).toEqual(new Map());
});

test('computeChildCoverageRects covers a parent tile with its single loaded child', () => {
    const parent = makeTile(0, 0, 0, 0, 0);
    const child = makeTile(1, 0, 1, 0, 0);
    const rects = computeChildCoverageRects([parent, child]);
    expect(rects.size).toBe(1);
    expect(rects.get(parent.tileID.key)).toEqual([{min: {x: 0, y: 0}, max: {x: 4096, y: 4096}}]);
});

test('computeChildCoverageRects covers a parent tile with only some of its children loaded', () => {
    const parent = makeTile(0, 0, 0, 0, 0);
    const topLeft = makeTile(1, 0, 1, 0, 0);
    const bottomRight = makeTile(1, 0, 1, 1, 1);
    const rects = computeChildCoverageRects([parent, topLeft, bottomRight]);
    expect(rects.size).toBe(1);
    expect(rects.get(parent.tileID.key)).toEqual([
        {min: {x: 0, y: 0}, max: {x: 4096, y: 4096}},
        {min: {x: 4096, y: 4096}, max: {x: 8192, y: 8192}}
    ]);
});

test('computeChildCoverageRects covers every ancestor in a 3-level chain', () => {
    const grandparent = makeTile(0, 0, 0, 0, 0);
    const parent = makeTile(1, 0, 1, 0, 0);
    const child = makeTile(2, 0, 2, 0, 0);
    const rects = computeChildCoverageRects([grandparent, parent, child]);
    expect(rects.size).toBe(2);
    expect(rects.get(grandparent.tileID.key)).toEqual([
        {min: {x: 0, y: 0}, max: {x: 4096, y: 4096}},
        {min: {x: 0, y: 0}, max: {x: 2048, y: 2048}}
    ]);
    expect(rects.get(parent.tileID.key)).toEqual([{min: {x: 0, y: 0}, max: {x: 4096, y: 4096}}]);
});

test('computeChildCoverageRects never shadows across different wrap (world copies)', () => {
    const wrap0 = makeTile(0, 0, 0, 0, 0);
    const wrap1Child = makeTile(1, 1, 1, 0, 0);
    expect(computeChildCoverageRects([wrap0, wrap1Child])).toEqual(new Map());
});

test('computeChildCoverageRects fully covers a lower-overscaledZ tile clamped to the same canonical id', () => {
    // Simulates a source maxzoom clamp: both tiles were requested at different (higher) zooms
    // but got clamped to the same canonical (z, x, y), differing only in overscaledZ.
    const lessOverscaled = makeTile(5, 0, 3, 1, 1);
    const moreOverscaled = makeTile(6, 0, 3, 1, 1);
    const rects = computeChildCoverageRects([lessOverscaled, moreOverscaled]);
    expect(rects.size).toBe(1);
    expect(rects.get(lessOverscaled.tileID.key)).toEqual([{min: {x: 0, y: 0}, max: {x: 8192, y: 8192}}]);
    expect(rects.has(moreOverscaled.tileID.key)).toBe(false);
});
