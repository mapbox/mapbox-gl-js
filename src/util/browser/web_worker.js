// @flow

import window from '../window';
import mapboxgl from '../../';

import type {WorkerInterface} from '../web_worker';

export default function (): WorkerInterface {
    return (mapboxgl.workerClass != null) ? new mapboxgl.workerClass() : (new window.Worker(mapboxgl.workerUrl): any); // eslint-disable-line new-cap
}
