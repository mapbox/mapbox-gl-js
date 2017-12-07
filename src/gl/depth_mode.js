// @flow
import type { DepthFuncType, DepthMaskType, DepthRangeType } from './types';

const ALWAYS = 0x0207;

class DepthMode {
    func: DepthFuncType;
    mask: DepthMaskType;
    range: DepthRangeType;

    constructor(depthFunc: DepthFuncType, depthMask: DepthMaskType, depthRange: DepthRangeType) {
        this.func = depthFunc;
        this.mask = depthMask;
        this.range = depthRange;
    }

    static disabled() {
        return new DepthMode(ALWAYS, false, [0, 1]);
    }
}

module.exports = DepthMode;
