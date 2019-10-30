/* eslint-disable import/no-commonjs */
/* eslint-env browser */

// Tests running in the browser need to be able to persist files to disk in certain situations.
// our test server (server.js) actually handles the file-io and listens for POST request to /write-file
// This is a helper method to send that POST request.
// filepath: relative filepath from the root of the mapboxgl repo
// data: base64 encoded string of the data to be persisted to disk
module.exports = function(filepath, data, callback) {
    const xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
        if (xhttp.readyState === 4 && xhttp.status === 200) {
            callback();
        }
    };
    xhttp.open("POST", "/write-file", true);
    xhttp.setRequestHeader("Content-type", "application/json");

    const postData = {
        filePath: filepath,
        data
    };
    xhttp.send(JSON.stringify(postData));
};
