// @flow

import { CanonicalTileID } from "../source/tile_id";
import { PossiblyEvaluated } from "../style/properties";
class ParticleSystem {
    emitters: Array<Emitter>;
    lastUpdate: any;
    zoomLevel: number;

    constructor() {
        this.emitters = [];
        this.lastUpdate = new Date().getTime();
        this.update();
        this.zoomLevel = 0;
    }
    
    update() {
        let now = new Date().getTime();
        let sinceLastUpdateMillis = now - this.lastUpdate;
        if (sinceLastUpdateMillis < 10) {
            return;
        }
        this.lastUpdate = new Date().getTime();
        for (const emitter of this.emitters) {
            emitter.update();
        }
        //setTimeout(() => { this.update() }, 100);
    }

    addEmitter(feature: any, location: Point, tileId: CanonicalTileID, mercatorPoint: Point, paint: PossiblyEvaluated<PaintProps>) {
        if (!tileId) {
            return;
        }
        for (const emitter of this.emitters) {
            if (emitter.mercatorPoint.x === mercatorPoint.x && emitter.mercatorPoint.y === mercatorPoint.y) {
                emitter.location = location;
                emitter.tileId = tileId;
                return;
            }
        }
        this.emitters.push(new Emitter(feature, location, tileId, mercatorPoint, paint));
    }

}
class Emitter {
    particles: Array<Particle>;
    location: Point;
    feature: any;
    elevation: number;
    zoom: number;
    maxParticleCount: number;
    featureId: number;
    tileId: CanonicalTileID;
    mercatorPoint: Point;
    paint: PossiblyEvaluated<PaintProps>;

    constructor(feature: any, location: Point, tileId: CanonicalTileID, mercatorPoint: Point, paint: PossiblyEvaluated<PaintProps>) {
        this.feature = feature;
        this.particles = [];
        this.location = location;
        this.elevation = 1.0;
        this.zoom = tileId.z;
        this.maxParticleCount = (paint.get('particle-emitter-type') === 'cloud') ? 100 : 250;
        this.featureId = undefined;
        this.tileId = tileId;
        this.mercatorPoint = mercatorPoint;
        this.paint = paint;
    }
    
    update() {
        while (this.particles.length < this.maxParticleCount) {
            this.particles.push(new Particle(this.paint));
        }

        for (const particle of this.particles) {
            particle.update();
        }
        this.particles = this.particles.filter(item => item.isAlive);
    }

}
class Particle {
    direction: any;
    velocity: number;
    timeToLive: number;
    minScale: number;
    maxScale: number;
    minTimeToLive: number;
    maxTimeToLive: number;
    paint: PossiblyEvaluated<PaintProps>;

    isAlive: boolean;
    locationOffset: any;
    elevation: number;
    opacity: number;
    scale: number;
    birthTime: number;
    color: any;

    constructor(paint: PossiblyEvaluated<PaintProps>) {
        this.isAlive = true;
        this.paint = paint;
        let clouds = (paint.get('particle-emitter-type') === 'cloud');
        
        // Distribute position in a circle
        const offsetRange = clouds ? 50.0 : 200.0;
        const r = Math.sqrt(Math.random()) * offsetRange;
        const theta = Math.random() * 2 * Math.PI;
        this.locationOffset = {
            x: r * Math.cos(theta),
            y: r * Math.sin(theta),
            z: clouds ? 2000.0 + Math.random() * 500.0 : 0.0
        };

        //var dir = Math.random();
        var dir = 0.9;
        this.direction = {x: dir, y: 1.0 - dir, z: 0.0 };

        let minVelocity = paint.get('particle-emitter-velocity-min').constantOr(0);
        let maxVelocity = paint.get('particle-emitter-velocity-min').constantOr(0);
        this.velocity = Math.random() * (maxVelocity - minVelocity) + minVelocity;

        this.opacity = 1.0;
        
        this.maxScale = clouds ? 30.0 : 3.0;
        this.minScale = clouds ? 10.0 : 0.5;
        this.scale = Math.random() * (this.maxScale - this.minScale) + this.minScale;
        
        this.minTimeToLive = paint.get('particle-emitter-ttl-min').constantOr(-1);
        this.maxTimeToLive = paint.get('particle-emitter-ttl-max').constantOr(-1);
        this.timeToLive = Math.random() * (this.maxTimeToLive - this.minTimeToLive) + this.minTimeToLive;
        this.birthTime = new Date().getTime();
        
        const colorA = clouds ? {r: 1.0, g: 1.0, b: 1.0} : {r: 1.0, g: 1.0, b: 0.0};
        const colorB = clouds ? {r: 0.8, g: 0.8, b: 0.8} : {r: 0.2, g: 0.2, b: 1.0};
        const lerp = (a, b, t) => a * (1 - t) + b * t;
        const randomColorProg = Math.pow(Math.random(), 2.0);
        this.color = {
            r: lerp(colorA.r, colorB.r, randomColorProg),
            g: lerp(colorA.g, colorB.g, randomColorProg),
            b: lerp(colorA.b, colorB.b, randomColorProg)
        };

        //console.count("New particle");
    }
    
    update() {
        let now = new Date().getTime();
        let timeSinceBith = now - this.birthTime;
        let lifePosition = this.timeToLive > 0 ? timeSinceBith / this.timeToLive : 0.5;
        if (lifePosition >= 1.0) {
            this.isAlive = false;
        }

        if (lifePosition < 0.2) {
            this.opacity = (lifePosition / 0.2);
        } else if (lifePosition > 0.8) {
            this.opacity = (1.0 - lifePosition) / 0.2;
        } else {
            this.opacity = 1.0;
        }
        this.locationOffset.x += this.direction.x * this.velocity;
        this.locationOffset.y += this.direction.y * this.velocity;
    }

}

let globalSystem = new ParticleSystem();

export { globalSystem };