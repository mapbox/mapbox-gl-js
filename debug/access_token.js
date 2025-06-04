'use strict';

mapboxgl.accessToken = getAccessToken();

function getAccessToken() {
    const accessToken = [
        process.env.MapboxAccessToken,
        process.env.MAPBOX_ACCESS_TOKEN,
        getURLParameter('access_token'),
        localStorage.getItem('accessToken'),
        // this token is a fallback for CI and testing. it is domain restricted to localhost
        'pk.eyJ1IjoiZ2wtanMtdGVhbSIsImEiOiJjbTV1d3l0d3AwMThnMmpzZ2M5OTNyeDE1In0.2nygBIo7PXbkFCCt6LEBgw'
    ].find(Boolean);

    try {
        localStorage.setItem('accessToken', accessToken);
    } catch (_) {
        // no-op
    }
    return accessToken;
}

function getURLParameter(name) {
    const url = new URL(window.location.href);
    return url.searchParams.get(name);
}
