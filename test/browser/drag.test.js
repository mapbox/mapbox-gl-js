import {test} from '../util/test';
import browser from './util/browser';
import {Origin} from 'selenium-webdriver';
import {equalWithPrecision} from '../util';

test("dragging", async t => {
    const {driver} = browser;

    await t.test("drag to the left", async t => {
        const canvas = await browser.getMapCanvas(`${browser.basePath}/test/browser/fixtures/land.html`);

        // Perform drag action, wait a bit the end to avoid the momentum mode.
        await driver
            .actions()
            .move(canvas)
            .press()
            .move({x: 100 / browser.scaleFactor, y: 0, origin: Origin.POINTER})
            .pause(200)
            .release()
            .perform();

        const center = await driver.executeScript(() => {
            /* eslint-disable no-undef */
            return map.getCenter();
        });
        equalWithPrecision(t, center.lng, -35.15625, 0.001);
        equalWithPrecision(t, center.lat, 0, 0.0000001);
    });
});
