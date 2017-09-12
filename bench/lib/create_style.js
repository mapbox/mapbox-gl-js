// @flow

'use strict';

const Style = require('../../src/style/style');
const Evented = require('../../src/util/evented');

class StubMap extends Evented {
    _transformRequest(url) {
        return { url };
    }
}

module.exports = function (styleJSON: StyleSpecification): Promise<Style> {
    return new Promise((resolve, reject) => {
        const style = new Style(styleJSON, (new StubMap(): any), {});

        style
            .on('style.load', () => resolve(style))
            .on('error', reject);
    });
};
