// @flow

import config from './config';

import browser from './browser';
import window from './window';
import { version } from '../../package.json';
import { uuid, validateUuid, storageAvailable, warnOnce } from './util';
import { postData } from './ajax';

import type { RequestParameters } from './ajax';
import type { Cancelable } from '../types/cancelable';

const help = 'See https://www.mapbox.com/api-documentation/#access-tokens';
const turnstileEventStorageKey = 'mapbox.turnstileEventData';

type UrlObject = {|
    protocol: string,
    authority: string,
    path: string,
    params: Array<string>
|};

function makeAPIURL(urlObject: UrlObject, accessToken: string | null | void): string {
    const apiUrlObject = parseUrl(config.API_URL);
    urlObject.protocol = apiUrlObject.protocol;
    urlObject.authority = apiUrlObject.authority;

    if (apiUrlObject.path !== '/') {
        urlObject.path = `${apiUrlObject.path}${urlObject.path}`;
    }

    if (!config.REQUIRE_ACCESS_TOKEN) return formatUrl(urlObject);

    accessToken = accessToken || config.ACCESS_TOKEN;
    if (!accessToken)
        throw new Error(`An API access token is required to use Mapbox GL. ${help}`);
    if (accessToken[0] === 's')
        throw new Error(`Use a public access token (pk.*) with Mapbox GL, not a secret access token (sk.*). ${help}`);

    urlObject.params.push(`access_token=${accessToken}`);
    return formatUrl(urlObject);
}

function isMapboxURL(url: string) {
    return url.indexOf('mapbox:') === 0;
}

export { isMapboxURL };

export const normalizeStyleURL = function(url: string, accessToken?: string): string {
    if (!isMapboxURL(url)) return url;
    const urlObject = parseUrl(url);
    urlObject.path = `/styles/v1${urlObject.path}`;
    return makeAPIURL(urlObject, accessToken);
};

export const normalizeGlyphsURL = function(url: string, accessToken?: string): string {
    if (!isMapboxURL(url)) return url;
    const urlObject = parseUrl(url);
    urlObject.path = `/fonts/v1${urlObject.path}`;
    return makeAPIURL(urlObject, accessToken);
};

export const normalizeSourceURL = function(url: string, accessToken?: string): string {
    if (!isMapboxURL(url)) return url;
    const urlObject = parseUrl(url);
    urlObject.path = `/v4/${urlObject.authority}.json`;
    // TileJSON requests need a secure flag appended to their URLs so
    // that the server knows to send SSL-ified resource references.
    urlObject.params.push('secure');
    return makeAPIURL(urlObject, accessToken);
};

export const normalizeSpriteURL = function(url: string, format: string, extension: string, accessToken?: string): string {
    const urlObject = parseUrl(url);
    if (!isMapboxURL(url)) {
        urlObject.path += `${format}${extension}`;
        return formatUrl(urlObject);
    }
    urlObject.path = `/styles/v1${urlObject.path}/sprite${format}${extension}`;
    return makeAPIURL(urlObject, accessToken);
};

const imageExtensionRe = /(\.(png|jpg)\d*)(?=$)/;

export const normalizeTileURL = function(tileURL: string, sourceURL?: ?string, tileSize?: ?number): string {
    if (!sourceURL || !isMapboxURL(sourceURL)) return tileURL;

    const urlObject = parseUrl(tileURL);

    // The v4 mapbox tile API supports 512x512 image tiles only when @2x
    // is appended to the tile URL. If `tileSize: 512` is specified for
    // a Mapbox raster source force the @2x suffix even if a non hidpi device.
    const suffix = browser.devicePixelRatio >= 2 || tileSize === 512 ? '@2x' : '';
    const extension = browser.supportsWebp ? '.webp' : '$1';
    urlObject.path = urlObject.path.replace(imageExtensionRe, `${suffix}${extension}`);

    replaceTempAccessToken(urlObject.params);
    return formatUrl(urlObject);
};

function replaceTempAccessToken(params: Array<string>) {
    for (let i = 0; i < params.length; i++) {
        if (params[i].indexOf('access_token=tk.') === 0) {
            params[i] = `access_token=${config.ACCESS_TOKEN || ''}`;
        }
    }
}

const urlRe = /^(\w+):\/\/([^/?]*)(\/[^?]+)?\??(.+)?/;

function parseUrl(url: string): UrlObject {
    const parts = url.match(urlRe);
    if (!parts) {
        throw new Error('Unable to parse URL object');
    }
    return {
        protocol: parts[1],
        authority: parts[2],
        path: parts[3] || '/',
        params: parts[4] ? parts[4].split('&') : []
    };
}

function formatUrl(obj: UrlObject): string {
    const params = obj.params.length ? `?${obj.params.join('&')}` : '';
    return `${obj.protocol}://${obj.authority}${obj.path}${params}`;
}

export class TurnstileEvent {
    eventData: { anonId: ?string, lastSuccess: ?number, accessToken: ?string};
    queue: Array<number>;
    pending: boolean
    pendingRequest: ?Cancelable;

    constructor() {
        this.eventData = { anonId: null, lastSuccess: null, accessToken: config.ACCESS_TOKEN};
        this.queue = [];
        this.pending = false;
        this.pendingRequest = null;
    }

    postTurnstileEvent(tileUrls: Array<string>) {
        //Enabled only when Mapbox Access Token is set and a source uses
        // mapbox tiles.
        if (config.ACCESS_TOKEN &&
            Array.isArray(tileUrls) &&
            tileUrls.some((url) => { return /(mapbox\.c)(n|om)/i.test(url); })) {
            this.queueRequest(browser.now());
        }
    }

    queueRequest(date: number) {
        this.queue.push(date);
        this.processRequests();
    }

    processRequests() {
        if (this.pendingRequest || this.queue.length === 0) {
            return;
        }
        const storageKey = `${turnstileEventStorageKey}:${config.ACCESS_TOKEN || ''}`;
        const isLocalStorageAvailable = storageAvailable('localStorage');
        let dueForEvent = this.eventData.accessToken ? (this.eventData.accessToken !== config.ACCESS_TOKEN) : false;

        //Reset event data cache if the access token changed.
        if (dueForEvent) {
            this.eventData.anonId = this.eventData.lastSuccess = null;
        }
        if ((!this.eventData.anonId || !this.eventData.lastSuccess) &&
            isLocalStorageAvailable) {
            //Retrieve cached data
            try {
                const data = window.localStorage.getItem(storageKey);
                if (data) {
                    this.eventData = JSON.parse(data);
                }
            } catch (e) {
                warnOnce('Unable to read from LocalStorage');
            }
        }

        if (!validateUuid(this.eventData.anonId)) {
            this.eventData.anonId = uuid();
            dueForEvent = true;
        }
        const nextUpdate = this.queue.shift();

        // Record turnstile event once per calendar day.
        if (this.eventData.lastSuccess) {
            const lastUpdate = new Date(this.eventData.lastSuccess);
            const nextDate = new Date(nextUpdate);
            const daysElapsed = (nextUpdate - this.eventData.lastSuccess) / (24 * 60 * 60 * 1000);
            dueForEvent = dueForEvent || daysElapsed >= 1 || daysElapsed < -1 || lastUpdate.getDate() !== nextDate.getDate();
        }

        if (!dueForEvent) {
            return this.processRequests();
        }

        const evenstUrlObject: UrlObject = parseUrl(config.EVENTS_URL);
        evenstUrlObject.params.push(`access_token=${config.ACCESS_TOKEN || ''}`);
        const request: RequestParameters = {
            url: formatUrl(evenstUrlObject),
            headers: {
                'Content-Type': 'text/plain' //Skip the pre-flight OPTIONS request
            }
        };

        const payload = JSON.stringify([{
            event: 'appUserTurnstile',
            created: (new Date(nextUpdate)).toISOString(),
            sdkIdentifier: 'mapbox-gl-js',
            sdkVersion: version,
            'enabled.telemetry': false,
            userId: this.eventData.anonId
        }]);

        this.pendingRequest = postData(request, payload, (error) => {
            this.pendingRequest = null;
            if (!error) {
                this.eventData.lastSuccess = nextUpdate;
                this.eventData.accessToken = config.ACCESS_TOKEN;
                if (isLocalStorageAvailable) {
                    try {
                        window.localStorage.setItem(storageKey, JSON.stringify(this.eventData));
                    } catch (e) {
                        warnOnce('Unable to write to LocalStorage');
                    }
                }
                this.processRequests();
            }
        });
    }
}

const turnstileEvent_ = new TurnstileEvent();

export const postTurnstileEvent = turnstileEvent_.postTurnstileEvent.bind(turnstileEvent_);
