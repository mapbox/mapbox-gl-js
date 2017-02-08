'use strict';

const accessToken = (
    process.env.MapboxAccessToken ||
    process.env.MAPBOX_ACCESS_TOKEN ||
    getURLParameter('access_token') ||
    localStorage.getItem('accessToken')
);

localStorage.setItem('accessToken', accessToken);

module.exports = accessToken;

function getURLParameter(name) {
    const regexp = new RegExp(`[?&]${name}=([^&#]*)`, 'i');
    const output = regexp.exec(window.location.href);
    return output && output[1];
}
