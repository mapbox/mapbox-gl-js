/* eslint-disable import/no-commonjs */
const path = require('path');
const fs = require('fs');
const colors = require('chalk');

module.exports = function localizeURLs(style) {
    localizeStyleURLs(style);
    if (style.metadata && style.metadata.test && style.metadata.test.operations) {
        style.metadata.test.operations.forEach((op) => {
            if (op[0] === 'addSource') {
                localizeSourceURLs(op[2]);
            } else if (op[0] === 'setStyle') {
                if (typeof op[1] === 'object') {
                    localizeStyleURLs(op[1]);
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

                localizeStyleURLs(styleJSON);

                op[1] = styleJSON;
                op[2] = { diff: false };
            }
        });
    }
};

function localizeURL(url) {
    return url.replace(/^local:\/\//, 'http://localhost:7357/');
}

function localizeMapboxSpriteURL(url) {
    return url.replace(/^mapbox:\/\//, 'http://localhost:7357/');
}

function localizeMapboxFontsURL(url) {
    return url.replace(/^mapbox:\/\/fonts/, 'http://localhost:7357/glyphs');
}

function localizeMapboxTilesURL(url) {
    return url.replace(/^mapbox:\/\//, 'http://localhost:7357/tiles/');
}

function localizeMapboxTilesetURL(url) {
    return url.replace(/^mapbox:\/\//, 'http://localhost:7357/tilesets/');
}

function localizeSourceURLs(source) {
    for (const tile in source.tiles) {
        source.tiles[tile] = localizeMapboxTilesURL(source.tiles[tile]);
        source.tiles[tile] = localizeURL(source.tiles[tile]);
    }

    if (source.urls) {
        source.urls = source.urls.map(localizeMapboxTilesetURL);
        source.urls = source.urls.map(localizeURL);
    }

    if (source.url) {
        source.url = localizeMapboxTilesetURL(source.url);
        source.url = localizeURL(source.url);
    }

    if (source.data && typeof source.data == 'string') {
        source.data = localizeURL(source.data);
    }
}

function localizeStyleURLs (style) {
    for (const source in style.sources) {
        localizeSourceURLs(style.sources[source]);
    }

    if (style.sprite) {
        style.sprite = localizeMapboxSpriteURL(style.sprite);
        style.sprite = localizeURL(style.sprite);
    }

    if (style.glyphs) {
        style.glyphs = localizeMapboxFontsURL(style.glyphs);
        style.glyphs = localizeURL(style.glyphs);
    }
}
