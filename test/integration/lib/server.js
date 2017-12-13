'use strict';

const st = require('st');
const http = require('http');
const path = require('path');
const colors = require('colors/safe');
const fs = require('fs');

module.exports = function () {
    const server = http.createServer(st({path: path.join(__dirname, '..')}));

    function localURL(url) {
        return url.replace(/^local:\/\//, 'http://localhost:2900/');
    }

    function clearMapboxProtocol(url) {
        return url.replace(/^mapbox:\/\//, '');
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
                        if (typeof op[1] === 'string') {
                            let styleJSON;

                            try {
                                styleJSON = fs.readFileSync(path.join(__dirname, '..', op[1].replace(/^local:\/\//, '')));
                            } catch (err) {
                                console.log(colors.blue(`* ${err}`));
                                return;
                            }

                            try {
                                styleJSON = JSON.parse(styleJSON);
                            } catch (err) {
                                console.log(colors.blue(`* Error while parsing ${op[1]}: ${err}`));
                                return;
                            }

                            // sources
                            for (const k in styleJSON.sources) {
                                const sourceName = clearMapboxProtocol(styleJSON.sources[k].url);
                                if (styleJSON.sources[k].type === 'vector') {
                                    styleJSON.sources[k].tiles = [ `http\:\/\/localhost:2900/tiles/${sourceName}/{z}-{x}-{y}.mvt` ];
                                } else if (styleJSON.sources[k].type === 'raster') {
                                    styleJSON.sources[k].tiles = [ `http\:\/\/localhost:2900/tiles/${sourceName}/{z}-{x}-{y}.png` ];
                                }
                                delete styleJSON.sources[k].url;
                            }

                            // sprite
                            {
                                const spriteName = clearMapboxProtocol(styleJSON.sprite);
                                styleJSON.sprite = `http\:\/\/localhost:2900/${spriteName}`;
                            }

                            // glyphs
                            {
                                const glyphsName = clearMapboxProtocol(styleJSON.glyphs).replace(/^fonts/, 'glyphs');
                                styleJSON.glyphs = `http\:\/\/localhost:2900/${glyphsName}`;
                            }

                            op[1] = styleJSON;
                            op[2] = { diff: false };
                        } else {
                            localizeStyleURLs(op[1]);
                        }
                    }
                });
            }

            localizeStyleURLs(style);
        }
    };
};
