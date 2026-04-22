import Color from '../style-spec/util/color';

import type {mat2, mat3, mat4} from 'gl-matrix';
import type Context from '../gl/context';
import type {PremultipliedRenderColor} from "../style-spec/util/color";

export type UniformValues<Us> = {
    [Key in keyof Us]: Us[Key] extends IUniform<infer V> ? V : never;
};

export interface IUniform<T> {
    gl: WebGL2RenderingContext;
    location: WebGLUniformLocation | null | undefined;
    current: T;
    initialized: boolean;
    fetchUniformLocation: (program: WebGLProgram, name: string) => boolean;
    set: (program: WebGLProgram, name: string, v: T) => void;
}

class Uniform<T> implements IUniform<T> {
    gl: WebGL2RenderingContext;
    location: WebGLUniformLocation | null | undefined;
    current: T;
    initialized: boolean;

    constructor(context: Context) {
        this.gl = context.gl;
        this.initialized = false;
    }

    fetchUniformLocation(program: WebGLProgram, name: string): boolean {
        if (!this.location && !this.initialized) {
            this.location = this.gl.getUniformLocation(program, name);
            this.initialized = true;
        }
        return !!this.location;
    }

    set(_program: WebGLProgram, _name: string, _v: T): void {
        throw new Error('Uniform#set() must be implemented by each concrete Uniform');
    }
}

class Uniform1i extends Uniform<number> implements IUniform<number> {
    constructor(context: Context) {
        super(context);
        this.current = 0;
    }

    override set(program: WebGLProgram, name: string, v: number): void {
        if (!this.fetchUniformLocation(program, name)) return;
        if (this.current !== v) {
            this.current = v;
            this.gl.uniform1i(this.location, v);
        }
    }
}

class Uniform1f extends Uniform<number> implements IUniform<number> {
    constructor(context: Context) {
        super(context);
        this.current = 0;
    }

    override set(program: WebGLProgram, name: string, v: number): void {
        if (!this.fetchUniformLocation(program, name)) return;
        if (this.current !== v) {
            this.current = v;
            this.gl.uniform1f(this.location, v);
        }
    }
}

class Uniform2f extends Uniform<[number, number]> implements IUniform<[number, number]> {
    constructor(context: Context) {
        super(context);
        this.current = [0, 0];
    }

    override set(program: WebGLProgram, name: string, v: [number, number]): void {
        if (!this.fetchUniformLocation(program, name)) return;
        if (v[0] !== this.current[0] || v[1] !== this.current[1]) {
            this.current = v;
            this.gl.uniform2f(this.location, v[0], v[1]);
        }
    }
}

class Uniform3f extends Uniform<[number, number, number]> implements IUniform<[number, number, number]> {
    constructor(context: Context) {
        super(context);
        this.current = [0, 0, 0];
    }

    override set(program: WebGLProgram, name: string, v: [number, number, number]): void {
        if (!this.fetchUniformLocation(program, name)) return;
        if (v[0] !== this.current[0] || v[1] !== this.current[1] || v[2] !== this.current[2]) {
            this.current = v;
            this.gl.uniform3f(this.location, v[0], v[1], v[2]);
        }
    }
}

class Uniform4ui extends Uniform<[number, number, number, number]> implements IUniform<[number, number, number, number]> {
    constructor(context: Context) {
        super(context);
        this.current = [0, 0, 0, 0];
    }

    override set(program: WebGLProgram, name: string, v: [number, number, number, number]): void {
        if (!this.fetchUniformLocation(program, name)) return;
        if (v[0] !== this.current[0] || v[1] !== this.current[1] ||
            v[2] !== this.current[2] || v[3] !== this.current[3]) {
            this.current = v;
            this.gl.uniform4ui(this.location, v[0], v[1], v[2], v[3]);
        }
    }
}

class Uniform4f extends Uniform<[number, number, number, number]> implements IUniform<[number, number, number, number]> {
    constructor(context: Context) {
        super(context);
        this.current = [0, 0, 0, 0];
    }

    override set(program: WebGLProgram, name: string, v: [number, number, number, number]): void {
        if (!this.fetchUniformLocation(program, name)) return;
        if (v[0] !== this.current[0] || v[1] !== this.current[1] ||
            v[2] !== this.current[2] || v[3] !== this.current[3]) {
            this.current = v;
            this.gl.uniform4f(this.location, v[0], v[1], v[2], v[3]);
        }
    }
}

class UniformColor extends Uniform<PremultipliedRenderColor> implements IUniform<PremultipliedRenderColor> {
    constructor(context: Context) {
        super(context);
        this.current = Color.transparent.toPremultipliedRenderColor(null);
    }

    override set(program: WebGLProgram, name: string, v: PremultipliedRenderColor): void {
        if (!this.fetchUniformLocation(program, name)) return;
        if (v.r !== this.current.r || v.g !== this.current.g ||
            v.b !== this.current.b || v.a !== this.current.a) {
            this.current = v;
            this.gl.uniform4f(this.location, v.r, v.g, v.b, v.a);
        }
    }
}

// Matrix uniforms cache a Float32Array copy of the last uploaded value. This makes it safe
// for callers to pass long-lived buffers (reused across frames, mutated in place) directly:
// change detection compares against the private copy rather than `v` itself, so `v === cache`
// can never silently skip an upload. Uploads always go through the Float32Array copy, so
// Float64Array or plain-array inputs are implicitly converted (gl.uniformMatrix*fv requires Float32Array).
class UniformMatrix4f extends Uniform<mat4> implements IUniform<mat4> {
    constructor(context: Context) {
        super(context);
        this.current = new Float32Array(16);
    }

    override set(program: WebGLProgram, name: string, v: mat4): void {
        if (!this.fetchUniformLocation(program, name)) return;
        const cache = this.current as Float32Array;
        // The vast majority of matrix comparisons that will trip this set
        // happen at i=12 or i=0, so we check those first to avoid lots of
        // unnecessary iteration:
        if (v[12] !== cache[12] || v[0] !== cache[0]) {
            cache.set(v);
            this.gl.uniformMatrix4fv(this.location, false, cache);
            return;
        }
        for (let i = 1; i < 16; i++) {
            if (v[i] !== cache[i]) {
                cache.set(v);
                this.gl.uniformMatrix4fv(this.location, false, cache);
                break;
            }
        }
    }
}

class UniformMatrix3f extends Uniform<mat3> implements IUniform<mat3> {
    constructor(context: Context) {
        super(context);
        this.current = new Float32Array(9);
    }

    override set(program: WebGLProgram, name: string, v: mat3): void {
        if (!this.fetchUniformLocation(program, name)) return;
        const cache = this.current as Float32Array;
        for (let i = 0; i < 9; i++) {
            if (v[i] !== cache[i]) {
                cache.set(v);
                this.gl.uniformMatrix3fv(this.location, false, cache);
                break;
            }
        }
    }
}

class UniformMatrix2f extends Uniform<mat2> implements IUniform<mat2> {
    constructor(context: Context) {
        super(context);
        this.current = new Float32Array(4);
    }

    override set(program: WebGLProgram, name: string, v: mat2): void {
        if (!this.fetchUniformLocation(program, name)) return;
        const cache = this.current as Float32Array;
        for (let i = 0; i < 4; i++) {
            if (v[i] !== cache[i]) {
                cache.set(v);
                this.gl.uniformMatrix2fv(this.location, false, cache);
                break;
            }
        }
    }
}

export {
    Uniform1i,
    Uniform1f,
    Uniform2f,
    Uniform3f,
    Uniform4ui,
    Uniform4f,
    UniformColor,
    UniformMatrix2f,
    UniformMatrix3f,
    UniformMatrix4f
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type UniformBindings = Record<PropertyKey, IUniform<any>>;
