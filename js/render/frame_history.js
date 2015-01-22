'use strict';

module.exports = FrameHistory;

function FrameHistory() {
    this.frameHistory = [];
}

FrameHistory.prototype.getFadeProperties = function(duration) {
    if (duration === undefined) duration = 300;
    var currentTime = (new Date()).getTime();

    // Remove frames until only one is outside the duration, or until there are only three
    while (this.frameHistory.length > 3 && this.frameHistory[1].time + duration < currentTime) {
        this.frameHistory.shift();
    }

    if (this.frameHistory[1].time + duration < currentTime) {
        this.frameHistory[0].z = this.frameHistory[1].z;
    }

    var frameLen = this.frameHistory.length;
    if (frameLen < 3) console.warn('there should never be less than three frames in the history');

    // Find the range of zoom levels we want to fade between
    var startingZ = this.frameHistory[0].z,
        lastFrame = this.frameHistory[frameLen - 1],
        endingZ = lastFrame.z,
        lowZ = Math.min(startingZ, endingZ),
        highZ = Math.max(startingZ, endingZ);

    // Calculate the speed of zooming, and how far it would zoom in terms of zoom levels in one duration
    var zoomDiff = lastFrame.z - this.frameHistory[1].z,
        timeDiff = lastFrame.time - this.frameHistory[1].time;
    var fadedist = zoomDiff / (timeDiff / duration);

    if (isNaN(fadedist)) console.warn('fadedist should never be NaN');

    // At end of a zoom when the zoom stops changing continue pretending to zoom at that speed
    // bump is how much farther it would have been if it had continued zooming at the same rate
    var bump = (currentTime - lastFrame.time) / duration * fadedist;

    return {
        fadedist: fadedist,
        minfadezoom: lowZ,
        maxfadezoom: highZ,
        bump: bump
    };
};

// Record frame history that will be used to calculate fading params
FrameHistory.prototype.record = function(zoom) {
    var currentTime = (new Date()).getTime();

    // first frame ever
    if (!this.frameHistory.length) {
        this.frameHistory.push({time: 0, z: zoom }, {time: 0, z: zoom });
    }

    if (this.frameHistory.length === 2 || this.frameHistory[this.frameHistory.length - 1].z !== zoom) {
        this.frameHistory.push({
            time: currentTime,
            z: zoom
        });
    }
};
