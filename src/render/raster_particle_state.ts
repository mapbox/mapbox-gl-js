import browser from '../util/browser';
import Context from '../gl/context';
import {ParticleIndexLayoutArray} from '../data/array_types';
import particleAttributes from '../data/particle_attributes';
import SegmentVector from '../data/segment';
import Texture from './texture';
import assert from 'assert';

import type {OverscaledTileID} from "../source/tile_id";
import type {TextureImage} from './texture';
import type VertexBuffer from '../gl/vertex_buffer';
import type {RGBAImage} from "../util/image";

class RasterParticleState {
    context: Context;
    particleTexture0: Texture;
    particleTexture1: Texture;
    particleIndexBuffer: VertexBuffer;
    particleSegment: SegmentVector;
    targetColorTexture: Texture;
    backgroundColorTexture: Texture;
    particleTextureDimension: number;
    lastInvalidatedAt: number;

    constructor(
        context: Context,
        id: OverscaledTileID,
        textureSize: [number, number],
        RGBAPositions: RGBAImage,
    ) {
        const emptyImage: TextureImage = {
            width: textureSize[0],
            height: textureSize[1],
            data: null
        };
        const gl = context.gl;
        this.targetColorTexture = new Texture(context, emptyImage, gl.RGBA, {useMipmap: false});
        this.backgroundColorTexture = new Texture(context, emptyImage, gl.RGBA, {useMipmap: false});
        this.context = context;

        this.updateParticleTexture(id, RGBAPositions);
        this.lastInvalidatedAt = 0;
    }

    updateParticleTexture(id: OverscaledTileID, RGBAPositions: RGBAImage) {
        assert(RGBAPositions.width === RGBAPositions.height);
        if (this.particleTextureDimension === RGBAPositions.width) {
            return;
        }

        if (this.particleTexture0 || this.particleTexture1 || this.particleIndexBuffer || this.particleSegment) {
            assert(this.particleTexture0 && this.particleTexture1 && this.particleIndexBuffer && this.particleSegment);
            this.particleTexture0.destroy();
            this.particleTexture1.destroy();
            this.particleIndexBuffer.destroy();
            this.particleSegment.destroy();
        }

        const gl = this.context.gl;

        const numParticles = RGBAPositions.width * RGBAPositions.height;

        this.particleTexture0 = new Texture(this.context, RGBAPositions, gl.RGBA, {premultiply: false, useMipmap: false});
        this.particleTexture1 = new Texture(this.context, RGBAPositions, gl.RGBA, {premultiply: false, useMipmap: false});

        const particleIndices = new ParticleIndexLayoutArray();
        particleIndices.reserve(numParticles);
        for (let i = 0; i < numParticles; i++) {
            particleIndices.emplaceBack(i);
        }
        this.particleIndexBuffer = this.context.createVertexBuffer(particleIndices, particleAttributes.members, true);

        this.particleSegment = SegmentVector.simpleSegment(0, 0, this.particleIndexBuffer.length, 0);
        this.particleTextureDimension = RGBAPositions.width;
    }

    update(layerLastInvalidatedAt: number): boolean {
        if (this.lastInvalidatedAt < layerLastInvalidatedAt) {
            this.lastInvalidatedAt = browser.now();
            return false;
        }

        return true;
    }

    destroy() {
        this.targetColorTexture.destroy();
        this.backgroundColorTexture.destroy();
        this.particleIndexBuffer.destroy();
        this.particleTexture0.destroy();
        this.particleTexture1.destroy();
        this.particleSegment.destroy();
    }
}

export default RasterParticleState;
