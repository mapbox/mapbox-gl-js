import {test} from '../util/test.js';
import browser from './util/browser.js';

test("performance metrics", async t => {
    const {driver} = browser;

    await t.test("double click at the center", async t => {
        const canvas = await browser.getMapCanvas(`${browser.basePath}/test/browser/fixtures/land.html`);

        // Double-click on the center of the map.
        await driver.executeScript(browser.doubleClick, canvas);

        // Wait until the map has settled, then report the zoom level back.
        const performance = await driver.executeAsyncScript(callback => {
            /* eslint-disable no-undef */
            map.once('idle', () => {
                mapboxgl.getPerformanceMetricsAsync((_, result) => callback(result));
            });
        });

        const timelines = performance.timelines;
        t.equal(timelines.length, 3);
        t.equal(timelines[0].scope, 'Window');
        t.equal(timelines[1].scope, 'Worker');
        t.equal(timelines[2].scope, 'Worker');

        const find = name => timelines[0].entries.find(e => e.name === name);

        t.ok(timelines[0].entries.every(e => {
            return !isNaN(e.startTime) && !isNaN(e.duration);
        }));

        t.ok(find('library-evaluate'));
        t.ok(find('frame'));
        t.ok(find('create'));
        t.ok(find('load'));
        t.ok(find('fullLoad'));
        t.equal(timelines[0].entries.filter(e => e.entryType === 'resource').length, 3);
    });
});
