// @flow

import browser from '../util/browser.js';
import Context from '../gl/context.js';
import {mulberry32} from '../style-spec/util/random.js';
import {ParticleIndexLayoutArray} from '../data/array_types.js';
import particleAttributes from '../data/particle_attributes.js';
import {RGBAImage} from '../util/image.js';
import SegmentVector from '../data/segment.js';
import Texture from './texture.js';
import assert from 'assert';

import type {OverscaledTileID} from "../source/tile_id";
import type {TextureImage} from './texture.js';
import type VertexBuffer from '../gl/vertex_buffer.js';

export const PARTICLE_POS_SCALE = 1.3;
export const PARTICLE_POS_OFFSET = 0.5 * (PARTICLE_POS_SCALE - 1.0);

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

    constructor(context: Context, id: OverscaledTileID, textureSize: [number, number], particleTextureDimension: number): void {
        const emptyImage: TextureImage = {
            width: textureSize[0],
            height: textureSize[1],
            data: null
        };
        const gl = context.gl;
        this.targetColorTexture = new Texture(context, emptyImage, gl.RGBA, {useMipmap: false});
        this.backgroundColorTexture = new Texture(context, emptyImage, gl.RGBA, {useMipmap: false});
        this.context = context;

        this.setParticleTextureDimension(id, particleTextureDimension);
        this.lastInvalidatedAt = 0;
    }

    setParticleTextureDimension(id: OverscaledTileID, particleTextureDimension: number) {
        if (this.particleTextureDimension === particleTextureDimension) {
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

        const numParticles = particleTextureDimension * particleTextureDimension;
        const particlePositions = new Uint8Array(numParticles * 4);

        const invScale = 1.0 / PARTICLE_POS_SCALE;
        const srand = mulberry32(id.key);
        // Encode random particle positions into RGBA pixels
        for (let i = 0; i < particlePositions.length; i += 4) {
            // Decoded positions in shader: (PARTICLE_POS_SCALE * p - PARTICLE_POS_OFFSET), where p ∈ [0, 1].
            // x, y are the inverse of the decoded position.
            const x = invScale * (srand() + PARTICLE_POS_OFFSET);
            const y = invScale * (srand() + PARTICLE_POS_OFFSET);
            // Encode fractional part into RG, integral part into BA.
            particlePositions[i + 0] = Math.floor(256 * ((255 * x) % 1));
            particlePositions[i + 1] = Math.floor(256 * ((255 * y)  % 1));
            particlePositions[i + 2] = Math.floor(256 * x);
            particlePositions[i + 3] = Math.floor(256 * y);
        }
        const particleImage = new RGBAImage({width: particleTextureDimension, height: particleTextureDimension}, particlePositions);
        this.particleTexture0 = new Texture(this.context, particleImage, gl.RGBA, {premultiply: false, useMipmap: false});
        this.particleTexture1 = new Texture(this.context, particleImage, gl.RGBA, {premultiply: false, useMipmap: false});

        const particleIndices = new ParticleIndexLayoutArray();
        particleIndices.reserve(numParticles);
        for (let i = 0; i < numParticles; i++) {
            particleIndices.emplaceBack(i);
        }
        this.particleIndexBuffer = this.context.createVertexBuffer(particleIndices, particleAttributes.members, true);

        this.particleSegment = SegmentVector.simpleSegment(0, 0, this.particleIndexBuffer.length, 0);
        this.particleTextureDimension = particleTextureDimension;
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
