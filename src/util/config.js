// @flow

type Config = {|
  API_URL: string,
  EVENTS_URL: string,
  REQUIRE_ACCESS_TOKEN: boolean,
  ACCESS_TOKEN: ?string
|};

const config: Config = {
    API_URL: 'https://api.mapbox.com',
    EVENTS_URL: 'https://events.mapbox.com/events/v2',
    REQUIRE_ACCESS_TOKEN: true,
    ACCESS_TOKEN: null
};

export default config;
