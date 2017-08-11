// @flow

export type Program = {
    program: WebGLProgram,
    uniforms: {[string]: number},
    attributes: {[string]: number},
    numAttributes: number
}
