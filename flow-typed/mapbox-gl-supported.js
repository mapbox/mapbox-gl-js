// @flow
'use strict';
declare module "@mapbox/mapbox-gl-supported" {
    declare type isSupported = {
        (options?: {failIfMajorPerformanceCaveat: boolean}): boolean,
        webGLContextAttributes: WebGLContextAttributes
    };
    declare module.exports: isSupported;
}
