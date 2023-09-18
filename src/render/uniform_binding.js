// @flow

import Color from '../style-spec/util/color.js';
import type Context from '../gl/context.js';

export type UniformValues<Us: Object>
    = $Exact<$ObjMap<Us, <V>(u: Uniform<V>) => V>>;

class Uniform<T> {
    gl: WebGL2RenderingContext;
    location: ?WebGLUniformLocation;
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

    +set: (program: WebGLProgram, name: string, v: T) => void;
}

class Uniform1i extends Uniform<number> {
    constructor(context: Context) {
        super(context);
        this.current = 0;
    }

    // $FlowFixMe[method-unbinding]
    set(program: WebGLProgram, name: string, v: number): void {
        if (!this.fetchUniformLocation(program, name)) return;
        if (this.current !== v) {
            this.current = v;
            this.gl.uniform1i(this.location, v);
        }
    }
}

class Uniform1f extends Uniform<number> {
    constructor(context: Context) {
        super(context);
        this.current = 0;
    }

    // $FlowFixMe[method-unbinding]
    set(program: WebGLProgram, name: string, v: number): void {
        if (!this.fetchUniformLocation(program, name)) return;
        if (this.current !== v) {
            this.current = v;
            this.gl.uniform1f(this.location, v);
        }
    }
}

class Uniform2f extends Uniform<[number, number]> {
    constructor(context: Context) {
        super(context);
        this.current = [0, 0];
    }

    // $FlowFixMe[method-unbinding]
    set(program: WebGLProgram, name: string, v: [number, number]): void {
        if (!this.fetchUniformLocation(program, name)) return;
        if (v[0] !== this.current[0] || v[1] !== this.current[1]) {
            this.current = v;
            this.gl.uniform2f(this.location, v[0], v[1]);
        }
    }
}

class Uniform3f extends Uniform<[number, number, number]> {
    constructor(context: Context) {
        super(context);
        this.current = [0, 0, 0];
    }

    // $FlowFixMe[method-unbinding]
    set(program: WebGLProgram, name: string, v: [number, number, number]): void {
        if (!this.fetchUniformLocation(program, name)) return;
        if (v[0] !== this.current[0] || v[1] !== this.current[1] || v[2] !== this.current[2]) {
            this.current = v;
            this.gl.uniform3f(this.location, v[0], v[1], v[2]);
        }
    }
}

class Uniform4f extends Uniform<[number, number, number, number]> {
    constructor(context: Context) {
        super(context);
        this.current = [0, 0, 0, 0];
    }

    // $FlowFixMe[method-unbinding]
    set(program: WebGLProgram, name: string, v: [number, number, number, number]): void {
        if (!this.fetchUniformLocation(program, name)) return;
        if (v[0] !== this.current[0] || v[1] !== this.current[1] ||
            v[2] !== this.current[2] || v[3] !== this.current[3]) {
            this.current = v;
            this.gl.uniform4f(this.location, v[0], v[1], v[2], v[3]);
        }
    }
}

class UniformColor extends Uniform<Color> {
    constructor(context: Context) {
        super(context);
        this.current = Color.transparent;
    }

    // $FlowFixMe[method-unbinding]
    set(program: WebGLProgram, name: string, v: Color): void {
        if (!this.fetchUniformLocation(program, name)) return;
        if (v.r !== this.current.r || v.g !== this.current.g ||
            v.b !== this.current.b || v.a !== this.current.a) {
            this.current = v;
            this.gl.uniform4f(this.location, v.r, v.g, v.b, v.a);
        }
    }
}

const emptyMat4 = new Float32Array(16);
class UniformMatrix4f extends Uniform<Float32Array> {
    constructor(context: Context) {
        super(context);
        this.current = emptyMat4;
    }

    // $FlowFixMe[method-unbinding]
    set(program: WebGLProgram, name: string, v: Float32Array): void {
        if (!this.fetchUniformLocation(program, name)) return;
        // The vast majority of matrix comparisons that will trip this set
        // happen at i=12 or i=0, so we check those first to avoid lots of
        // unnecessary iteration:
        if (v[12] !== this.current[12] || v[0] !== this.current[0]) {
            this.current = v;
            this.gl.uniformMatrix4fv(this.location, false, v);
            return;
        }
        for (let i = 1; i < 16; i++) {
            if (v[i] !== this.current[i]) {
                this.current = v;
                this.gl.uniformMatrix4fv(this.location, false, v);
                break;
            }
        }
    }
}

const emptyMat3 = new Float32Array(9);
class UniformMatrix3f extends Uniform<Float32Array> {
    constructor(context: Context) {
        super(context);
        this.current = emptyMat3;
    }

    // $FlowFixMe[method-unbinding]
    set(program: WebGLProgram, name: string, v: Float32Array): void {
        if (!this.fetchUniformLocation(program, name)) return;
        for (let i = 0; i < 9; i++) {
            if (v[i] !== this.current[i]) {
                this.current = v;
                this.gl.uniformMatrix3fv(this.location, false, v);
                break;
            }
        }
    }
}

const emptyMat2 = new Float32Array(4);
class UniformMatrix2f extends Uniform<Float32Array> {
    constructor(context: Context) {
        super(context);
        this.current = emptyMat2;
    }

    // $FlowFixMe[method-unbinding]
    set(program: WebGLProgram, name: string, v: Float32Array): void {
        if (!this.fetchUniformLocation(program, name)) return;
        for (let i = 0; i < 4; i++) {
            if (v[i] !== this.current[i]) {
                this.current = v;
                this.gl.uniformMatrix2fv(this.location, false, v);
                break;
            }
        }
    }
}

export {
    Uniform,
    Uniform1i,
    Uniform1f,
    Uniform2f,
    Uniform3f,
    Uniform4f,
    UniformColor,
    UniformMatrix2f,
    UniformMatrix3f,
    UniformMatrix4f
};

export type UniformBindings = {[_: string]: Uniform<any>};
