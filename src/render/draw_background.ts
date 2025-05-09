import StencilMode from '../gl/stencil_mode';
import DepthMode from '../gl/depth_mode';
import CullFaceMode from '../gl/cull_face_mode';
import Tile from '../source/tile';
import {
    backgroundUniformValues,
    backgroundPatternUniformValues
} from './program/background_program';
import {OverscaledTileID} from '../source/tile_id';
import {mat4} from 'gl-matrix';
import {ImageId} from '../style-spec/expression/types/image_id';

import type Painter from './painter';
import type SourceCache from '../source/source_cache';
import type BackgroundStyleLayer from '../style/style_layer/background_style_layer';
import type {UniformValues} from './uniform_binding';
import type {ImagePosition} from './image_atlas';
import type {BackgroundUniformsType, BackgroundPatternUniformsType} from './program/background_program';

export default drawBackground;

function drawBackground(painter: Painter, sourceCache: SourceCache, layer: BackgroundStyleLayer, coords: Array<OverscaledTileID>) {
    const color = layer.paint.get('background-color');
    const ignoreLut = layer.paint.get('background-color-use-theme').constantOr('default') === 'none';
    const opacity = layer.paint.get('background-opacity');
    const emissiveStrength = layer.paint.get('background-emissive-strength');
    const isViewportPitch = layer.paint.get('background-pitch-alignment') === 'viewport';

    if (opacity === 0) return;

    const context = painter.context;
    const gl = context.gl;
    const transform = painter.transform;
    const tileSize = transform.tileSize;
    const image = layer.paint.get('background-pattern');
    let patternPosition: ImagePosition | null | undefined;
    if (image !== undefined) {
        // Check if pattern image is loaded and retrieve position
        if (image === null) {
            return;
        }
        patternPosition = painter.imageManager.getPattern(ImageId.from(image.toString()), layer.scope, painter.style.getLut(layer.scope));
        if (!patternPosition) {
            return;
        }
    }

    const pass = (!image && color.a === 1 && opacity === 1 && painter.opaquePassEnabledForLayer()) ? 'opaque' : 'translucent';
    if (painter.renderPass !== pass) return;

    const stencilMode = StencilMode.disabled;
    const depthMode = painter.depthModeForSublayer(0, pass === 'opaque' ? DepthMode.ReadWrite : DepthMode.ReadOnly);

    const colorMode = painter.colorModeForDrapableLayerRenderPass(emissiveStrength);
    const programName = image ? 'backgroundPattern' : 'background';

    let tileIDs = coords;
    let backgroundTiles: Record<number, Tile>;
    if (!tileIDs) {
        backgroundTiles = painter.getBackgroundTiles();
        tileIDs = Object.values(backgroundTiles).map(tile => tile.tileID);
    }

    if (image) {
        context.activeTexture.set(gl.TEXTURE0);
        painter.imageManager.bind(painter.context, layer.scope);
    }

    if (isViewportPitch) {
        // Set overrideRtt to ignore 3D lights
        const program = painter.getOrCreateProgram(programName, {overrideFog: false, overrideRtt: true});
        const matrix = new Float32Array(mat4.identity([] as unknown as mat4));
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);

        const uniformValues: UniformValues<BackgroundUniformsType | BackgroundPatternUniformsType> = image ?
            backgroundPatternUniformValues(matrix, emissiveStrength, opacity, painter, image, layer.scope, patternPosition, isViewportPitch, {tileID, tileSize}) :
            backgroundUniformValues(matrix, emissiveStrength, opacity, color.toPremultipliedRenderColor(ignoreLut ? null : layer.lut));

        program.draw(painter, gl.TRIANGLES, depthMode, stencilMode, colorMode, CullFaceMode.disabled,
            uniformValues, layer.id, painter.viewportBuffer,
            painter.quadTriangleIndexBuffer, painter.viewportSegments);
        return;
    }

    for (const tileID of tileIDs) {
        const affectedByFog = painter.isTileAffectedByFog(tileID);
        const program = painter.getOrCreateProgram(programName, {overrideFog: affectedByFog});
        const unwrappedTileID = tileID.toUnwrapped();
        const matrix = coords ? tileID.projMatrix : painter.transform.calculateProjMatrix(unwrappedTileID);
        painter.prepareDrawTile();

        const tile = sourceCache ? sourceCache.getTile(tileID) :
            backgroundTiles ? backgroundTiles[tileID.key] : new Tile(tileID, tileSize, transform.zoom, painter);

        const uniformValues: UniformValues<BackgroundUniformsType | BackgroundPatternUniformsType> = image ?
            backgroundPatternUniformValues(matrix, emissiveStrength, opacity, painter, image, layer.scope, patternPosition, isViewportPitch, {tileID, tileSize}) :

            backgroundUniformValues(matrix, emissiveStrength, opacity, color.toPremultipliedRenderColor(ignoreLut ? null : layer.lut));

        painter.uploadCommonUniforms(context, program, unwrappedTileID);

        const {tileBoundsBuffer, tileBoundsIndexBuffer, tileBoundsSegments} = painter.getTileBoundsBuffers(tile);

        program.draw(painter, gl.TRIANGLES, depthMode, stencilMode, colorMode, CullFaceMode.disabled,
            uniformValues, layer.id, tileBoundsBuffer,
            tileBoundsIndexBuffer, tileBoundsSegments);
    }
}
