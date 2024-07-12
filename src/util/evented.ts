import {extend} from './util';

export type EventData = object;

export class Event<Type extends string = string, Data extends EventData | void = void> {
    target: unknown;
    readonly type: Type;

    /**
     * Virtual property to ensure that events with different data types are not compatible.
     *
     * @private
     * @example
     * new Event('click', {required: true}) satisfies Event<'click', {required: boolean}>;
     *
     * @example
     * // @ts-expect-error - Property 'required' is missing in type '{}' but required in type '{ required: boolean; }'
     * new Event('click', {}) satisfies Event<'click', {required: boolean}>;
     */
    private _eventData: Data;

    constructor(type: Type, eventData: Data = {} as Data) {
        extend(this, eventData as EventData);
        this.type = type;
    }
}

interface ErrorLike {
    message: string;
}

export class ErrorEvent extends Event<'error', EventData> {
    error: ErrorLike;

    constructor(error: ErrorLike, data: EventData = {} as EventData) {
        super('error', extend({error}, data));
    }
}

export type Listener<T = Event> = (e: T) => void

type Listeners<R extends EventRegistry> = {
    [T in keyof R]?: Array<Listener<EventOf<R[T]>>>;
};

/**
 * Utility type that represents a registry of events. Maps event type to an event object.
 */
type EventRegistry = Record<string, Event<string, EventData | void>>;
type GenericEventRegistry = Record<string, Event<string, EventData>>;

/**
 * Utility type that extracts the event data type from the event.
 */
type EventDataOf<E> = E extends Event<string, infer D> ? D : never;

/**
 * Utility type that extracts the event type and extends it with the event data type if present.
 */
type EventOf<E> =
    E extends Event<infer T, infer D> ?
        (D extends void ?
            Event<T, void> :
            // after migration to strongly typed events registry, this must be simplified to Event<T, D> & D
            Event<T, D> & (D extends object ? D & {[key: string]: any} : D)
        ) : never;

function _addEventListener<R extends EventRegistry, T extends keyof R>(type: T, listener: Listener<EventOf<R[T]>>, listenerList: Listeners<R>) {
    const listenerExists = listenerList[type] && listenerList[type].indexOf(listener) !== -1;
    if (!listenerExists) {
        listenerList[type] = listenerList[type] || [];
        listenerList[type].push(listener);
    }
}

function _removeEventListener<R extends EventRegistry, T extends keyof R>(type: T, listener: Listener<EventOf<R[T]>>, listenerList: Listeners<R>) {
    if (listenerList && listenerList[type]) {
        const index = listenerList[type].indexOf(listener);
        if (index !== -1) {
            listenerList[type].splice(index, 1);
        }
    }
}

/**
 * `Evented` mixes methods into other classes for event capabilities.
 *
 * Unless you are developing a plugin you will most likely use these methods through classes like `Map` or `Popup`.
 *
 * For lists of events you can listen for, see API documentation for specific classes: [`Map`](https://docs.mapbox.com/mapbox-gl-js/api/map/#map-events), [`Marker`](https://docs.mapbox.com/mapbox-gl-js/api/map/#map-events), [`Popup`](https://docs.mapbox.com/mapbox-gl-js/api/map/#map-events), and [`GeolocationControl`](https://docs.mapbox.com/mapbox-gl-js/api/map/#map-events).
 *
 * @mixin Evented
 */
export class Evented<R extends EventRegistry = GenericEventRegistry> {
    _listeners: Listeners<R>;
    _oneTimeListeners: Listeners<R>;
    _eventedParent?: Evented;
    _eventedParentData?: EventData | (() => EventData);

    /**
     * Adds a listener to a specified event type.
     *
     * @param {string} type The event type to add a listen for.
     * @param {Function} listener The function to be called when the event is fired.
     *   The listener function is called with the data object passed to `fire`,
     *   extended with `target` and `type` properties.
     * @returns {Object} Returns itself to allow for method chaining.
     */
    on<T extends keyof R & string>(type: T, listener: Listener<EventOf<R[T]>>): this {
        this._listeners = this._listeners || {};
        _addEventListener(type, listener, this._listeners);

        return this;
    }

    /**
     * Removes a previously registered event listener.
     *
     * @param {string} type The event type to remove listeners for.
     * @param {Function} listener The listener function to remove.
     * @returns {Object} Returns itself to allow for method chaining.
     */
    off<T extends keyof R & string>(type: T, listener: Listener<EventOf<R[T]>>): this {
        _removeEventListener(type, listener, this._listeners);
        _removeEventListener(type, listener, this._oneTimeListeners);

        return this;
    }

    /**
     * Adds a listener that will be called only once to a specified event type.
     *
     * The listener will be called first time the event fires after the listener is registered.
     *
     * @param {string} type The event type to listen for.
     * @param {Function} listener (Optional) The function to be called when the event is fired once.
     *   If not provided, returns a Promise that will be resolved when the event is fired once.
     * @returns {Object} Returns `this` | Promise.
     */
    once<T extends keyof R & string>(type: T): Promise<EventOf<R[T]>>;
    once<T extends keyof R & string>(type: T, listener: Listener<EventOf<R[T]>>): this;
    once<T extends keyof R & string>(type: T, listener?: Listener<EventOf<R[T]>>): this | Promise<EventOf<R[T]>> {
        if (!listener) {
            return new Promise((resolve) => this.once(type, resolve));
        }

        this._oneTimeListeners = this._oneTimeListeners || {};
        _addEventListener(type, listener, this._oneTimeListeners);

        return this;
    }

    fire<T extends keyof R>(event: R[T]): this;
    fire<T extends keyof R>(type: T, eventData?: EventDataOf<R[T]>): this;
    fire<T extends keyof R>(e: R[T] | T, eventData?: EventDataOf<R[T]>): this {
        // Compatibility with (type: string, properties: Object) signature from previous versions.
        // See https://github.com/mapbox/mapbox-gl-js/issues/6522,
        //     https://github.com/mapbox/mapbox-gl-draw/issues/766
        const event = (typeof e === 'string' ? new Event(e, eventData || {}) : e) as R[T];
        const type = event.type;

        if (this.listens(type)) {
            event.target = this;

            // make sure adding or removing listeners inside other listeners won't cause an infinite loop
            const listeners = this._listeners && this._listeners[type] ? this._listeners[type].slice() : [];

            for (const listener of listeners) {
                listener.call(this, event);
            }

            const oneTimeListeners = this._oneTimeListeners && this._oneTimeListeners[type] ? this._oneTimeListeners[type].slice() : [];
            for (const listener of oneTimeListeners) {
                _removeEventListener(type, listener, this._oneTimeListeners);
                listener.call(this, event);
            }

            const parent = this._eventedParent;
            if (parent) {
                const eventedParentData = typeof this._eventedParentData === 'function' ?
                    this._eventedParentData() :
                    this._eventedParentData;

                extend(event, eventedParentData);
                parent.fire(event as Event<string, EventData>);
            }

        // To ensure that no error events are dropped, print them to the
        // console if they have no listeners.
        } else if (event instanceof ErrorEvent) {
            console.error(event.error);
        }

        return this;
    }

    /**
     * Returns true if this instance of Evented or any forwarded instances of Evented have a listener for the specified type.
     *
     * @param {string} type The event type.
     * @returns {boolean} Returns `true` if there is at least one registered listener for specified event type, `false` otherwise.
     * @private
     */
    listens<T extends keyof R & string>(type: T): boolean {
        return !!(
            (this._listeners && this._listeners[type] && this._listeners[type].length > 0) ||
            (this._oneTimeListeners && this._oneTimeListeners[type] && this._oneTimeListeners[type].length > 0) ||
            (this._eventedParent && this._eventedParent.listens(type))
        );
    }

    /**
     * Bubble all events fired by this instance of Evented to this parent instance of Evented.
     *
     * @returns {Object} `this`
     * @private
     */
    setEventedParent(parent?: Evented, data?: EventData | (() => EventData)): this {
        this._eventedParent = parent;
        this._eventedParentData = data;

        return this;
    }
}
