// @flow

import browser from './browser';

type Config = {|
  API_URL: string,
  EVENTS_URL: string,
  REQUIRE_ACCESS_TOKEN: boolean,
  ACCESS_TOKEN: ?string,
  DEVICE_PIXEL_RATIO: number,
|};

const config: Config = {
    API_URL: 'https://api.mapbox.com',
    get EVENTS_URL() {
        if (this.API_URL.indexOf('https://api.mapbox.cn') === 0) {
            return 'https://events.mapbox.cn/events/v2';
        } else {
            return 'https://events.mapbox.com/events/v2';
        }
    },
    REQUIRE_ACCESS_TOKEN: true,
    ACCESS_TOKEN: null,
    get DEVICE_PIXEL_RATIO() {
        return browser.devicePixelRatio;
    }
};

export default config;
