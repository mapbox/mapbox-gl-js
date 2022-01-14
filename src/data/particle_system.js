// @flow

import { CanonicalTileID } from "../source/tile_id";
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

    addEmitter(feature: any, location: Point, tileId: CanonicalTileID, mercatorPoint: Point, clouds: Boolean) {
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
        this.emitters.push(new Emitter(feature, location, tileId, mercatorPoint, clouds));
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
    clouds: Boolean;

    constructor(feature: any, location: Point, tileId: CanonicalTileID, mercatorPoint: Point, clouds: Boolean) {
        this.feature = feature;
        this.particles = [];
        this.location = location;
        this.elevation = 1.0;
        this.zoom = tileId.z;
        this.maxParticleCount = clouds ? 100 : 250;
        this.featureId = undefined;
        this.tileId = tileId;
        this.mercatorPoint = mercatorPoint;
        this.clouds = clouds;
    }
    
    update() {
        while (this.particles.length < this.maxParticleCount) {
            this.particles.push(new Particle(this.clouds));
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
    clouds: Boolean;

    isAlive: boolean;
    locationOffset: any;
    elevation: number;
    opacity: number;
    scale: number;
    birthTime: number;
    color: any;

    constructor(clouds: Boolean) {
        this.isAlive = true;
        this.clouds = clouds;
        // Distribute position in a circle
        const offsetRange = this.clouds ? 50.0 : 200.0;
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

        let minVelocity = this.clouds ? 0.01 : 0.0;
        let maxVelocity = this.clouds ? 0.05 : 0.0;
        this.velocity = Math.random() * (maxVelocity - minVelocity) + minVelocity;

        this.opacity = 1.0;
        
        this.maxScale = this.clouds ? 15.0 : 3.0;
        this.minScale = this.clouds ? 5.0 : 0.5;
        this.scale = Math.random() * (this.maxScale - this.minScale) + this.minScale;
        
        this.minTimeToLive = this.clouds ? 5000 : 5000;
        this.maxTimeToLive = this.clouds ? 15000 : 10000;
        this.timeToLive = Math.random() * (this.maxTimeToLive - this.minTimeToLive) + this.minTimeToLive;
        this.birthTime = new Date().getTime();
        
        const colorA = {r: 1.0, g: 1.0, b: 0.0};
        const colorB = {r: 0.2, g: 0.2, b: 1.0};
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