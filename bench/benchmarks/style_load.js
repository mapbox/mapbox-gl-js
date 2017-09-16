'use strict';

const Benchmark = require('../lib/benchmark');
const accessToken = require('../lib/access_token');

const config = require('../../src/util/config');
const Style = require('../../src/style/style');
const Evented = require('../../src/util/evented');

config.ACCESS_TOKEN = accessToken;

module.exports = class StyleLoad extends Benchmark {
    setup() {
        return fetch(`https://api.mapbox.com/styles/v1/mapbox/streets-v9?access_token=${accessToken}`)
            .then(response => response.json())
            .then(json => this.json = json);
    }

    bench() {
        return new Promise((resolve, reject) => {
            new Style(this.json, new StubMap(), {})
                .on('error', reject)
                .on('style.load', resolve);
        });
    }
};

class StubMap extends Evented {
    _transformRequest(url) {
        return { url };
    }
}
