import {test} from '../../util/test';
import LineAtlas from '../../../src/render/line_atlas';

test('LineAtlas', (t) => {
    const lineAtlas = new LineAtlas(64, 64);
    t.test('round [0, 0]', (t) => {
        const entry = lineAtlas.addDash([0, 0], true);
        t.equal(entry.width, 0);
        t.end();
    });
    t.test('round [1, 0]', (t) => {
        const entry = lineAtlas.addDash([1, 0], true);
        t.equal(entry.width, 1);
        t.end();
    });
    t.test('round [0, 1]', (t) => {
        const entry = lineAtlas.addDash([0, 1], true);
        t.equal(entry.width, 1);
        t.end();
    });
    t.test('odd round [1, 2, 1]', (t) => {
        const entry = lineAtlas.addDash([1, 2, 1], true);
        t.equal(entry.width, 4);
        t.end();
    });

    t.test('regular [0, 0]', (t) => {
        const entry = lineAtlas.addDash([0, 0], false);
        t.equal(entry.width, 0);
        t.end();
    });
    t.test('regular [1, 0]', (t) => {
        const entry = lineAtlas.addDash([1, 0], false);
        t.equal(entry.width, 1);
        t.end();
    });
    t.test('regular [0, 1]', (t) => {
        const entry = lineAtlas.addDash([0, 1], false);
        t.equal(entry.width, 1);
        t.end();
    });
    t.test('odd regular [1, 2, 1]', (t) => {
        const entry = lineAtlas.addDash([1, 2, 1], false);
        t.equal(entry.width, 4);
        t.end();
    });
    t.end();
});
