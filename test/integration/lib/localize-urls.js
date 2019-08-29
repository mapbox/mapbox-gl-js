/* eslint-disable import/no-commonjs */
const path = require('path');
const fs = require('fs');
const colors = require('chalk');

module.exports = function localizeURLs(style, port) {
    localizeStyleURLs(style, port);
    if (style.metadata && style.metadata.test && style.metadata.test.operations) {
        style.metadata.test.operations.forEach((op) => {
            if (op[0] === 'addSource') {
                localizeSourceURLs(op[2], port);
            } else if (op[0] === 'setStyle') {
                if (typeof op[1] === 'object') {
                    localizeStyleURLs(op[1], port);
                    return;
                }

                let styleJSON;
                try {
                    const relativePath = op[1].replace(/^local:\/\//, '');
                    if (relativePath.startsWith('mapbox-gl-styles')) {
                        styleJSON = fs.readFileSync(path.join(path.dirname(require.resolve('mapbox-gl-styles')), '..', relativePath));
                    } else {
                        styleJSON = fs.readFileSync(path.join(__dirname, '..', relativePath));
                    }
                } catch (error) {
                    console.log(colors.blue(`* ${error}`));
                    return;
                }

                try {
                    styleJSON = JSON.parse(styleJSON);
                } catch (error) {
                    console.log(colors.blue(`* Error while parsing ${op[1]}: ${error}`));
                    return;
                }

                localizeStyleURLs(styleJSON, port);

                op[1] = styleJSON;
                op[2] = {diff: false};
            }
        });
    }
};

function localizeURL(url, port) {
    return url.replace(/^local:\/\//, `http://localhost:${port}/`);
}

function localizeMapboxSpriteURL(url, port) {
    return url.replace(/^mapbox:\/\//, `http://localhost:${port}/`);
}

function localizeMapboxFontsURL(url, port) {
    return url.replace(/^mapbox:\/\/fonts/, `http://localhost:${port}/glyphs`);
}

function localizeMapboxTilesURL(url, port) {
    return url.replace(/^mapbox:\/\//, `http://localhost:${port}/tiles/`);
}

function localizeMapboxTilesetURL(url, port) {
    return url.replace(/^mapbox:\/\//, `http://localhost:${port}/tilesets/`);
}

function localizeSourceURLs(source, port) {
    for (const tile in source.tiles) {
        source.tiles[tile] = localizeMapboxTilesURL(source.tiles[tile], port);
        source.tiles[tile] = localizeURL(source.tiles[tile], port);
    }

    if (source.urls) {
        source.urls = source.urls.map((url) => localizeMapboxTilesetURL(url, port));
        source.urls = source.urls.map((url) => localizeURL(url, port));
    }

    if (source.url) {
        source.url = localizeMapboxTilesetURL(source.url, port);
        source.url = localizeURL(source.url, port);
    }

    if (source.data && typeof source.data == 'string') {
        source.data = localizeURL(source.data, port);
    }
}

function localizeStyleURLs (style, port) {
    for (const source in style.sources) {
        localizeSourceURLs(style.sources[source], port);
    }

    if (style.sprite) {
        style.sprite = localizeMapboxSpriteURL(style.sprite, port);
        style.sprite = localizeURL(style.sprite, port);
    }

    if (style.glyphs) {
        style.glyphs = localizeMapboxFontsURL(style.glyphs, port);
        style.glyphs = localizeURL(style.glyphs, port);
    }
}
