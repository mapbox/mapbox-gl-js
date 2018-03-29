// @flow

import browser from './browser';

type Config = {|
  API_URL: string,
  REQUIRE_ACCESS_TOKEN: boolean,
  ACCESS_TOKEN: ?string,
  DEVICE_PIXEL_RATIO: number,
|};

const config: Config = {
    API_URL: 'https://api.mapbox.com',
    REQUIRE_ACCESS_TOKEN: true,
    ACCESS_TOKEN: null,
    get DEVICE_PIXEL_RATIO() {
        return browser.devicePixelRatio;
    }
};

export default config;
