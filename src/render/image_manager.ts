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

import type Context from '../gl/context';
import type {StyleImage, StyleImageMap} from '../style/style_image';
import type {PotpackBox} from 'potpack';
import type {Callback} from '../types/callback';
import type {Size} from '../util/image';
import type {LUT} from '../util/lut';
import type {FQID} from '../util/fqid';
import type {StringifiedImageId} from '../style-spec/expression/types/image_id';
import type {StringifiedImageVariant} from '../style-spec/expression/types/image_variant';
import type {ImageProvider} from '../render/image_provider';
import type {ActorMessages} from '../util/actor_messages';

const IMAGE_RASTERIZER_WORKER_POOL_COUNT = 1;

type Pattern = {
    bin: PotpackBox;
    position: ImagePosition;
};

export type PatternMap = Record<string, Pattern>;

export type ImageRasterizationTasks = Map<StringifiedImageVariant, ImageVariant>;

export type ImageRasterizationWorkerTask = {
    image: StyleImage,
    imageVariant: ImageVariant
};

export type ImageRasterizationWorkerTasks = Map<StringifiedImageVariant, ImageRasterizationWorkerTask>;

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
    dirty: boolean;
    spriteFormat: SpriteFormat;
    imageProviders: Map<string, Map<ImageProvider['id'], ImageProvider>>;

    loaded: Map<string, boolean>;
    requestors: ImageRequestor[];

    images: Map<string, Map<StringifiedImageId, StyleImage>>;
    updatedImages: Map<string, Set<ImageId>>;
    callbackDispatchedThisFrame: Map<string, Set<StringifiedImageId>>;

    patterns: Map<string, Map<StringifiedImageId, Pattern>>;
    patternsInFlight: Set<FQID<StringifiedImageId>>;

    atlasImage: Map<string, RGBAImage>;
    atlasTexture: Map<string, Texture | null | undefined>;

    imageRasterizerDispatcher: Dispatcher;
    _imageRasterizer: ImageRasterizer;

    constructor(spriteFormat: SpriteFormat) {
        super();
        this.imageProviders = new Map();
        this.images = new Map();
        this.updatedImages = new Map();
        this.callbackDispatchedThisFrame = new Map();
        this.loaded = new Map();
        this.requestors = [];

        this.patterns = new Map();
        this.patternsInFlight = new Set();
        this.atlasImage = new Map();
        this.atlasTexture = new Map();
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

    addScope(scope: string) {
        this.loaded.set(scope, false);
        this.imageProviders.set(scope, new Map());
        this.images.set(scope, new Map());
        this.updatedImages.set(scope, new Set());
        this.callbackDispatchedThisFrame.set(scope, new Set());
        this.patterns.set(scope, new Map());
        this.atlasImage.set(scope, new RGBAImage({width: 1, height: 1}));
    }

    removeScope(scope: string) {
        this.loaded.delete(scope);
        this.imageProviders.delete(scope);
        this.images.delete(scope);
        this.updatedImages.delete(scope);
        this.callbackDispatchedThisFrame.delete(scope);
        this.patterns.delete(scope);
        this.atlasImage.delete(scope);

        const atlasTexture = this.atlasTexture.get(scope);
        if (atlasTexture) {
            atlasTexture.destroy();
            this.atlasTexture.delete(scope);
        }
    }

    addImageProvider(imageProvider: ImageProvider, scope: string) {
        if (!this.imageProviders.has(scope)) {
            this.imageProviders.set(scope, new Map());
        }

        assert(!this.imageProviders.get(scope).has(imageProvider.id), 'ImageProvider already exists');
        this.imageProviders.get(scope).set(imageProvider.id, imageProvider);
    }

    removeImageProvider(imageProviderId: ImageProvider['id'], scope: string) {
        if (this.imageProviders.has(scope)) {
            this.imageProviders.get(scope).delete(imageProviderId);
        }
    }

    getPendingImageProviders(): ImageProvider[] {
        const pendingImageProviders: ImageProvider[] = [];
        for (const imageProviders of this.imageProviders.values()) {
            for (const imageProvider of imageProviders.values()) {
                if (imageProvider.hasPendingRequests()) {
                    pendingImageProviders.push(imageProvider);
                }
            }
        }
        return pendingImageProviders;
    }

    get imageRasterizer(): ImageRasterizer {
        if (!this._imageRasterizer) {
            this._imageRasterizer = new ImageRasterizer();
        }
        return this._imageRasterizer;
    }

    isLoaded(): boolean {
        for (const scope of this.loaded.keys()) {
            if (!this.loaded.get(scope)) return false;
        }
        return true;
    }

    setLoaded(loaded: boolean, scope: string) {
        if (this.loaded.get(scope) === loaded) {
            return;
        }

        this.loaded.set(scope, loaded);

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
        return this.images.get(scope).get(id.toString());
    }

    addImage(id: ImageId, scope: string, image: StyleImage) {
        assert(!this.images.get(scope).has(id.toString()), `Image "${id.toString()}" already exists in scope "${scope}"`);
        if (this._validate(id, image)) {
            this.images.get(scope).set(id.toString(), image);
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
        const oldImage = this.images.get(scope).get(id.toString());
        assert(oldImage, `Image "${id.toString()}" does not exist in scope "${scope}"`);
        assert(oldImage.data.width === image.data.width && oldImage.data.height === image.data.height, `Image "${id.toString()}" dimensions mismatch`);
        image.version = oldImage.version + 1;
        this.images.get(scope).set(id.toString(), image);
        this.updatedImages.get(scope).add(id);
        this.removeFromImageRasterizerCache(id, scope);
    }

    clearUpdatedImages(scope: string) {
        this.updatedImages.get(scope).clear();
    }

    removeFromImageRasterizerCache(id: ImageId, scope: string) {
        if (this.spriteFormat === 'raster') {
            return;
        }

        if (offscreenCanvasSupported()) {
            this.imageRasterizerDispatcher.getActor().send('removeRasterizedImages', {imageIds: [id], scope});
        } else {
            this.imageRasterizer.removeImagesFromCacheByIds([id], scope);
        }
    }

    removeImage(id: ImageId, scope: string) {
        const images = this.images.get(scope);
        assert(images.has(id.toString()), `Image "${id.toString()}" does not exist in scope "${scope}"`);
        const image = images.get(id.toString());
        images.delete(id.toString());
        this.patterns.get(scope).delete(id.toString());
        this.removeFromImageRasterizerCache(id, scope);
        if (image.userImage && image.userImage.onRemove) {
            image.userImage.onRemove();
        }
    }

    listImages(scope: string): ImageId[] {
        return Array.from(this.images.get(scope).keys()).map((id) => ImageId.from(id));
    }

    getImages(ids: ImageId[], scope: string, callback: Callback<StyleImageMap<StringifiedImageId>>) {
        const images: ImageId[] = [];
        const resolvedImages: ImageId[] = [];
        const imageProviders = this.imageProviders.get(scope);
        for (const id of ids) {
            // Populate `images` with all image ids that are not part of an iconset.
            if (!id.iconsetId) {
                images.push(id);
                continue;
            }

            const imageProvider = imageProviders.get(id.iconsetId);
            if (!imageProvider) continue;

            const image = this.getImage(id, scope);
            if (image) resolvedImages.push(id);
            else imageProvider.addPendingRequest(id);
        }

        // Skip the request if all images are part of an iconset.
        // Requested images will be resolved during the imageProvider update.
        if (images.length === 0) {
            // Notify the requestor with the resolved images.
            // Missing images will be provided after the
            // ImageProvider#resolvePendingRequests and Style#_updateTilesForChangedImages.
            this._notify(resolvedImages, scope, callback);
            return;
        }

        // If the sprite has been loaded, or if all the icon dependencies are already present
        // (i.e. if they've been added via runtime styling), then notify the requestor immediately.
        // Otherwise, delay notification until the sprite is loaded. At that point, if any of the
        // dependencies are still unavailable, we'll just assume they are permanently missing.
        let hasAllDependencies = true;
        const isLoaded = !!this.loaded.get(scope);
        const imagesInScope = this.images.get(scope);
        if (!isLoaded) {
            for (const id of images) {
                if (!imagesInScope.has(id.toString())) {
                    hasAllDependencies = false;
                }
            }
        }
        if (isLoaded || hasAllDependencies) {
            this._notify(images, scope, callback);
        } else {
            this.requestors.push({ids: images, scope, callback});
        }
    }

    rasterizeImages(params: ActorMessages['rasterizeImages']['params'], callback: ActorMessages['rasterizeImages']['callback']) {
        const imageWorkerTasks: ImageRasterizationWorkerTasks = new Map();

        const {tasks, scope} = params;
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
            this.imageRasterizerDispatcher.getActor().send('rasterizeImagesWorker', {tasks, scope}, callback);
        } else {
            // Fallback to main thread rasterization
            const rasterizedImages: RasterizedImageMap = new Map();
            for (const [id, {image, imageVariant}] of tasks.entries()) {
                rasterizedImages.set(id, this.imageRasterizer.rasterize(imageVariant, image, scope, 0));
            }
            callback(undefined, rasterizedImages);
        }
    }

    getUpdatedImages(scope: string): Set<ImageId> {
        return this.updatedImages.get(scope) || new Set();
    }

    _notify(ids: ImageId[], scope: string, callback: Callback<StyleImageMap<StringifiedImageId>>) {
        const imagesInScope = this.images.get(scope);
        const response: StyleImageMap<StringifiedImageId> = new Map();

        for (const id of ids) {
            if (!imagesInScope.get(id.toString())) {
                // Don't fire the `styleimagemissing` event if the image is a part of an iconset
                if (id.iconsetId) continue;

                this.fire(new Event('styleimagemissing', {id: id.name}));
            }

            // Check if the image was added to the map after the `styleimagemissing` event was fired
            const image = imagesInScope.get(id.toString());
            if (!image) {
                warnOnce(`Image "${id.name}" could not be loaded. Please make sure you have added the image with map.addImage() or a "sprite" property in your style. You can provide missing images by listening for the "styleimagemissing" map event.`);
                continue;
            }

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
        }

        callback(null, response);
    }

    // Pattern stuff

    getPixelSize(scope: string): Size {
        const {width, height} = this.atlasImage.get(scope);
        return {width, height};
    }

    getPattern(id: ImageId, scope: string, lut: LUT | null): ImagePosition | null | undefined {
        const strImageId = id.toString();
        const patternsInScope = this.patterns.get(scope);
        const pattern = patternsInScope.get(strImageId);

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
                const patternInFlightId = this.getPatternInFlightId(strImageId, scope);
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
        return patternsInScope.get(strImageId).position;
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
        this.patterns.get(scope).set(id.toString(), {bin, position});
    }

    bind(context: Context, scope: string) {
        const gl = context.gl;
        let atlasTexture = this.atlasTexture.get(scope);

        if (!atlasTexture) {
            atlasTexture = new Texture(context, this.atlasImage.get(scope), gl.RGBA8);
            this.atlasTexture.set(scope, atlasTexture);
        } else if (this.dirty) {
            atlasTexture.update(this.atlasImage.get(scope));
            this.dirty = false;
        }

        atlasTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
    }

    _updatePatternAtlas(scope: string, lut: LUT | null) {
        const patternsInScope = this.patterns.get(scope);
        const bins = Array.from(patternsInScope.values()).map(({bin}) => bin);
        const {w, h} = potpack(bins);

        const dst = this.atlasImage.get(scope);
        dst.resize({width: w || 1, height: h || 1});

        const imagesInScope = this.images.get(scope);
        for (const [id, {bin, position}] of patternsInScope.entries()) {
            let padding = position.padding;
            const x = bin.x + padding;
            const y = bin.y + padding;
            const src = imagesInScope.get(id).data;
            const w = src.width;
            const h = src.height;

            assert(padding > 1);
            padding = padding > 1 ? padding - 1 : padding;

            RGBAImage.copy(src, dst, {x: 0, y: 0}, {x, y}, {width: w, height: h}, lut);

            // Add wrapped padding on each side of the image.
            // Leave one pixel transparent to avoid bleeding to neighbouring images
            RGBAImage.copy(src, dst, {x: 0, y: h - padding}, {x, y: y - padding}, {width: w, height: padding}, lut); // T
            RGBAImage.copy(src, dst, {x: 0, y: 0}, {x, y: y + h}, {width: w, height: padding}, lut); // B
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
        for (const scope of this.images.keys()) {
            this.callbackDispatchedThisFrame.set(scope, new Set());
        }
    }

    dispatchRenderCallbacks(ids: ImageId[], scope: string) {
        const imagesInScope = this.images.get(scope);
        for (const id of ids) {
            // the callback for the image was already dispatched for a different frame
            if (this.callbackDispatchedThisFrame.get(scope).has(id.toString())) continue;
            this.callbackDispatchedThisFrame.get(scope).add(id.toString());

            const image = imagesInScope.get(id.toString());
            assert(image, `Image "${id.toString()}" does not exist in scope "${scope}"`);

            const updated = renderStyleImage(image);
            if (updated) {
                this.updateImage(id, scope, image);
            }
        }
    }
}

export default ImageManager;
