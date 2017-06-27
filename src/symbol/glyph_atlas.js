'use strict';

const ShelfPack = require('@mapbox/shelf-pack');
const util = require('../util/util');
const Texture = require('../render/texture');

const SIZE_GROWTH_RATE = 4;
const DEFAULT_SIZE = 128;
// must be "DEFAULT_SIZE * SIZE_GROWTH_RATE ^ n" for some integer n
const MAX_SIZE = 2048;

class GlyphAtlas {

    constructor() {
        this.width = DEFAULT_SIZE;
        this.height = DEFAULT_SIZE;

        this.atlas = new ShelfPack(this.width, this.height);
        this.index = {};
        this.ids = {};
        this.data = new Uint8Array(this.width * this.height);
        this.dirty = true;
    }

    getGlyphs() {
        const glyphs = {};
        let split,
            name,
            id;

        for (const key in this.ids) {
            split = key.split('#');
            name = split[0];
            id = split[1];

            if (!glyphs[name]) glyphs[name] = [];
            glyphs[name].push(id);
        }

        return glyphs;
    }

    getRects() {
        const rects = {};
        let split,
            name,
            id;

        for (const key in this.ids) {
            split = key.split('#');
            name = split[0];
            id = split[1];

            if (!rects[name]) rects[name] = {};
            rects[name][id] = this.index[key];
        }

        return rects;
    }

    addGlyph(id, name, glyph, buffer) {
        if (!glyph) return null;

        const key = `${name}#${glyph.id}`;

        // The glyph is already in this texture.
        if (this.index[key]) {
            if (this.ids[key].indexOf(id) < 0) {
                this.ids[key].push(id);
            }
            return this.index[key];
        }

        // The glyph bitmap has zero width.
        if (!glyph.bitmap) {
            return null;
        }

        const bufferedWidth = glyph.width + buffer * 2;
        const bufferedHeight = glyph.height + buffer * 2;

        // Add a 1px border around every image.
        const padding = 1;
        const packWidth = bufferedWidth + 2 * padding;
        const packHeight = bufferedHeight + 2 * padding;

        let rect = this.atlas.packOne(packWidth, packHeight);
        if (!rect) {
            this.resize();
            rect = this.atlas.packOne(packWidth, packHeight);
        }
        if (!rect) {
            util.warnOnce('glyph bitmap overflow');
            return null;
        }

        this.index[key] = rect;
        this.ids[key] = [id];

        const target = this.data;
        const source = glyph.bitmap;
        for (let y = 0; y < bufferedHeight; y++) {
            const y1 = this.width * (rect.y + y + padding) + rect.x + padding;
            const y2 = bufferedWidth * y;
            for (let x = 0; x < bufferedWidth; x++) {
                target[y1 + x] = source[y2 + x];
            }
        }

        this.dirty = true;

        return rect;
    }

    resize() {
        const prevWidth = this.width;
        const prevHeight = this.height;

        if (prevWidth >= MAX_SIZE || prevHeight >= MAX_SIZE) return;

        if (this.gl)
            this.texture.destroy();

        this.width *= SIZE_GROWTH_RATE;
        this.height *= SIZE_GROWTH_RATE;
        this.atlas.resize(this.width, this.height);

        const buf = new ArrayBuffer(this.width * this.height);
        for (let i = 0; i < prevHeight; i++) {
            const src = new Uint8Array(this.data.buffer, prevHeight * i, prevWidth);
            const dst = new Uint8Array(buf, prevHeight * i * SIZE_GROWTH_RATE, prevWidth);
            dst.set(src);
        }
        this.data = new Uint8Array(buf);
    }

    bind(gl) {
        this.gl = gl;
        if (!this.texture) {
            this.texture = new Texture(gl, gl.CLAMP_TO_EDGE, gl.LINEAR, gl.LINEAR);
        } else {
            this.texture.bind();
        }
        if (this.dirty) {
            this.texture.setData(gl.ALPHA, this.width, this.height, this.data);
            this.dirty = false;
        }
    }
}

module.exports = GlyphAtlas;
