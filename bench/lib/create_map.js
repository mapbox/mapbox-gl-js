// @flow

'use strict';

const Map = require('../../src/ui/map');

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
            .on('load', () => resolve(map))
            .on('error', (e) => reject(e.error))
            .on('remove', () => container.remove());
    });
};
