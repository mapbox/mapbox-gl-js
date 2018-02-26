// @flow

import Map from '../../src/ui/map';

import browser from '../../src/util/browser';

module.exports = function (options: any): Promise<Map> {
    return new Promise((resolve, reject) => {
        const container = document.createElement('div');
        container.style.width = `${options.width || 512}px`;
        container.style.height = `${options.width || 512}px`;
        container.style.margin = '0 auto';
        container.style.display = 'none';
        (document.body: any).appendChild(container);

        const map = new Map(Object.assign({
            container,
            style: 'mapbox://styles/mapbox/streets-v9'
        }, options));

        map
            .on('load', () => {
                // Stub out `_rerender`; benchmarks need to be the only trigger of `_render` from here on out.
                map._rerender = () => {};

                // If there's a pending rerender, cancel it.
                if (map._frameId) {
                    browser.cancelFrame(map._frameId);
                    map._frameId = null;
                }

                resolve(map);
            })
            .on('error', (e) => reject(e.error))
            .on('remove', () => container.remove());
    });
};
