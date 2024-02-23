// @flow

// Main module for tracked parameters usage
// - For prod builds module exports mocked function and classes
// - For non-prod builds without "devtools" map option exports mocked function and classes
// - For prod builds with "devtools" map option exports actual function and classes

/* eslint-disable import/no-unresolved */
/* $FlowFixMe[cannot-resolve-module] */
import {TrackedParameters, registerParameter, registerButton} from 'tracked_parameters_proxy';
import {TrackedParameters as TrackedParametersMock} from './internal/tracked_parameters_mock.js';

export {TrackedParameters, TrackedParametersMock, registerParameter, registerButton};
