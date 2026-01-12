import {server} from 'vitest/browser';

export async function readArrayBuffer(path: string) {
    const data = await server.commands.readFile(path, 'binary');
    const arrayBuffer = new ArrayBuffer(data.length);
    const view = new Uint8Array(arrayBuffer);
    for (let i = 0; i < data.length; i++) {
        view[i] = data.charCodeAt(i);
    }
    return arrayBuffer;
}
