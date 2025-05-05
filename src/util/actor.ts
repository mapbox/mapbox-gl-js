import {bindAll, isWorker} from './util';
import {serialize, deserialize} from './web_worker_transfer';
import Scheduler from './scheduler';

import type MapWorker from '../source/worker';
import type {Serialized} from './web_worker_transfer';
import type {Transferable} from '../types/transferable';
import type {Cancelable} from '../types/cancelable';
import type {Callback} from '../types/callback';
import type {TaskMetadata} from './scheduler';
import type {ActorMessage, ActorMessages} from './actor_messages';
import '../types/worker';

export type Task = {
    type: ActorMessage | '<response>' | '<cancel>';
    id?: string;
    data?: Serialized;
    error?: Serialized;
    targetMapId?: number;
    sourceMapId?: number;
    hasCallback?: boolean;
    mustQueue?: boolean;
};

export type ActorCallback<T = unknown> = Callback<T> & {metadata?: TaskMetadata};

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
    target: Worker;
    parent: MapWorker;
    name?: string;
    mapId?: number;
    callbacks: Record<number, ActorCallback<ActorMessage>>;
    cancelCallbacks: Record<string | number, Cancelable>;
    scheduler: Scheduler;

    constructor(target: Worker, parent: MapWorker, mapId?: number) {
        this.target = target;
        this.parent = parent;
        this.mapId = mapId;
        this.callbacks = {};
        this.cancelCallbacks = {};
        bindAll(['receive'], this);
        this.target.addEventListener('message', this.receive, false);
        this.scheduler = new Scheduler();
    }

    /**
     * Sends a message from a main-thread map to a Worker or from a Worker back to
     * a main-thread map instance.
     *
     * @param type The name of the target method to invoke or '[source-type].[source-name].name' for a method on a WorkerSource.
     * @param targetMapId A particular mapId to which to send this message.
     * @private
     */
    send<T extends ActorMessage>(
        type: T,
        data: ActorMessages[T]['params'],
        callback?: ActorMessages[T]['callback'],
        targetMapId?: number,
        mustQueue: boolean = false,
        callbackMetadata?: TaskMetadata,
    ): Cancelable | undefined {
        // We're using a string ID instead of numbers because they are being used as object keys
        // anyway, and thus stringified implicitly. We use random IDs because an actor may receive
        // message from multiple other actors which could run in different execution context. A
        // linearly increasing ID could produce collisions.
        const id = Math.round((Math.random() * 1e18)).toString(36).substring(0, 10);
        if (callback) {
            callback.metadata = callbackMetadata;
            this.callbacks[id] = callback;
        }
        const buffers: Set<Transferable> = new Set();
        this.target.postMessage({
            id,
            type,
            hasCallback: !!callback,
            targetMapId,
            mustQueue,
            sourceMapId: this.mapId,
            data: serialize(data, buffers)
        } as Task, buffers as unknown as Transferable[]);
        return {
            cancel: () => {
                if (callback) {
                    // Set the callback to null so that it never fires after the request is aborted.
                    delete this.callbacks[id];
                }
                this.target.postMessage({
                    id,
                    type: '<cancel>',
                    targetMapId,
                    sourceMapId: this.mapId
                } as Task);
            }
        };
    }

    receive(message: MessageEvent<Task>) {
        const data = message.data;
        if (!data) return;

        const id = data.id;
        if (!id) return;

        if (data.targetMapId && this.mapId !== data.targetMapId) {
            return;
        }

        if (data.type === '<cancel>') {
            // Remove the original request from the queue. This is only possible if it
            // hasn't been kicked off yet. The id will remain in the queue, but because
            // there is no associated task, it will be dropped once it's time to execute it.
            const cancel = this.cancelCallbacks[id];
            delete this.cancelCallbacks[id];
            if (cancel) {
                cancel.cancel();
            }
        } else {
            if (data.mustQueue || isWorker(self)) {
                // for worker tasks that are often cancelled, such as loadTile, store them before actually
                // processing them. This is necessary because we want to keep receiving <cancel> messages.
                // Some tasks may take a while in the worker thread, so before executing the next task
                // in our queue, postMessage preempts this and <cancel> messages can be processed.
                // We're using a MessageChannel object to get throttle the process() flow to one at a time.
                const callback = this.callbacks[id];
                const metadata = (callback && callback.metadata) || {type: 'message'};
                const cancel = this.scheduler.add(() => this.processTask(id, data), metadata);
                if (cancel) this.cancelCallbacks[id] = cancel;
            } else {
                // In the main thread, process messages immediately so that other work does not slip in
                // between getting partial data back from workers.
                this.processTask(id, data);
            }
        }
    }

    processTask(id: string, task: Task) {
        // Always delete since we are no longer cancellable
        delete this.cancelCallbacks[id];
        if (task.type === '<response>') {
            // The done() function in the counterpart has been called, and we are now
            // firing the callback in the originating actor, if there is one.
            const callback = this.callbacks[id];
            delete this.callbacks[id];
            if (callback) {
                // If we get a response, but don't have a callback, the request was canceled.
                if (task.error) {
                    callback(deserialize(task.error) as Error);
                } else {
                    callback(null, deserialize(task.data));
                }
            }
        } else {
            const buffers: Set<Transferable> = new Set();
            const done = task.hasCallback ? (err: Error | null | undefined, data?: unknown) => {
                this.target.postMessage({
                    id,
                    type: '<response>',
                    sourceMapId: this.mapId,
                    error: err ? serialize(err) : null,
                    data: serialize(data, buffers)
                } as Task, buffers as unknown as Transferable[]);
            } : () => {};

            const params = deserialize(task.data);
            if (this.parent[task.type]) {
                // task.type == 'loadTile', 'removeTile', etc.
                this.parent[task.type](task.sourceMapId, params as ActorMessages[ActorMessage]['params'], done);
            } else if (this.parent.getWorkerSource) {
                // task.type == sourcetype.method
                const keys = task.type.split('.');
                const {source, scope} = params as {source: string; scope: string};
                const workerSource = this.parent.getWorkerSource(task.sourceMapId, keys[0], source, scope);
                workerSource[keys[1]](params, done);
            } else {
                // No function was found.
                done(new Error(`Could not find function ${task.type}`));
            }
        }
    }

    remove() {
        this.scheduler.remove();
        this.target.removeEventListener('message', this.receive, false);
    }
}

export default Actor;
