'use strict';

const util = require('../util/util');
const ajax = require('../util/ajax');
const ImageSource = require('./image_source');

module.exports = VideoSource;

/**
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
function VideoSource(id, options, dispatcher, eventedParent) {
    this.id = id;
    this.urls = options.urls;
    this.coordinates = options.coordinates;

    this.setEventedParent(eventedParent);
    this.fire('dataloading', {dataType: 'source'});
    ajax.getVideo(options.urls, function(err, video) {
        if (err) return this.fire('error', {error: err});

        this.video = video;
        this.video.loop = true;

        let loopID;

        // start repainting when video starts playing
        this.video.addEventListener('playing', function() {
            loopID = this.map.style.animationLoop.set(Infinity);
            this.map._rerender();
        }.bind(this));

        // stop repainting when video stops
        this.video.addEventListener('pause', function() {
            this.map.style.animationLoop.cancel(loopID);
        }.bind(this));

        if (this.map) {
            this.video.play();
            this.setCoordinates(options.coordinates);
        }

        this.fire('data', {dataType: 'source'});
        this.fire('source.load');
    }.bind(this));
}

VideoSource.prototype = util.inherit(ImageSource, /** @lends VideoSource.prototype */{
    roundZoom: true,

    /**
     * Returns the HTML `video` element.
     *
     * @returns {HTMLVideoElement} The HTML `video` element.
     */
    getVideo: function() {
        return this.video;
    },

    onAdd: function(map) {
        if (this.map) return;
        this.map = map;
        if (this.video) {
            this.video.play();
            this.setCoordinates(this.coordinates);
        }
    },

    /**
     * Sets the video's coordinates and re-renders the map.
     *
     * @method setCoordinates
     * @param {Array<Array<number>>} coordinates Four geographical coordinates,
     *   represented as arrays of longitude and latitude numbers, which define the corners of the video.
     *   The coordinates start at the top left corner of the video and proceed in clockwise order.
     *   They do not have to represent a rectangle.
     * @returns {VideoSource} this
     */
    // setCoordiates inherited from ImageSource

    prepare: function() {
        if (!this.tile || this.video.readyState < 2) return; // not enough data for current position
        this._prepareImage(this.map.painter.gl, this.video);
    },

    serialize: function() {
        return {
            type: 'video',
            urls: this.urls,
            coordinates: this.coordinates
        };
    }
});
