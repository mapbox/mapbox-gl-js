import type {StencilOpConstant, StencilTest} from './types';

const ALWAYS = 0x0207;
const KEEP = 0x1E00;

// While a `raster-mask` layer is drawn, the high bit of the 8-bit stencil buffer is used as a
// per-fragment "do not draw" flag (see src/render/raster_mask.ts). Stencil refs allocated for
// that layer are kept below this bit, so that a GEQUAL/EQUAL test of `ref >= stencil`
// automatically fails wherever the bit is set. Other layers use the full 8 bits.
export const STENCIL_MASK_BIT = 0x80;

class StencilMode {
    test: StencilTest;
    ref: number;
    mask: number;
    fail: StencilOpConstant;
    depthFail: StencilOpConstant;
    pass: StencilOpConstant;

    constructor(test: StencilTest, ref: number, mask: number, fail: StencilOpConstant,
        depthFail: StencilOpConstant, pass: StencilOpConstant) {
        this.test = test;
        this.ref = ref;
        this.mask = mask;
        this.fail = fail;
        this.depthFail = depthFail;
        this.pass = pass;
    }

    static disabled: Readonly<StencilMode>;
}

StencilMode.disabled = new StencilMode({func: ALWAYS, mask: 0}, 0, 0, KEEP, KEEP, KEEP);

export default StencilMode;
