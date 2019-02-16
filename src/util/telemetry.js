// @flow
import config from './config';
import { Event, Evented } from '../util/evented';
import { extend, bindAll } from '../util/util';
import { postData } from '../util/ajax';
import window from '../util/window';

const defaultOptions = {
    flushAt: 20,
    flushAfter: 10000
};

const telemetryURL = 'http://localhost:8000/events';

export type TelemetryOptions = {
    flushAt?: number,
    flushAfter?: number
};

class Telemetry extends Evented {
    options: TelemetryOptions;
    _registry: array;
    _timer: number;

    constructor(options: TelemetryOptions) {
        bindAll([
          '_flush'
        ], this);

        this.options = extend(defaultOptions, options);
        // on telemetry creation, we should check if anything is in localStorage
        // we'll initialize anything left over from last session into the queue
        // so that it can be uploaded to the API in the next flush event
        const localStorageRegistry = window.localStorage.getItem('registry');
        console.log('localStorageRegistry', localStorageRegistry);
        this._registry = localStorageRegistry ? JSON.parse(localStorageRegistry) : [];
        this._setFlushTimer();
        console.log('set up event listener');
        this.on('featureTelemetry', (e) => {
          console.log('telemetry event received', e);
        });
    }

    push(name: string, payload: any) {
        // we should provide a normalized interface for events
        // the exact API for this is TBD once we know more about what data to collect
        const event = {name, payload};
        this._registry.push(event);
        // write to local storage
        // on unexpected connection loss or map remove, we should upload any events in the registry
        window.localStorage.setItem('registry', JSON.stringify(this._registry));
        console.log('event added to _registry', this._registry);
        if (this._registry.length === this.options.flushAt) {
            this._flush();
        }
    }

    _setFlushTimer() {
        // move if to the constructor?
        if (this.options.flushAfter) {
            this._timer = setInterval(this._flush, this.options.flushAfter);
            console.log('timer set', this._timer);
        }
    }

    _flush() {
        this.fire(new Event('featureTelemetry'));
        console.log('flushing event _registry', this._registry);
        const events = [];
        while(this._registry.length) {
          events.push(this._registry.shift());
        }
        if (events.length) {
          postData({url: telemetryURL, body: JSON.stringify(events)}, (err, data) => {
            if (err) console.log('err', err);

            console.log('data', data);
          });
        }
        window.localStorage.setItem('registry', '');
        console.log('_registry flushed', this._registry);
    }
}

export default Telemetry;
