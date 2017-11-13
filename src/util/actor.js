// @flow

const util = require('./util');

import type {Transferable} from '../types/transferable';

/**
 * An implementation of the [Actor design pattern](http://en.wikipedia.org/wiki/Actor_model)
 * that maintains the relationship between asynchronous tasks and the objects
 * that spin them off - in this case, tasks like parsing parts of styles,
 * owned by the styles
 *
 * @param {WebWorker} target
 * @param {WebWorker} parent
 * @param {string|number} mapId A unique identifier for the Map instance using this Actor.
 * @private
 */
class Actor {
    target: any;
    parent: any;
    mapId: string;
    callbacks: any;
    callbackID: number;
    name: string;

    constructor(target: any, parent: any, mapId: any) {
        this.target = target;
        this.parent = parent;
        this.mapId = mapId;
        this.callbacks = {};
        this.callbackID = 0;
        util.bindAll(['receive'], this);
        this.target.addEventListener('message', this.receive, false);
    }

    /**
     * Sends a message from a main-thread map to a Worker or from a Worker back to
     * a main-thread map instance.
     *
     * @param type The name of the target method to invoke or '[source-type].name' for a method on a WorkerSource.
     * @param buffers A list of buffers to "transfer" (see https://developer.mozilla.org/en-US/docs/Web/API/Transferable)
     * @param targetMapId A particular mapId to which to send this message.
     * @private
     */
    send(type: string, data: mixed, callback: ?Function, buffers: ?Array<Transferable>, targetMapId: ?string) {
        const id = callback ? `${this.mapId}:${this.callbackID++}` : null;
        if (callback) this.callbacks[id] = callback;
        this.target.postMessage({
            targetMapId: targetMapId,
            sourceMapId: this.mapId,
            type: type,
            id: String(id),
            data: data
        }, buffers);
    }

    receive(message: Object) {
        const data = message.data,
            id = data.id;
        let callback;

        if (data.targetMapId && this.mapId !== data.targetMapId)
            return;

        const done = (err, data, buffers) => {
            this.target.postMessage({
                sourceMapId: this.mapId,
                type: '<response>',
                id: String(id),
                error: err ? String(err) : null,
                data: data
            }, buffers);
        };

        if (data.type === '<response>') {
            callback = this.callbacks[data.id];
            delete this.callbacks[data.id];
            if (callback && data.error) {
                callback(new Error(data.error));
            } else if (callback) {
                callback(null, data.data);
            }
        } else if (typeof data.id !== 'undefined' && this.parent[data.type]) {
            // data.type == 'loadTile', 'removeTile', etc.
            this.parent[data.type](data.sourceMapId, data.data, done);
        } else if (typeof data.id !== 'undefined' && this.parent.getWorkerSource) {
            // data.type == sourcetype.method
            const keys = data.type.split('.');
            const workerSource = (this.parent: any).getWorkerSource(data.sourceMapId, keys[0]);
            workerSource[keys[1]](data.data, done);
        } else {
            this.parent[data.type](data.data);
        }
    }

    remove() {
        this.target.removeEventListener('message', this.receive, false);
    }
}

module.exports = Actor;
