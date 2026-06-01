import {vec3} from 'gl-matrix';
import {cartesianPositionToSpherical, sphericalPositionToCartesian, clamp, linearVec3TosRGB} from '../../src/util/util';

import type Style from '../../src/style/style';
import type Lights from '../style/lights';
import type {LightProps as Directional} from '../style/directional_light_properties';
import type {LightProps as Ambient} from '../style/ambient_light_properties';

export function shadowDirectionFromProperties(directionalLight: Lights<Directional>): vec3 {
    const direction = directionalLight.properties.get('direction');

    const spherical = cartesianPositionToSpherical(direction.x, direction.y, direction.z);

    // Limit light position specifically for shadow rendering.
    // If the polar coordinate goes very high, we get visual artifacts.
    // We limit the position in order to avoid these issues.
    // 75 degrees is an arbitrarily chosen value, based on a subjective assessment of the visuals.
    const MaxPolarCoordinate = 75.0;
    spherical[2] = clamp(spherical[2], 0.0, MaxPolarCoordinate);

    const position = sphericalPositionToCartesian([spherical[0], spherical[1], spherical[2]]);

    // Convert polar and azimuthal to cartesian
    return vec3.fromValues(position.x, position.y, position.z);
}

export function calculateGroundShadowFactor(
    style: Style,
    directionalLight: Lights<Directional>,
    ambientLight: Lights<Ambient>,
): [number, number, number] {
    const dirColorIgnoreLut = directionalLight.properties.get('color-use-theme') === 'none';
    const dirColor = directionalLight.properties.get('color');
    const dirIntensity = directionalLight.properties.get('intensity');
    const dirDirection = directionalLight.properties.get('direction');

    const directionVec: [number, number, number] = [dirDirection.x, dirDirection.y, dirDirection.z];
    const ambientColorIgnoreLut = ambientLight.properties.get('color-use-theme') === 'none';
    const ambientColor = ambientLight.properties.get('color');
    const ambientIntensity = ambientLight.properties.get('intensity');

    const groundNormal: [number, number, number] = [0.0, 0.0, 1.0];
    const dirDirectionalFactor = Math.max(vec3.dot(groundNormal, directionVec), 0.0);
    const ambStrength: [number, number, number] = [0, 0, 0];
    vec3.scale(ambStrength, ambientColor.toPremultipliedRenderColor(ambientColorIgnoreLut ? null : style.getLut(directionalLight.scope)).toArray01Linear().slice(0, 3), ambientIntensity);
    const dirStrength: [number, number, number] = [0, 0, 0];
    vec3.scale(dirStrength, dirColor.toPremultipliedRenderColor(dirColorIgnoreLut ? null : style.getLut(ambientLight.scope)).toArray01Linear().slice(0, 3), dirDirectionalFactor * dirIntensity);

    // Multiplier X to get from lit surface color L to shadowed surface color S
    // X = A / (A + D)
    // A: Ambient light coming into the surface; taking into account color and intensity
    // D: Directional light coming into the surface; taking into account color, intensity and direction
    const shadow: [number, number, number] = [
        ambStrength[0] > 0.0 ? ambStrength[0] / (ambStrength[0] + dirStrength[0]) : 0.0,
        ambStrength[1] > 0.0 ? ambStrength[1] / (ambStrength[1] + dirStrength[1]) : 0.0,
        ambStrength[2] > 0.0 ? ambStrength[2] / (ambStrength[2] + dirStrength[2]) : 0.0
    ];

    // Because blending will happen in sRGB space, convert the shadow factor to sRGB
    return linearVec3TosRGB(shadow);
}
