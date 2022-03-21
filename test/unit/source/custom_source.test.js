import {test} from '../../util/test.js';
import CustomSource from '../../../src/source/custom_source.js';
import Transform from '../../../src/geo/transform.js';
import {Event, Evented} from '../../../src/util/evented.js';

function createSource(options = {}) {
    const source = new CustomSource('id', options, {send() {}}, options.eventedParent);
    return source;
}

class StubMap extends Evented {
    constructor() {
        super();
        this.style = {};
        this.transform = new Transform();
    }

    triggerRepaint() {
        this.fire(new Event('repaint'));
    }
}

test('CustomSource', (t) => {
    t.test('constructor', (t) => {
        const source = createSource();

        t.equal(source.scheme, 'xyz');
        t.equal(source.minzoom, 0);
        t.equal(source.maxzoom, 22);
        t.equal(source.tileSize, 512);
        t.equal(source.roundZoom, true);

        source.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
                t.end();
            }
        });

        source.onAdd(new StubMap());
    });

    t.test('fires "dataloading" event', (t) => {
        const map = new StubMap();
        const source = createSource({eventedParent: map});

        let dataloadingFired = false;
        map.on('dataloading', () => {
            dataloadingFired = true;
        });

        source.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
                if (!dataloadingFired) t.fail('no "dataloading" event was fired');
                t.end();
            }
        });

        source.onAdd(map);
    });

    t.end();
});
