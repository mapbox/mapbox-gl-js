import { test } from 'mapbox-gl-js-test';
import {
    Uniform1i,
    Uniform1f,
    Uniform2fv,
    Uniform3fv,
    Uniform4fv
} from '../../../src/render/uniform_binding';

function arrEq(a, b) {
    return a.every((el, i) => el === b[i]);
}

test('Uniform1i', (t) => {
    // test counts ensure we don't call the gl.uniform* setters more than expected
    t.plan(4);

    const context = {
        gl: {
            uniform1i: () => { t.ok(true, 'sets value when unique'); }
        }
    };

    const u = new Uniform1i(context);

    t.notOk(u.current, 'not set upon initialization');
    u.set(0, 1);
    t.equal(u.current, 1, 'correctly set value');
    u.set(0, 1);
    u.set(0, 2);
    t.end();
});

test('Uniform1f', (t) => {
    t.plan(4);

    const context = {
        gl: {
            uniform1f: () => { t.ok(true, 'sets value when unique'); }
        }
    };

    const u = new Uniform1f(context);

    t.notOk(u.current, 'not set upon initialization');
    u.set(0, 1);
    t.equal(u.current, 1, 'correctly set value');
    u.set(0, 1);
    u.set(0, 2);
    t.end();
});

test('Uniform2fv', (t) => {
    t.plan(4);

    const context = {
        gl: {
            uniform2f: () => { t.ok(true, 'sets value when unique'); }
        }
    };

    const u = new Uniform2fv(context);

    t.notOk(u.current, 'not set upon initialization');
    u.set(0, [1, 1]);
    t.ok(arrEq(u.current, [1, 1]), 'correctly set value');
    u.set(0, [1, 1]);
    u.set(0, [1, 2]);
    t.end();
});

test('Uniform3fv', (t) => {
    t.plan(4);

    const context = {
        gl: {
            uniform3f: () => { t.ok(true, 'sets value when unique'); }
        }
    };

    const u = new Uniform3fv(context);

    t.notOk(u.current, 'not set upon initialization');
    u.set(0, [1, 1, 1]);
    t.ok(arrEq(u.current, [1, 1, 1]), 'correctly set value');
    u.set(0, [1, 1, 1]);
    u.set(0, [1, 1, 2]);
    t.end();
});

test('Uniform4fv', (t) => {
    t.plan(4);

    const context = {
        gl: {
            uniform4f: () => { t.ok(true, 'sets value when unique'); }
        }
    };

    const u = new Uniform4fv(context);

    t.notOk(u.current, 'not set upon initialization');
    u.set(0, [1, 1, 1, 1]);
    t.ok(arrEq(u.current, [1, 1, 1, 1]), 'correctly set value');
    u.set(0, [1, 1, 1, 1]);
    u.set(0, [2, 1, 1, 1]);
    t.end();
});
