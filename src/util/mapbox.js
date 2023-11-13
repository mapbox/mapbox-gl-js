// @flow

/***** START WARNING REMOVAL OR MODIFICATION OF THE
* FOLLOWING CODE VIOLATES THE MAPBOX TERMS OF SERVICE  ******
* The following code is used to access Mapbox's APIs. Removal or modification
* of this code can result in higher fees and/or
* termination of your account with Mapbox.
*
* Under the Mapbox Terms of Service, you may not use this code to access Mapbox
* Mapping APIs other than through Mapbox SDKs.
*
* The Mapping APIs documentation is available at https://docs.mapbox.com/api/maps/#maps
* and the Mapbox Terms of Service are available at https://www.mapbox.com/tos/
******************************************************************************/

import config from './config.js';
import window from './window.js';
import webpSupported from './webp_supported.js';
import {createSkuToken, SKU_ID} from './sku_token.js';
import {version as sdkVersion} from '../../package.json';
import {uuid, validateUuid, storageAvailable, b64DecodeUnicode, b64EncodeUnicode, warnOnce, extend} from './util.js';
import {postData, ResourceType, getData} from './ajax.js';
import {getLivePerformanceMetrics} from '../util/live_performance.js';
import type {LivePerformanceData} from '../util/live_performance.js';
import type {RequestParameters} from './ajax.js';
import type {Cancelable} from '../types/cancelable.js';
import type {TileJSON} from '../types/tilejson.js';
import assert from 'assert';

type ResourceTypeEnum = $Keys<typeof ResourceType>;
export type RequestTransformFunction = (url: string, resourceType?: ResourceTypeEnum) => RequestParameters;

type UrlObject = {|
    protocol: string,
    authority: string,
    path: string,
    params: Array<string>
|};

type EventCallback = (err: ?Error) => void;

export const AUTH_ERR_MSG: string = 'NO_ACCESS_TOKEN';

export class RequestManager {
    _skuToken: string;
    _skuTokenExpiresAt: number;
    _transformRequestFn: ?RequestTransformFunction;
    _customAccessToken: ?string;
    _silenceAuthErrors: boolean;

    constructor(transformRequestFn?: ?RequestTransformFunction, customAccessToken?: ?string, silenceAuthErrors: ?boolean) {
        this._transformRequestFn = transformRequestFn;
        this._customAccessToken = customAccessToken;
        this._silenceAuthErrors = !!silenceAuthErrors;
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

    transformRequest(url: string, type: ResourceTypeEnum): RequestParameters {
        if (this._transformRequestFn) {
            return this._transformRequestFn(url, type) || {url};
        }

        return {url};
    }

    normalizeStyleURL(url: string, accessToken?: string): string {
        if (!isMapboxURL(url)) return url;
        const urlObject = parseUrl(url);
        urlObject.params.push(`sdk=js-${sdkVersion}`);
        urlObject.path = `/styles/v1${urlObject.path}`;
        return this._makeAPIURL(urlObject, this._customAccessToken || accessToken);
    }

    normalizeGlyphsURL(url: string, accessToken?: string): string {
        if (!isMapboxURL(url)) return url;
        const urlObject = parseUrl(url);
        urlObject.path = `/fonts/v1${urlObject.path}`;
        return this._makeAPIURL(urlObject, this._customAccessToken || accessToken);
    }

    normalizeModelURL(url: string, accessToken?: string): string {
        if (!isMapboxURL(url)) return url;
        const urlObject = parseUrl(url);
        urlObject.path = `/models/v1${urlObject.path}`;
        return this._makeAPIURL(urlObject, this._customAccessToken || accessToken);
    }

    normalizeSourceURL(url: string, accessToken?: ?string, language?: ?string, worldview?: ?string): string {
        if (!isMapboxURL(url)) return url;
        const urlObject = parseUrl(url);
        urlObject.path = `/v4/${urlObject.authority}.json`;
        // TileJSON requests need a secure flag appended to their URLs so
        // that the server knows to send SSL-ified resource references.
        urlObject.params.push('secure');
        if (language) {
            urlObject.params.push(`language=${language}`);
        }
        if (worldview) {
            urlObject.params.push(`worldview=${worldview}`);
        }

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

    normalizeTileURL(tileURL: string, use2x?: boolean, rasterTileSize?: number): string {
        if (this._isSkuTokenExpired()) {
            this._createSkuToken();
        }

        if (tileURL && !isMapboxURL(tileURL)) return tileURL;

        const urlObject = parseUrl(tileURL);
        const imageExtensionRe = /(\.(png|jpg)\d*)(?=$)/;
        const extension = webpSupported.supported ? '.webp' : '$1';

        // The v4 mapbox tile API supports 512x512 image tiles but they must be requested as '@2x' tiles.
        const use2xAs512 = rasterTileSize && urlObject.authority !== 'raster' && rasterTileSize === 512;

        const suffix = use2x || use2xAs512 ? '@2x' : '';
        urlObject.path = urlObject.path.replace(imageExtensionRe, `${suffix}${extension}`);

        if (urlObject.authority === 'raster') {
            urlObject.path = `/${config.RASTER_URL_PREFIX}${urlObject.path}`;
        } else {
            const tileURLAPIPrefixRe = /^.+\/v4\//;
            urlObject.path = urlObject.path.replace(tileURLAPIPrefixRe, '/');
            urlObject.path = `/${config.TILE_URL_VERSION}${urlObject.path}`;
        }

        const accessToken = this._customAccessToken || getAccessToken(urlObject.params) || config.ACCESS_TOKEN;
        if (config.REQUIRE_ACCESS_TOKEN && accessToken && this._skuToken) {
            urlObject.params.push(`sku=${this._skuToken}`);
        }

        return this._makeAPIURL(urlObject, accessToken);
    }

    canonicalizeTileURL(url: string, removeAccessToken: boolean): string {
        // matches any file extension specified by a dot and one or more alphanumeric characters
        const extensionRe = /\.[\w]+$/;

        const urlObject = parseUrl(url);
        // Make sure that we are dealing with a valid Mapbox tile URL.
        // Has to begin with /v4/ or /raster/v1, with a valid filename + extension
        if (!urlObject.path.match(/^(\/v4\/|\/raster\/v1\/)/) || !urlObject.path.match(extensionRe)) {
            // Not a proper Mapbox tile URL.
            return url;
        }
        // Reassemble the canonical URL from the parts we've parsed before.
        let result = "mapbox://";
        if (urlObject.path.match(/^\/raster\/v1\//)) {
            // If the tile url has /raster/v1/, make the final URL mapbox://raster/....
            const rasterPrefix = `/${config.RASTER_URL_PREFIX}/`;
            result += `raster/${urlObject.path.replace(rasterPrefix, '')}`;
        } else {
            const tilesPrefix = `/${config.TILE_URL_VERSION}/`;
            result += `tiles/${urlObject.path.replace(tilesPrefix, '')}`;
        }

        // Append the query string, minus the access token parameter.
        let params = urlObject.params;
        if (removeAccessToken) {
            params = params.filter(p => !p.match(/^access_token=/));
        }
        if (params.length) result += `?${params.join('&')}`;
        return result;
    }

    canonicalizeTileset(tileJSON: TileJSON, sourceURL?: string): Array<string> {
        const removeAccessToken = sourceURL ? isMapboxURL(sourceURL) : false;
        const canonical = [];
        for (const url of tileJSON.tiles || []) {
            if (isMapboxHTTPURL(url)) {
                canonical.push(this.canonicalizeTileURL(url, removeAccessToken));
            } else {
                canonical.push(url);
            }
        }
        return canonical;
    }

    _makeAPIURL(urlObject: UrlObject, accessToken: string | null | void): string {
        const help = 'See https://docs.mapbox.com/api/overview/#access-tokens-and-token-scopes';
        const apiUrlObject = parseUrl(config.API_URL);
        urlObject.protocol = apiUrlObject.protocol;
        urlObject.authority = apiUrlObject.authority;

        if (urlObject.protocol === 'http') {
            const i = urlObject.params.indexOf('secure');
            if (i >= 0) urlObject.params.splice(i, 1);
        }

        if (apiUrlObject.path !== '/') {
            urlObject.path = `${apiUrlObject.path}${urlObject.path}`;
        }

        if (!config.REQUIRE_ACCESS_TOKEN) return formatUrl(urlObject);

        accessToken = accessToken || config.ACCESS_TOKEN;
        if (!this._silenceAuthErrors) {
            if (!accessToken)
                throw new Error(`An API access token is required to use Mapbox GL. ${help}`);
            if (accessToken[0] === 's')
                throw new Error(`Use a public access token (pk.*) with Mapbox GL, not a secret access token (sk.*). ${help}`);
        }

        urlObject.params = urlObject.params.filter((d) => d.indexOf('access_token') === -1);
        urlObject.params.push(`access_token=${accessToken || ''}`);
        return formatUrl(urlObject);
    }
}

export function isMapboxURL(url: string): boolean {
    return url.indexOf('mapbox:') === 0;
}

export function isMapboxHTTPURL(url: string): boolean {
    return config.API_URL_REGEX.test(url);
}

export function isMapboxHTTPCDNURL(url: string): boolean {
    return config.API_CDN_URL_REGEX.test(url);
}

export function isMapboxHTTPStyleURL(url: string): boolean {
    return config.API_STYLE_REGEX.test(url) && !isMapboxHTTPSpriteURL(url);
}

export function isMapboxHTTPTileJSONURL(url: string): boolean {
    return config.API_TILEJSON_REGEX.test(url);
}

export function isMapboxHTTPSpriteURL(url: string): boolean {
    return config.API_SPRITE_REGEX.test(url);
}

export function isMapboxHTTPFontsURL(url: string): boolean {
    return config.API_FONTS_REGEX.test(url);
}

export function hasCacheDefeatingSku(url: string): boolean {
    return url.indexOf('sku=') > 0 && isMapboxHTTPURL(url);
}

function getAccessToken(params: Array<string>): string | null {
    for (const param of params) {
        const match = param.match(/^access_token=(.*)$/);
        if (match) {
            return match[1];
        }
    }
    return null;
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

type TelemetryEventType = 'appUserTurnstile' | 'map.load' | 'map.auth' | 'gljs.performance';

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

    getStorageKey(domain: ?string): string {
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
    postEvent(timestamp: number, additionalPayload: {[_: string]: any}, callback: EventCallback, customAccessToken?: ?string) {
        if (!config.EVENTS_URL) return;
        const eventsUrlObject: UrlObject = parseUrl(config.EVENTS_URL);
        eventsUrlObject.params.push(`access_token=${customAccessToken || config.ACCESS_TOKEN || ''}`);

        const payload: Object = {
            event: this.type,
            created: new Date(timestamp).toISOString()
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

    queueRequest(event: any, customAccessToken?: ?string) {
        this.queue.push(event);
        this.processRequests(customAccessToken);
    }
}

export class PerformanceEvent extends TelemetryEvent {
    constructor() {
        super('gljs.performance');
    }

    postPerformanceEvent(customAccessToken: ?string, performanceData: LivePerformanceData) {
        if (config.EVENTS_URL) {
            if (customAccessToken || config.ACCESS_TOKEN) {
                this.queueRequest({timestamp: Date.now(), performanceData}, customAccessToken);
            }
        }
    }

    processRequests(customAccessToken?: ?string) {
        if (this.pendingRequest || this.queue.length === 0) {
            return;
        }

        const {timestamp, performanceData} = this.queue.shift();

        const additionalPayload = getLivePerformanceMetrics(performanceData);

        // Server will only process string for these entries
        for (const metadata of additionalPayload.metadata) {
            assert(typeof metadata.value === 'string');
        }
        for (const counter of additionalPayload.counters) {
            assert(typeof counter.value === 'string');
        }
        for (const attribute of additionalPayload.attributes) {
            assert(typeof attribute.value === 'string');
        }

        this.postEvent(timestamp, additionalPayload, () => {}, customAccessToken);
    }
}

export class MapLoadEvent extends TelemetryEvent {
    +success: {[_: number]: boolean};
    skuToken: string;
    errorCb: EventCallback;

    constructor() {
        super('map.load');
        this.success = {};
        this.skuToken = '';
    }

    postMapLoadEvent(mapId: number, skuToken: string, customAccessToken: ?string, callback: EventCallback) {
        this.skuToken = skuToken;
        this.errorCb = callback;

        if (config.EVENTS_URL) {
            if (customAccessToken || config.ACCESS_TOKEN) {
                this.queueRequest({id: mapId, timestamp: Date.now()}, customAccessToken);
            } else {
                this.errorCb(new Error(AUTH_ERR_MSG));
            }
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

        const additionalPayload = {
            sdkIdentifier: 'mapbox-gl-js',
            sdkVersion,
            skuId: SKU_ID,
            skuToken: this.skuToken,
            userId: this.anonId
        };

        this.postEvent(timestamp, additionalPayload, (err) => {
            if (err) {
                this.errorCb(err);
            } else {
                if (id) this.success[id] = true;
            }

        }, customAccessToken);
    }
}

export class MapSessionAPI extends TelemetryEvent {
    +success: {[_: number]: boolean};
    skuToken: string;
    errorCb: EventCallback;

    constructor() {
        super('map.auth');
        this.success = {};
        this.skuToken = '';
    }

    getSession(timestamp: number, token: string, callback: EventCallback, customAccessToken?: ?string) {
        if (!config.API_URL || !config.SESSION_PATH) return;
        const authUrlObject: UrlObject = parseUrl(config.API_URL + config.SESSION_PATH);
        authUrlObject.params.push(`sku=${token || ''}`);
        authUrlObject.params.push(`access_token=${customAccessToken || config.ACCESS_TOKEN || ''}`);

        const request: RequestParameters = {
            url: formatUrl(authUrlObject),
            headers: {
                'Content-Type': 'text/plain', //Skip the pre-flight OPTIONS request
            }
        };

        this.pendingRequest = getData(request, (error) => {
            this.pendingRequest = null;
            callback(error);
            this.saveEventData();
            this.processRequests(customAccessToken);
        });
    }

    getSessionAPI(mapId: number, skuToken: string, customAccessToken: ?string, callback: EventCallback) {
        this.skuToken = skuToken;
        this.errorCb = callback;

        if (config.SESSION_PATH && config.API_URL) {
            if (customAccessToken || config.ACCESS_TOKEN) {
                this.queueRequest({id: mapId, timestamp: Date.now()}, customAccessToken);
            } else {
                this.errorCb(new Error(AUTH_ERR_MSG));
            }
        }
    }

    processRequests(customAccessToken?: ?string) {
        if (this.pendingRequest || this.queue.length === 0) return;
        const {id, timestamp} = this.queue.shift();

        // Only one load event should fire per map
        if (id && this.success[id]) return;

        this.getSession(timestamp, this.skuToken, (err) => {
            if (err) {
                this.errorCb(err);
            } else {
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
            this.processRequests();
            return;
        }

        const additionalPayload = {
            sdkIdentifier: 'mapbox-gl-js',
            sdkVersion,
            skuId: SKU_ID,
            "enabled.telemetry": false,
            userId: this.anonId
        };

        this.postEvent(nextUpdate, additionalPayload, (err) => {
            if (!err) {
                this.eventData.lastSuccess = nextUpdate;
                this.eventData.tokenU = tokenU;
            }
        }, customAccessToken);
    }
}

const turnstileEvent_ = new TurnstileEvent();
// $FlowFixMe[method-unbinding]
export const postTurnstileEvent: (tileUrls: Array<string>, customAccessToken?: ?string) => void = turnstileEvent_.postTurnstileEvent.bind(turnstileEvent_);

const mapLoadEvent_ = new MapLoadEvent();
// $FlowFixMe[method-unbinding]
export const postMapLoadEvent: (number, string, ?string, EventCallback) => void = mapLoadEvent_.postMapLoadEvent.bind(mapLoadEvent_);

export const performanceEvent_: PerformanceEvent = new PerformanceEvent();
// $FlowFixMe[method-unbinding]
export const postPerformanceEvent: (?string, LivePerformanceData) => void = performanceEvent_.postPerformanceEvent.bind(performanceEvent_);

const mapSessionAPI_ = new MapSessionAPI();
// $FlowFixMe[method-unbinding]
export const getMapSessionAPI: (number, string, ?string, EventCallback) => void = mapSessionAPI_.getSessionAPI.bind(mapSessionAPI_);

const authenticatedMaps = new Set();
export function storeAuthState(gl: WebGL2RenderingContext, state: boolean) {
    if (state) {
        authenticatedMaps.add(gl);
    } else {
        authenticatedMaps.delete(gl);
    }
}

export function isMapAuthenticated(gl: WebGL2RenderingContext): boolean {
    return authenticatedMaps.has(gl);
}

export function removeAuthState(gl: WebGL2RenderingContext) {
    authenticatedMaps.delete(gl);
}

/***** END WARNING - REMOVAL OR MODIFICATION OF THE
PRECEDING CODE VIOLATES THE MAPBOX TERMS OF SERVICE  ******/
