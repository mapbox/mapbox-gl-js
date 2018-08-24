// @flow

const EventsUrlOptions = {
    DefaultEventsUrl: 'https://events.mapbox.com/events/v2',
    ChinaEventsUrl: 'https://events.mapbox.cn/events/v2'
};

type Config = {|
  API_URL: string,
  EVENTS_URL: string,
  REQUIRE_ACCESS_TOKEN: boolean,
  ACCESS_TOKEN: ?string
|};

const config: Config = {
    API_URL: 'https://api.mapbox.com',
    EVENTS_URL: EventsUrlOptions.DefaultEventsUrl,
    REQUIRE_ACCESS_TOKEN: true,
    ACCESS_TOKEN: null
};

const defineProperty = Object.defineProperty;
defineProperty(config, 'EVENTS_URL', {
    get: function() {
        if (this.API_URL.indexOf('https://api.mapbox.cn') === 0) {
            return EventsUrlOptions.ChinaEventsUrl;
        } else {
            return EventsUrlOptions.DefaultEventsUrl;
        }
    }
});

export default config;
