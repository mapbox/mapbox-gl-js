import StyleLayer from '../style_layer';
import properties from './sky_style_layer_properties';
import {Transitionable, Transitioning, PossiblyEvaluated} from '../properties';
import {renderColorRamp} from '../../util/color_ramp';
import {warnOnce, degToRad} from '../../util/util';
import {vec3, quat} from 'gl-matrix';
import assert from 'assert';

import type {PaintProps} from './sky_style_layer_properties';
import type Texture from '../../render/texture';
import type Painter from '../../render/painter';
import type {LayerSpecification} from '../../style-spec/types';
import type Framebuffer from '../../gl/framebuffer';
import type {RGBAImage} from '../../util/image';
import type SkyboxGeometry from '../../render/skybox_geometry';
import type {Position} from '../../util/util';
import type {ConfigOptions} from '../properties';
import type {LUT} from "../../util/lut";

function getCelestialDirection(azimuth: number, altitude: number, leftHanded: boolean): [number, number, number] {
    const up: [number, number, number] = [0, 0, 1];
    const rotation = quat.identity([] as any);

    quat.rotateY(rotation, rotation, leftHanded ? -degToRad(azimuth) + Math.PI : degToRad(azimuth));
    quat.rotateX(rotation, rotation, -degToRad(altitude));
    vec3.transformQuat(up, up, rotation);

    return vec3.normalize(up, up) as [number, number, number];
}

class SkyLayer extends StyleLayer {
    _transitionablePaint: Transitionable<PaintProps>;
    _transitioningPaint: Transitioning<PaintProps>;
    paint: PossiblyEvaluated<PaintProps>;
    _lightPosition: Position;

    skyboxFbo: Framebuffer | null | undefined;
    skyboxTexture: WebGLTexture | null | undefined;
    _skyboxInvalidated: boolean | null | undefined;

    colorRamp: RGBAImage;
    colorRampTexture: Texture | null | undefined;

    skyboxGeometry: SkyboxGeometry;

    constructor(layer: LayerSpecification, scope: string, lut: LUT | null, options?: ConfigOptions | null) {
        super(layer, properties, scope, lut, options);
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
