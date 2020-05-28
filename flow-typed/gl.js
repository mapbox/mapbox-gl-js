// @flow strict
declare module "gl" {
    declare function gl(width: number, height: number, attributes: WebGLContextAttributes): WebGLRenderingContext;
    declare module.exports: typeof gl;
}
