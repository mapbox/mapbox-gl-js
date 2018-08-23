// @flow

const EventsUrlOptions = {
    DefaultEventsUrl: 'https://events.mapbox.com/events/v2',
    ChinaEventsUrl: 'https://events.mapbox.cn/events/v2'
};

type Config = {|
  _API_URL: string,
  API_URL: string,
  EVENTS_URL: string,
  REQUIRE_ACCESS_TOKEN: boolean,
  ACCESS_TOKEN: ?string
|};

const config: Config = {
    _API_URL: 'https://api.mapbox.com',
    EVENTS_URL: EventsUrlOptions.DefaultEventsUrl,
    REQUIRE_ACCESS_TOKEN: true,
    ACCESS_TOKEN: null
};

Object.defineProperty(config,'API_URL',{
    get: function(){
        return this._API_URL;
    },
    set: function(apiurl: string){
        this._API_URL = apiurl;
        if(this._API_URL.indexOf('https://api.mapbox.cn') === 0){
          this.EVENTS_URL = EventsUrlOptions.ChinaEventsUrl;
        }
        else {
          this.EVENTS_URL = EventsUrlOptions.DefaultEventsUrl;
        }
    }
});

export default config;