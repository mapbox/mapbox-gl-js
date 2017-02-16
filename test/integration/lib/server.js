'use strict';

const st = require('st');
const http = require('http');
const path = require('path');

module.exports = function () {
    const server = http.createServer(st({path: path.join(__dirname, '..')}));

    function localURL(url) {
        return url.replace(/^local:\/\//, 'http://localhost:2900/');
    }

    return {
        listen: function (callback) {
            server.listen(2900, callback);
        },

        close: function (callback) {
            server.close(callback);
        },

        localizeURLs: function (style) {
            function localizeSourceURLs(source) {
                for (const l in source.tiles) {
                    source.tiles[l] = localURL(source.tiles[l]);
                }

                if (source.urls) {
                    source.urls = source.urls.map(localURL);
                }

                if (source.url) {
                    source.url = localURL(source.url);
                }

                if (source.data && typeof source.data == 'string') {
                    source.data = localURL(source.data);
                }
            }

            // localize the source, glyphs, and sprite URLs in the given style JSON
            function localizeStyleURLs (style) {
                for (const k in style.sources) {
                    localizeSourceURLs(style.sources[k]);
                }

                if (style.sprite) {
                    style.sprite = localURL(style.sprite);
                }

                if (style.glyphs) {
                    style.glyphs = localURL(style.glyphs);
                }
            }

            if (style.metadata && style.metadata.test && style.metadata.test.operations) {
                style.metadata.test.operations.forEach((op) => {
                    if (op[0] === 'addSource') {
                        localizeSourceURLs(op[2]);
                    } else if (op[0] === 'setStyle' && op[1]) {
                        localizeStyleURLs(op[1]);
                    }
                });
            }

            localizeStyleURLs(style);
        }
    };
};
