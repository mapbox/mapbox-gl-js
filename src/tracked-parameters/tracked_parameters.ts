// Main module for tracked parameters usage
// - For prod builds module exports mocked function and classes
// - For non-prod builds without "devtools" map option exports mocked function and classes
// - For prod builds with "devtools" map option exports actual function and classes

/* eslint-disable import/no-unresolved */
import {
    TrackedParameters,
    registerParameter,
    registerButton,
    registerBinding,
    // @ts-expect-error - TS2305 - Module '"tracked_parameters_proxy"' has no exported member 'refreshUI'.
    refreshUI,
} from 'tracked_parameters_proxy';
import {TrackedParameters as TrackedParametersMock} from './internal/tracked_parameters_mock';

export {TrackedParameters, TrackedParametersMock, registerParameter, registerButton, registerBinding, refreshUI};
