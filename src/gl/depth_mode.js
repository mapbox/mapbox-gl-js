// @flow
import type { DepthFuncType, DepthMaskType, DepthRangeType } from './types';

const ALWAYS = 0x0207;

class DepthMode {
    func: DepthFuncType;
    mask: DepthMaskType;
    range: DepthRangeType;

    // DepthMask enums
    static ReadOnly: boolean;
    static ReadWrite: boolean;

    constructor(depthFunc: DepthFuncType, depthMask: DepthMaskType, depthRange: DepthRangeType) {
        this.func = depthFunc;
        this.mask = depthMask;
        this.range = depthRange;
    }

    static disabled() {
        return new DepthMode(ALWAYS, DepthMode.ReadOnly, [0, 1]);
    }
}

DepthMode.ReadOnly = false;
DepthMode.ReadWrite = true;

module.exports = DepthMode;
