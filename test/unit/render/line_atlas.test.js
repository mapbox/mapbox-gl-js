import {test} from '../../util/test.js';
import LineAtlas from '../../../src/render/line_atlas.js';

test('LineAtlas', (t) => {
    const lineAtlas = new LineAtlas(64, 64);
    t.test('round [0, 0]', (t) => {
        const entry = lineAtlas.addDash([0, 0], 'round');
        t.equal(entry.br[0], 0);
        t.end();
    });
    t.test('round [1, 0]', (t) => {
        const entry = lineAtlas.addDash([1, 0], 'round');
        t.equal(entry.br[0], 1);
        t.end();
    });
    t.test('round [0, 1]', (t) => {
        const entry = lineAtlas.addDash([0, 1], 'round');
        t.equal(entry.br[0], 1);
        t.end();
    });
    t.test('odd round [1, 2, 1]', (t) => {
        const entry = lineAtlas.addDash([1, 2, 1], 'round');
        t.equal(entry.br[0], 4);
        t.end();
    });

    t.test('regular [0, 0]', (t) => {
        const entry = lineAtlas.addDash([0, 0], 'butt');
        t.equal(entry.br[0], 0);
        t.end();
    });
    t.test('regular [1, 0]', (t) => {
        const entry = lineAtlas.addDash([1, 0], 'butt');
        t.equal(entry.br[0], 1);
        t.end();
    });
    t.test('regular [0, 1]', (t) => {
        const entry = lineAtlas.addDash([0, 1], 'butt');
        t.equal(entry.br[0], 1);
        t.end();
    });
    t.test('odd regular [1, 2, 1]', (t) => {
        const entry = lineAtlas.addDash([1, 2, 1], 'butt');
        t.equal(entry.br[0], 4);
        t.end();
    });
    t.test('trims & uses cached positions', (t) => {
        lineAtlas.trim();
        t.ok(lineAtlas.addDash([0, 0], 'butt'));
        t.ok(lineAtlas.addDash([0, 0], 'round'));
        t.end();
    });
    t.end();
});
