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

    constructor(id: string, options: CanvasSourceSpecification, dispatcher: Dispatcher, eventedParent: Evented) {
        super(id, options, dispatcher, eventedParent);
        this.options = options;
        this.animate = options.animate !== undefined ? options.animate : true;
    }

    load() {
        this.canvas = this.canvas || window.document.getElementById(this.options.canvas);
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

    prepare() {
        console.log('prepare');
        if (this._hasInvalidDimensions()) return;

        if (Object.keys(this.tiles).length === 0) return; // not enough data for current position

        this._prepareImage(this.map.painter.gl, this.canvas, true);
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
