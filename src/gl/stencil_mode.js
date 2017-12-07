// @flow
import type { CompareFuncType, StencilOpConstant } from './types';

const ALWAYS = 0x0207;
const KEEP = 0x1E00;

class StencilMode {
    func: CompareFuncType;
    ref: number;
    mask: number;
    fail: StencilOpConstant;
    depthFail: StencilOpConstant;
    pass: StencilOpConstant;

    constructor(func: CompareFuncType, ref: number, mask: number, fail: StencilOpConstant,
        depthFail: StencilOpConstant, pass: StencilOpConstant) {
        this.func = func;
        this.ref = ref;
        this.mask = mask;
        this.fail = fail;
        this.depthFail = depthFail;
        this.pass = pass;
    }

    static disabled() {
        return new StencilMode(ALWAYS, 0, 0, KEEP, KEEP, KEEP);
    }
}

module.exports = StencilMode;
