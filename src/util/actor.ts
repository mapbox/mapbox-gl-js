import Scheduler from './scheduler';
import assert from '../style-spec/util/assert';
import {bindAll, isWorker} from './util';
import {serialize, deserialize} from './web_worker_transfer';
import '../types/worker';

import type {Serialized} from './web_worker_transfer';
import type {Transferable} from '../types/transferable';
import type {TaskMetadata} from './scheduler';
import type {WorkerSource, WorkerSourceRequest} from '../source/worker_source';
import type {ActorMessage, ActorInbox} from './actor_messages';

export type Task = {
    type: ActorMessage | '<response>';
    id?: string;
    data?: Serialized;
    error?: Serialized;
    targetMapId?: number;
    sourceMapId?: number;
};

type PendingResponse = {
    resolve: (value: unknown) => void;
    reject: (err: Error) => void;
    metadata: TaskMetadata;
    detach?: () => void;
};

const DEFAULT_METADATA: TaskMetadata = {type: 'message'};

/**
 * Constraint that lets {@link Actor#send} index `Outbox[T]` generically.
 * @private
 */
type MessageMap = {[type: string]: {params: unknown; result: unknown}};

/**
 * Dispatch-table view of the parent used by {@link Actor#processTask}: handlers
 * keyed by message name, plus `getWorkerSource` for dynamic `sourcetype.method`
 * messages. Each handler returns its result (or a Promise of it); `processTask`
 * awaits and posts a single `<response>`.
 * @private
 */
type ActorParent = {
    [K in keyof ActorInbox]: (mapId: number, params: unknown) => unknown;
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
    pendingResponses: Map<string, PendingResponse>;
    scheduler: Scheduler;

    constructor(target: Worker, parent: unknown, mapId?: number) {
        this.target = target;
        this.parent = parent as ActorParent;
        this.mapId = mapId;
        this.pendingResponses = new Map();
        bindAll(['receive'], this);
        this.target.addEventListener('message', this.receive, false);
        this.scheduler = new Scheduler();
    }

    /**
     * Sends a message from a main-thread map to a Worker or from a Worker back to a
     * main-thread map instance, and resolves with the worker's result. Registers a pending
     * response and is cancelable via `signal`. Use {@link Actor#notify} if you don't need a response.
     *
     * @param type The name of the target method to invoke or '[source-type].[source-name].name' for a method on a WorkerSource.
     * @param data The message payload.
     * @param options Optional send options (`signal` to cancel, `targetMapId`, scheduler `metadata`).
     * @private
     */
    send<T extends keyof Outbox>(type: T, data: Outbox[T]['params'], options?: {signal?: AbortSignal; targetMapId?: number; metadata?: TaskMetadata}): Promise<Outbox[T]['result']> {
        const {signal, targetMapId, metadata} = options || {};
        // We're using a string ID instead of numbers because they are being used as object keys
        // anyway, and thus stringified implicitly. We use random IDs because an actor may receive
        // message from multiple other actors which could run in different execution context. A
        // linearly increasing ID could produce collisions.
        const id = Math.round((Math.random() * 1e18)).toString(36).substring(0, 10);
        const buffers: Set<Transferable> = new Set();

        if (signal && signal.aborted) {
            return Promise.reject(signal.reason as Error);
        }

        this.target.postMessage({
            id,
            type: type as ActorMessage,
            targetMapId,
            sourceMapId: this.mapId,
            data: serialize(data, buffers)
        }, [...buffers]);

        return new Promise((resolve, reject) => {
            const entry: PendingResponse = {resolve, reject, metadata: metadata || DEFAULT_METADATA};

            if (signal) {
                const abortHandler = () => {
                    this.pendingResponses.delete(id);
                    reject(signal.reason as Error);
                };
                signal.addEventListener('abort', abortHandler, {once: true});
                entry.detach = () => signal.removeEventListener('abort', abortHandler);
            }

            this.pendingResponses.set(id, entry);
        });
    }

    /**
     * Sends a message without awaiting for response. Use {@link Actor#send} if you need to await a response.
     * @private
     */
    notify<T extends keyof Outbox>(type: T, data: Outbox[T]['params'], options?: {targetMapId?: number}): void {
        const {targetMapId} = options || {};
        const buffers: Set<Transferable> = new Set();

        this.target.postMessage({
            type: type as ActorMessage,
            targetMapId,
            sourceMapId: this.mapId,
            data: serialize(data, buffers)
        }, [...buffers]);
    }

    /**
     * Convenience wrapper around {@link send} for the common callback + cancellation pattern:
     * fires the message with a fresh AbortController, routes the result to a node-style callback,
     * swallows AbortError, and returns the {@link AbortController} so the caller can abort the request.
     *
     * @private
     */
    sendCancelable<T extends keyof Outbox>(
        type: T,
        data: Outbox[T]['params'],
        options: {targetMapId?: number; metadata?: TaskMetadata},
        callback: (err?: Error | null, result?: Outbox[T]['result']) => void
    ): AbortController {
        const controller = new AbortController();
        this.send(type, data, {...options, signal: controller.signal})
            .then((result) => callback(null, result))
            .catch((err: Error) => { if (err.name !== 'AbortError') callback(err); });
        return controller;
    }

    /**
     * A send-only view bound to `mapId`, for {@link WorkerSource}s. One worker-side
     * actor serves many maps and has no `mapId` of its own, so its outbound messages
     * must carry the owning map's id as `targetMapId`.
     * @private
     */
    getWorkerSourceActor(mapId: number): Pick<Actor<Outbox>, 'send' | 'notify' | 'sendCancelable' | 'scheduler'> {
        return {
            scheduler: this.scheduler,
            send: <T extends keyof Outbox>(type: T, data: Outbox[T]['params'], options?: {signal?: AbortSignal; metadata?: TaskMetadata}) => {
                return this.send(type, data, {...options, targetMapId: mapId});
            },
            notify: <T extends keyof Outbox>(type: T, data: Outbox[T]['params']) => {
                this.notify(type, data, {targetMapId: mapId});
            },
            sendCancelable: <T extends keyof Outbox>(type: T, data: Outbox[T]['params'], options: {metadata?: TaskMetadata}, callback: (err?: Error | null, result?: Outbox[T]['result']) => void) => {
                return this.sendCancelable(type, data, {...options, targetMapId: mapId}, callback);
            },
        };
    }

    receive(message: MessageEvent<Task>) {
        const data = message.data;
        if (!data) return;

        const id = data.id;
        if (data.targetMapId && this.mapId !== data.targetMapId) {
            return;
        }

        if (isWorker(self)) {
            // Worker tasks go through the scheduler so they run in priority order and yield between
            // each other instead of blocking the message loop. The worker's own glyph/image responses
            // carry 'maybePrepare' metadata (from `metadata` on the originating `send`), deferring them
            // onto the shared scheduler ahead of tile parsing.
            const entry = this.pendingResponses.get(id);
            const metadata = (entry && entry.metadata) || DEFAULT_METADATA;
            this.scheduler.add(() => {
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                this.processTask(id, data);
            }, metadata);
        } else {
            // In the main thread, process messages immediately so that other work does not slip in
            // between getting partial data back from workers.
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.processTask(id, data);
        }
    }

    async processTask(id: string, task: Task): Promise<void> {
        if (task.type === '<response>') {
            // The handler has resolved, and we are now resolving or rejecting
            // the Promise in the originating actor, if there is one.
            const entry = this.pendingResponses.get(id);
            this.pendingResponses.delete(id);
            if (entry) {
                // If we get a response, but don't have a stored resolver, the request was canceled.
                if (entry.detach) entry.detach();
                // Deserialization can throw on a malformed payload; reject so the caller observes an
                // error instead of hanging on a Promise that never settles.
                try {
                    if (task.error) {
                        entry.reject(deserialize(task.error) as Error);
                    } else {
                        entry.resolve(deserialize(task.data));
                    }
                } catch (err) {
                    entry.reject(err as Error);
                }
            }

            return;
        }

        const buffers: Set<Transferable> = new Set();
        const params = deserialize(task.data);

        // `task.type` is a message name ('loadTile', etc.) or a runtime
        // `sourcetype.method` (WorkerSource types register via Map#addSourceType).
        // Both dispatch by runtime string, so the handler lookup is untyped.
        try {
            let result: unknown;
            if (this.parent[task.type]) {
                // task.type == 'loadTile', 'removeTile', etc.
                result = await this.parent[task.type](task.sourceMapId, params);
            } else if (this.parent.getWorkerSource) {
                // task.type == sourcetype.method
                const keys = task.type.split('.');
                const {source, scope} = params as {source: string; scope: string};
                const workerSource = this.parent.getWorkerSource(task.sourceMapId, {type: keys[0], source, scope, uid: 0});
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                result = await workerSource[keys[1]](params);
            } else {
                throw new Error(`Could not find function ${task.type}`);
            }

            if (!id) return;

            this.target.postMessage({
                id,
                type: '<response>',
                sourceMapId: this.mapId,
                error: null,
                data: serialize(result, buffers)
            }, [...buffers]);
        } catch (err) {
            if (!id) assert(false, `"${task.type}" threw: ${(err as Error).message}`);

            this.target.postMessage({
                id,
                type: '<response>',
                sourceMapId: this.mapId,
                error: serialize(err),
                data: null
            }, []);
        }
    }

    remove() {
        // Reject any in-flight requests so their awaiters unwind instead of hanging forever once the
        // message listener is detached and responses can no longer arrive.
        for (const entry of this.pendingResponses.values()) {
            if (entry.detach) entry.detach();
            entry.reject(new DOMException('Actor removed', 'AbortError'));
        }
        this.pendingResponses.clear();
        this.scheduler.remove();
        this.target.removeEventListener('message', this.receive, false);
    }
}

export default Actor;
