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
    current: ?T;

    constructor(context: Context) {
        this.context = context;
    }
}

class Uniform1i extends Uniform<number> {
    set(location: WebGLUniformLocation, v: number): void {
        if (this.current !== v || this.location !== location) {
            this.current = v;
            this.location = location;
            this.context.gl.uniform1i(location, v);
        }
    }
}

class Uniform1f extends Uniform<number> {
    set(location: WebGLUniformLocation, v: number): void {
        if (this.current !== v || this.location !== location) {
            this.current = v;
            this.location = location;
            this.context.gl.uniform1f(location, v);
        }
    }
}

class Uniform2fv extends Uniform<[number, number]> {
    set(location: WebGLUniformLocation, v: [number, number]): void {
        const c = this.current;
        if (!c || v[0] !== c[0] || v[1] !== c[1] || this.location !== location) {
            this.current = v;
            this.location = location;
            this.context.gl.uniform2f(location, v[0], v[1]);
        }
    }
}

class Uniform3fv extends Uniform<[number, number, number]> {
    set(location: WebGLUniformLocation, v: [number, number, number]): void {
        const c = this.current;
        if (!c || v[0] !== c[0] || v[1] !== c[1] || v[2] !== c[2] || this.location !== location) {
            this.current = v;
            this.location = location;
            this.context.gl.uniform3f(location, v[0], v[1], v[2]);
        }
    }
}

class Uniform4fv extends Uniform<[number, number, number, number] | Color> {
    set(location: WebGLUniformLocation, v: [number, number, number, number] | Color): void {
        const c = this.current;
        if (v instanceof Color && (!c || c instanceof Color)) {
            if (!c || v.r !== c.r || v.g !== c.g || v.b !== c.b || v.a !== c.a || this.location !== location) {
                this.current = v;
                this.location = location;
                this.context.gl.uniform4f(location, v.r, v.g, v.b, v.a);
            }
        } else if (Array.isArray(v) && (!c || Array.isArray(c))) {
            if (!c || v[0] !== c[0] || v[1] !== c[1] || v[2] !== c[2] || v[3] !== c[3] || this.location !== location) {
                this.current = v;
                this.location = location;
                this.context.gl.uniform4f(location, v[0], v[1], v[2], v[3]);
            }
        }
    }
}

class UniformMatrix4fv extends Uniform<Float32Array> {
    set(location: WebGLUniformLocation, v: Float32Array): void {
        let diff = !this.current || this.location !== location;

        if (!diff && this.current) {
            for (let i = 0; i < 16; i++) {
                if (v[i] !== this.current[i]) {
                    diff = true;
                    break;
                }
            }
        }

        if (diff) {
            this.current = v;
            this.location = location;
            this.context.gl.uniformMatrix4fv(location, false, v);
        }
    }
}

class Uniforms<Us: UniformBindings> {
    bindings: Us;

    constructor(bindings: Us) {
        this.bindings = bindings;
    }

    set(uniformLocations: UniformLocations, uniformValues: UniformValues<Us>) {
        for (const name in uniformValues) {
            assert(this.bindings[name], `No binding with name ${name}`);
            this.bindings[name].set(uniformLocations[name], uniformValues[name]);
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
    UniformMatrix4fv,
    Uniforms
};
