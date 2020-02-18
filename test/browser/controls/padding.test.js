import {test} from '../../util/test';
import browser from '../util/browser';
import webdriver from 'selenium-webdriver';
const {By} = webdriver;

test("Map controls respect padding", async t => {
    const {driver} = browser;

    await t.test("Containers have appropriate amount of padding applied", async t => {
        const canvas = await browser.getMapCanvas(`${browser.basePath}/test/browser/fixtures/land.html`);
        const canvasRect = await canvas.getRect();
        // Add controls
        await driver.executeScript(() => {
            map.addControl(new mapboxgl.NavigationControl());
            map.addControl(new mapboxgl.ScaleControl());
            map.addControl(new mapboxgl.FullscreenControl());
        });
        const padding = {
            left: 150,
            top: 50,
            bottom: 30,
            right: 100
        };
        // Set padding, the data must be duplicated because the funtion passed to `executeScript` is stringified and does not capture
        // closure scope variables.
        await driver.executeAsyncScript(callback => {
            map.easeTo({
                padding:{
                    left: 150,
                    top: 50,
                    bottom: 30,
                    right: 100
                }
            });
            map.once('idle', () => { callback() });
        });
        let x,y;
        const topLeft = await driver.findElement(By.className('mapboxgl-ctrl-top-left'));
        const topLeftRect = await topLeft.getRect();
        t.equal(topLeftRect.x, padding.left);
        t.equal(topLeftRect.y, padding.top);

        const topRight = await driver.findElement(By.className('mapboxgl-ctrl-top-right'));
        const topRightRect = await topRight.getRect();
        x = canvasRect.width - topRightRect.x - topRightRect.width;
        t.equal(x, padding.right);
        t.equal(topRightRect.y, padding.top);

        const btmLeft = await driver.findElement(By.className('mapboxgl-ctrl-bottom-left'));
        const btmLeftRect = await btmLeft.getRect();
        y = canvasRect.height - btmLeftRect.y - btmLeftRect.height;
        t.equal(btmLeftRect.x, padding.left);
        t.equal(y, padding.bottom);

        const btmRight = await driver.findElement(By.className('mapboxgl-ctrl-bottom-right'));
        const btmRightRect = await btmRight.getRect();
        x = canvasRect.width - btmRightRect.x - btmRightRect.width;
        y = canvasRect.height - btmRightRect.y - btmRightRect.height;
        t.equal(x, padding.right);
        t.equal(y, padding.bottom);
    });

    await t.test("Controls shift back to original position after padding is removed", async t => {
        const canvas = await browser.getMapCanvas(`${browser.basePath}/test/browser/fixtures/land.html`);
        // Add controls
        await driver.executeScript(() => {
            map.addControl(new mapboxgl.NavigationControl());
            map.addControl(new mapboxgl.ScaleControl());
            map.addControl(new mapboxgl.FullscreenControl());
        });

        const controls = await driver.findElements(By.className('mapboxgl-ctrl'));
        const rects = await Promise.all(controls.map(control => control.getRect()));

        // Set and unset padding
        await driver.executeAsyncScript(callback => {
            map.easeTo({
                padding: {
                    left: 100,
                    top: 50,
                    bottom: 30,
                    right: 60
                }
            });

            map.once('idle', () => {
                map.easeTo({
                    padding: {
                        left: 0,
                        top: 0,
                        bottom: 0,
                        right: 0
                    }
                });

                map.once('idle', () => {
                    callback();
                })
            });
        });

        // Controls reset back to their original position
        const resetControls = await driver.findElements(By.className('mapboxgl-ctrl'));
        const resetRects = await Promise.all(resetControls.map(control => control.getRect()));
        t.deepEqual(rects, resetRects);
    });
});
