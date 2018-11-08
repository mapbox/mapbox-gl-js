// @flow

import StencilMode from '../gl/stencil_mode';
import DepthMode from '../gl/depth_mode';
import CullFaceMode from '../gl/cull_face_mode';
import { circleUniformValues } from './program/circle_program';

import type Painter from './painter';
import type SourceCache from '../source/source_cache';
import type CircleStyleLayer from '../style/style_layer/circle_style_layer';
import type GlobalCircleBucket from '../data/bucket/global_circle_bucket';
import type {OverscaledTileID} from '../source/tile_id';

export default drawCircles;

function drawCircles(painter: Painter, sourceCache: SourceCache, layer: CircleStyleLayer, coords: Array<OverscaledTileID>) {
    if (painter.renderPass !== 'translucent') return;

    const opacity = layer.paint.get('circle-opacity');
    const strokeWidth = layer.paint.get('circle-stroke-width');
    const strokeOpacity = layer.paint.get('circle-stroke-opacity');

    if (opacity.constantOr(1) === 0 && (strokeWidth.constantOr(1) === 0 || strokeOpacity.constantOr(1) === 0)) {
        return;
    }

    const context = painter.context;
    const gl = context.gl;

    const depthMode = painter.depthModeForSublayer(0, DepthMode.ReadOnly);
    // Turn off stencil testing to allow circles to be drawn across boundaries,
    // so that large circles are not clipped to tiles
    const stencilMode = StencilMode.disabled;
    const colorMode = painter.colorModeForRenderPass();

    const buckets = sourceCache.getGlobalBuckets(layer.id);
    if (!buckets) {
        return;
    }

    for (const key in buckets) {
        const bucket = buckets[key];
        if (bucket.tileCount() === 0) {
            continue;
        }

        const programConfiguration = bucket.programConfigurations.get(layer.id);
        const program = painter.useProgram('circle', programConfiguration);

        for (const wrap of sourceCache.getCoveringWraps()) {
            program.draw(context, gl.TRIANGLES, depthMode, stencilMode, colorMode, CullFaceMode.disabled,
                    circleUniformValues(painter, wrap, layer), layer.id,
                    bucket.layoutVertexBuffer, bucket.indexBuffer, bucket.segments,
                    layer.paint, painter.transform.zoom, programConfiguration);
        }
    }
}
