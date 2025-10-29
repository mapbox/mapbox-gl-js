import {DevTools} from '../ui/devtools';

export class PrecipitationRevealParams {
    revealStart: number;
    revealRange: number;

    constructor(folder: string) {
        this.revealStart = 11.0;
        this.revealRange = 2.0;

        DevTools.addParameter(this, 'revealStart', `${folder} > Reveal`, {min: 0, max: 17, step: 0.05});
        DevTools.addParameter(this, 'revealRange', `${folder} > Reveal`, {min: 0.1, max: 5.1, step: 0.05});
    }
}
