import {bindAll, isWorker} from './util';
import {serialize, deserialize} from './web_worker_transfer';
import Scheduler from './scheduler';

import type {Serialized} from './web_worker_transfer';
import type {Transferable} from '../types/transferable';
import type {Cancelable} from '../types/cancelable';
import type {Callback} from '../types/callback';
import type {TaskMetadata} from './scheduler';
import type {WorkerSource, WorkerSourceRequest} from '../source/worker_source';
import type {ActorMessage, ActorInbox} from './actor_messages';
import '../types/worker';

export type Task = {
    type: ActorMessage | '<response>';
    id?: string;
    data?: Serialized;
    error?: Serialized;
    targetMapId?: number;
    sourceMapId?: number;
    hasCallback?: boolean;
};

export type ActorCallback<T = unknown> = Callback<T> & {metadata?: TaskMetadata};

/**
 * Constraint that lets {@link Actor#send} index `Outbox[T]` generically.
 * @private
 */
type MessageMap = {[type: string]: {params: unknown; callback: unknown}};

/**
 * Dispatch-table view of the parent used by {@link Actor#processTask}: handlers
 * keyed by message name, plus `getWorkerSource` for dynamic `sourcetype.method`
 * messages.
 * @private
 */
type ActorParent = {
    [K in keyof ActorInbox]: (mapId: number, params: unknown, callback: unknown) => void;
} & {
    getWorkerSource?: (mapId: number, params: WorkerSourceRequest) => WorkerSource;
};

/**
 * An implementation of the [Actor design pattern](http://en.wikipedia.org/wiki/Actor_model)
 * that maintains the relationship between asynchronous tasks and the objects
 * that spin them off - in this case, tasks like parsing parts of styles,
 * owned by the styles
 *
 * `Outbox` is the inbox this actor sends to: a worker-side actor (parent
 * {@link MapWorker}) is an `Actor<MainInbox>`; a main-side actor (parent
 * {@link Style}) is an `Actor<WorkerInbox>`.
 *
 * @param {WebWorker} target
 * @param {unknown} parent
 * @param {number} [mapId] A unique identifier for the Map instance using this Actor.
 * @private
 */
class Actor<Outbox extends MessageMap> {
    target: Worker;
    parent: ActorParent;
    name?: string;
    mapId?: number;
    callbacks: Record<number, ActorCallback<ActorMessage>>;
    scheduler: Scheduler;

    constructor(target: Worker, parent: unknown, mapId?: number) {
        this.target = target;
        this.parent = parent as ActorParent;
        this.mapId = mapId;
        this.callbacks = {};
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
    send<T extends keyof Outbox>(
        type: T,
        data: Outbox[T]['params'],
        callback?: Outbox[T]['callback'],
        targetMapId?: number,
        callbackMetadata?: TaskMetadata,
    ): Cancelable | undefined {
        // We're using a string ID instead of numbers because they are being used as object keys
        // anyway, and thus stringified implicitly. We use random IDs because an actor may receive
        // message from multiple other actors which could run in different execution context. A
        // linearly increasing ID could produce collisions.
        const id = Math.round((Math.random() * 1e18)).toString(36).substring(0, 10);
        if (callback) {
            const actorCallback = callback as ActorCallback<ActorMessage>;
            actorCallback.metadata = callbackMetadata;
            this.callbacks[id] = actorCallback;
        }
        const buffers: Set<Transferable> = new Set();
        this.target.postMessage({
            id,
            type: type as ActorMessage,
            hasCallback: !!callback,
            targetMapId,
            sourceMapId: this.mapId,
            data: serialize(data, buffers)
        }, buffers as unknown as Transferable[]);
        return {
            cancel: () => {
                // Drop the callback; the worker still runs the task to completion, we just ignore its result.
                delete this.callbacks[id];
            }
        };
    }

    /**
     * A send-only view bound to `mapId`, for {@link WorkerSource}s. One worker-side
     * actor serves many maps and has no `mapId` of its own, so its outbound messages
     * must carry the owning map's id as `targetMapId`.
     * @private
     */
    getWorkerSourceActor(mapId: number): Pick<Actor<Outbox>, 'send' | 'scheduler'> {
        return {
            scheduler: this.scheduler,
            send: (type, data, callback, _targetMapId, callbackMetadata) => {
                return this.send(type, data, callback, mapId, callbackMetadata);
            },
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

        if (isWorker(self)) {
            // Worker tasks go through the scheduler so they run in priority order and yield between
            // each other instead of blocking the message loop.
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const callback = this.callbacks[id];
            const metadata = (callback && (callback as ActorCallback).metadata) || {type: 'message'};
            this.scheduler.add(() => this.processTask(id, data), metadata);
        } else {
            // In the main thread, process messages immediately so that other work does not slip in
            // between getting partial data back from workers.
            this.processTask(id, data);
        }
    }

    processTask(id: string, task: Task) {
        if (task.type === '<response>') {
            // The done() function in the counterpart has been called, and we are now
            // firing the callback in the originating actor, if there is one.
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const callback = this.callbacks[id];
            delete this.callbacks[id];
            if (callback) {
                // If we get a response, but don't have a callback, the request was canceled.
                if (task.error) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                    callback(deserialize(task.error));
                } else {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
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
                }, buffers as unknown as Transferable[]);
            } : () => {};

            const params = deserialize(task.data);

            // `task.type` is a message name ('loadTile', etc.) or a runtime
            // `sourcetype.method` (WorkerSource types register via Map#addSourceType).
            if (this.parent[task.type]) {
                // task.type == 'loadTile', 'removeTile', etc.
                this.parent[task.type](task.sourceMapId, params, done);
            } else if (this.parent.getWorkerSource) {
                // task.type == sourcetype.method
                const keys = task.type.split('.');
                const {source, scope} = params as {source: string; scope: string};
                const workerSource = this.parent.getWorkerSource(task.sourceMapId, {type: keys[0], source, scope, uid: 0});
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call
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
