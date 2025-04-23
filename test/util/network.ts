// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {vi} from './vitest';

const canvasElement = Object.assign(window.document.createElement('canvas'), {
    width: 1,
    height: 1
});

export function mockFetch(config: Record<string, (req: Request) => Promise<Response<unknown>>>) {
    return vi.spyOn(window, 'fetch').mockImplementation(
        async (req: Request): Promise<Response<unknown>> => {
            const responseKey = Object.keys(config).find(key => new RegExp(key).test(req.url));
            const response = config[responseKey];

            if (!response) {
                throw new Error(`No response for ${req.url}, available responses: ${Object.keys(config).join(', ')}`);
            }

            return await response(req);
        }
    );
}

export function getPNGResponse() {
    return new Promise((resolve, reject) => {
        try {
            canvasElement.toBlob(resolve, 'image/png');
        } catch (err) {
            reject(err as Error);
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
