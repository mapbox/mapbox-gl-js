import type {MouseRotateHandler, MousePitchHandler} from '../mouse';

/**
 * The `DragRotateHandler` allows the user to rotate the map by clicking and
 * dragging the cursor while holding the right mouse button or `ctrl` key.
 *
 * @see [Example: Toggle interactions](https://docs.mapbox.com/mapbox-gl-js/example/toggle-interaction-handlers/)
 * @see [Example: Disable map rotation](https://docs.mapbox.com/mapbox-gl-js/example/disable-rotation/)
 */
export default class DragRotateHandler {

    _mouseRotate: MouseRotateHandler;
    _mousePitch: MousePitchHandler;
    _pitchWithRotate: boolean;
    _pitchDisabled: boolean;
    _rotationDisabled: boolean;

    /**
     * @param {Object} [options]
     * @param {number} [options.bearingSnap] The threshold, measured in degrees, that determines when the map's
     *   bearing will snap to north.
     * @param {bool} [options.pitchWithRotate=true] Control the map pitch in addition to the bearing
     * @private
     */
    constructor(options: {
        pitchWithRotate: boolean;
    }, mouseRotate: MouseRotateHandler, mousePitch: MousePitchHandler) {
        this._pitchWithRotate = options.pitchWithRotate;
        this._mouseRotate = mouseRotate;
        this._mousePitch = mousePitch;
        this._pitchDisabled = false;
        this._rotationDisabled = false;
    }

    /**
     * Enables the "drag to rotate" interaction.
     *
     * @example
     * map.dragRotate.enable();
     */
    enable() {
        if (!this._rotationDisabled) this._mouseRotate.enable();
        if (this._pitchWithRotate && !this._pitchDisabled) this._mousePitch.enable();
    }

    /**
     * Disables the "drag to rotate" interaction.
     *
     * @example
     * map.dragRotate.disable();
     */
    disable() {
        this._mouseRotate.disable();
        this._mousePitch.disable();
    }

    /**
     * Returns a Boolean indicating whether the "drag to rotate" interaction is enabled.
     *
     * @returns {boolean} `true` if the "drag to rotate" interaction is enabled.
     * @example
     * const isDragRotateEnabled = map.dragRotate.isEnabled();
     */
    isEnabled(): boolean {
        // If pitchWithRotate is true, then the dragRotate interaction is considered enabled
        // if either the rotation or pitch interactions are enabled.
        if (this._pitchWithRotate) {
            return (!this._rotationDisabled && this._mouseRotate.isEnabled()) ||
                (!this._pitchDisabled && this._mousePitch.isEnabled());
        } else {
            return !this._rotationDisabled && this._mouseRotate.isEnabled();
        }
    }

    /**
     * Returns a Boolean indicating whether the "drag to rotate" interaction is active (currently being used).
     *
     * @returns {boolean} Returns `true` if the "drag to rotate" interaction is active.
     * @example
     * const isDragRotateActive = map.dragRotate.isActive();
     */
    isActive(): boolean {
        return this._mouseRotate.isActive() || this._mousePitch.isActive();
    }

    /**
     * Disables the "drag to pitch" interaction, leaving the "drag to rotate"
     * interaction enabled.
     *
     * @example
     * map.dragRotate.disablePitch();
     */
    disablePitch() {
        this._pitchDisabled = true;
        this._mousePitch.disable();
    }

    /**
     * Enables the "drag to pitch" interaction.
     *
     * Has no effect if the handler was constructed with `pitchWithRotate: false`.
     *
     * @example
     * map.dragRotate.enablePitch();
     */
    enablePitch() {
        this._pitchDisabled = false;
        if (this._pitchWithRotate) this._mousePitch.enable();
    }

    /**
     * Returns a Boolean indicating whether the "drag to pitch" interaction is enabled.
     *
     * @returns {boolean} `true` if the "drag to pitch" interaction is enabled.
     * @example
     * const isDragPitchEnabled = map.dragRotate.isPitchEnabled();
     */
    isPitchEnabled(): boolean {
        return !this._pitchDisabled && this._mousePitch.isEnabled();
    }

    /**
     * Disables the "drag to rotate" interaction, leaving the "drag to pitch"
     * interaction enabled.
     *
     * @example
     * map.dragRotate.disableRotation();
     */
    disableRotation() {
        this._rotationDisabled = true;
        this._mouseRotate.disable();
    }

    /**
     * Enables the "drag to rotate" interaction.
     *
     * @example
     * map.dragRotate.enableRotation();
     */
    enableRotation() {
        this._rotationDisabled = false;
        this._mouseRotate.enable();
    }
    /**
     * Returns a Boolean indicating whether the "drag to rotate" interaction is enabled.
     *
     * @returns {boolean} `true` if the "drag to rotate" interaction is enabled.
     * @example
     * const isDragRotationEnabled = map.dragRotate.isRotationEnabled();
     */
    isRotationEnabled(): boolean {
        return !this._rotationDisabled && this._mouseRotate.isEnabled();
    }
}
