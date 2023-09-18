// @flow strict
declare module "gl" {
    declare function gl(width: number, height: number, attributes: WebGLContextAttributes): WebGL2RenderingContext;
    declare module.exports: typeof gl;
}
