import tap from 'tap';
import address from 'address';
import st from 'st';
import http from 'http';

import webdriver from 'selenium-webdriver';
const {Builder, By} = webdriver;

import chrome from 'selenium-webdriver/chrome';
import firefox from 'selenium-webdriver/firefox';
import safari from 'selenium-webdriver/safari';

import doubleClick from './doubleclick';
import mouseWheel from './mousewheel';

const defaultViewportSize = {width: 800, height: 600};

const chromeOptions = new chrome.Options().windowSize(defaultViewportSize);
const firefoxOptions = new firefox.Options().windowSize(defaultViewportSize);
const safariOptions = new safari.Options();

if (process.env.SELENIUM_BROWSER && process.env.SELENIUM_BROWSER.split(/:/, 3)[2] === 'android') {
    chromeOptions.androidChrome().setPageLoadStrategy('normal');
}

const ip = address.ip();
const port = 9968;

const browser = {
    driver: null,
    pixelRatio: 1,
    scaleFactor: 1,
    basePath: `http://${ip}:${port}`,
    getMapCanvas,
    doubleClick,
    mouseWheel
};

export default browser;

async function getMapCanvas(url) {
    await browser.driver.get(url);

    await browser.driver.executeAsyncScript(callback => {
        /* eslint-disable no-undef */
        if (map.loaded()) {
            callback();
        } else {
            map.once("load", () => callback());
        }
    });

    return browser.driver.findElement(By.className('mapboxgl-canvas'));
}

let server = null;

tap.test('start server', t => {
    server = http.createServer(
        st(process.cwd())
    ).listen(port, ip, err => {
        if (err) {
            t.error(err);
            t.bailout();
        } else {
            t.ok(true, `Listening at ${ip}:${port}`);
        }
        t.end();
    });
});

tap.test("start browser", async t => {
    try {
        // eslint-disable-next-line require-atomic-updates
        browser.driver = await new Builder()
            .forBrowser("chrome")
            .setChromeOptions(chromeOptions)
            .setFirefoxOptions(firefoxOptions)
            .setSafariOptions(safariOptions)
            .build();
    } catch (err) {
        t.error(err);
        t.bailout();
    }

    const capabilities = await browser.driver.getCapabilities();
    t.ok(true, `platform: ${capabilities.getPlatform()}`);
    t.ok(true, `browser: ${capabilities.getBrowserName()}`);
    t.ok(true, `version: ${capabilities.getBrowserVersion()}`);

    if (capabilities.getBrowserName() === 'Safari') {
        browser.scaleFactor = 2;
    }

    const metrics = await browser.driver.executeScript(size => {
        /* eslint-disable no-undef */
        return {
            width: outerWidth - innerWidth / devicePixelRatio + size.width,
            height: outerHeight - innerHeight / devicePixelRatio + size.height,
            pixelRatio: devicePixelRatio
        };
    }, defaultViewportSize);
    browser.pixelRatio = metrics.pixelRatio;
    (await browser.driver.manage().window()).setRect({
        width: metrics.width,
        height: metrics.height
    });
});

tap.tearDown(async () => {
    if (browser.driver) {
        await browser.driver.quit();
    }

    if (server) {
        server.close();
    }
});
