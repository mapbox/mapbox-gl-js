export function getAccessToken() {
    const accessToken =
        process.env.MAPBOX_ACCESS_TOKEN ||
        (new URLSearchParams(location.search).get('access_token')) ||
        localStorage.getItem('accessToken') ||
        // this token is a fallback for CI and testing. it is domain restricted to localhost
        'pk.eyJ1IjoiZ2wtanMtdGVhbSIsImEiOiJjbTV1d3l0d3AwMThnMmpzZ2M5OTNyeDE1In0.2nygBIo7PXbkFCCt6LEBgw'

    localStorage.setItem('accessToken', accessToken);
    return accessToken;
}
