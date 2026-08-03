import type {Map} from '../map';
import type {Handler, HandlerResult} from '../handler';

const defaultOptions = {
    panStep: 100,
    bearingStep: 15,
    pitchStep: 10
};

/**
 * The `KeyboardHandler` allows the user to zoom, rotate, and pan the map using
 * the following keyboard shortcuts:
 *
 * - `=` / `+`: Increase the zoom level by 1.
 * - `Shift-=` / `Shift-+`: Increase the zoom level by 2.
 * - `-`: Decrease the zoom level by 1.
 * - `Shift--`: Decrease the zoom level by 2.
 * - Arrow keys: Pan by 100 pixels.
 * - `Shift+⇢`: Increase the rotation by 15 degrees.
 * - `Shift+⇠`: Decrease the rotation by 15 degrees.
 * - `Shift+⇡`: Increase the pitch by 10 degrees.
 * - `Shift+⇣`: Decrease the pitch by 10 degrees.
 *
 * @see [Example: Toggle interactions](https://docs.mapbox.com/mapbox-gl-js/example/toggle-interaction-handlers/)
 * @see [Example: Navigate the map with game-like controls](https://docs.mapbox.com/mapbox-gl-js/example/game-controls/)
 * @see [Example: Display map navigation controls](https://docs.mapbox.com/mapbox-gl-js/example/navigation/)
 */
class KeyboardHandler implements Handler {
    _enabled!: boolean;
    _active!: boolean;
    _panStep: number;
    _bearingStep: number;
    _pitchStep: number;
    _bearingDisabled: boolean;
    _pitchDisabled: boolean;
    _panDisabled: boolean;
    _zoomDisabled: boolean;

    /**
    * @private
    */
    constructor() {
        const stepOptions = defaultOptions;
        this._panStep = stepOptions.panStep;
        this._bearingStep = stepOptions.bearingStep;
        this._pitchStep = stepOptions.pitchStep;
        this._bearingDisabled = false;
        this._pitchDisabled = false;
        this._panDisabled = false;
        this._zoomDisabled = false;
    }

    blur() {
        this.reset();
    }

    reset() {
        this._active = false;
    }

    keydown(e: KeyboardEvent): HandlerResult | null | undefined {
        if (e.altKey || e.ctrlKey || e.metaKey) return;
        if (!this.isEnabled()) return;

        let zoomDir = 0;
        let bearingDir = 0;
        let pitchDir = 0;
        let xDir = 0;
        let yDir = 0;

        switch (e.keyCode) {
        case 61:
        case 107:
        case 171:
        case 187:
            zoomDir = 1;
            break;

        case 189:
        case 109:
        case 173:
            zoomDir = -1;
            break;

        case 37:
            if (e.shiftKey) {
                bearingDir = -1;
            } else {
                e.preventDefault();
                xDir = -1;
            }
            break;

        case 39:
            if (e.shiftKey) {
                bearingDir = 1;
            } else {
                e.preventDefault();
                xDir = 1;
            }
            break;

        case 38:
            if (e.shiftKey) {
                pitchDir = 1;
            } else {
                e.preventDefault();
                yDir = -1;
            }
            break;

        case 40:
            if (e.shiftKey) {
                pitchDir = -1;
            } else {
                e.preventDefault();
                yDir = 1;
            }
            break;

        default:
            return;
        }

        if (this._bearingDisabled) {
            bearingDir = 0;
        }

        if (this._pitchDisabled) {
            pitchDir = 0;
        }

        if (this._panDisabled) {
            xDir = 0;
            yDir = 0;
        }

        if (this._zoomDisabled) {
            zoomDir = 0;
        }

        return {
            cameraAnimation: (map: Map) => {
                const zoom = map.getZoom();

                map.easeTo({
                    duration: 300,
                    easeId: 'keyboardHandler',
                    easing: easeOut,
                    zoom: zoomDir ? Math.round(zoom) + zoomDir * (e.shiftKey ? 2 : 1) : zoom,
                    bearing: map.getBearing() + bearingDir * this._bearingStep,
                    pitch: map.getPitch() + pitchDir * this._pitchStep,
                    offset: [-xDir * this._panStep, -yDir * this._panStep],
                    center: map.getCenter()
                }, {originalEvent: e});
            }
        };
    }

    /**
     * Enables the "keyboard rotate and zoom" interaction.
     *
     * @example
     * map.keyboard.enable();
     */
    enable() {
        this._enabled = true;
    }

    /**
     * Disables the "keyboard rotate and zoom" interaction.
     *
     * @example
     * map.keyboard.disable();
     */
    disable() {
        this._enabled = false;
        this.reset();
    }

    /**
     * Returns a Boolean indicating whether the "keyboard rotate and zoom"
     * interaction is enabled.
     *
     * @returns {boolean} `true` if the "keyboard rotate and zoom"
     * interaction is enabled.
     * @example
     * const isKeyboardEnabled = map.keyboard.isEnabled();
     */
    isEnabled(): boolean {
        return this._enabled && !(this._bearingDisabled && this._pitchDisabled && this._panDisabled && this._zoomDisabled);
    }

    /**
     * Returns true if the handler is enabled and has detected the start of a
     * zoom/rotate gesture.
     *
     * @returns {boolean} `true` if the handler is enabled and has detected the
     * start of a zoom/rotate gesture.
     * @example
     * const isKeyboardActive = map.keyboard.isActive();
     */
    isActive(): boolean {
        return this._active;
    }

    /**
     * Disables the "keyboard pitch/rotate" interaction, leaving the
     * "keyboard zoom" interaction enabled.
     *
     * @example
     * map.keyboard.disableRotation();
     */
    disableRotation() {
        this._pitchDisabled = true;
        this._bearingDisabled = true;
    }

    /**
     * Enables the "keyboard pitch/rotate" interaction.
     *
     * @example
     * map.keyboard.enable();
     * map.keyboard.enableRotation();
     */
    enableRotation() {
        this._pitchDisabled = false;
        this._bearingDisabled = false;
    }

    /**
     * Returns a Boolean indicating whether the "keyboard pitch/rotate"
     * interaction is enabled.
     *
     * @returns {boolean} `true` if the "keyboard pitch/rotate"
     * interaction is enabled.
     * @example
     * const isRotationEnabled = map.keyboard.isRotationEnabled();
     */
    isRotationEnabled(): boolean {
        return !this._pitchDisabled && !this._bearingDisabled;
    }

    /**
     * Disables the "keyboard pan" interaction (arrow keys), leaving the
     * "keyboard zoom" and "keyboard rotate/pitch" interactions enabled.
     *
     * @example
     * map.keyboard.disablePan();
     */
    disablePan() {
        this._panDisabled = true;
    }

    /**
     * Enables the "keyboard pan" interaction (arrow keys).
     *
     * @example
     * map.keyboard.enable();
     * map.keyboard.enablePan();
     */
    enablePan() {
        this._panDisabled = false;
    }

    /**
     * Returns a Boolean indicating whether the "keyboard pan" interaction is
     * enabled.
     *
     * @returns {boolean} `true` if the "keyboard pan" interaction is enabled.
     * @example
     * const isPanEnabled = map.keyboard.isPanEnabled();
     */
    isPanEnabled(): boolean {
        return !this._panDisabled;
    }

    /**
     * Disables the "keyboard zoom" interaction (plus/minus keys), leaving the
     * "keyboard pan" and "keyboard rotate/pitch" interactions enabled.
     *
     * @example
     * map.keyboard.disableZoom();
     */
    disableZoom() {
        this._zoomDisabled = true;
    }

    /**
     * Enables the "keyboard zoom" interaction (plus/minus keys).
     *
     * @example
     * map.keyboard.enable();
     * map.keyboard.enableZoom();
     */
    enableZoom() {
        this._zoomDisabled = false;
    }

    /**
     * Returns a Boolean indicating whether the "keyboard zoom" interaction is
     * enabled.
     *
     * @returns {boolean} `true` if the "keyboard zoom" interaction is enabled.
     * @example
     * const isZoomEnabled = map.keyboard.isZoomEnabled();
     */
    isZoomEnabled(): boolean {
        return !this._zoomDisabled;
    }

    /**
     * Disables the "keyboard pitch" interaction (Shift+Up/Down), leaving the
     * "keyboard pan" and "keyboard rotate" interactions enabled.
     *
     * @example
     * map.keyboard.disablePitch();
     */
    disablePitch() {
        this._pitchDisabled = true;
    }

    /**
     * Enables the "keyboard pitch" interaction (Shift+Up/Down).
     *
     * @example
     * map.keyboard.enable();
     * map.keyboard.enablePitch();
     */
    enablePitch() {
        this._pitchDisabled = false;
    }

    /**
     * Returns a Boolean indicating whether the "keyboard pitch" interaction is
     * enabled.
     *
     * @returns {boolean} `true` if the "keyboard pitch" interaction is enabled.
     * @example
     * const isPitchEnabled = map.keyboard.isPitchEnabled();
     */
    isPitchEnabled(): boolean {
        return !this._pitchDisabled;
    }

    /**
     * Disables the "keyboard bearing" interaction (Shift+Left/Right), leaving the
     * "keyboard pan" and "keyboard pitch" interactions enabled.
     *
     * @example
     * map.keyboard.disableBearing();
     */
    disableBearing() {
        this._bearingDisabled = true;
    }

    /**
     * Enables the "keyboard bearing" interaction (Shift+Left/Right).
     *
     * @example
     * map.keyboard.enable();
     * map.keyboard.enableBearing();
     */
    enableBearing() {
        this._bearingDisabled = false;
    }

    /**
     * Returns a Boolean indicating whether the "keyboard bearing" interaction is
     * enabled.
     *
     * @returns {boolean} `true` if the "keyboard bearing" interaction is enabled.
     * @example
     * const isBearingEnabled = map.keyboard.isBearingEnabled();
     */
    isBearingEnabled(): boolean {
        return !this._bearingDisabled;
    }
}

function easeOut(t: number) {
    return t * (2 - t);
}

export default KeyboardHandler;
