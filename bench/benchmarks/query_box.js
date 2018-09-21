// @flow

import Benchmark from '../lib/benchmark';
import createMap from '../lib/create_map';
import type Map from '../../src/ui/map';

const width = 1024;
const height = 768;

export default class QueryBox extends Benchmark {
    style: string;
    locations: Array<Object>;
    maps: Array<Map>;

    constructor(style: string, locations: Array<Object>) {
        super();
        this.style = style;
        this.locations = locations;
    }

    setup(): Promise<void> {
        return Promise.all(this.locations.map(location => {
            return createMap({
                zoom: location.zoom,
                width,
                height,
                center: location.center,
                style: this.style
            });
        }))
            .then(maps => {
                this.maps = maps;
            });
    }

    bench() {
        for (const map of this.maps) {
            map.queryRenderedFeatures({});
        }
    }

    teardown() {
        for (const map of this.maps) {
            map.remove();
        }
    }
}
