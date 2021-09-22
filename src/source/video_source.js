// @flow

import {getVideo, ResourceType} from '../util/ajax.js';

import ImageSource from './image_source.js';
import rasterBoundsAttributes from '../data/raster_bounds_attributes.js';
import SegmentVector from '../data/segment.js';
import Texture from '../render/texture.js';
import {ErrorEvent} from '../util/evented.js';
import ValidationError from '../style-spec/error/validation_error.js';

import type Map from '../ui/map.js';
import type Dispatcher from '../util/dispatcher.js';
import type {Evented} from '../util/evented.js';
import type {VideoSourceSpecification} from '../style-spec/types.js';

/**
 * A data source containing video.
 * See the [Style Specification](https://www.mapbox.com/mapbox-gl-style-spec/#sources-video) for detailed documentation of options.
 *
 * @example
 * // add to map
 * map.addSource('some id', {
 *     type: 'video',
 *     url: [
 *         'https://www.mapbox.com/blog/assets/baltimore-smoke.mp4',
 *         'https://www.mapbox.com/blog/assets/baltimore-smoke.webm'
 *     ],
 *     coordinates: [
 *         [-76.54, 39.18],
 *         [-76.52, 39.18],
 *         [-76.52, 39.17],
 *         [-76.54, 39.17]
 *     ]
 * });
 *
 * // update
 * const mySource = map.getSource('some id');
 * mySource.setCoordinates([
 *     [-76.54335737228394, 39.18579907229748],
 *     [-76.52803659439087, 39.1838364847587],
 *     [-76.5295386314392, 39.17683392507606],
 *     [-76.54520273208618, 39.17876344106642]
 * ]);
 *
 * map.removeSource('some id');  // remove
 * @see [Example: Add a video](https://www.mapbox.com/mapbox-gl-js/example/video-on-a-map/)
 */
class VideoSource extends ImageSource {
    options: VideoSourceSpecification;
    urls: Array<string>;
    video: HTMLVideoElement;
    roundZoom: boolean;

    /**
     * @private
     */
    constructor(id: string, options: VideoSourceSpecification, dispatcher: Dispatcher, eventedParent: Evented) {
        super(id, options, dispatcher, eventedParent);
        this.roundZoom = true;
        this.type = 'video';
        this.options = options;
    }

    load() {
        this._loaded = false;
        const options = this.options;

        this.urls = [];
        for (const url of options.urls) {
            this.urls.push(this.map._requestManager.transformRequest(url, ResourceType.Source).url);
        }

        getVideo(this.urls, (err, video) => {
            this._loaded = true;
            if (err) {
                this.fire(new ErrorEvent(err));
            } else if (video) {
                this.video = video;
                this.video.loop = true;

                // Start repainting when video starts playing. hasTransition() will then return
                // true to trigger additional frames as long as the videos continues playing.
                this.video.addEventListener('playing', () => {
                    this.map.triggerRepaint();
                });

                if (this.map) {
                    this.video.play();
                }

                this._finishLoading();
            }
        });
    }

    /**
     * Pauses the video.
     *
     * @example
     * // Assuming a video source identified by video_source_id was added to the map
     * const videoSource = map.getSource('video_source_id');
     *
     * // Pauses the video
     * videoSource.pause();
     */
    pause() {
        if (this.video) {
            this.video.pause();
        }
    }

    /**
     * Plays the video.
     *
     * @example
     * // Assuming a video source identified by video_source_id was added to the map
     * const videoSource = map.getSource('video_source_id');
     *
     * // Starts the video
     * videoSource.play();
     */
    play() {
        if (this.video) {
            this.video.play();
        }
    }

    /**
     * Sets playback to a timestamp, in seconds.
     * @private
     */
    seek(seconds: number) {
        if (this.video) {
            const seekableRange = this.video.seekable;
            if (seconds < seekableRange.start(0) || seconds > seekableRange.end(0)) {
                this.fire(new ErrorEvent(new ValidationError(`sources.${this.id}`, null, `Playback for this video can be set only between the ${seekableRange.start(0)} and ${seekableRange.end(0)}-second mark.`)));
            } else this.video.currentTime = seconds;
        }
    }

    /**
     * Returns the HTML `video` element.
     *
     * @returns {HTMLVideoElement} The HTML `video` element.
     * @example
     * // Assuming a video source identified by video_source_id was added to the map
     * const videoSource = map.getSource('video_source_id');
     *
     * videoSource.getVideo(); // <video crossorigin="Anonymous" loop="">...</video>
     */
    getVideo() {
        return this.video;
    }

    onAdd(map: Map) {
        if (this.map) return;
        this.map = map;
        this.load();
        if (this.video) {
            this.video.play();
            this.setCoordinates(this.coordinates);
        }
    }

    /**
     * Sets the video's coordinates and re-renders the map.
     *
     * @method setCoordinates
     * @instance
     * @memberof VideoSource
     * @returns {VideoSource} Returns itself to allow for method chaining.
     * @example
     * // Add a video source to the map to map
     * map.addSource('video_source_id', {
     *     type: 'video',
     *     url: [
     *         'https://www.mapbox.com/blog/assets/baltimore-smoke.mp4',
     *         'https://www.mapbox.com/blog/assets/baltimore-smoke.webm'
     *     ],
     *     coordinates: [
     *         [-76.54, 39.18],
     *         [-76.52, 39.18],
     *         [-76.52, 39.17],
     *         [-76.54, 39.17]
     *     ]
     * });
     *
     * // Then update the video source coordinates by new coordinates
     * const videoSource = map.getSource('video_source_id');
     * videoSource.setCoordinates([
     *     [-76.5433, 39.1857],
     *     [-76.5280, 39.1838],
     *     [-76.5295, 39.1768],
     *     [-76.5452, 39.1787]
     * ]);
     */
    // setCoordinates inherited from ImageSource

    prepare() {
        if (Object.keys(this.tiles).length === 0 || this.video.readyState < 2) {
            return; // not enough data for current position
        }

        const context = this.map.painter.context;
        const gl = context.gl;

        if (!this.boundsBuffer) {
            this.boundsBuffer = context.createVertexBuffer(this._boundsArray, rasterBoundsAttributes.members);
        }

        if (!this.boundsSegments) {
            this.boundsSegments = SegmentVector.simpleSegment(0, 0, 4, 2);
        }

        if (!this.texture) {
            this.texture = new Texture(context, this.video, gl.RGBA);
            this.texture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
        } else if (!this.video.paused) {
            this.texture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.video);
        }

        for (const w in this.tiles) {
            const tile = this.tiles[w];
            if (tile.state !== 'loaded') {
                tile.state = 'loaded';
                tile.texture = this.texture;
            }
        }
    }

    serialize() {
        return {
            type: 'video',
            urls: this.urls,
            coordinates: this.coordinates
        };
    }

    hasTransition() {
        return this.video && !this.video.paused;
    }
}

export default VideoSource;
