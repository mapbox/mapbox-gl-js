// @flow

import {RGBAImage} from '../util/image.js';

import type Map from '../ui/map.js';

export type StyleImageData = {
    data: RGBAImage,
    version: number,
    hasRenderCallback?: boolean,
    userImage?: StyleImageInterface
};

export type StyleImageMetadata = {
    pixelRatio: number,
    sdf: boolean,
    stretchX?: Array<[number, number]>,
    stretchY?: Array<[number, number]>,
    content?: [number, number, number, number]
};

export type StyleImage = StyleImageData & StyleImageMetadata;

export type StyleImageInterface = {
    width: number,
    height: number,
    data: Uint8Array | Uint8ClampedArray,
    render?: () => boolean,
    onAdd?: (map: Map, id: string) => void,
    onRemove?: () => void
};

export function renderStyleImage(image: StyleImage) {
    const {userImage} = image;
    if (userImage && userImage.render) {
        const updated = userImage.render();
        if (updated) {
            image.data.replace(new Uint8Array(userImage.data.buffer));
            return true;
        }
    }
    return false;
}

/**
 * Interface for dynamically generated style images. This is a specification for
 * implementers to model: it is not an exported method or class.
 *
 * Images implementing this interface can be redrawn for every frame. They can be used to animate
 * icons and patterns or make them respond to user input. Style images can implement a
 * {@link StyleImageInterface#render} method. The method is called every frame and
 * can be used to update the image.
 *
 * @interface StyleImageInterface
 * @property {number} width Width in pixels.
 * @property {number} height Height in pixels.
 * @property {Uint8Array | Uint8ClampedArray} data Byte array representing the image. To ensure space for all four channels in an RGBA color, size must be width × height × 4.
 *
 * @see [Example: Add an animated icon to the map.](https://docs.mapbox.com/mapbox-gl-js/example/add-image-animated/)
 *
 * @example
 * const flashingSquare = {
 *     width: 64,
 *     height: 64,
 *     data: new Uint8Array(64 * 64 * 4),
 *
 *     onAdd(map) {
 *         this.map = map;
 *     },
 *
 *     render() {
 *         // keep repainting while the icon is on the map
 *         this.map.triggerRepaint();
 *
 *         // alternate between black and white based on the time
 *         const value = Math.round(Date.now() / 1000) % 2 === 0  ? 255 : 0;
 *
 *         // check if image needs to be changed
 *         if (value !== this.previousValue) {
 *             this.previousValue = value;
 *
 *             const bytesPerPixel = 4;
 *             for (let x = 0; x < this.width; x++) {
 *                 for (let y = 0; y < this.height; y++) {
 *                     const offset = (y * this.width + x) * bytesPerPixel;
 *                     this.data[offset + 0] = value;
 *                     this.data[offset + 1] = value;
 *                     this.data[offset + 2] = value;
 *                     this.data[offset + 3] = 255;
 *                 }
 *             }
 *
 *             // return true to indicate that the image changed
 *             return true;
 *         }
 *     }
 * };
 *
 * map.addImage('flashing_square', flashingSquare);
 */

/**
 * This method is called once before every frame where the icon will be used.
 * The method can optionally update the image's `data` member with a new image.
 *
 * If the method updates the image it must return `true` to commit the change.
 * If the method returns `false` or nothing the image is assumed to not have changed.
 *
 * If updates are infrequent it maybe easier to use {@link Map#updateImage} to update
 * the image instead of implementing this method.
 *
 * @function
 * @memberof StyleImageInterface
 * @instance
 * @name render
 * @return {boolean} `true` if this method updated the image. `false` if the image was not changed.
 */

/**
 * Optional method called when the layer has been added to the Map with {@link Map#addImage}.
 *
 * @function
 * @memberof StyleImageInterface
 * @instance
 * @name onAdd
 * @param {Map} map The Map this custom layer was just added to.
 */

/**
 * Optional method called when the icon is removed from the map with {@link Map#removeImage}.
 * This gives the image a chance to clean up resources and event listeners.
 *
 * @function
 * @memberof StyleImageInterface
 * @instance
 * @name onRemove
 */
