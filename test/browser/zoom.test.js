import {test} from '../util/test';
import browser from './util/browser';
import {equalWithPrecision} from '../util';

test("zooming", async t => {
    const {driver} = browser;

    await t.test("double click at the center", async t => {
        const canvas = await browser.getMapCanvas(`${browser.basePath}/test/browser/fixtures/land.html`, 'canvas');

        // Double-click on the center of the map.
        await driver.executeScript(browser.doubleClick, canvas);

        // Wait until the map has settled, then report the zoom level back.
        const zoom = await driver.executeAsyncScript(callback => {
            /* eslint-disable no-undef */
            map.once('idle', () => callback(map.getZoom()));
        });

        t.equals(zoom, 2, 'zoomed in by 1 zoom level');
    });

    await t.test("double click at the center with scaled map", async t => {
        const canvas = await browser.getMapCanvas(`${browser.basePath}/test/browser/fixtures/scaled-land.html`);

        // Double-click on the center of the map.
        await driver.executeScript(browser.doubleClick, canvas);

        // Wait until the map has settled, then report the zoom level back.
        const center = await driver.executeAsyncScript(callback => {
            /* eslint-disable no-undef */
            map.once('idle', () => callback(map.getCenter()));
        });

        equalWithPrecision(t, center.lng, -0.044, 0.001);
        equalWithPrecision(t, center.lat, 0, 0.001);
    });
});
