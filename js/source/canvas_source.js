'use strict';

const ImageSource = require('./image_source');

/**         // TODO update documentation
 * A data source containing video.
 * (See the [Style Specification](https://www.mapbox.com/mapbox-gl-style-spec/#sources-video) for detailed documentation of options.)
 * @interface VideoSource
 * @example
 * // add to map
 * map.addSource('some id', {
 *    type: 'video',
 *    url: [
 *        'https://www.mapbox.com/blog/assets/baltimore-smoke.mp4',
 *        'https://www.mapbox.com/blog/assets/baltimore-smoke.webm'
 *    ],
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
 * @see [Add a video](https://www.mapbox.com/mapbox-gl-js/example/video-on-a-map/)
 */
class CanvasSource extends ImageSource {
    constructor(id, options, dispatcher, eventedParent) {
        super(id, options, dispatcher, eventedParent);
    }

    _load(options) {
        this.canvas = window.document.getElementById(options.canvas);
        this.animate = options.hasOwnProperty('animate') ? options.animate : true;
        this.dimensions = options.dimensions;

        // detect context type
        if (this.canvas.getContext('2d')) {
            this.contextType = '2d';
        } else if (this.canvas.getContext('webgl')) {
            this.contextType = 'webgl';
        }

        this._rereadCanvas();

        this.play = function() {
            let loopID = this.map.style.animationLoop.set(Infinity);
            this.map._rerender();
        }

        this._finishLoading();
    }

    _rereadCanvas() {
        if (!this.animate && this.canvasData) return;
        switch (this.contextType) {
            case '2d':
                this.canvasData = this.canvas.getContext('2d')
                    .getImageData(
                        this.dimensions[0],
                        this.dimensions[1],
                        this.dimensions[2],
                        this.dimensions[3]);
                return;

            case 'webgl':
                if (this.canvasBuffer) delete this.canvasBuffer;

                let w = this.dimensions[2] - this.dimensions[0],
                    h = this.dimensions[3] - this.dimensions[1];

                this.canvasBuffer = new Uint8Array(w * h * 4);

                const ctx = this.canvas.getContext('webgl');

                ctx.readPixels(
                    this.dimensions[0],
                    this.dimensions[1],
                    this.dimensions[2],
                    this.dimensions[3],
                    ctx.RGBA, ctx.UNSIGNED_BYTE, this.canvasBuffer);
                this.canvasData = new window.ImageData(new Uint8ClampedArray(this.canvasBuffer), w, h);
                return;
        }

    }

    /**
     * Returns the HTML `canvas` element.
     *
     * @returns {HTMLCanvasElement} The HTML `canvas` element.
     */
    getCanvas() {
        return this.canvas;
    }

    onAdd(map) {
        if (this.map) return;
        this.map = map;
        if (this.canvasData) {
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
        // console.log(this.canvasData.data.filter(d => d !== 0).length);
    // setCoordinates inherited from ImageSource

    prepare() {
        if (!this.tile) return; // not enough data for current position

        this._rereadCanvas();
        this._prepareImage(this.map.painter.gl, this.canvasData);
    }

    serialize() {
        return {
            type: 'canvas',
            canvas: this.canvas,
            coordinates: this.coordinates
        };
    }
}

module.exports = CanvasSource;
