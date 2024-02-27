import {describe, test, expect} from "../../util/vitest.js";
import LineAtlas from '../../../src/render/line_atlas.js';

describe('LineAtlas', () => {
    const lineAtlas = new LineAtlas(64, 64);
    test('round [0, 0]', () => {
        const entry = lineAtlas.addDash([0, 0], 'round');
        expect(entry.br[0]).toEqual(0);
    });
    test('round [1, 0]', () => {
        const entry = lineAtlas.addDash([1, 0], 'round');
        expect(entry.br[0]).toEqual(1);
    });
    test('round [0, 1]', () => {
        const entry = lineAtlas.addDash([0, 1], 'round');
        expect(entry.br[0]).toEqual(1);
    });
    test('odd round [1, 2, 1]', () => {
        const entry = lineAtlas.addDash([1, 2, 1], 'round');
        expect(entry.br[0]).toEqual(4);
    });

    test('regular [0, 0]', () => {
        const entry = lineAtlas.addDash([0, 0], 'butt');
        expect(entry.br[0]).toEqual(0);
    });
    test('regular [1, 0]', () => {
        const entry = lineAtlas.addDash([1, 0], 'butt');
        expect(entry.br[0]).toEqual(1);
    });
    test('regular [0, 1]', () => {
        const entry = lineAtlas.addDash([0, 1], 'butt');
        expect(entry.br[0]).toEqual(1);
    });
    test('odd regular [1, 2, 1]', () => {
        const entry = lineAtlas.addDash([1, 2, 1], 'butt');
        expect(entry.br[0]).toEqual(4);
    });
    test('trims & uses cached positions', () => {
        lineAtlas.trim();
        expect(lineAtlas.addDash([0, 0], 'butt')).toBeTruthy();
        expect(lineAtlas.addDash([0, 0], 'round')).toBeTruthy();
    });
});
