// @flow
'use strict';
declare module "mapbox-gl-supported" {
    declare type isSupported = (options?: {failIfMajorPerformanceCaveat: boolean}) => boolean;
    declare var exports: isSupported;
}
