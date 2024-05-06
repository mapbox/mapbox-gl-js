import {vi, describe, test, beforeAll, afterAll, doneAsync} from '../../util/vitest.js';

const rules = `
default-src 'none';
img-src data: blob:;
worker-src blob:;
style-src https://api.mapbox.com/mapbox-gl-js/ 'unsafe-inline';
script-src https://api.mapbox.com/mapbox-gl-js/ 'unsafe-inline';
connect-src
    https://api.mapbox.com/v4/
    https://api.mapbox.com/raster/v1/
    https://api.mapbox.com/rasterarrays/v1/
    https://api.mapbox.com/styles/v1/mapbox/
    https://api.mapbox.com/fonts/v1/mapbox/
    https://api.mapbox.com/models/v1/mapbox/
    https://api.mapbox.com/map-sessions/v1
    https://events.mapbox.com/
`;

const getStrictRules = (href) => `
default-src 'none';
img-src data: blob:;
worker-src ${href}dist/mapbox-gl-csp-worker.js;
style-src https://api.mapbox.com/mapbox-gl-js/ 'unsafe-inline';
script-src https://api.mapbox.com/mapbox-gl-js/ 'unsafe-inline';
connect-src
    https://api.mapbox.com/v4/
    https://api.mapbox.com/raster/v1/
    https://api.mapbox.com/rasterarrays/v1/
    https://api.mapbox.com/styles/v1/mapbox/
    https://api.mapbox.com/fonts/v1/mapbox/
    https://api.mapbox.com/models/v1/mapbox/
    https://api.mapbox.com/map-sessions/v1
    https://events.mapbox.com/
`;

// Styles from http://docs.mapbox.com/mapbox-gl-js/guides/styles/
const styles = [
    'mapbox://styles/mapbox/standard',
    'mapbox://styles/mapbox/streets-v12',
    'mapbox://styles/mapbox/outdoors-v12',
    'mapbox://styles/mapbox/light-v11',
    'mapbox://styles/mapbox/dark-v11',
    'mapbox://styles/mapbox/satellite-v9',
    'mapbox://styles/mapbox/satellite-streets-v12',
    'mapbox://styles/mapbox/navigation-day-v1',
    'mapbox://styles/mapbox/navigation-night-v1'
];

describe('Map', () => {
    describe.concurrent('Strict CSP rules', () => {
        let container;

        beforeAll(() => {
            container = window.document.createElement('div');
            window.document.body.appendChild(container);
        });

        afterAll(() => {
            window.document.body.removeChild(container);
        });

        for (const style of styles) {
            // eslint-disable-next-line no-loop-func
            test(`Should load ${style} successfully with strict CSP rules`, async () => {
                const {wait, withAsync} = doneAsync();

                const frame = document.createElement('iframe');

                frame.addEventListener('load', withAsync((_, doneRef) => {
                    vi.spyOn(frame.contentWindow.console, 'error').mockImplementation((message) => {
                        doneRef.reject(`CSP rules shoudn't cause any errors: ${message}`);
                    });

                    frame.contentWindow.postMessage({type: 'load', payload: style});

                    window.addEventListener('message', (e) => {
                        if (e.data.type === 'map.load') {
                            doneRef.resolve();
                        }
                    });
                }));

                const href = Object.assign(new URL(location.href), {
                    pathname: '/'
                });

                frame.csp = getStrictRules(href.toString()).replace(/\n/g, '').replace('script-src', 'script-src \'self\'');
                frame.src = `/fixtures/strict.html`;

                container.appendChild(frame);

                return wait;
            });
        }
    });

    describe.concurrent('CSP rules', () => {
        let container;

        beforeAll(() => {
            container = window.document.createElement('div');
            window.document.body.appendChild(container);
        });

        afterAll(() => {
            window.document.body.removeChild(container);
        });

        for (const style of styles) {
            // eslint-disable-next-line no-loop-func
            test(`Should load ${style} successfully with CSP rules`, async () => {
                const {wait, withAsync} = doneAsync();

                const frame = document.createElement('iframe');

                frame.addEventListener('load', withAsync((_, doneRef) => {
                    vi.spyOn(frame.contentWindow.console, 'error').mockImplementation((message) => {
                        doneRef.reject(`CSP rules shoudn't cause any errors: ${message}`);
                    });

                    frame.contentWindow.postMessage({type: 'load', payload: style});

                    window.addEventListener('message', (e) => {
                        if (e.data.type === 'map.load') {
                            doneRef.resolve();
                        }
                    });
                }));

                frame.csp = rules.replace(/\n/g, '').replace('script-src', 'script-src \'self\'');
                frame.src = `/fixtures/csp.html`;

                container.appendChild(frame);

                return wait;
            });
        }
    });
});
