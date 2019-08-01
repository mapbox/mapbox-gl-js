/* eslint-disable import/no-commonjs */
const path = require('path');
const st = require('st');
const {createServer} = require('http');
const localizeURLs = require('./localize-urls');

module.exports = function () {
    const port = 2900;
    const integrationMount = st({path: path.join(__dirname, '..')});
    const mapboxGLStylesMount = st({path: path.dirname(require.resolve('mapbox-gl-styles')), url: 'mapbox-gl-styles'});
    const mapboxMVTFixturesMount = st({path: path.dirname(require.resolve('@mapbox/mvt-fixtures')), url: 'mvt-fixtures'});
    const server = createServer((req, res) => {
        return mapboxMVTFixturesMount(req, res, () => {
            return mapboxGLStylesMount(req, res, () => {
                return integrationMount(req, res);
            });
        });
    });

    return {
        listen(callback) {
            server.listen(port, callback);
        },

        close(callback) {
            server.close(callback);
        },

        localizeURLs(style) {
            return localizeURLs(style, port);
        }
    };
};
