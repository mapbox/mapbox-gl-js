// @flow
import type { DepthFuncType, DepthMaskType, DepthRangeType } from './types';

const glALWAYS = 0x0207;

class DepthMode {
    func: DepthFuncType;
    mask: DepthMaskType;
    range: DepthRangeType;
    test: boolean;

    constructor(depthFunc: DepthFuncType, depthMask: DepthMaskType, depthRange: DepthRangeType, test: ?boolean) {
        this.func = depthFunc;
        this.mask = depthMask;
        this.range = depthRange;
        this.test = (typeof test !== 'undefined' && test !== null) ? test :
            !(this.func === glALWAYS && !this.mask);
    }

    static disabled() {
        return new DepthMode(glALWAYS, false, [0, 1]);
    }
}

module.exports = DepthMode;
