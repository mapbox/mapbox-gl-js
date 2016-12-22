'use strict';

const ImageSource = require('./image_source');
const window = require('../util/window');

/**
 * A data source containing content copied from an HTML canvas.
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
 *    dimensions: [0, 0, 400, 400]
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
 * // update
 * var mySource = map.getSource('some id');
 * mySource.setDimensions([0, 0, 600, 600]);
 *
 * map.removeSource('some id');  // remove
 * @see [Add a canvas (TODO: this page does not yet exist)](https://www.mapbox.com/mapbox-gl-js/example/canvas-on-a-map/)
 */
class CanvasSource extends ImageSource {

    constructor(id, options, dispatcher, eventedParent) {
        super(id, options, dispatcher, eventedParent);
        this.options = options;
        this.animate = options.hasOwnProperty('animate') ? options.animate : true;
        this.dimensions = options.dimensions;
        this.resize = false;
    }

    load() {
        this._canvas = this._canvas || window.document.getElementById(this.options.canvas);

        // detect context type
        if (this._canvas.getContext('2d')) {
            this.contextType = '2d';
            this.canvas = this._canvas;
        } else if (this._canvas.getContext('webgl')) {
            this.contextType = 'webgl';
        }

        this._rereadCanvas();

        this.play = function() {
            this.map.style.animationLoop.set(Infinity);
            this.map._rerender();
        };

        this._finishLoading();
    }

    _rereadCanvas() {
        if (!this.animate && this.canvas) return;

        if (this.contextType === 'webgl') {
            if (this.canvasBuffer) delete this.canvasBuffer;

            const w = this.dimensions[2] - this.dimensions[0],
                h = this.dimensions[3] - this.dimensions[1];

            this.canvasBuffer = new Uint8Array(w * h * 4);

            const ctx = this.canvas.getContext('webgl');

            ctx.readPixels(
                this.dimensions[0],
                this.dimensions[1],
                this.dimensions[2],
                this.dimensions[3],
                ctx.RGBA, ctx.UNSIGNED_BYTE, this.canvasBuffer);
            this.canvas = new window.ImageData(new Uint8ClampedArray(this.canvasBuffer), w, h);
        }

    }

    /**
     * Returns the HTML `canvas` element.
     *
     * @returns {HTMLCanvasElement} The HTML `canvas` element.
     */
    getCanvas() {
        return this._canvas;
    }

    onAdd(map) {
        if (this.map) return;
        this.map = map;
        this.load();
        if (this.canvas) {
            if (this.animate) this.play();
            this.setCoordinates(this.coordinates);
        }
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

    prepare() {
        if (!this.tile) return; // not enough data for current position

        this._rereadCanvas();
        this._prepareImage(this.map.painter.gl, this.canvas, this.resize);
        this.resize = false;
    }

    serialize() {
        return {
            type: 'canvas',
            canvas: this._canvas,
            coordinates: this.coordinates
        };
    }

    /**
     * Sets new dimensions to read the canvas and re-renders the map.
     * @method setDimensions
     * @param {Array<Array<number>>} dimensions Four pixel dimensions,
     *   represented as an array of [x (first horizontal pixel), y (first
     *   vertical pixel), width, height].
     */
    setDimensions(dimensions) {
        this.dimensions = dimensions;
        this._rereadCanvas();
        this.resize = true;
    }
}

module.exports = CanvasSource;
