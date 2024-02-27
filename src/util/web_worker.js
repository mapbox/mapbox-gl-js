// @flow

import WorkerClass from './worker_class.js';
import type {WorkerSource} from '../source/worker_source.js';

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

    registerWorkerSource?: (string, Class<WorkerSource>) => void,
    registerRTLTextPlugin?: (_: any) => void
}

export default function (): WorkerInterface {
    return (WorkerClass.workerClass != null) ? new WorkerClass.workerClass() : (new self.Worker(WorkerClass.workerUrl, WorkerClass.workerParams): any); // eslint-disable-line new-cap
}
