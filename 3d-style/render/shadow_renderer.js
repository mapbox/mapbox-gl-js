// @flow

import Texture from '../../src/render/texture.js';
import Framebuffer from '../../src/gl/framebuffer.js';
import ColorMode from '../../src/gl/color_mode.js';
import DepthMode from '../../src/gl/depth_mode.js';
import StencilMode from '../../src/gl/stencil_mode.js';
import CullFaceMode from '../../src/gl/cull_face_mode.js';
import Transform from '../../src/geo/transform.js';
import {Frustum, Aabb} from '../../src/util/primitives.js';
import Color from '../../src/style-spec/util/color.js';
import {FreeCamera} from '../../src/ui/free_camera.js';
import {OverscaledTileID, UnwrappedTileID} from '../../src/source/tile_id.js';
import {mercatorZfromAltitude, tileToMeter} from '../../src/geo/mercator_coordinate.js';
import {cartesianPositionToSpherical, sphericalPositionToCartesian, clamp, linearVec3TosRGB} from '../../src/util/util.js';

import Lights from '../style/lights.js';
import {defaultShadowUniformValues} from '../render/shadow_uniforms.js';
import TextureSlots from './texture_slots.js';

import assert from 'assert';

import {mat4, vec3} from 'gl-matrix';
import {groundShadowUniformValues} from './program/ground_shadow_program.js';
import EXTENT from '../../src/style-spec/data/extent.js';
import {getCutoffParams} from '../../src/render/cutoff.js';

import type Painter from '../../src/render/painter.js';
import type Program from '../../src/render/program.js';
import type Style from '../../src/style/style.js';
import type {UniformValues} from '../../src/render/uniform_binding.js';
import type {LightProps as Directional} from '../style/directional_light_properties.js';
import type {LightProps as Ambient} from '../style/ambient_light_properties.js';
import type {ShadowUniformsType} from '../render/shadow_uniforms.js';
import type {Mat4, Vec3, Vec4} from 'gl-matrix';

type ShadowCascade = {
    framebuffer: Framebuffer,
    texture: Texture,
    matrix: Mat4,
    far: number,
    boundingSphereRadius: number,
    frustum: Frustum,
    scale: number;
};

// Describes simplified shadow volume of a tile. Consists of eight corner
// points of the aabb (possibly transformed) and four side planes. Top and bottom
// planes are left out as they rarely contribute visibility.
export type TileShadowVolume = {
    vertices: Array<Vec3>;
    planes: Array<Vec4>;
};

type ShadowNormalOffsetMode = 'vector-tile' | 'model-tile';

const shadowParameters = {
    cascadeCount: 2,
    shadowMapResolution: 2048
};

class ShadowReceiver {
    constructor(aabb: Aabb, lastCascade: ?number) {
        this.aabb = aabb;
        this.lastCascade = lastCascade;
    }

    aabb: Aabb;
    lastCascade: ?number;
}

class ShadowReceivers {
    add(tileId: UnwrappedTileID, aabb: Aabb) {
        const receiver = this.receivers[tileId.key];

        if (receiver !== undefined) {
            receiver.aabb.min[0] = Math.min(receiver.aabb.min[0], aabb.min[0]);
            receiver.aabb.min[1] = Math.min(receiver.aabb.min[1], aabb.min[1]);
            receiver.aabb.min[2] = Math.min(receiver.aabb.min[2], aabb.min[2]);
            receiver.aabb.max[0] = Math.max(receiver.aabb.max[0], aabb.max[0]);
            receiver.aabb.max[1] = Math.max(receiver.aabb.max[1], aabb.max[1]);
            receiver.aabb.max[2] = Math.max(receiver.aabb.max[2], aabb.max[2]);
        } else {
            this.receivers[tileId.key] = new ShadowReceiver(aabb, null);
        }
    }
    clear() {
        this.receivers = {};
    }

    get(tileId: UnwrappedTileID): ?ShadowReceiver {
        return this.receivers[tileId.key];
    }

    // Returns the number of cascades that need to be rendered based on visibility on screen.
    // Cascades that need to be rendered always include the first cascade.
    computeRequiredCascades(frustum: Frustum, worldSize: number, cascades: Array<ShadowCascade>): number {
        const frustumAabb = Aabb.fromPoints((frustum.points: any));
        let lastCascade = 0;

        for (const receiverKey in this.receivers) {
            const receiver = (this.receivers[receiverKey]: ?ShadowReceiver);
            if (!receiver) continue;

            if (!frustumAabb.intersectsAabb(receiver.aabb)) continue;

            receiver.aabb.min = frustumAabb.closestPoint(receiver.aabb.min);
            receiver.aabb.max = frustumAabb.closestPoint(receiver.aabb.max);
            const clampedTileAabbPoints = receiver.aabb.getCorners();

            for (let i = 0; i < cascades.length; i++) {
                let aabbInsideCascade = true;

                for (const point of clampedTileAabbPoints) {
                    const p = [point[0] * worldSize, point[1] * worldSize, point[2]];
                    vec3.transformMat4(p, p, cascades[i].matrix);

                    if (p[0] < -1.0 || p[0] > 1.0 || p[1] < -1.0 || p[1] > 1.0) {
                        aabbInsideCascade = false;
                        break;
                    }
                }

                receiver.lastCascade = i;
                lastCascade = Math.max(lastCascade, i);

                if (aabbInsideCascade) {
                    break;
                }
            }
        }

        return lastCascade + 1;
    }

    receivers: {number: ShadowReceiver};
}

export class ShadowRenderer {
    painter: Painter;
    _enabled: boolean;
    _shadowLayerCount: number;
    _numCascadesToRender: number;
    _cascades: Array<ShadowCascade>;
    _groundShadowTiles: Array<OverscaledTileID>;
    _receivers: ShadowReceivers;
    _depthMode: DepthMode;
    _uniformValues: UniformValues<ShadowUniformsType>;
    shadowDirection: Vec3;
    useNormalOffset: boolean;

    constructor(painter: Painter) {
        this.painter = painter;
        this._enabled = false;
        this._shadowLayerCount = 0;
        this._numCascadesToRender = 0;
        this._cascades = [];
        this._groundShadowTiles = [];
        this._receivers = new ShadowReceivers();
        this._depthMode = new DepthMode(painter.context.gl.LEQUAL, DepthMode.ReadWrite, [0, 1]);
        this._uniformValues = defaultShadowUniformValues();

        this.useNormalOffset = false;

        painter.tp.registerParameter(shadowParameters, ["Shadows"], "cascadeCount", {min: 1, max: 2, step: 1});
        painter.tp.registerParameter(shadowParameters, ["Shadows"], "shadowMapResolution", {min: 32, max: 2048, step: 32});
        painter.tp.registerBinding(this, ["Shadows"], "_numCascadesToRender", {readonly: true, label: 'numCascadesToRender'});
    }

    destroy() {
        for (const cascade of this._cascades) {
            cascade.texture.destroy();
            cascade.framebuffer.destroy();
        }

        this._cascades = [];
    }

    updateShadowParameters(transform: Transform, directionalLight: ?Lights<Directional>) {
        const painter = this.painter;

        this._enabled = false;
        this._shadowLayerCount = 0;
        this._receivers.clear();

        if (!directionalLight || !directionalLight.properties) {
            return;
        }

        const shadowIntensity = directionalLight.properties.get('shadow-intensity');

        if (!directionalLight.shadowsEnabled() || shadowIntensity <= 0.0) {
            return;
        }

        this._shadowLayerCount = painter.style.order.reduce(
            (accumulator: number, layerId: string) => {
                const layer = painter.style._mergedLayers[layerId];
                return accumulator + (layer.hasShadowPass() && !layer.isHidden(transform.zoom) ? 1 : 0);
            }, 0);

        this._enabled = this._shadowLayerCount > 0;

        if (!this._enabled) {
            return;
        }

        const context = painter.context;
        const width = shadowParameters.shadowMapResolution;
        const height = shadowParameters.shadowMapResolution;

        if (this._cascades.length === 0 || shadowParameters.shadowMapResolution !== this._cascades[0].texture.size[0]) {
            this._cascades = [];
            for (let i = 0; i < shadowParameters.cascadeCount; ++i) {
                const useColor = painter._shadowMapDebug;

                const gl = context.gl;
                const fbo = context.createFramebuffer(width, height, useColor, 'texture');
                const depthTexture = new Texture(context, {width, height, data: null}, gl.DEPTH_COMPONENT);
                fbo.depthAttachment.set(depthTexture.texture);

                if (useColor) {
                    const colorTexture = new Texture(context, {width, height, data: null}, gl.RGBA);
                    fbo.colorAttachment.set(colorTexture.texture);
                }

                this._cascades.push({
                    framebuffer: fbo,
                    texture: depthTexture,
                    matrix: [],
                    far: 0,
                    boundingSphereRadius: 0,
                    frustum: new Frustum(),
                    scale: 0});
            }
        }

        this.shadowDirection = shadowDirectionFromProperties(directionalLight);

        let verticalRange = 0.0;
        if (transform.elevation) {
            const elevation = transform.elevation;
            const range = [10000, -10000];
            elevation.visibleDemTiles.filter(tile => tile.dem).forEach(tile => {
                const minMaxTree = (tile.dem: any).tree;
                range[0] = Math.min(range[0], minMaxTree.minimums[0]);
                range[1] = Math.max(range[1], minMaxTree.maximums[0]);
            });
            if (range[0] !== 10000) {
                verticalRange = (range[1] - range[0]) * elevation.exaggeration();
            }
        }

        const cascadeSplitDist = transform.cameraToCenterDistance * 1.5;
        const shadowCutoutDist = cascadeSplitDist * 3.0;
        const cameraInvProj = new Float64Array(16);
        for (let cascadeIndex = 0; cascadeIndex < this._cascades.length; ++cascadeIndex) {
            const cascade = this._cascades[cascadeIndex];

            let near = transform.height / 50.0;
            let far = 1.0;

            if (shadowParameters.cascadeCount === 1) {
                far = shadowCutoutDist;
            } else {
                if (cascadeIndex === 0) {
                    far = cascadeSplitDist;
                } else {
                    near = cascadeSplitDist;
                    far = shadowCutoutDist;
                }
            }

            const [matrix, radius] = createLightMatrix(transform, this.shadowDirection, near, far, shadowParameters.shadowMapResolution, verticalRange);
            cascade.scale = transform.scale;
            cascade.matrix = matrix;
            cascade.boundingSphereRadius = radius;

            mat4.invert(cameraInvProj, cascade.matrix);
            cascade.frustum = Frustum.fromInvProjectionMatrix(cameraInvProj, 1, 0, true);
            cascade.far = far;
        }
        const fadeRangeIdx = this._cascades.length - 1;
        this._uniformValues['u_fade_range'] = [this._cascades[fadeRangeIdx].far * 0.75, this._cascades[fadeRangeIdx].far];
        this._uniformValues['u_shadow_intensity'] = shadowIntensity;
        this._uniformValues['u_shadow_direction'] = [this.shadowDirection[0], this.shadowDirection[1], this.shadowDirection[2]];
        this._uniformValues['u_shadow_texel_size'] = 1 / shadowParameters.shadowMapResolution;
        this._uniformValues['u_shadow_map_resolution'] = shadowParameters.shadowMapResolution;
        this._uniformValues['u_shadowmap_0'] = TextureSlots.ShadowMap0;
        this._uniformValues['u_shadowmap_1'] = TextureSlots.ShadowMap0 + 1;

        // Render shadows on the ground plane as an extra layer of blended "tiles"
        const tileCoverOptions = {
            tileSize: 512,
            renderWorldCopies: true
        };

        this._groundShadowTiles = painter.transform.coveringTiles(tileCoverOptions);

        const elevation = painter.transform.elevation;
        for (const tileId of this._groundShadowTiles) {
            let tileHeight = {min: 0, max: 0};
            if (elevation) {
                const minMax = elevation.getMinMaxForTile(tileId);
                if (minMax) tileHeight = minMax;
            }
            this.addShadowReceiver(tileId.toUnwrapped(), tileHeight.min, tileHeight.max);
        }
    }

    get enabled(): boolean {
        return this._enabled;
    }

    set enabled(enabled: boolean) {
        // called on layer rendering to disable shadow receiving.
        this._enabled = enabled;
    }

    drawShadowPass(style: Style, sourceCoords: {[_: string]: Array<OverscaledTileID>}) {
        if (!this._enabled) {
            return;
        }

        const painter = this.painter;
        const context = painter.context;

        assert(painter.renderPass === 'shadow');

        // For each shadow receiver, compute how many cascades would need to be
        // sampled for the VISIBLE part of the receiver to be fully covered by
        // shadows.
        this._numCascadesToRender = this._receivers.computeRequiredCascades(painter.transform.getFrustum(0), painter.transform.worldSize, this._cascades);

        context.viewport.set([0, 0, shadowParameters.shadowMapResolution, shadowParameters.shadowMapResolution]);

        for (let cascade = 0; cascade < this._numCascadesToRender; ++cascade) {
            painter.currentShadowCascade = cascade;

            context.bindFramebuffer.set(this._cascades[cascade].framebuffer.framebuffer);
            context.clear({color: Color.white, depth: 1});

            for (const layerId of style.order) {
                const layer = style._mergedLayers[layerId];
                if (!layer.hasShadowPass() || layer.isHidden(painter.transform.zoom)) continue;

                const sourceCache = style.getLayerSourceCache(layer);
                const coords = sourceCache ? sourceCoords[sourceCache.id] : undefined;
                if (layer.type !== 'model' && !(coords && coords.length)) continue;

                painter.renderLayer(painter, sourceCache, layer, coords);
            }
        }

        painter.currentShadowCascade = 0;
    }

    drawGroundShadows() {
        if (!this._enabled) {
            return;
        }

        const painter = this.painter;
        const style = painter.style;
        const context = painter.context;
        const directionalLight = style.directionalLight;
        const ambientLight = style.ambientLight;

        if (!directionalLight || !ambientLight) {
            return;
        }

        const baseDefines = ([]: any);
        const cutoffParams = getCutoffParams(painter, painter.longestCutoffRange);
        if (cutoffParams.shouldRenderCutoff) {
            baseDefines.push('RENDER_CUTOFF');
        }

        const shadowColor = calculateGroundShadowFactor(directionalLight, ambientLight);

        const depthMode = new DepthMode(context.gl.LEQUAL, DepthMode.ReadOnly, painter.depthRangeFor3D);

        for (const id of this._groundShadowTiles) {
            const unwrapped = id.toUnwrapped();
            const affectedByFog = painter.isTileAffectedByFog(id);
            const program = painter.getOrCreateProgram('groundShadow', {defines: baseDefines, overrideFog: affectedByFog});

            this.setupShadows(unwrapped, program);

            painter.uploadCommonUniforms(context, program, unwrapped, null, cutoffParams);

            const uniformValues = groundShadowUniformValues(painter.transform.calculateProjMatrix(unwrapped), shadowColor);

            program.draw(painter, context.gl.TRIANGLES, depthMode, StencilMode.disabled, ColorMode.multiply, CullFaceMode.disabled,
                uniformValues, "ground_shadow", painter.tileExtentBuffer, painter.quadTriangleIndexBuffer,
                painter.tileExtentSegments, {}, painter.transform.zoom,
                null, null);
        }
    }

    getShadowPassColorMode(): $ReadOnly<ColorMode> {
        return this.painter._shadowMapDebug ? ColorMode.unblended : ColorMode.disabled;
    }

    getShadowPassDepthMode(): $ReadOnly<DepthMode> {
        return this._depthMode;
    }

    getShadowCastingLayerCount(): number {
        return this._shadowLayerCount;
    }

    calculateShadowPassMatrixFromTile(unwrappedId: UnwrappedTileID): Float32Array {
        const tr = this.painter.transform;
        const tileMatrix = tr.calculatePosMatrix(unwrappedId, tr.worldSize);
        const lightMatrix = this._cascades[this.painter.currentShadowCascade].matrix;
        mat4.multiply(tileMatrix, lightMatrix, tileMatrix);
        return Float32Array.from(tileMatrix);
    }

    calculateShadowPassMatrixFromMatrix(matrix: Mat4): Float32Array {
        const lightMatrix = this._cascades[this.painter.currentShadowCascade].matrix;
        mat4.multiply(matrix, lightMatrix, matrix);
        return Float32Array.from(matrix);
    }

    setupShadows(unwrappedTileID: UnwrappedTileID, program: Program<*>, normalOffsetMode: ?ShadowNormalOffsetMode, tileOverscaledZ: number = 0) {
        if (!this._enabled) {
            return;
        }

        const transform = this.painter.transform;
        const context = this.painter.context;
        const gl = context.gl;
        const uniforms = this._uniformValues;

        const lightMatrix = new Float64Array(16);
        const tileMatrix = transform.calculatePosMatrix(unwrappedTileID, transform.worldSize);

        for (let i = 0; i < this._cascades.length; i++) {
            mat4.multiply(lightMatrix, this._cascades[i].matrix, tileMatrix);
            uniforms[i === 0 ? 'u_light_matrix_0' : 'u_light_matrix_1'] = Float32Array.from(lightMatrix);
            context.activeTexture.set(gl.TEXTURE0 + TextureSlots.ShadowMap0 + i);
            this._cascades[i].texture.bind(gl.NEAREST, gl.CLAMP_TO_EDGE);
        }

        this.useNormalOffset = !!normalOffsetMode;

        if (this.useNormalOffset) {
            const meterInTiles = tileToMeter(unwrappedTileID.canonical);
            const texelScale = 2.0 / transform.tileSize * EXTENT / shadowParameters.shadowMapResolution;
            const shadowTexelInTileCoords0 = texelScale * this._cascades[0].boundingSphereRadius;
            const shadowTexelInTileCoords1 = texelScale * this._cascades[this._cascades.length - 1].boundingSphereRadius;
            // Instanced model tiles could have smoothened (shared among neighbor faces) normals. Normal is not surface normal
            // and this is why it is needed to increase the offset. 3.0 in case of model-tile could be alternatively replaced by
            // 2.0 if normal would not get scaled by dotScale in shadow_normal_offset().
            const tileTypeMultiplier = (normalOffsetMode === 'vector-tile') ? 1.0 : 3.0;
            const scale = tileTypeMultiplier / Math.pow(2, tileOverscaledZ - unwrappedTileID.canonical.z - (1 - transform.zoom + Math.floor(transform.zoom)));
            const offset0 = shadowTexelInTileCoords0 * scale;
            const offset1 = shadowTexelInTileCoords1 * scale;
            uniforms["u_shadow_normal_offset"] = [meterInTiles, offset0, offset1];
            uniforms["u_shadow_bias"] = [0.00006, 0.0012, 0.012]; // Reduce constant offset
        } else {
            uniforms["u_shadow_bias"] = [0.00036, 0.0012, 0.012];
        }
        program.setShadowUniformValues(context, uniforms);
    }

    setupShadowsFromMatrix(worldMatrix: Mat4, program: Program<*>, normalOffset: boolean = false) {
        if (!this._enabled) {
            return;
        }

        const context = this.painter.context;
        const gl = context.gl;
        const uniforms = this._uniformValues;

        const lightMatrix = new Float64Array(16);
        for (let i = 0; i < shadowParameters.cascadeCount; i++) {
            mat4.multiply(lightMatrix, this._cascades[i].matrix, worldMatrix);
            uniforms[i === 0 ? 'u_light_matrix_0' : 'u_light_matrix_1'] = Float32Array.from(lightMatrix);
            context.activeTexture.set(gl.TEXTURE0 + TextureSlots.ShadowMap0 + i);
            this._cascades[i].texture.bind(gl.NEAREST, gl.CLAMP_TO_EDGE);
        }

        this.useNormalOffset = normalOffset;

        if (normalOffset) {
            const scale = 5.0; // Experimentally found value
            uniforms["u_shadow_normal_offset"] = [1.0, scale, scale]; // meterToTile isn't used
            uniforms["u_shadow_bias"] = [0.00006, 0.0012, 0.012]; // Reduce constant offset
        } else {
            uniforms["u_shadow_bias"] = [0.00036, 0.0012, 0.012];
        }

        program.setShadowUniformValues(context, uniforms);
    }

    // When the same uniform values are used multiple times on different programs, it is sufficient
    // to call program.setShadowUniformValues(context, uniforms) instead of calling setupShadowsFromMatrix multiple times.
    getShadowUniformValues(): UniformValues<ShadowUniformsType> {
        return this._uniformValues;
    }

    getCurrentCascadeFrustum(): Frustum {
        return this._cascades[this.painter.currentShadowCascade].frustum;
    }

    computeSimplifiedTileShadowVolume(id: UnwrappedTileID, height: number, worldSize: number, lightDir: Vec3): TileShadowVolume {
        if (lightDir[2] >= 0.0) {
            return {};
        }
        const corners = tileAabb(id, height, worldSize).getCorners();
        const t = height / -lightDir[2];
        // Project vertices of bottom edges belonging to sides facing away from the light.
        if (lightDir[0] < 0.0) {
            vec3.add(corners[0], corners[0], [lightDir[0] * t, 0.0, 0.0]);
            vec3.add(corners[3], corners[3], [lightDir[0] * t, 0.0, 0.0]);
        } else if (lightDir[0] > 0.0) {
            vec3.add(corners[1], corners[1], [lightDir[0] * t, 0.0, 0.0]);
            vec3.add(corners[2], corners[2], [lightDir[0] * t, 0.0, 0.0]);
        }
        if (lightDir[1] < 0.0) {
            vec3.add(corners[0], corners[0], [0.0, lightDir[1] * t, 0.0]);
            vec3.add(corners[1], corners[1], [0.0, lightDir[1] * t, 0.0]);
        } else if (lightDir[1] > 0.0) {
            vec3.add(corners[2], corners[2], [0.0, lightDir[1] * t, 0.0]);
            vec3.add(corners[3], corners[3], [0.0, lightDir[1] * t, 0.0]);
        }
        const tileShadowVolume: TileShadowVolume = {};
        /* $FlowIgnore[invalid-tuple-arity] we know corners have the same length than vertices */
        tileShadowVolume.vertices = corners;
        tileShadowVolume.planes = [computePlane(corners[1], corners[0], corners[4]), // top
            computePlane(corners[2], corners[1], corners[5]), // right
            computePlane(corners[3], corners[2], corners[6]), // bottom
            computePlane(corners[0], corners[3], corners[7]) ];
        return tileShadowVolume;
    }

    addShadowReceiver(tileId: UnwrappedTileID, minHeight: number, maxHeight: number) {
        this._receivers.add(tileId, Aabb.fromTileIdAndHeight(tileId, minHeight, maxHeight));
    }

    getMaxCascadeForTile(tileId: UnwrappedTileID): number {
        const receiver = this._receivers.get(tileId);
        return !!receiver && !!receiver.lastCascade ? receiver.lastCascade : 0;
    }
}

function tileAabb(id: UnwrappedTileID, height: number, worldSize: number): Aabb {
    const tileToWorld = worldSize / (1 << id.canonical.z);
    const minx =  id.canonical.x * tileToWorld + id.wrap * worldSize;
    const maxx =  (id.canonical.x + 1) * tileToWorld + id.wrap * worldSize;
    const miny =  id.canonical.y * tileToWorld + id.wrap * worldSize;
    const maxy =  (id.canonical.y + 1) * tileToWorld + id.wrap * worldSize;
    return new Aabb([minx, miny, 0], [maxx, maxy, height]);

}

function computePlane(a: Vec3, b: Vec3, c: Vec3): Vec4 {
    const bc = vec3.sub([], c, b);
    const ba = vec3.sub([], a, b);

    const normal = vec3.cross([], bc, ba);
    const len = vec3.length(normal);

    if (len === 0) {
        return [0, 0, 1, 0];
    }
    vec3.scale(normal, normal, 1 / len);
    return [normal[0], normal[1], normal[2], -vec3.dot(normal, b)];
}

export function shadowDirectionFromProperties(directionalLight: Lights<Directional>): Vec3 {
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

export function calculateGroundShadowFactor(directionalLight: Lights<Directional>, ambientLight: Lights<Ambient>): [number, number, number] {
    const dirColor = directionalLight.properties.get('color');
    const dirIntensity = directionalLight.properties.get('intensity');
    const dirDirection = directionalLight.properties.get('direction');
    const directionVec = [dirDirection.x, dirDirection.y, dirDirection.z];
    const ambientColor = ambientLight.properties.get('color');
    const ambientIntensity = ambientLight.properties.get('intensity');

    const groundNormal = [0.0, 0.0, 1.0];
    const dirDirectionalFactor = Math.max(vec3.dot(groundNormal, directionVec), 0.0);
    const ambStrength = [0, 0, 0];
    vec3.scale(ambStrength, ambientColor.toArray01Linear().slice(0, 3), ambientIntensity);
    const dirStrength = [0, 0, 0];
    vec3.scale(dirStrength, dirColor.toArray01Linear().slice(0, 3), dirDirectionalFactor * dirIntensity);

    // Multiplier X to get from lit surface color L to shadowed surface color S
    // X = A / (A + D)
    // A: Ambient light coming into the surface; taking into account color and intensity
    // D: Directional light coming into the surface; taking into account color, intensity and direction
    const shadow = [
        ambStrength[0] > 0.0 ? ambStrength[0] / (ambStrength[0] + dirStrength[0]) : 0.0,
        ambStrength[1] > 0.0 ? ambStrength[1] / (ambStrength[1] + dirStrength[1]) : 0.0,
        ambStrength[2] > 0.0 ? ambStrength[2] / (ambStrength[2] + dirStrength[2]) : 0.0
    ];

    // Because blending will happen in sRGB space, convert the shadow factor to sRGB
    return linearVec3TosRGB(shadow);
}

function createLightMatrix(
    transform: Transform,
    shadowDirection: Vec3,
    near: number,
    far: number,
    resolution: number,
    verticalRange: number): [Float64Array, number] {
    const zoom = transform.zoom;
    const scale = transform.scale;
    const ws = transform.worldSize;
    const wsInverse = 1.0 / ws;

    // Find the minimum shadow cascade bounding sphere to create a rotation invariant shadow volume
    // https://lxjk.github.io/2017/04/15/Calculate-Minimal-Bounding-Sphere-of-Frustum.html
    const aspectRatio = transform.aspect;
    const k = Math.sqrt(1. + aspectRatio * aspectRatio) * Math.tan(transform.fovX * 0.5);
    const k2 = k * k;
    const farMinusNear = far - near;
    const farPlusNear = far + near;

    let centerDepth;
    let radius;
    if (k2 > farMinusNear / farPlusNear) {
        centerDepth = far;
        radius = far * k;
    } else {
        centerDepth = 0.5 * farPlusNear * (1. + k2);
        radius = 0.5 * Math.sqrt(farMinusNear * farMinusNear + 2. * (far * far + near * near) * k2 + farPlusNear * farPlusNear * k2 * k2);
    }

    const pixelsPerMeter = transform.projection.pixelsPerMeter(transform.center.lat, ws);
    const cameraToWorldMerc = transform._camera.getCameraToWorldMercator();
    const sphereCenter = [0.0, 0.0, -centerDepth * wsInverse];
    vec3.transformMat4(sphereCenter, sphereCenter, cameraToWorldMerc);
    let sphereRadius = radius * wsInverse;

    // Transform frustum bounds to mercator space
    const frustumPointToMercator = function(point: Vec3): Vec3 {
        point[0] /= scale;
        point[1] /= scale;
        point[2] = mercatorZfromAltitude(point[2], transform._center.lat);
        return point;
    };

    // Check if we have padding we need to recalculate radii
    const padding = transform._edgeInsets;

    // If there is padding
    if (padding.left !== 0 || padding.top !== 0 || padding.right !== 0 || padding.bottom !== 0) {
        // and the padding is not symmetrical
        if (padding.left !== padding.right || padding.top !== padding.bottom) {
            const zUnit = transform.projection.zAxisUnit === "meters" ? pixelsPerMeter : 1.0;
            const worldToCamera = transform._camera.getWorldToCamera(transform.worldSize, zUnit);
            const cameraToClip = transform._camera.getCameraToClipPerspective(transform._fov, transform.width / transform.height, near, far);

            // Apply center of perspective offset
            cameraToClip[8] = -transform.centerOffset.x * 2 / transform.width;
            cameraToClip[9] = transform.centerOffset.y * 2 / transform.height;

            const cameraProj = new Float64Array(16);
            mat4.mul(cameraProj, cameraToClip, worldToCamera);

            const cameraInvProj = new Float64Array(16);
            mat4.invert(cameraInvProj, cameraProj);

            const frustum = Frustum.fromInvProjectionMatrix(cameraInvProj, ws, zoom, true);

            // Iterate over the frustum points to get the furthest one from the center
            for (const p of frustum.points) {
                const fp = frustumPointToMercator(p);
                sphereRadius = Math.max(sphereRadius, vec3.len(vec3.subtract([], sphereCenter, fp)));
            }
        }
    }

    const roundingMarginFactor = resolution / (resolution - 1.0);
    sphereRadius *= roundingMarginFactor;

    const pitch = Math.acos(shadowDirection[2]);
    const bearing = Math.atan2(-shadowDirection[0], -shadowDirection[1]);

    const camera = new FreeCamera();
    camera.position = sphereCenter;
    camera.setPitchBearing(pitch, bearing);

    // Construct the light view matrix
    const lightWorldToView = camera.getWorldToCamera(ws, pixelsPerMeter);

    // The lightMatrixNearZ value is a bit arbitrary. Its magnitude needs to be high enough to fit features that would
    // cast shadows into the view, but low enough to preserve depth precision in the shadow map.
    // The mercatorZfromZoom term gets used for the first cascade when zoom level is very high.
    // The radius term gets used for the second cascade in most cases and for the first cascade at lower zoom levels.
    const radiusPx = sphereRadius * ws;
    const lightMatrixNearZ = Math.min(transform._mercatorZfromZoom(17) * ws * -2.0, radiusPx * -2.0);
    const lightMatrixFarZ = (radiusPx + verticalRange * pixelsPerMeter) / shadowDirection[2];

    const lightViewToClip = camera.getCameraToClipOrthographic(-radiusPx, radiusPx, -radiusPx, radiusPx, lightMatrixNearZ, lightMatrixFarZ);
    const lightWorldToClip = new Float64Array(16);
    mat4.multiply(lightWorldToClip, lightViewToClip, lightWorldToView);

    // Move light camera in discrete steps in order to reduce shimmering when translating
    const alignedCenter = vec3.fromValues(Math.floor(sphereCenter[0] * 1e6) / 1e6 * ws, Math.floor(sphereCenter[1] * 1e6) / 1e6 * ws, 0.);

    const halfResolution = 0.5 * resolution;
    const projectedPoint = [0.0, 0.0, 0.0];
    vec3.transformMat4(projectedPoint, alignedCenter, lightWorldToClip);
    vec3.scale(projectedPoint, projectedPoint, halfResolution);

    const roundedPoint = [Math.floor(projectedPoint[0]), Math.floor(projectedPoint[1]), Math.floor(projectedPoint[2])];
    const offsetVec = [0.0, 0.0, 0.0];
    vec3.sub(offsetVec, projectedPoint, roundedPoint);
    vec3.scale(offsetVec, offsetVec, -1.0 / halfResolution);

    const truncMatrix = new Float64Array(16);
    mat4.identity(truncMatrix);
    mat4.translate(truncMatrix, truncMatrix, offsetVec);
    mat4.multiply(lightWorldToClip, truncMatrix, lightWorldToClip);

    return [lightWorldToClip, radiusPx];
}
