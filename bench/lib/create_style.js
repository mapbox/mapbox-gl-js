// @flow

import Style from '../../src/style/style';

import { Evented } from '../../src/util/evented';

class StubMap extends Evented {
    _transformRequest(url) {
        return { url };
    }
}

export default function (styleJSON: StyleSpecification): Promise<Style> {
    return new Promise((resolve, reject) => {
        const style = new Style((new StubMap(): any));
        style.loadJSON(styleJSON);

        style
            .on('style.load', () => resolve(style))
            .on('error', reject);
    });
};
