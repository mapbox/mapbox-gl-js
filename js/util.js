function loadBuffer(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.responseType = "arraybuffer";
    xhr.onload = function(e) {
        if (xhr.status >= 200 && xhr.status < 300 && xhr.response) {
            callback(null, new Uint8Array(xhr.response));
        } else {
            callback(new Error(xhr.statusText));
        }
    };
    xhr.send();
}

function clamp(value, min, max) {
    return value < min ? min : (value > max ? max : value);
}
