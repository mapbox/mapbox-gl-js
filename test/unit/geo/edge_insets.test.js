import {test} from '../../util/test';
import EdgeInsets from '../../../src/geo/edge_insets';

test('EdgeInsets', (t) => {
    t.test('#constructor', (t) => {
        t.ok(new EdgeInsets() instanceof EdgeInsets, 'creates an object with default values');
        t.throws(() => {
            new EdgeInsets(NaN, 10);
        }, `Invalid input EdgeInsets(NaN, 10) gets detected and error is thrown`);
        t.throws(() => {
            new EdgeInsets(-10, 10, 20, 10);
        }, `Invalid input EdgeInsets(-10, 10, 20, 10) gets detected and error is thrown`);

        t.test('valid initialization', (t) => {
            const top = 10;
            const bottom = 15;
            const left = 26;
            const right = 19;

            const inset = new EdgeInsets(top, bottom, left, right);
            t.equal(inset.top, top);
            t.equal(inset.bottom, bottom);
            t.equal(inset.left, left);
            t.equal(inset.right, right);
            t.end();
        });
        t.end();
    });

    t.test('#getCenter', (t) => {
        t.test('valid input', (t) => {
            const inset = new EdgeInsets(10, 15, 50, 10);
            const center = inset.getCenter(600, 400);
            t.equal(center.x, 320);
            t.equal(center.y, 197.5);
            t.end();
        });

        t.test('center clamping', (t) => {
            const inset = new EdgeInsets(300, 200, 500, 200);
            const center = inset.getCenter(600, 400);
            // Midpoint of the overlap when padding overlaps
            t.equal(center.x, 450);
            t.equal(center.y, 250);
            t.end();
        });
        t.end();
    });

    t.test('#interpolate', (t) => {
        t.test('it works', (t) => {
            const inset1 = new EdgeInsets(10, 15, 50, 10);
            const inset2 = new EdgeInsets(20, 30, 100, 10);
            const inset3 = inset1.interpolate(inset1, inset2, 0.5);
            // inset1 is mutated in-place
            t.equal(inset3, inset1);

            t.equal(inset3.top, 15);
            t.equal(inset3.bottom, 22.5);
            t.equal(inset3.left, 75);
            t.equal(inset3.right, 10);
            t.end();
        });

        t.test('it retains insets that dont have new parameters passed in', (t) => {
            const inset = new EdgeInsets(10, 15, 50, 10);
            const target = {
                top: 20
            };
            inset.interpolate(inset, target, 0.5);
            t.equal(inset.top, 15);
            t.equal(inset.bottom, 15);
            t.equal(inset.left, 50);
            t.equal(inset.right, 10);
            t.end();
        });

        t.end();
    });

    t.test('#equals', (t) => {
        const inset1 = new EdgeInsets(10, 15, 50, 10);
        const inset2 = new EdgeInsets(10, 15, 50, 10);
        const inset3 = new EdgeInsets(10, 15, 50, 11);
        t.ok(inset1.equals(inset2));
        t.notOk(inset2.equals(inset3));
        t.end();
    });

    t.test('#clone', (t) => {
        const inset1 = new EdgeInsets(10, 15, 50, 10);
        const inset2 = inset1.clone();
        t.notOk(inset2 === inset1);
        t.ok(inset1.equals(inset2));
        t.end();
    });

    t.end();
});
