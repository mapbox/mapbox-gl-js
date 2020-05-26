import {test} from '../util/test';
import browser from './util/browser';

test("zooming", async t => {
    const {driver} = browser;

    await t.test("double click at the center", async t => {
        const canvas = await browser.getMapCanvas(`${browser.basePath}/test/browser/fixtures/land.html`);

        // Double-click on the center of the map.
        await driver.executeScript(browser.doubleClick, canvas);

        // Wait until the map has settled, then report the zoom level back.
        const zoom = await driver.executeAsyncScript(callback => {
            /* eslint-disable no-undef */
            map.once('idle', () => callback(map.getZoom()));
        });

        t.equals(zoom, 2, 'zoomed in by 1 zoom level');
    });
});
