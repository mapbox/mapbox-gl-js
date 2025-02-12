import potpack from 'potpack';
import {Event, ErrorEvent, Evented} from '../util/evented';
import {RGBAImage} from '../util/image';
import {ImagePosition, PATTERN_PADDING} from './image_atlas';
import Texture from './texture';
import assert from 'assert';
import {renderStyleImage} from '../style/style_image';
import {warnOnce} from '../util/util';
import Dispatcher from '../util/dispatcher';
import {getImageRasterizerWorkerPool} from '../util/worker_pool_factory';
import offscreenCanvasSupported from '../util/offscreen_canvas_supported';
import {ImageRasterizer} from './image_rasterizer';
import ResolvedImage from '../style-spec/expression/types/resolved_image';

import type {ImageIdWithOptions} from '../style-spec/expression/types/image_id_with_options';
import type {StyleImage} from '../style/style_image';
import type Context from '../gl/context';
import type {PotpackBox} from 'potpack';
import type {Callback} from '../types/callback';
import type {Size} from '../util/image';
import type {LUT} from '../util/lut';

const IMAGE_RASTERIZER_WORKER_POOL_COUNT = 1;

type Pattern = {
    bin: PotpackBox;
    position: ImagePosition;
};

export type SpriteFormat = 'auto' | 'raster' | 'icon_set';

/*
    ImageManager does three things:

        1. Tracks requests for icon images from tile workers and sends responses when the requests are fulfilled.
        2. Builds a texture atlas for pattern images.
        3. Rerenders renderable images once per frame

    These are disparate responsibilities and should eventually be handled by different classes. When we implement
    data-driven support for `*-pattern`, we'll likely use per-bucket pattern atlases, and that would be a good time
    to refactor this.
*/
class ImageManager extends Evented {
    images: {
        [scope: string]: {
            [id: string]: StyleImage;
        };
    };
    updatedImages: {
        [scope: string]: {
            [id: string]: boolean;
        };
    };
    callbackDispatchedThisFrame: {
        [scope: string]: {
            [id: string]: boolean;
        };
    };
    loaded: {
        [scope: string]: boolean;
    };
    requestors: Array<{
        ids: Array<string>;
        scope: string;
        callback: Callback<{
            [id: string]: StyleImage;
        }>;
    }>;

    patterns: {
        [scope: string]: {
            [id: string]: Pattern;
        };
    };
    atlasImage: {
        [scope: string]: RGBAImage;
    };
    atlasTexture: {
        [scope: string]: Texture | null | undefined;
    };
    spriteFormat: SpriteFormat;
    dirty: boolean;

    imageRasterizerDispatcher: Dispatcher;

    _imageRasterizer: ImageRasterizer;

    constructor(spriteFormat: SpriteFormat) {
        super();
        this.images = {};
        this.updatedImages = {};
        this.callbackDispatchedThisFrame = {};
        this.loaded = {};
        this.requestors = [];

        this.patterns = {};
        this.atlasImage = {};
        this.atlasTexture = {};
        this.dirty = true;

        this.spriteFormat = spriteFormat;
        // Disable worker rasterizer if:
        // - Vector icons are not preferred
        // - Offscreen canvas is not supported
        if (spriteFormat !== 'raster' && offscreenCanvasSupported()) {
            this.imageRasterizerDispatcher = new Dispatcher(
                getImageRasterizerWorkerPool(),
                this,
                'Image Rasterizer Worker',
                IMAGE_RASTERIZER_WORKER_POOL_COUNT
            );
        }
    }

    get imageRasterizer(): ImageRasterizer {
        if (!this._imageRasterizer) {
            this._imageRasterizer = new ImageRasterizer();
        }
        return this._imageRasterizer;
    }

    createScope(scope: string) {
        this.images[scope] = {};
        this.loaded[scope] = false;
        this.updatedImages[scope] = {};
        this.patterns[scope] = {};
        this.callbackDispatchedThisFrame[scope] = {};
        this.atlasImage[scope] = new RGBAImage({width: 1, height: 1});
    }

    isLoaded(): boolean {
        for (const scope in this.loaded) {
            if (!this.loaded[scope]) return false;
        }
        return true;
    }

    setLoaded(loaded: boolean, scope: string) {
        if (this.loaded[scope] === loaded) {
            return;
        }

        this.loaded[scope] = loaded;

        if (loaded) {
            for (const {ids, callback} of this.requestors) {
                this._notify(ids, scope, callback);
            }
            this.requestors = [];
        }
    }

    hasImage(id: string, scope: string): boolean {
        return !!this.getImage(id, scope);
    }

    getImage(id: string, scope: string): StyleImage | null | undefined {
        return this.images[scope][id];
    }

    addImage(id: string, scope: string, image: StyleImage) {
        assert(!this.images[scope][id]);
        if (this._validate(id, image)) {
            this.images[scope][id] = image;
        }
    }

    _validate(id: string, image: StyleImage): boolean {
        let valid = true;
        if (!this._validateStretch(image.stretchX, image.data && image.data.width)) {
            this.fire(new ErrorEvent(new Error(`Image "${id}" has invalid "stretchX" value`)));
            valid = false;
        }
        if (!this._validateStretch(image.stretchY, image.data && image.data.height)) {
            this.fire(new ErrorEvent(new Error(`Image "${id}" has invalid "stretchY" value`)));
            valid = false;
        }
        if (!this._validateContent(image.content, image)) {
            this.fire(new ErrorEvent(new Error(`Image "${id}" has invalid "content" value`)));
            valid = false;
        }
        return valid;
    }

    _validateStretch(
        stretch: Array<[number, number]> | null | undefined,
        size: number,
    ): boolean {
        if (!stretch) return true;
        let last = 0;
        for (const part of stretch) {
            if (part[0] < last || part[1] < part[0] || size < part[1]) return false;
            last = part[1];
        }
        return true;
    }

    _validateContent(
        content: [number, number, number, number] | null | undefined,
        image: StyleImage,
    ): boolean {
        if (!content) return true;
        if (content.length !== 4) return false;
        if (!image.usvg) {
            if (content[0] < 0 || image.data.width < content[0]) return false;
            if (content[1] < 0 || image.data.height < content[1]) return false;
            if (content[2] < 0 || image.data.width < content[2]) return false;
            if (content[3] < 0 || image.data.height < content[3]) return false;
        }
        if (content[2] < content[0]) return false;
        if (content[3] < content[1]) return false;
        return true;
    }

    updateImage(id: string, scope: string, image: StyleImage) {
        const oldImage = this.images[scope][id];
        assert(oldImage);
        assert(oldImage.data.width === image.data.width);
        assert(oldImage.data.height === image.data.height);
        image.version = oldImage.version + 1;
        this.images[scope][id] = image;
        this.updatedImages[scope][id] = true;
        this.removeFromImageRasterizerCache(id, scope);
    }

    removeFromImageRasterizerCache(id: string, scope: string) {
        if (this.spriteFormat === 'raster') {
            return;
        }

        if (offscreenCanvasSupported()) {
            this.imageRasterizerDispatcher.getActor().send('removeRasterizedImages', {imageIds: [id], scope});
        } else {
            this.imageRasterizer.removeImagesFromCacheByIds([id], scope);
        }
    }

    removeImage(id: string, scope: string) {
        assert(this.images[scope][id]);
        const image = this.images[scope][id];
        delete this.images[scope][id];
        delete this.patterns[scope][id];
        this.removeFromImageRasterizerCache(id, scope);
        if (image.userImage && image.userImage.onRemove) {
            image.userImage.onRemove();
        }
    }

    listImages(scope: string): Array<string> {
        return Object.keys(this.images[scope]);
    }

    getImages(ids: Array<string>, scope: string, callback: Callback<{
        [_: string]: StyleImage;
    }>) {
        // If the sprite has been loaded, or if all the icon dependencies are already present
        // (i.e. if they've been added via runtime styling), then notify the requestor immediately.
        // Otherwise, delay notification until the sprite is loaded. At that point, if any of the
        // dependencies are still unavailable, we'll just assume they are permanently missing.
        let hasAllDependencies = true;
        const isLoaded = !!this.loaded[scope];
        if (!isLoaded) {
            for (const id of ids) {
                if (!this.images[scope][id]) {
                    hasAllDependencies = false;
                }
            }
        }
        if (isLoaded || hasAllDependencies) {
            this._notify(ids, scope, callback);
        } else {
            this.requestors.push({ids, scope, callback});
        }
    }

    rasterizeImages({scope, imageTasks}: {scope: string, imageTasks: {[_: string]: ImageIdWithOptions}}, callback: Callback<{[_: string]: RGBAImage}>) {
        const imageWorkerTasks: {[_: string]: {image: StyleImage, imageIdWithOptions: ImageIdWithOptions}} = {};

        for (const id in imageTasks) {
            const imageIdWithOptions = imageTasks[id];
            const image = this.getImage(imageIdWithOptions.id, scope);
            if (image) {
                imageWorkerTasks[id] = {image, imageIdWithOptions};
            }
        }

        if (!offscreenCanvasSupported()) {
            this.rasterizeImagesInMainThread({imageTasks: imageWorkerTasks, scope}, callback);
        } else {
            this.imageRasterizerDispatcher.getActor().send('rasterizeImages', {imageTasks: imageWorkerTasks, scope}, callback);
        }
    }

    rasterizeImagesInMainThread(input: {imageTasks: {[_: string]:  {image: StyleImage, imageIdWithOptions: ImageIdWithOptions}}, scope: string}, callback: (err?: Error, result?: {[_: string]: RGBAImage}) => void) {
        const {imageTasks, scope} = input;
        const images: {[key: string]: RGBAImage} = {};
        for (const id in imageTasks) {
            const {image, imageIdWithOptions} = imageTasks[id];
            images[id] = this.imageRasterizer.rasterize(imageIdWithOptions, image, scope, '');
        }
        callback(undefined, images);
    }

    getUpdatedImages(scope: string): {
        [_: string]: boolean;
    } {
        return this.updatedImages[scope];
    }

    _notify(ids: Array<string>, scope: string, callback: Callback<{
        [_: string]: StyleImage;
    }>) {
        const response: Record<string, any> = {};

        for (const id of ids) {
            if (!this.images[scope][id]) {
                this.fire(new Event('styleimagemissing', {id}));
            }
            const image = this.images[scope][id];
            if (image) {
                // Clone the image so that our own copy of its ArrayBuffer doesn't get transferred.
                response[id] = {
                    // Vector images will be rasterized on the worker thread
                    data: image.usvg ? null : image.data.clone(),
                    pixelRatio: image.pixelRatio,
                    sdf: image.sdf,
                    usvg: image.usvg,
                    version: image.version,
                    stretchX: image.stretchX,
                    stretchY: image.stretchY,
                    content: image.content,
                    hasRenderCallback: Boolean(image.userImage && image.userImage.render)
                };
            } else {
                warnOnce(`Image "${id}" could not be loaded. Please make sure you have added the image with map.addImage() or a "sprite" property in your style. You can provide missing images by listening for the "styleimagemissing" map event.`);
            }
        }

        callback(null, response);
    }

    // Pattern stuff

    getPixelSize(scope: string): Size {
        const {width, height} = this.atlasImage[scope];
        return {width, height};
    }

    getPattern(id: string, scope: string, lut: LUT | null): ImagePosition | null | undefined {
        const pattern = this.patterns[scope][id];

        const image = this.getImage(id, scope);
        if (!image) {
            return null;
        }

        if (pattern && pattern.position.version === image.version) {
            return pattern.position;
        }

        if (!pattern) {
            if (image.usvg && !image.data) {
                image.data = this.imageRasterizer.rasterize(ResolvedImage.from(id).getPrimary(), image, scope, '');
            }
            const w = image.data.width + PATTERN_PADDING * 2;
            const h = image.data.height + PATTERN_PADDING * 2;
            const bin = {w, h, x: 0, y: 0};
            const position = new ImagePosition(bin, image, PATTERN_PADDING);
            this.patterns[scope][id] = {bin, position};
        } else {
            pattern.position.version = image.version;
        }

        this._updatePatternAtlas(scope, lut);

        return this.patterns[scope][id].position;
    }

    bind(context: Context, scope: string) {
        const gl = context.gl;
        let atlasTexture = this.atlasTexture[scope];

        if (!atlasTexture) {
            atlasTexture = new Texture(context, this.atlasImage[scope], gl.RGBA8);
            this.atlasTexture[scope] = atlasTexture;
        } else if (this.dirty) {
            atlasTexture.update(this.atlasImage[scope]);
            this.dirty = false;
        }

        atlasTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
    }

    _updatePatternAtlas(scope: string, lut: LUT | null) {
        const bins = [];
        for (const id in this.patterns[scope]) {
            bins.push(this.patterns[scope][id].bin);
        }

        const {w, h} = potpack(bins);

        const dst = this.atlasImage[scope];
        dst.resize({width: w || 1, height: h || 1});

        for (const id in this.patterns[scope]) {
            const {bin, position} = this.patterns[scope][id];
            let padding = position.padding;
            const x = bin.x + padding;
            const y = bin.y + padding;
            const src = this.images[scope][id].data;
            const w = src.width;
            const h = src.height;

            assert(padding > 1);
            padding = padding > 1 ? padding - 1 : padding;

            RGBAImage.copy(src, dst, {x: 0, y: 0}, {x, y}, {width: w, height: h}, lut);

            // Add wrapped padding on each side of the image.
            // Leave one pixel transparent to avoid bleeding to neighbouring images
            RGBAImage.copy(src, dst, {x: 0, y: h - padding}, {x, y: y - padding}, {width: w, height: padding}, lut); // T
            RGBAImage.copy(src, dst, {x: 0, y:     0}, {x, y: y + h}, {width: w, height: padding}, lut); // B
            RGBAImage.copy(src, dst, {x: w - padding, y: 0}, {x: x - padding, y}, {width: padding, height: h}, lut); // L
            RGBAImage.copy(src, dst, {x: 0,     y: 0}, {x: x + w, y}, {width: padding, height: h}, lut); // R
            // Fill corners
            RGBAImage.copy(src, dst, {x: w - padding, y: h - padding}, {x: x - padding, y: y - padding}, {width: padding, height: padding}, lut); // TL
            RGBAImage.copy(src, dst, {x: 0, y: h - padding}, {x: x + w, y: y - padding}, {width: padding, height: padding}, lut); // TR
            RGBAImage.copy(src, dst, {x: 0, y: 0}, {x: x + w, y: y + h}, {width: padding, height: padding}, lut); // BL
            RGBAImage.copy(src, dst, {x: w - padding, y: 0}, {x: x - padding, y: y + h}, {width: padding, height: padding}, lut); // BR

        }

        this.dirty = true;
    }

    beginFrame() {
        for (const scope in this.images) {
            this.callbackDispatchedThisFrame[scope] = {};
        }
    }

    dispatchRenderCallbacks(ids: Array<string>, scope: string) {
        for (const id of ids) {
            // the callback for the image was already dispatched for a different frame
            if (this.callbackDispatchedThisFrame[scope][id]) continue;
            this.callbackDispatchedThisFrame[scope][id] = true;

            const image = this.images[scope][id];
            assert(image);

            const updated = renderStyleImage(image);
            if (updated) {
                this.updateImage(id, scope, image);
            }
        }
    }
}

export default ImageManager;
