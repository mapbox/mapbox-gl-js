This folder contains files for automated testing of Mapbox GL in real browsers using [Selenium WebDriver](https://www.npmjs.com/package/selenium-webdriver).

## Prerequisites

To run Webdriver, you'll have to install the driver for every browser you want to test in.

- **Google Chrome**: `npm install -g chromedriver`
- **Mozilla Firefox**: `npm install -g geckodriver`
- **Apple Safari**: (`safaridriver` ships with macOS)
- **Microsoft Edge**: See https://developer.microsoft.com/en-us/microsoft-edge/tools/webdriver/

## Running

- Run browser tests with `yarn run test-browser`.
- The tests default to Chrome, but it's possible to use a different browser by setting the `SELENIUM_BROWSER` environment variable, e.g. like this: `SELENIUM_BROWSER=firefox yarn run test-browser`.
- To run on iOS Safari, use `SELENIUM_BROWSER=safari::ios yarn run test-browser`. Make sure that the iOS device is in the same local Wifi network as your computer.
- To run on Android Chrome, use `SELENIUM_BROWSER=chrome::android yarn run test-browser`. Make sure that the Android device is in the same local Wifi network as your computer.
- To run individual tests instead of the entire test suite, you can execute a test file with the TAP runner, e.g. by typing `build/run-tap test/browser/zoom.test.js`.
