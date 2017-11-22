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
 *    ]
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
    width: number;
    height: number;
    canvasData: ?ImageData;
    play: () => void;
    pause: () => void;
    _playing: boolean;

    constructor(id: string, options: CanvasSourceSpecification, dispatcher: Dispatcher, eventedParent: Evented) {
        super(id, options, dispatcher, eventedParent);
        this.options = options;
        this.animate = options.animate !== undefined ? options.animate : true;
    }

    /**
     * Enables animation. The image will be copied from the canvas to the map on each frame.
     * @method play
     * @instance
     * @memberof CanvasSource
     */

    /**
     * Disables animation. The map will display a static copy of the canvas image.
     * @method pause
     * @instance
     * @memberof CanvasSource
     */

    load() {
        this.canvas = this.canvas || window.document.getElementById(this.options.canvas);
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        if (this._hasInvalidDimensions()) return this.fire('error', new Error('Canvas dimensions cannot be less than or equal to zero.'));

        this.play = function() {
            this._playing = true;
            this.map._rerender();
        };

        this.pause = function() {
            this._playing = false;
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
     * @instance
     * @memberof CanvasSource
     * @param {Array<Array<number>>} coordinates Four geographical coordinates,
     *   represented as arrays of longitude and latitude numbers, which define the corners of the canvas.
     *   The coordinates start at the top left corner of the canvas and proceed in clockwise order.
     *   They do not have to represent a rectangle.
     * @returns {CanvasSource} this
     */
    // setCoordinates inherited from ImageSource

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

        this._prepareImage(this.map.painter.gl, this.canvas, resize);
    }

    serialize(): Object {
        return {
            type: 'canvas',
            canvas: this.canvas,
            coordinates: this.coordinates
        };
    }

    hasTransition() {
        return this._playing;
    }

    _hasInvalidDimensions() {
        for (const x of [this.canvas.width, this.canvas.height]) {
            if (isNaN(x) || x <= 0) return true;
        }
        return false;
    }
}

module.exports = CanvasSource;
