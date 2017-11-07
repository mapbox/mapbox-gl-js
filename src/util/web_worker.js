// @flow

const Worker = require('../source/worker');

import type {WorkerSource} from '../source/worker_source';

type MessageListener = ({data: Object}) => mixed;

// The main thread interface. Provided by Worker in a browser environment,
// and MessageBus below in a node environment.
export interface WorkerInterface {
    addEventListener(type: 'message', listener: MessageListener): void;
    removeEventListener(type: 'message', listener: MessageListener): void;
    postMessage(message: any): void;
    terminate(): void;
}

export interface WorkerGlobalScopeInterface {
    importScripts(...urls: Array<string>): void;

    registerWorkerSource: (string, Class<WorkerSource>) => void,
    registerRTLTextPlugin: (any) => void
}

class MessageBus implements WorkerInterface, WorkerGlobalScopeInterface {
    addListeners: Array<MessageListener>;
    postListeners: Array<MessageListener>;
    target: MessageBus;
    registerWorkerSource: *;
    registerRTLTextPlugin: *;

    constructor(addListeners: Array<MessageListener>, postListeners: Array<MessageListener>) {
        this.addListeners = addListeners;
        this.postListeners = postListeners;
    }

    addEventListener(event: 'message', callback: MessageListener) {
        if (event === 'message') {
            this.addListeners.push(callback);
        }
    }

    removeEventListener(event: 'message', callback: MessageListener) {
        const i = this.addListeners.indexOf(callback);
        if (i >= 0) {
            this.addListeners.splice(i, 1);
        }
    }

    postMessage(data: Object) {
        setImmediate(() => {
            for (const listener of this.postListeners) {
                listener({data: data, target: this.target});
            }
        });
    }

    terminate() {
        this.addListeners.splice(0, this.addListeners.length);
        this.postListeners.splice(0, this.postListeners.length);
    }

    importScripts() {}
}

module.exports = function (): WorkerInterface {
    const parentListeners = [],
        workerListeners = [],
        parentBus = new MessageBus(workerListeners, parentListeners),
        workerBus = new MessageBus(parentListeners, workerListeners);

    parentBus.target = workerBus;
    workerBus.target = parentBus;

    new Worker(workerBus);

    return parentBus;
};
