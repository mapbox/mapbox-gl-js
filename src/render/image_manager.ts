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
import browser from '../util/browser';
import {makeFQID} from '../util/fqid';
import {ImageId} from '../style-spec/expression/types/image_id';
import {ImageVariant} from '../style-spec/expression/types/image_variant';

import type {StyleImage, StyleImages, StyleImageMap} from '../style/style_image';
import type Context from '../gl/context';
import type {PotpackBox} from 'potpack';
import type {Callback} from '../types/callback';
import type {Size} from '../util/image';
import type {LUT} from '../util/lut';
import type {FQID} from '../util/fqid';
import type {StringifiedImageId} from '../style-spec/expression/types/image_id';
import type {StringifiedImageVariant} from '../style-spec/expression/types/image_variant';
import type {WorkerSourceRemoveRasterizedImagesParameters} from '../source/worker_source';

const IMAGE_RASTERIZER_WORKER_POOL_COUNT = 1;

type Pattern = {
    bin: PotpackBox;
    position: ImagePosition;
};

export type PatternMap = Record<string, Pattern>;

export type ImageRasterizationWorkerTask = {
    image: StyleImage,
    imageVariant: ImageVariant
};

export type ImageRasterizationWorkerTasks = Map<StringifiedImageVariant, ImageRasterizationWorkerTask>;

export type ImageRasterizationTasks = Map<StringifiedImageVariant, ImageVariant>;

export type RasterizeImagesParameters = {
    scope: string;
    tasks: ImageRasterizationTasks;
};

export type RasterizedImageMap = Map<StringifiedImageVariant, RGBAImage>;

export type SpriteFormat = 'auto' | 'raster' | 'icon_set';

type ImageRequestor = {
    ids: ImageId[];
    scope: string;
    callback: Callback<StyleImageMap<StringifiedImageId>>;
};

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
    _images: {
        [scope: string]: StyleImages;
    };
    _iconsets: {
        [scope: string]: Record<string, StyleImages>;
    };
    updatedImages: {
        [scope: string]: Set<ImageId>;
    };
    callbackDispatchedThisFrame: {
        [scope: string]: Set<StringifiedImageId>;
    };
    loaded: {
        [scope: string]: boolean;
    };
    requestors: ImageRequestor[];

    patterns: {
        [scope: string]: {
            [id: string]: Pattern;
        };
    };
    patternsInFlight: Set<FQID<StringifiedImageId>>;
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
        this._images = {};
        this._iconsets = {};
        this.updatedImages = {};
        this.callbackDispatchedThisFrame = {};
        this.loaded = {};
        this.requestors = [];

        this.patterns = {};
        this.patternsInFlight = new Set();
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
        this._images[scope] = {};
        this._iconsets[scope] = {};
        this.loaded[scope] = false;
        this.updatedImages[scope] = new Set();
        this.patterns[scope] = {};
        this.callbackDispatchedThisFrame[scope] = new Set();
        this.atlasImage[scope] = new RGBAImage({width: 1, height: 1});
    }

    createIconset(scope: string, iconsetId: string) {
        this._iconsets[scope][iconsetId] = {};
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

    hasImage(id: ImageId, scope: string): boolean {
        return !!this.getImage(id, scope);
    }

    getImage(id: ImageId, scope: string): StyleImage | null | undefined {
        const images = id.iconsetId ? this._iconsets[scope][id.iconsetId] : this._images[scope];
        return images[id.name];
    }

    addImage(id: ImageId, scope: string, image: StyleImage) {
        const images = id.iconsetId ? this._iconsets[scope][id.iconsetId] : this._images[scope];
        assert(!images[id.name]);
        if (this._validate(id, image)) {
            images[id.name] = image;
        }
    }

    _validate(id: ImageId, image: StyleImage): boolean {
        let valid = true;
        if (!this._validateStretch(image.stretchX, image.data && image.data.width)) {
            this.fire(new ErrorEvent(new Error(`Image "${id.name}" has invalid "stretchX" value`)));
            valid = false;
        }
        if (!this._validateStretch(image.stretchY, image.data && image.data.height)) {
            this.fire(new ErrorEvent(new Error(`Image "${id.name}" has invalid "stretchY" value`)));
            valid = false;
        }
        if (!this._validateContent(image.content, image)) {
            this.fire(new ErrorEvent(new Error(`Image "${id.name}" has invalid "content" value`)));
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

    updateImage(id: ImageId, scope: string, image: StyleImage) {
        const images = id.iconsetId ? this._iconsets[scope][id.iconsetId] : this._images[scope];
        const oldImage = images[id.name];
        assert(oldImage);
        assert(oldImage.data.width === image.data.width);
        assert(oldImage.data.height === image.data.height);
        image.version = oldImage.version + 1;
        images[id.name] = image;
        this.updatedImages[scope].add(id);
        this.removeFromImageRasterizerCache(id, scope);
    }

    removeFromImageRasterizerCache(id: ImageId, scope: string) {
        if (this.spriteFormat === 'raster') {
            return;
        }

        if (offscreenCanvasSupported()) {
            const params: WorkerSourceRemoveRasterizedImagesParameters = {imageIds: [id], scope};
            this.imageRasterizerDispatcher.getActor().send('removeRasterizedImages', params);
        } else {
            this.imageRasterizer.removeImagesFromCacheByIds([id], scope);
        }
    }

    removeImage(id: ImageId, scope: string) {
        const images = id.iconsetId ? this._iconsets[scope][id.iconsetId] : this._images[scope];
        assert(images[id.name]);
        const image = images[id.name];
        delete images[id.name];
        delete this.patterns[scope][id.name];
        this.removeFromImageRasterizerCache(id, scope);
        if (image.userImage && image.userImage.onRemove) {
            image.userImage.onRemove();
        }
    }

    listImages(scope: string): ImageId[] {
        const result = [];
        for (const name of Object.keys(this._images[scope])) {
            result.push(new ImageId(name));
        }

        for (const iconsetId in this._iconsets[scope]) {
            for (const name of Object.keys(this._iconsets[scope][iconsetId])) {
                result.push(new ImageId({name, iconsetId}));
            }
        }

        return result;
    }

    getImages(ids: ImageId[], scope: string, callback: Callback<StyleImageMap<StringifiedImageId>>) {
        // If the sprite has been loaded, or if all the icon dependencies are already present
        // (i.e. if they've been added via runtime styling), then notify the requestor immediately.
        // Otherwise, delay notification until the sprite is loaded. At that point, if any of the
        // dependencies are still unavailable, we'll just assume they are permanently missing.
        let hasAllDependencies = true;
        const isLoaded = !!this.loaded[scope];
        if (!isLoaded) {
            for (const id of ids) {
                const images = id.iconsetId ? this._iconsets[scope][id.iconsetId] : this._images[scope];
                if (!images[id.name]) {
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

    rasterizeImages({scope, tasks}: RasterizeImagesParameters, callback: Callback<RasterizedImageMap>) {
        const imageWorkerTasks: ImageRasterizationWorkerTasks = new Map();

        for (const [id, imageVariant] of tasks.entries()) {
            const image = this.getImage(imageVariant.id, scope);
            if (image) {
                imageWorkerTasks.set(id, {image, imageVariant});
            }
        }

        this._rasterizeImages(scope, imageWorkerTasks, callback);
    }

    _rasterizeImages(scope: string, tasks: ImageRasterizationWorkerTasks, callback?: Callback<RasterizedImageMap>) {
        if (offscreenCanvasSupported()) {
            // Use the worker thread to rasterize images
            this.imageRasterizerDispatcher.getActor().send('rasterizeImages', {tasks, scope}, callback);
        } else {
            // Fallback to main thread rasterization
            const rasterizedImages: RasterizedImageMap = new Map();
            for (const [id, {image, imageVariant}] of tasks.entries()) {
                rasterizedImages.set(id, this.imageRasterizer.rasterize(imageVariant, image, scope, ''));
            }
            callback(undefined, rasterizedImages);
        }
    }

    getUpdatedImages(scope: string): Set<ImageId> {
        return this.updatedImages[scope] || new Set();
    }

    _notify(ids: ImageId[], scope: string, callback: Callback<StyleImageMap<StringifiedImageId>>) {
        const response: StyleImageMap<StringifiedImageId> = new Map();

        for (const id of ids) {
            if (id.iconsetId) {
                this._iconsets[scope][id.iconsetId] = this._iconsets[scope][id.iconsetId] || {};
            }

            const images = id.iconsetId ? this._iconsets[scope][id.iconsetId] : this._images[scope];
            if (!images[id.name]) {
                // eslint-disable-next-line
                // TODO: `styleimagemissing` event should also include `iconsetId`
                this.fire(new Event('styleimagemissing', {id: id.name}));
            }
            const image = images[id.name];
            if (image) {
                // Clone the image so that our own copy of its ArrayBuffer doesn't get transferred.
                const styleImage = {
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

                if (image.usvg) {
                    // Since vector images don't have any data, we add the width and height from the source svg
                    // so that we can compute the scale factor later if needed
                    Object.assign(styleImage, {
                        width: image.icon.usvg_tree.width,
                        height: image.icon.usvg_tree.height
                    });
                }

                response.set(ImageId.toString(id), styleImage);
            } else {
                warnOnce(`Image "${id.name}" could not be loaded. Please make sure you have added the image with map.addImage() or a "sprite" property in your style. You can provide missing images by listening for the "styleimagemissing" map event.`);
            }
        }

        callback(null, response);
    }

    // Pattern stuff

    getPixelSize(scope: string): Size {
        const {width, height} = this.atlasImage[scope];
        return {width, height};
    }

    getPattern(id: ImageId, scope: string, lut: LUT | null): ImagePosition | null | undefined {
        // eslint-disable-next-line
        // TODO: add iconsets support
        const pattern = this.patterns[scope][id.name];

        const image = this.getImage(id, scope);
        if (!image) {
            return null;
        }

        if (pattern) {
            if (pattern.position.version === image.version) {
                return pattern.position;
            } else {
                pattern.position.version = image.version;
            }
        } else {
            if (image.usvg && !image.data) {
                const patternInFlightId = this.getPatternInFlightId(id.toString(), scope);
                if (this.patternsInFlight.has(patternInFlightId)) {
                    return null;
                }

                this.patternsInFlight.add(patternInFlightId);
                const imageVariant = new ImageVariant(id).scaleSelf(browser.devicePixelRatio);
                const tasks: ImageRasterizationWorkerTasks = new Map([[imageVariant.toString(), {image, imageVariant}]]);
                this._rasterizeImages(scope, tasks, (_, rasterizedImages) => this.storePatternImage(imageVariant, scope, image, lut, rasterizedImages));
                return null;
            } else {
                this.storePattern(id, scope, image);
            }
        }

        this._updatePatternAtlas(scope, lut);

        return this.patterns[scope][id.name].position;
    }

    getPatternInFlightId(id: StringifiedImageId, scope: string): FQID<StringifiedImageId> {
        return makeFQID(id, scope);
    }

    hasPatternsInFlight() {
        return this.patternsInFlight.size !== 0;
    }

    storePatternImage(imageVariant: ImageVariant, scope: string, image: StyleImage, lut: LUT, rasterizedImages?: RasterizedImageMap | null) {
        const id = imageVariant.toString();
        const imageData = rasterizedImages ? rasterizedImages.get(id) : undefined;
        if (!imageData) return;

        image.data = imageData;
        this.storePattern(imageVariant.id, scope, image);
        this._updatePatternAtlas(scope, lut);
        this.patternsInFlight.delete(this.getPatternInFlightId(imageVariant.id.toString(), scope));
    }

    storePattern(id: ImageId, scope: string, image: StyleImage) {
        const w = image.data.width + PATTERN_PADDING * 2;
        const h = image.data.height + PATTERN_PADDING * 2;
        const bin = {w, h, x: 0, y: 0};
        const position = new ImagePosition(bin, image, PATTERN_PADDING);
        this.patterns[scope][id.name] = {bin, position};
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
        for (const name in this.patterns[scope]) {
            bins.push(this.patterns[scope][name].bin);
        }

        const {w, h} = potpack(bins);

        const dst = this.atlasImage[scope];
        dst.resize({width: w || 1, height: h || 1});

        for (const name in this.patterns[scope]) {
            const {bin, position} = this.patterns[scope][name];
            let padding = position.padding;
            const x = bin.x + padding;
            const y = bin.y + padding;
            const src = this._images[scope][name].data;
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
        for (const scope in this._images) {
            this.callbackDispatchedThisFrame[scope] = new Set();
        }
    }

    dispatchRenderCallbacks(ids: ImageId[], scope: string) {
        for (const id of ids) {
            // the callback for the image was already dispatched for a different frame
            if (this.callbackDispatchedThisFrame[scope].has(id.toString())) continue;
            this.callbackDispatchedThisFrame[scope].add(id.toString());

            const images = id.iconsetId ? this._iconsets[scope][id.iconsetId] : this._images[scope];
            const image = images[id.name];
            assert(image);

            const updated = renderStyleImage(image);
            if (updated) {
                this.updateImage(id, scope, image);
            }
        }
    }
}

export default ImageManager;
