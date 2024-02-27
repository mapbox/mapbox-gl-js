import {setupWorker} from 'msw/browser';

export async function getNetworkWorker(_, ...handlers) {
    const worker = setupWorker(...handlers);

    await worker.start({
        onUnhandledRequest: 'bypass',
        quiet: true
    });

    return worker;
}

const canvasElement = Object.assign(window.document.createElement('canvas'), {
    width: 1,
    height: 1
});

export function getPNGResponse() {
    return new Promise((resolve, reject) => {
        try {
            canvasElement.toBlob(resolve, 'image/png');
        } catch (err) {
            reject(err);
        }
    });
}

export function getRequestBody(request) {
    let data = '';

    return new Promise(resolve => {
        request.body.pipeTo(new window.WritableStream({
            write(chunk) {
                data += new TextDecoder().decode(chunk);
            },
            close() {
                resolve(data);
            }
        }));
    });
}

export {http, HttpResponse} from 'msw';
