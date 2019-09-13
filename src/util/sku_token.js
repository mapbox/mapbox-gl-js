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

type SkuTokenObject = {|
    token: string,
    tokenExpiresAt: number
|};

const SKU_ID = '01';

function createSkuToken(): SkuTokenObject {
    // SKU_ID and TOKEN_VERSION are specified by an internal schema and should not change
    const TOKEN_VERSION = '1';
    const base62chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    // sessionRandomizer is a randomized 10-digit base-62 number
    let sessionRandomizer = '';
    for (let i = 0; i < 10; i++) {
        sessionRandomizer += base62chars[Math.floor(Math.random() * 62)];
    }
    const expiration = 12 * 60 * 60 * 1000; // 12 hours
    const token = [TOKEN_VERSION, SKU_ID, sessionRandomizer].join('');
    const tokenExpiresAt = Date.now() + expiration;

    return { token, tokenExpiresAt };
}

export { createSkuToken, SKU_ID };

/***** END WARNING - REMOVAL OR MODIFICATION OF THE
PRECEDING CODE VIOLATES THE MAPBOX TERMS OF SERVICE  ******/
