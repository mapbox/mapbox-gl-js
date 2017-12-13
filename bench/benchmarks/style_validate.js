
const Benchmark = require('../lib/benchmark');
const accessToken = require('../lib/access_token');
const validateStyle = require('../../src/style-spec/validate_style.min');

module.exports = class StyleValidate extends Benchmark {
    setup() {
        return fetch(`https://api.mapbox.com/styles/v1/mapbox/streets-v9?access_token=${accessToken}`)
            .then(response => response.json())
            .then(json => { this.json = json; });
    }

    bench() {
        validateStyle(this.json);
    }
};
