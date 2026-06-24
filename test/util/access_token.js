// Domain-restricted to localhost. Safe to commit; used by debug pages and tests.
export const LOCALHOST_CI_TOKEN = 'pk.eyJ1IjoiZ2wtanMtdGVhbSIsImEiOiJjbTV1d3l0d3AwMThnMmpzZ2M5OTNyeDE1In0.2nygBIo7PXbkFCCt6LEBgw';

export function getAccessToken() {
    const accessToken =
        process.env.MAPBOX_ACCESS_TOKEN ||
        (new URLSearchParams(location.search).get('access_token')) ||
        localStorage.getItem('accessToken') ||
        LOCALHOST_CI_TOKEN;

    localStorage.setItem('accessToken', accessToken);
    return accessToken;
}
