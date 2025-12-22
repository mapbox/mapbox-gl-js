type PositionCallback = (position: GeolocationPosition) => void;
type ErrorCallback = (error: GeolocationPositionError) => void;

interface MockPosition {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp?: number;
}

interface MockError {
    code: number;
    message: string;
}

let currentPositionCallback: PositionCallback | null = null;
let currentErrorCallback: ErrorCallback | null = null;
const watchCallbacks = new Map<number, {success: PositionCallback; error?: ErrorCallback}>();
let nextWatchId = 1;

function createPosition(opts: MockPosition): GeolocationPosition {
    const timestamp = opts.timestamp ?? Date.now();
    const coords: GeolocationCoordinates = {
        latitude: opts.latitude,
        longitude: opts.longitude,
        accuracy: opts.accuracy,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
        toJSON() { return this; }
    };
    return {
        coords,
        timestamp,
        toJSON() { return this; }
    };
}

function createError(opts: MockError): GeolocationPositionError {
    return {
        code: opts.code,
        message: opts.message,
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3
    };
}

export const mockGeolocation = {
    use() {
        Object.defineProperty(navigator, 'geolocation', {
            value: {
                getCurrentPosition(success: PositionCallback, error?: ErrorCallback) {
                    currentPositionCallback = success;
                    currentErrorCallback = error ?? null;
                },
                watchPosition(success: PositionCallback, error?: ErrorCallback) {
                    const id = nextWatchId++;
                    watchCallbacks.set(id, {success, error});
                    return id;
                },
                clearWatch(id: number) {
                    watchCallbacks.delete(id);
                }
            },
            configurable: true
        });
    },

    send(opts: MockPosition) {
        const position = createPosition(opts);
        if (currentPositionCallback) {
            currentPositionCallback(position);
            currentPositionCallback = null;
            currentErrorCallback = null;
        }
        watchCallbacks.forEach(cb => cb.success(position));
    },

    sendError(opts: MockError) {
        const error = createError(opts);
        if (currentErrorCallback) {
            currentErrorCallback(error);
            currentPositionCallback = null;
            currentErrorCallback = null;
        }
    },

    change(opts: MockPosition) {
        const position = createPosition(opts);
        watchCallbacks.forEach(cb => cb.success(position));
    },

    changeError(opts: MockError) {
        const error = createError(opts);
        watchCallbacks.forEach(cb => cb.error?.(error));
    },

    reset() {
        currentPositionCallback = null;
        currentErrorCallback = null;
        watchCallbacks.clear();
        nextWatchId = 1;
    }
};
