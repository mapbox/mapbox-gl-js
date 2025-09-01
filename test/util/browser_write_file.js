/* eslint-env browser */
/* eslint-disable import/no-commonjs */
/* global WorkerGlobalScope */

// Tests running in the browser need to be able to persist files to disk in certain situations.
// our test server (server.js) actually handles the file-io and listens for POST request to /write-file
// This worker provides a helper method to send that POST request.
// filepath: relative filepath from the root of the mapboxgl repo
// data: base64 encoded string of the data to be persisted to disk
function isWorker() {
    // @ts-expect-error - TS2304
    return typeof WorkerGlobalScope !== 'undefined' && typeof self !== 'undefined' && self instanceof WorkerGlobalScope;
}
const browserWriteFile = (filepath, data, cb) => {
    const xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function () {
        if (xhttp.readyState === 4 && xhttp.status === 200) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            cb();
        }
    };
    xhttp.open("POST", "/write-file", true);
    xhttp.setRequestHeader("Content-type", "application/json");

    const postData = {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        filePath: filepath,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data
    };
    xhttp.send(JSON.stringify(postData));
};

if (isWorker()) {
    onmessage = function (e) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        e.data.forEach((file) => {
            browserWriteFile(
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              file.path,
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              file.data,
               () => {
                   self.postMessage(true);
               }
            );
        });
    };
} else {
    module.exports = browserWriteFile;
}

