// @flow

import type {CullFaceModeType, FrontFaceType} from './types.js';

const BACK = 0x0405;
const FRONT = 0x0404;
const CCW = 0x0901;
const CW = 0x0900;

class CullFaceMode {
    enable: boolean;
    mode: CullFaceModeType;
    frontFace: FrontFaceType;

    constructor(enable: boolean, mode: CullFaceModeType, frontFace: FrontFaceType) {
        this.enable = enable;
        this.mode = mode;
        this.frontFace = frontFace;
    }

    static disabled: $ReadOnly<CullFaceMode>;
    static backCCW: $ReadOnly<CullFaceMode>;
    static backCW: $ReadOnly<CullFaceMode>;
    static frontCW: $ReadOnly<CullFaceMode>;
    static frontCCW: $ReadOnly<CullFaceMode>;
}

CullFaceMode.disabled = new CullFaceMode(false, BACK, CCW);
CullFaceMode.backCCW = new CullFaceMode(true, BACK, CCW);
CullFaceMode.backCW = new CullFaceMode(true, BACK, CW);
CullFaceMode.frontCW = new CullFaceMode(true, FRONT, CW);
CullFaceMode.frontCCW = new CullFaceMode(true, FRONT, CCW);

export default CullFaceMode;
