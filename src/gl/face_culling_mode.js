// @flow
import type { CullFaceModeType, FrontFaceType } from './types';

class FaceCullingMode {
    cullFace: boolean;
    cullFaceMode: ?CullFaceModeType;
    frontFace: ?FrontFaceType;

    constructor(cullFace: boolean, cullFaceMode?: CullFaceModeType, frontFace?: FrontFaceType) {
        this.cullFace = cullFace;
        this.cullFaceMode = cullFaceMode;
        this.frontFace = frontFace;
    }

    static disabled: $ReadOnly<FaceCullingMode>;
}

FaceCullingMode.disabled = new FaceCullingMode(false);

export default FaceCullingMode;
