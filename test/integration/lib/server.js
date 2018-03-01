'use strict';

const st = require('st');
const http = require('http');
const path = require('path');

module.exports = function () {
    const integrationPath = st({path: path.join(__dirname, '..'), url: '/'});
    const nodeModulesPath = st({path: path.join(__dirname, '../../../node_modules'), url: '/node_modules'});
    const server = http.createServer((req, res) => {
        return nodeModulesPath(req, res, () => { return integrationPath(req, res); });
    });

    return {
        listen: function (callback) {
            server.listen(2900, callback);
        },

        close: function (callback) {
            server.close(callback);
        },
    };
};
