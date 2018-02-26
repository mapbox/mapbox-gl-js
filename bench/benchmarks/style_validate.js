
import Benchmark from '../lib/benchmark';
import accessToken from '../lib/access_token';
import validateStyle from '../../src/style-spec/validate_style.min';

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
