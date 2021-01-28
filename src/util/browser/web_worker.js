// @flow

import window from '../window.js';
import mapboxgl from '../../index.js';

import type {WorkerInterface} from '../web_worker.js';

export default function (): WorkerInterface {
    return (mapboxgl.workerClass != null) ? new mapboxgl.workerClass() : (new window.Worker(mapboxgl.workerUrl): any); // eslint-disable-line new-cap
}
