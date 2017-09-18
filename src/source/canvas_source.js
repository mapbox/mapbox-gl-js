// @flow

const ImageSource = require('./image_source');
const window = require('../util/window');

import type Map from '../ui/map';
import type Dispatcher from '../util/dispatcher';
import type Evented from '../util/evented';

/**
 * A data source containing the contents of an HTML canvas.
 * (See the [Style Specification](https://www.mapbox.com/mapbox-gl-style-spec/#sources-canvas) for detailed documentation of options.)
 * @interface CanvasSource
 * @example
 * // add to map
 * map.addSource('some id', {
 *    type: 'canvas',
 *    canvas: 'idOfMyHTMLCanvas',
 *    animate: true,
 *    coordinates: [
 *        [-76.54, 39.18],
 *        [-76.52, 39.18],
 *        [-76.52, 39.17],
 *        [-76.54, 39.17]
 *    ],
 *    contextType: '2d'
 * });
 *
 * // update
 * var mySource = map.getSource('some id');
 * mySource.setCoordinates([
 *     [-76.54335737228394, 39.18579907229748],
 *     [-76.52803659439087, 39.1838364847587],
 *     [-76.5295386314392, 39.17683392507606],
 *     [-76.54520273208618, 39.17876344106642]
 * ]);
 *
 * map.removeSource('some id');  // remove
 */
class CanvasSource extends ImageSource {
    options: CanvasSourceSpecification;
    animate: boolean;
    canvas: HTMLCanvasElement;
    context: (CanvasRenderingContext2D | WebGLRenderingContext);
    secondaryContext: ?CanvasRenderingContext2D;
    width: number;
    height: number;
    canvasData: ?ImageData;
    play: () => void;
    pause: () => void;

    constructor(id: string, options: CanvasSourceSpecification, dispatcher: Dispatcher, eventedParent: Evented) {
        super(id, options, dispatcher, eventedParent);
        this.options = options;
        this.animate = options.animate !== undefined ? options.animate : true;
    }

    load() {
        this.canvas = this.canvas || window.document.getElementById(this.options.canvas);
        const context = this.canvas.getContext(this.options.contextType);
        if (!context) return this.fire('error', new Error('Canvas context not found.'));
        this.context = context;
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        if (this._hasInvalidDimensions()) return this.fire('error', new Error('Canvas dimensions cannot be less than or equal to zero.'));

        let loopID;

        this.play = function() {
            if (loopID === undefined) {
                loopID = this.map.style.animationLoop.set(Infinity);
                this.map._rerender();
            }
        };

        this.pause = function() {
            if (loopID !== undefined) {
                loopID = this.map.style.animationLoop.cancel(loopID);
            }
        };

        this._finishLoading();
    }

    /**
     * Returns the HTML `canvas` element.
     *
     * @returns {HTMLCanvasElement} The HTML `canvas` element.
     */
    getCanvas() {
        return this.canvas;
    }

    onAdd(map: Map) {
        this.map = map;
        this.load();
        if (this.canvas) {
            if (this.animate) this.play();
        }
    }

    onRemove() {
        this.pause();
    }

    /**
     * Sets the canvas's coordinates and re-renders the map.
     *
     * @method setCoordinates
     * @param {Array<Array<number>>} coordinates Four geographical coordinates,
     *   represented as arrays of longitude and latitude numbers, which define the corners of the canvas.
     *   The coordinates start at the top left corner of the canvas and proceed in clockwise order.
     *   They do not have to represent a rectangle.
     * @returns {CanvasSource} this
     */
    // setCoordinates inherited from ImageSource

    readCanvas(resize: boolean) {
        // We *should* be able to use a pure HTMLCanvasElement in
        // texImage2D/texSubImage2D (in ImageSource#_prepareImage), but for
        // some reason this breaks the map on certain GPUs (see #4262).

        if (this.context instanceof CanvasRenderingContext2D) {
            this.canvasData = this.context.getImageData(0, 0, this.width, this.height);
        } else if (this.context instanceof WebGLRenderingContext) {
            const gl = this.context;
            const data = new Uint8Array(this.width * this.height * 4);
            gl.readPixels(0, 0, this.width, this.height, gl.RGBA, gl.UNSIGNED_BYTE, data);

            if (!this.secondaryContext) this.secondaryContext = window.document.createElement('canvas').getContext('2d');
            if (!this.canvasData || resize) {
                this.canvasData = this.secondaryContext.createImageData(this.width, this.height);
            }

            // WebGL reads pixels bottom to top, but for our ImageData object we need top to bottom: flip here
            for (let i = this.height - 1, j = 0; i >= 0; i--, j++) {
                this.canvasData.data.set(data.subarray(i * this.width * 4, (i + 1) * this.width * 4), j * this.width * 4);
            }
        }
    }

    prepare() {
        let resize = false;
        if (this.canvas.width !== this.width) {
            this.width = this.canvas.width;
            resize = true;
        }
        if (this.canvas.height !== this.height) {
            this.height = this.canvas.height;
            resize = true;
        }
        if (this._hasInvalidDimensions()) return;

        if (Object.keys(this.tiles).length === 0) return; // not enough data for current position

        const reread = this.animate || !this.canvasData || resize;
        if (reread) {
            this.readCanvas(resize);
        }

        if (!this.canvasData) {
            this.fire('error', new Error('Could not read canvas data.'));
            return;
        }
        this._prepareImage(this.map.painter.gl, this.canvasData, resize);
    }

    serialize(): Object {
        return {
            type: 'canvas',
            canvas: this.canvas,
            coordinates: this.coordinates
        };
    }

    _hasInvalidDimensions() {
        for (const x of [this.canvas.width, this.canvas.height]) {
            if (isNaN(x) || x <= 0) return true;
        }
        return false;
    }
}

module.exports = CanvasSource;
