import { test } from 'mapbox-gl-js-test';
import assert from 'assert';
import VideoSource from '../../../src/source/video_source';
import { Evented } from '../../../src/util/evented';
import Transform from '../../../src/geo/transform';
import { extend } from '../../../src/util/util';
import browser from '../../../src/util/browser';
import window from '../../../src/util/window';

function createSource(options) {

    const c = options && options.video || window.document.createElement('video');

    options = extend({coordinates: [[0, 0], [1, 0], [1, 1], [0, 1]]}, options);

    const source = new VideoSource('id', options, { send() {} }, options.eventedParent);

    source.video = c;
    return source;
}

class StubMap extends Evented {
    constructor() {
        super();
        this.transform = new Transform();
        this._requestManager = {
            transformRequest: (urls) => {
                return { urls };
            }
        };
    }
}

test('VideoSource', (t) => {
    window.useFakeXMLHttpRequest();
    // stub this manually because sinon does not stub non-existent methods
    assert(!window.URL.createObjectURL);
    window.URL.createObjectURL = () => 'blob:';
    t.tearDown(() => delete window.URL.createObjectURL);

    // fake the image request (sinon doesn't allow non-string data for
    // server.respondWith, so we do so manually)
    const requests = [];
    window.XMLHttpRequest.onCreate = req => { requests.push(req); };
    const respond = () => {
        const req = requests.shift();
        req.setStatus(200);
        req.response = new ArrayBuffer(1);
        req.onload();
        video.canplay();
    };
    // t.stub(browser, 'getImageData').callsFake(() => new ArrayBuffer(1));

    t.test('constructor', (t) => {

        const source = createSource({
            type: 'video', 
            urls : [ "cropped.mp4", "https://static-assets.mapbox.com/mapbox-gl-js/drone.webm" ],
            coordinates: [
                [-76.54, 39.18],
                [-76.52, 39.18],
                [-76.52, 39.17],
                [-76.54, 39.17]
            ] 
        });        

        t.equal(source.minzoom, 0);
        t.equal(source.maxzoom, 22);
        t.equal(source.tileSize, 512);
        t.end();
    });



    t.test('sets coordinates', (t) => {
        
        const source = createSource({
            type: 'video', 
            urls : [ "cropped.mp4", "https://static-assets.mapbox.com/mapbox-gl-js/drone.webm" ],
            coordinates: [
                [-76.54, 39.18],
                [-76.52, 39.18],
                [-76.52, 39.17],
                [-76.54, 39.17]
            ] 
        }); 

        const newCoordinates = [[0, 0], [-1, 0], [-1, -1], [0, -1]];
        source.setCoordinates(newCoordinates);
        var serialized = source.serialize();

        t.deepEqual(serialized.coordinates, newCoordinates);
        t.end();

    });

    //test video retrieval by first supplying the video element directly
    t.test('gets video', (t) => {
        
        var el = window.document.createElement('video');
        const source = createSource({
            type: 'video', 
            video: el,
            urls : [ "cropped.mp4", "https://static-assets.mapbox.com/mapbox-gl-js/drone.webm" ],
            coordinates: [
                [-76.54, 39.18],
                [-76.52, 39.18],
                [-76.52, 39.17],
                [-76.54, 39.17]
            ] 
        }); 

        t.equal(source.getVideo(), el)
        t.end();
    });


    // t.test('seek video', (t) => {
        
    //     var el = window.document.createElement('video');
    //     const source = createSource({
    //         type: 'video', 
    //         video: el,
    //         urls : [ "cropped.mp4", "https://static-assets.mapbox.com/mapbox-gl-js/drone.webm" ],
    //         coordinates: [
    //             [-76.54, 39.18],
    //             [-76.52, 39.18],
    //             [-76.52, 39.17],
    //             [-76.54, 39.17]
    //         ] 
    //     }); 
    //     var stub = new StubMap();
    //     // console.log(stub)
    //     source.onAdd(stub)
    //     // t.equal(source.getVideo(), el)
    //     t.end();
    // });

    // t.test('video plays', (t) => {
        
    //     var el = window.document.createElement('video');

    //     const source = createSource({
    //         type: 'video', 
    //         video: el,
    //         urls : [ "cropped.mp4", "https://static-assets.mapbox.com/mapbox-gl-js/drone.webm" ],
    //         coordinates: [
    //             [-76.54, 39.18],
    //             [-76.52, 39.18],
    //             [-76.52, 39.17],
    //             [-76.54, 39.17]
    //         ] 
    //     }); 

    //     source.play();
    //     t.equal(source.getVideo().paused, false)
    //     t.end();
    // });
    t.end();
});
