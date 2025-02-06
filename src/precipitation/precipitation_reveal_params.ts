import {type ITrackedParameters} from '../tracked-parameters/tracked_parameters_base';

export class PrecipitationRevealParams {
    revealStart: number;
    revealRange: number;

    constructor(tp: ITrackedParameters, namespace: Array<string>) {
        this.revealStart = 11.0;
        this.revealRange = 2.0;

        tp.registerParameter(this, [...namespace, "Reveal"], 'revealStart', {min: 0, max: 17, step: 0.05});
        tp.registerParameter(this, [...namespace, "Reveal"], 'revealRange', {min: 0.1, max: 5.1, step: 0.05});
    }
}
