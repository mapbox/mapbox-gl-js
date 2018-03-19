// @flow

import assert from 'assert';
import Color from '../style-spec/util/color';

import type Context from '../gl/context';

export type UniformValues<Us: Object>
    = $Exact<$ObjMap<Us, <V>(u: Uniform<V>) => V>>;
export type UniformLocations = {[string]: WebGLUniformLocation};
export type UniformBindings = {[string]: any};
// binder uniforms are dynamically created:
export type BinderUniformTypes = any;

class Uniform<T> {
    context: Context;
    location: ?WebGLUniformLocation;
    current: T;

    constructor(context: Context, location: WebGLUniformLocation) {
        this.context = context;
        this.location = location;
    }
}

class Uniform1i extends Uniform<number> {
    constructor(context: Context, location: WebGLUniformLocation) {
        super(context, location);
        this.current = 0;
    }

    set(v: number): void {
        if (this.current !== v) {
            this.current = v;
            this.context.gl.uniform1i(this.location, v);
        }
    }
}

class Uniform1f extends Uniform<number> {
    constructor(context: Context, location: WebGLUniformLocation) {
        super(context, location);
        this.current = 0;
    }

    set(v: number): void {
        if (this.current !== v) {
            this.current = v;
            this.context.gl.uniform1f(this.location, v);
        }
    }
}

class Uniform2fv extends Uniform<[number, number]> {
    constructor(context: Context, location: WebGLUniformLocation) {
        super(context, location);
        this.current = [0, 0];
    }

    set(v: [number, number]): void {
        if (v[0] !== this.current[0] || v[1] !== this.current[1]) {
            this.current = v;
            this.context.gl.uniform2f(this.location, v[0], v[1]);
        }
    }
}

class Uniform3fv extends Uniform<[number, number, number]> {
    constructor(context: Context, location: WebGLUniformLocation) {
        super(context, location);
        this.current = [0, 0, 0];
    }

    set(v: [number, number, number]): void {
        if (v[0] !== this.current[0] || v[1] !== this.current[1] || v[2] !== this.current[2]) {
            this.current = v;
            this.context.gl.uniform3f(this.location, v[0], v[1], v[2]);
        }
    }
}

class Uniform4fv extends Uniform<[number, number, number, number]> {
    constructor(context: Context, location: WebGLUniformLocation) {
        super(context, location);
        this.current = [0, 0, 0, 0];
    }

    set(v: [number, number, number, number]): void {
        if (v[0] !== this.current[0] || v[1] !== this.current[1] ||
            v[2] !== this.current[2] || v[3] !== this.current[3]) {
            this.current = v;
            this.context.gl.uniform4f(this.location, v[0], v[1], v[2], v[3]);
        }
    }
}

class UniformColor extends Uniform<Color> {
    constructor(context: Context, location: WebGLUniformLocation) {
        super(context, location);
        this.current = Color.transparent;
    }

    set(v: Color): void {
        if (v.r !== this.current.r || v.g !== this.current.g ||
            v.b !== this.current.b || v.a !== this.current.a) {
            this.current = v;
            this.context.gl.uniform4f(this.location, v.r, v.g, v.b, v.a);
        }
    }
}

const emptyMat4 = new Float32Array(16);
class UniformMatrix4fv extends Uniform<Float32Array> {
    constructor(context: Context, location: WebGLUniformLocation) {
        super(context, location);
        this.current = emptyMat4;
    }

    set(v: Float32Array): void {
        // The vast majority of matrix comparisons that will trip this set
        // happen at i=12 or i=0, so we check those first to avoid lots of
        // unnecessary iteration:
        if (v[12] !== this.current[12] || v[0] !== this.current[0]) {
            this.current = v;
            this.context.gl.uniformMatrix4fv(this.location, false, v);
            return;
        }
        for (let i = 1; i < 16; i++) {
            if (v[i] !== this.current[i]) {
                this.current = v;
                this.context.gl.uniformMatrix4fv(this.location, false, v);
                break;
            }
        }
    }
}

class Uniforms<Us: UniformBindings> {
    bindings: Us;

    constructor(bindings: Us) {
        this.bindings = bindings;
    }

    set(uniformValues: UniformValues<Us>) {
        for (const name in uniformValues) {
            assert(this.bindings[name], `No binding with name ${name}`);
            this.bindings[name].set(uniformValues[name]);
        }
    }
}

export {
    Uniform,
    Uniform1i,
    Uniform1f,
    Uniform2fv,
    Uniform3fv,
    Uniform4fv,
    UniformColor,
    UniformMatrix4fv,
    Uniforms
};
