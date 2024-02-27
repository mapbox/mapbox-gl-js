import {test, expect} from "../../util/vitest.js";
import {
    Uniform1i,
    Uniform1f,
    Uniform2f,
    Uniform3f,
    Uniform4f
} from '../../../src/render/uniform_binding.js';

test('Uniform1i', () => {
    // test counts ensure we don't call the gl.uniform* setters more than expected
    expect.assertions(4);

    const context = {
        gl: {
            uniform1i: () => { expect(true).toBeTruthy(); },
            getUniformLocation: () => { return true; }
        }
    };

    const u = new Uniform1i(context, 0);

    expect(u.current).toEqual(0);
    u.set(0, '', 1);
    expect(u.current).toEqual(1);
    u.set(0, '', 1);
    u.set(0, '', 2);
});

test('Uniform1f', () => {
    expect.assertions(4);

    const context = {
        gl: {
            uniform1f: () => { expect(true).toBeTruthy(); },
            getUniformLocation: () => { return true; }
        }
    };

    const u = new Uniform1f(context, 0);

    expect(u.current).toEqual(0);
    u.set(0, '', 1);
    expect(u.current).toEqual(1);
    u.set(0, '', 1);
    u.set(0, '', 2);
});

test('Uniform2f', () => {
    expect.assertions(4);

    const context = {
        gl: {
            uniform2f: () => { expect(true).toBeTruthy(); },
            getUniformLocation: () => { return true; }
        }
    };

    const u = new Uniform2f(context, 0);

    expect(u.current).toEqual([0, 0]);
    u.set(0, '', [1, 1]);
    expect(u.current).toEqual([1, 1]);
    u.set(0, '', [1, 1]);
    u.set(0, '', [1, 2]);
});

test('Uniform3f', () => {
    expect.assertions(4);

    const context = {
        gl: {
            uniform3f: () => { expect(true).toBeTruthy(); },
            getUniformLocation: () => { return true; }
        }
    };

    const u = new Uniform3f(context, 0);

    expect(u.current).toEqual([0, 0, 0]);
    u.set(0, '', [1, 1, 1]);
    expect(u.current).toEqual([1, 1, 1]);
    u.set(0, '', [1, 1, 1]);
    u.set(0, '', [1, 1, 2]);
});

test('Uniform4f', () => {
    expect.assertions(4);

    const context = {
        gl: {
            uniform4f: () => { expect(true).toBeTruthy(); },
            getUniformLocation: () => { return true; }
        }
    };

    const u = new Uniform4f(context, 0);

    expect(u.current).toEqual([0, 0, 0, 0]);
    u.set(0, '', [1, 1, 1, 1]);
    expect(u.current).toEqual([1, 1, 1, 1]);
    u.set(0, '', [1, 1, 1, 1]);
    u.set(0, '', [2, 1, 1, 1]);
});
