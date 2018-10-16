// @flow

import Map from '../../src/ui/map';

export default function (options: any): Promise<Map> {
    return new Promise((resolve, reject) => {
        const container = document.createElement('div');
        container.style.width = `${options.width || 512}px`;
        container.style.height = `${options.width || 512}px`;
        container.style.margin = '0 auto';
        container.style.display = 'none';
        (document.body: any).appendChild(container);

        const map = new Map(Object.assign({
            container,
            style: 'mapbox://styles/mapbox/streets-v10'
        }, options));

        map
            .on('load', () => {
                // Stub out `_rerender`; benchmarks need to be the only trigger of `_render` from here on out.
                map._rerender = () => {};

                // If there's a pending rerender, cancel it.
                if (map._frame) {
                    map._frame.cancel();
                    map._frame = null;
                }

                resolve(map);
            })
            .on('error', (e) => reject(e.error))
            .on('remove', () => container.remove());
    });
}
