// @flow

import browser from '../util/browser.js';
import Context from '../gl/context.js';
import {ParticleVertexLayoutArray} from '../data/array_types.js';
import particleAttributes from '../data/particle_attributes.js';
import SegmentVector from '../data/segment.js';
import Texture from './texture.js';
import assert from 'assert';

import type {TextureImage} from './texture.js';
import type VertexBuffer from '../gl/vertex_buffer.js';

class RasterParticleState {
    context: Context;
    particleVertices0: VertexBuffer;
    particleVertices1: VertexBuffer;
    particleSegment: SegmentVector;
    targetColorTexture: Texture;
    backgroundColorTexture: Texture;
    numParticles: number;
    lastInvalidatedAt: number;

    constructor(context: Context, textureSize: [number, number], numParticles: number): void {
        const emptyImage: TextureImage = {
            width: textureSize[0],
            height: textureSize[1],
            data: null
        };
        const gl = context.gl;
        this.targetColorTexture = new Texture(context, emptyImage, gl.RGBA, {useMipmap: false});
        this.backgroundColorTexture = new Texture(context, emptyImage, gl.RGBA, {useMipmap: false});
        this.context = context;

        this.setNumParticles(numParticles);
        this.lastInvalidatedAt = 0;
    }

    setNumParticles(numParticles: number) {
        if (this.numParticles === numParticles) {
            return;
        }

        if (this.particleVertices0 || this.particleVertices1 || this.particleSegment) {
            assert(this.particleVertices0 && this.particleVertices1 && this.particleSegment);
            this.particleVertices0.destroy();
            this.particleVertices1.destroy();
            this.particleSegment.destroy();
        }

        const particles = new ParticleVertexLayoutArray();
        particles.reserve(Math.round(numParticles));
        for (let i = 0; i < numParticles; i++) {
            particles.emplaceBack(Math.random(), Math.random(), Math.random());
        }
        this.particleVertices0 = this.context.createVertexBuffer(particles, particleAttributes.members, true);
        this.particleVertices1 = this.context.createVertexBuffer(particles, particleAttributes.members, true);
        this.particleSegment = SegmentVector.simpleSegment(0, 0, this.particleVertices0.length, 0);

        this.numParticles = numParticles;
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
        this.particleVertices0.destroy();
        this.particleVertices1.destroy();
        this.particleSegment.destroy();
    }
}

export default RasterParticleState;
