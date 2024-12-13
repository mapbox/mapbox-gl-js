'use strict';

mapboxgl.accessToken = getAccessToken();

function getAccessToken() {
    const accessToken = [
        process.env.MapboxAccessToken,
        process.env.MAPBOX_ACCESS_TOKEN,
        getURLParameter('access_token'),
        localStorage.getItem('accessToken'),
        // this token is a fallback for CI and testing. it is domain restricted to localhost
        'pk.eyJ1IjoibWFwYm94LWdsLWpzIiwiYSI6ImNram9ybGI1ajExYjQyeGxlemppb2pwYjIifQ.LGy5UGNIsXUZdYMvfYRiAQ'
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
