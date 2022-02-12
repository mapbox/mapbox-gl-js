// @flow

import StyleLayer from '../style_layer.js';
import properties from './sky_style_layer_properties.js';
import {Transitionable, Transitioning, PossiblyEvaluated} from '../properties.js';
import {renderColorRamp} from '../../util/color_ramp.js';
import type {PaintProps} from './sky_style_layer_properties.js';
import type Texture from '../../render/texture.js';
import type Painter from '../../render/painter.js';
import type {LayerSpecification} from '../../style-spec/types.js';
import type Framebuffer from '../../gl/framebuffer.js';
import type {RGBAImage} from '../../util/image.js';
import type SkyboxGeometry from '../../render/skybox_geometry.js';
import type {LightPosition} from '../light.js';
import {warnOnce, degToRad} from '../../util/util.js';
import {vec3, quat} from 'gl-matrix';
import assert from 'assert';

function getCelestialDirection(azimuth: number, altitude: number, leftHanded: boolean) {
    const up = [0, 0, 1];
    const rotation = quat.identity([]);

    quat.rotateY(rotation, rotation, leftHanded ? -degToRad(azimuth) + Math.PI : degToRad(azimuth));
    quat.rotateX(rotation, rotation, -degToRad(altitude));
    vec3.transformQuat(up, up, rotation);

    return vec3.normalize(up, up);
}

class SkyLayer extends StyleLayer {
    _transitionablePaint: Transitionable<PaintProps>;
    _transitioningPaint: Transitioning<PaintProps>;
    paint: PossiblyEvaluated<PaintProps>;
    _lightPosition: LightPosition;

    skyboxFbo: ?Framebuffer;
    skyboxTexture: ?WebGLTexture;
    _skyboxInvalidated: ?boolean;

    colorRamp: RGBAImage;
    colorRampTexture: ?Texture;

    skyboxGeometry: SkyboxGeometry;

    constructor(layer: LayerSpecification) {
        super(layer, properties);
        this._updateColorRamp();
    }

    _handleSpecialPaintPropertyUpdate(name: string) {
        if (name === 'sky-gradient') {
            this._updateColorRamp();
        } else if (name === 'sky-atmosphere-sun' ||
                   name === 'sky-atmosphere-halo-color' ||
                   name === 'sky-atmosphere-color' ||
                   name === 'sky-atmosphere-sun-intensity') {
            this._skyboxInvalidated = true;
        }
    }

    _updateColorRamp() {
        const expression = this._transitionablePaint._values['sky-gradient'].value.expression;
        this.colorRamp = renderColorRamp({
            expression,
            evaluationKey: 'skyRadialProgress'
        });
        if (this.colorRampTexture) {
            this.colorRampTexture.destroy();
            this.colorRampTexture = null;
        }
    }

    needsSkyboxCapture(painter: Painter): boolean {
        if (!!this._skyboxInvalidated || !this.skyboxTexture || !this.skyboxGeometry) {
            return true;
        }
        if (!this.paint.get('sky-atmosphere-sun')) {
            const lightPosition = painter.style.light.properties.get('position');
            return this._lightPosition.azimuthal !== lightPosition.azimuthal ||
                   this._lightPosition.polar !== lightPosition.polar;
        }
        return false;
    }

    getCenter(painter: Painter, leftHanded: boolean): [number, number, number] {
        const type = this.paint.get('sky-type');
        if (type === 'atmosphere') {
            const sunPosition = this.paint.get('sky-atmosphere-sun');
            const useLightPosition = !sunPosition;
            const light = painter.style.light;
            const lightPosition = light.properties.get('position');

            if (useLightPosition && light.properties.get('anchor') === 'viewport') {
                warnOnce('The sun direction is attached to a light with viewport anchor, lighting may behave unexpectedly.');
            }

            return useLightPosition ?
                getCelestialDirection(lightPosition.azimuthal, -lightPosition.polar + 90, leftHanded) :
                getCelestialDirection(sunPosition[0], -sunPosition[1] + 90, leftHanded);
        }
        assert(type === 'gradient');
        const direction = this.paint.get('sky-gradient-center');
        return getCelestialDirection(direction[0], -direction[1] + 90, leftHanded);
    }

    is3D(): boolean {
        return false;
    }

    isSky(): boolean {
        return true;
    }

    markSkyboxValid(painter: Painter) {
        this._skyboxInvalidated = false;
        this._lightPosition = painter.style.light.properties.get('position');
    }

    hasOffscreenPass(): boolean {
        return true;
    }

    getProgramIds(): string[] | null {
        const type = this.paint.get('sky-type');
        if (type === 'atmosphere') {
            return ['skyboxCapture', 'skybox'];
        } else if (type === 'gradient') {
            return ['skyboxGradient'];
        }
        return null;
    }
}

export default SkyLayer;
