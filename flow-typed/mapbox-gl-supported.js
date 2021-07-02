// @flow
'use strict';
declare module "@mapbox/mapbox-gl-supported" {
    declare type SupportedOptions = {failIfMajorPerformanceCaveat: boolean};

    declare type SupportedFn = {
        (options?: SupportedOptions): boolean,
        webGLContextAttributes: WebGLContextAttributes
    };
    declare function notSupportedReason(options?: SupportedOptions): ?string;

    declare module.exports: {
        supported: SupportedFn;
        notSupportedReason: typeof notSupportedReason;
    }
}
