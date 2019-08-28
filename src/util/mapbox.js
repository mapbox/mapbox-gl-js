// @flow

/***** START WARNING - IF YOU USE THIS CODE WITH MAPBOX MAPPING APIS, REMOVAL OR
* MODIFICATION OF THE FOLLOWING CODE VIOLATES THE MAPBOX TERMS OF SERVICE  ******
* The following code is used to access Mapbox's Mapping APIs. Removal or modification
* of this code when used with Mapbox's Mapping APIs can result in higher fees and/or
* termination of your account with Mapbox.
*
* Under the Mapbox Terms of Service, you may not use this code to access Mapbox
* Mapping APIs other than through Mapbox SDKs.
*
* The Mapping APIs documentation is available at https://docs.mapbox.com/api/maps/#maps
* and the Mapbox Terms of Service are available at https://www.mapbox.com/tos/
******************************************************************************/

import config from './config';

import browser from './browser';
import window from './window';
import webpSupported from './webp_supported';
import {createSkuToken, SKU_ID} from './sku_token';
import {version as sdkVersion} from '../../package.json';
import {uuid, validateUuid, storageAvailable, b64DecodeUnicode, b64EncodeUnicode, warnOnce, extend} from './util';
import {postData, ResourceType} from './ajax';

import type {RequestParameters} from './ajax';
import type {Cancelable} from '../types/cancelable';
import type {TileJSON} from '../types/tilejson';

type ResourceTypeEnum = $Keys<typeof ResourceType>;
export type RequestTransformFunction = (url: string, resourceType?: ResourceTypeEnum) => RequestParameters;

type UrlObject = {|
    protocol: string,
    authority: string,
    path: string,
    params: Array<string>
|};

export class RequestManager {
    _skuToken: string;
    _skuTokenExpiresAt: number;
    _transformRequestFn: ?RequestTransformFunction;
    _customAccessToken: ?string;

    constructor(transformRequestFn?: RequestTransformFunction, customAccessToken?: string) {
        this._transformRequestFn = transformRequestFn;
        this._customAccessToken = customAccessToken;
        this._createSkuToken();
    }

    _createSkuToken() {
        const skuToken = createSkuToken();
        this._skuToken = skuToken.token;
        this._skuTokenExpiresAt = skuToken.tokenExpiresAt;
    }

    _isSkuTokenExpired(): boolean {
        return Date.now() > this._skuTokenExpiresAt;
    }

    transformRequest(url: string, type: ResourceTypeEnum) {
        if (this._transformRequestFn) {
            return this._transformRequestFn(url, type) || {url};
        }

        return {url};
    }

    normalizeStyleURL(url: string, accessToken?: string): string {
        if (!isMapboxURL(url)) return url;
        const urlObject = parseUrl(url);
        urlObject.path = `/styles/v1${urlObject.path}`;
        return this._makeAPIURL(urlObject, this._customAccessToken || accessToken);
    }

    normalizeGlyphsURL(url: string, accessToken?: string): string {
        if (!isMapboxURL(url)) return url;
        const urlObject = parseUrl(url);
        urlObject.path = `/fonts/v1${urlObject.path}`;
        return this._makeAPIURL(urlObject, this._customAccessToken || accessToken);
    }

    normalizeSourceURL(url: string, accessToken?: string): string {
        if (!isMapboxURL(url)) return url;
        const urlObject = parseUrl(url);
        urlObject.path = `/v4/${urlObject.authority}.json`;
        // TileJSON requests need a secure flag appended to their URLs so
        // that the server knows to send SSL-ified resource references.
        urlObject.params.push('secure');
        return this._makeAPIURL(urlObject, this._customAccessToken || accessToken);
    }

    normalizeSpriteURL(url: string, format: string, extension: string, accessToken?: string): string {
        const urlObject = parseUrl(url);
        if (!isMapboxURL(url)) {
            urlObject.path += `${format}${extension}`;
            return formatUrl(urlObject);
        }
        urlObject.path = `/styles/v1${urlObject.path}/sprite${format}${extension}`;
        return this._makeAPIURL(urlObject, this._customAccessToken || accessToken);
    }

    normalizeTileURL(tileURL: string, sourceURL?: ?string, tileSize?: ?number): string {
        if (this._isSkuTokenExpired()) {
            this._createSkuToken();
        }

        if (!sourceURL || !isMapboxURL(sourceURL)) return tileURL;

        const urlObject = parseUrl(tileURL);
        const imageExtensionRe = /(\.(png|jpg)\d*)(?=$)/;
        const tileURLAPIPrefixRe = /^.+\/v4\//;

        // The v4 mapbox tile API supports 512x512 image tiles only when @2x
        // is appended to the tile URL. If `tileSize: 512` is specified for
        // a Mapbox raster source force the @2x suffix even if a non hidpi device.
        const suffix = browser.devicePixelRatio >= 2 || tileSize === 512 ? '@2x' : '';
        const extension = webpSupported.supported ? '.webp' : '$1';
        urlObject.path = urlObject.path.replace(imageExtensionRe, `${suffix}${extension}`);
        urlObject.path = urlObject.path.replace(tileURLAPIPrefixRe, '/');
        urlObject.path = `/v4${urlObject.path}`;

        if (config.REQUIRE_ACCESS_TOKEN && (config.ACCESS_TOKEN || this._customAccessToken) && this._skuToken) {
            urlObject.params.push(`sku=${this._skuToken}`);
        }

        return this._makeAPIURL(urlObject, this._customAccessToken);
    }

    canonicalizeTileURL(url: string) {
        const version = "/v4/";
        // matches any file extension specified by a dot and one or more alphanumeric characters
        const extensionRe = /\.[\w]+$/;

        const urlObject = parseUrl(url);
        // Make sure that we are dealing with a valid Mapbox tile URL.
        // Has to begin with /v4/, with a valid filename + extension
        if (!urlObject.path.match(/(^\/v4\/)/) || !urlObject.path.match(extensionRe)) {
            // Not a proper Mapbox tile URL.
            return url;
        }
        // Reassemble the canonical URL from the parts we've parsed before.
        let result = "mapbox://tiles/";
        result +=  urlObject.path.replace(version, '');

        // Append the query string, minus the access token parameter.
        const params = urlObject.params.filter(p => !p.match(/^access_token=/));
        if (params.length) result += `?${params.join('&')}`;
        return result;
    }

    canonicalizeTileset(tileJSON: TileJSON, sourceURL: string) {
        if (!isMapboxURL(sourceURL)) return tileJSON.tiles || [];
        const canonical = [];
        for (const url of tileJSON.tiles) {
            const canonicalUrl = this.canonicalizeTileURL(url);
            canonical.push(canonicalUrl);
        }
        return canonical;
    }

    _makeAPIURL(urlObject: UrlObject, accessToken: string | null | void): string {
        const help = 'See https://www.mapbox.com/api-documentation/#access-tokens-and-token-scopes';
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

        urlObject.params = urlObject.params.filter((d) => d.indexOf('access_token') === -1);
        urlObject.params.push(`access_token=${accessToken}`);
        return formatUrl(urlObject);
    }
}

function isMapboxURL(url: string) {
    return url.indexOf('mapbox:') === 0;
}

const mapboxHTTPURLRe = /^((https?:)?\/\/)?([^\/]+\.)?mapbox\.c(n|om)(\/|\?|$)/i;
function isMapboxHTTPURL(url: string): boolean {
    return mapboxHTTPURLRe.test(url);
}

function hasCacheDefeatingSku(url: string) {
    return url.indexOf('sku=') > 0 && isMapboxHTTPURL(url);
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

export {isMapboxURL, isMapboxHTTPURL, hasCacheDefeatingSku};

const telemEventKey = 'mapbox.eventData';

function parseAccessToken(accessToken: ?string) {
    if (!accessToken) {
        return null;
    }

    const parts = accessToken.split('.');
    if (!parts || parts.length !== 3) {
        return null;
    }

    try {
        const jsonData = JSON.parse(b64DecodeUnicode(parts[1]));
        return jsonData;
    } catch (e) {
        return null;
    }
}

type TelemetryEventType = 'appUserTurnstile' | 'map.load';

class TelemetryEvent {
    eventData: any;
    anonId: ?string;
    queue: Array<any>;
    type: TelemetryEventType;
    pendingRequest: ?Cancelable;
    _customAccessToken: ?string;

    constructor(type: TelemetryEventType) {
        this.type = type;
        this.anonId = null;
        this.eventData = {};
        this.queue = [];
        this.pendingRequest = null;
    }

    getStorageKey(domain: ?string) {
        const tokenData = parseAccessToken(config.ACCESS_TOKEN);
        let u = '';
        if (tokenData && tokenData['u']) {
            u = b64EncodeUnicode(tokenData['u']);
        } else {
            u = config.ACCESS_TOKEN || '';
        }
        return domain ?
            `${telemEventKey}.${domain}:${u}` :
            `${telemEventKey}:${u}`;
    }

    fetchEventData() {
        const isLocalStorageAvailable = storageAvailable('localStorage');
        const storageKey = this.getStorageKey();
        const uuidKey = this.getStorageKey('uuid');

        if (isLocalStorageAvailable) {
            //Retrieve cached data
            try {
                const data = window.localStorage.getItem(storageKey);
                if (data) {
                    this.eventData = JSON.parse(data);
                }

                const uuid = window.localStorage.getItem(uuidKey);
                if (uuid) this.anonId = uuid;
            } catch (e) {
                warnOnce('Unable to read from LocalStorage');
            }
        }
    }

    saveEventData() {
        const isLocalStorageAvailable = storageAvailable('localStorage');
        const storageKey =  this.getStorageKey();
        const uuidKey = this.getStorageKey('uuid');
        if (isLocalStorageAvailable) {
            try {
                window.localStorage.setItem(uuidKey, this.anonId);
                if (Object.keys(this.eventData).length >= 1) {
                    window.localStorage.setItem(storageKey, JSON.stringify(this.eventData));
                }
            } catch (e) {
                warnOnce('Unable to write to LocalStorage');
            }
        }

    }

    processRequests(_: ?string) {}

    /*
    * If any event data should be persisted after the POST request, the callback should modify eventData`
    * to the values that should be saved. For this reason, the callback should be invoked prior to the call
    * to TelemetryEvent#saveData
    */
    postEvent(timestamp: number, additionalPayload: {[string]: any}, callback: (err: ?Error) => void, customAccessToken?: ?string) {
        if (!config.EVENTS_URL) return;
        const eventsUrlObject: UrlObject = parseUrl(config.EVENTS_URL);
        eventsUrlObject.params.push(`access_token=${customAccessToken || config.ACCESS_TOKEN || ''}`);

        const payload: Object = {
            event: this.type,
            created: new Date(timestamp).toISOString(),
            sdkIdentifier: 'mapbox-gl-js',
            sdkVersion,
            skuId: SKU_ID,
            userId: this.anonId
        };

        const finalPayload = additionalPayload ? extend(payload, additionalPayload) : payload;
        const request: RequestParameters = {
            url: formatUrl(eventsUrlObject),
            headers: {
                'Content-Type': 'text/plain' //Skip the pre-flight OPTIONS request
            },
            body: JSON.stringify([finalPayload])
        };

        this.pendingRequest = postData(request, (error) => {
            this.pendingRequest = null;
            callback(error);
            this.saveEventData();
            this.processRequests(customAccessToken);
        });
    }

    queueRequest(event: number | {id: number, timestamp: number}, customAccessToken?: ?string) {
        this.queue.push(event);
        this.processRequests(customAccessToken);
    }
}

export class MapLoadEvent extends TelemetryEvent {
    +success: {[number]: boolean};
    skuToken: string;

    constructor() {
        super('map.load');
        this.success = {};
        this.skuToken = '';
    }

    postMapLoadEvent(tileUrls: Array<string>, mapId: number, skuToken: string, customAccessToken: string) {
        //Enabled only when Mapbox Access Token is set and a source uses
        // mapbox tiles.
        this.skuToken = skuToken;

        if (config.EVENTS_URL &&
            customAccessToken || config.ACCESS_TOKEN &&
            Array.isArray(tileUrls) &&
            tileUrls.some(url => isMapboxURL(url) || isMapboxHTTPURL(url))) {
            this.queueRequest({id: mapId, timestamp: Date.now()}, customAccessToken);
        }
    }

    processRequests(customAccessToken?: ?string) {
        if (this.pendingRequest || this.queue.length === 0) return;
        const {id, timestamp} = this.queue.shift();

        // Only one load event should fire per map
        if (id && this.success[id]) return;

        if (!this.anonId) {
            this.fetchEventData();
        }

        if (!validateUuid(this.anonId)) {
            this.anonId = uuid();
        }

        this.postEvent(timestamp, {skuToken: this.skuToken}, (err) => {
            if (!err) {
                if (id) this.success[id] = true;
            }
        }, customAccessToken);
    }
}

export class TurnstileEvent extends TelemetryEvent {
    constructor(customAccessToken?: ?string) {
        super('appUserTurnstile');
        this._customAccessToken = customAccessToken;
    }

    postTurnstileEvent(tileUrls: Array<string>, customAccessToken?: ?string) {
        //Enabled only when Mapbox Access Token is set and a source uses
        // mapbox tiles.
        if (config.EVENTS_URL &&
            config.ACCESS_TOKEN &&
            Array.isArray(tileUrls) &&
            tileUrls.some(url => isMapboxURL(url) || isMapboxHTTPURL(url))) {
            this.queueRequest(Date.now(), customAccessToken);
        }
    }

    processRequests(customAccessToken?: ?string) {
        if (this.pendingRequest || this.queue.length === 0) {
            return;
        }

        if (!this.anonId || !this.eventData.lastSuccess || !this.eventData.tokenU) {
            //Retrieve cached data
            this.fetchEventData();
        }

        const tokenData = parseAccessToken(config.ACCESS_TOKEN);
        const tokenU = tokenData ? tokenData['u'] : config.ACCESS_TOKEN;
        //Reset event data cache if the access token owner changed.
        let dueForEvent = tokenU !== this.eventData.tokenU;

        if (!validateUuid(this.anonId)) {
            this.anonId = uuid();
            dueForEvent = true;
        }

        const nextUpdate = this.queue.shift();
        // Record turnstile event once per calendar day.
        if (this.eventData.lastSuccess) {
            const lastUpdate = new Date(this.eventData.lastSuccess);
            const nextDate = new Date(nextUpdate);
            const daysElapsed = (nextUpdate - this.eventData.lastSuccess) / (24 * 60 * 60 * 1000);
            dueForEvent = dueForEvent || daysElapsed >= 1 || daysElapsed < -1 || lastUpdate.getDate() !== nextDate.getDate();
        } else {
            dueForEvent = true;
        }

        if (!dueForEvent) {
            return this.processRequests();
        }

        this.postEvent(nextUpdate, {"enabled.telemetry": false}, (err) => {
            if (!err) {
                this.eventData.lastSuccess = nextUpdate;
                this.eventData.tokenU = tokenU;
            }
        }, customAccessToken);
    }
}

const turnstileEvent_ = new TurnstileEvent();
export const postTurnstileEvent = turnstileEvent_.postTurnstileEvent.bind(turnstileEvent_);

const mapLoadEvent_ = new MapLoadEvent();
export const postMapLoadEvent = mapLoadEvent_.postMapLoadEvent.bind(mapLoadEvent_);

/***** END WARNING - REMOVAL OR MODIFICATION OF THE
PRECEDING CODE VIOLATES THE MAPBOX TERMS OF SERVICE  ******/
