import assert from 'assert';
import {Event} from '../util/evented';
import {TargetFeature} from '../util/vectortile_to_geojson';
import featureFilter from '../style-spec/feature_filter/index';

import type Point from '@mapbox/point-geometry';
import type LngLat from '../geo/lng_lat';
import type Feature from '../util/vectortile_to_geojson';
import type {QrfTarget} from '../source/query_features';
import type {FeatureFilter} from '../style-spec/feature_filter/index';
import type {Map as MapboxMap} from './map';
import type {FilterSpecification} from '../style-spec/types';
import type {TargetDescriptor} from '../util/vectortile_to_geojson';
import type {MapEvents, MapInteractionEventType, MapMouseEvent, MapMouseEventType} from './events';

/**
 * `Interaction` is a configuration object used with {@link Map#addInteraction} to handle user events, such as clicks and hovers.
 * Interactions can be applied globally or to specific targets, such as layers or featuresets.
 */
export type Interaction = {
    /**
     * A type of interaction. For a full list of available events, see [Interaction `Map` events](/mapbox-gl-js/api/map/#events-interaction).
     */
    type: MapInteractionEventType;

    /**
     * A query target to add interaction to. This could be a [style layer ID](https://docs.mapbox.com/mapbox-gl-js/style-spec/#layer-id) or a {@link FeaturesetDescriptor}.
     */
    target?: TargetDescriptor;

    /**
     * A feature namespace to distinguish between features in the same sources but different featureset selectors.
     */
    namespace?: string;

    /**
     * A filter allows to specify which features from the query target should handle the interaction.
     * This parameter only applies when the `target` is specified.
     */
    filter?: FilterSpecification;

    /**
     * A function that will be called when the interaction is triggered.
     * @param {InteractionEvent} event The event object.
     * @returns
     */
    handler: (event: InteractionEvent) => boolean | void;
};

/**
 * Event types that require would be delegated to `mousemove` and `mouseout` events.
 */
const delegatedEventTypes = ['mouseenter', 'mouseover', 'mouseleave', 'mouseout'] as const;

type DelegatedEventType = typeof delegatedEventTypes[number];

type DelegatedHandlers = {
    mousemove: (InteractionEvent) => boolean | void;
    mouseout: (InteractionEvent) => boolean | void;
};

/**
 * `InteractionEvent` is an event object that is passed to the interaction handler.
 */
export class InteractionEvent extends Event<MapEvents, MapInteractionEventType> {
    override type: MapInteractionEventType;
    override target: MapboxMap;
    originalEvent: MouseEvent;
    point: Point;
    lngLat: LngLat;

    /**
     * Prevents the event propagation to the next interaction in the stack.
     */
    preventDefault: () => void;

    /**
     * The ID of the associated {@link Interaction}.
     */
    id: string;

    /**
     * The {@link Interaction} configuration object.
     */
    interaction: Interaction;

    /**
     * The {@link TargetFeature} associated with the interaction event triggered during the interaction handler execution.
     */
    feature?: TargetFeature;

    /**
     * @private
     */
    constructor(e: MapMouseEvent, id: string, interaction: Interaction, feature?: TargetFeature) {
        const {point, lngLat, originalEvent, target} = e;
        super(e.type, {point, lngLat, originalEvent, target} as MapEvents[MapInteractionEventType]);
        this.preventDefault = () => { e.preventDefault(); };

        this.id = id;
        this.interaction = interaction;
        this.feature = feature;
    }
}

export class InteractionSet {
    map: MapboxMap;
    typeById: Map<string, MapInteractionEventType>;
    filters: Map<string, FeatureFilter>;
    delegatedHandlers: Map<string, DelegatedHandlers>;
    interactionsByType: Map<MapInteractionEventType, Map<string, Interaction>>;

    constructor(map) {
        this.map = map;
        this.interactionsByType = new Map(); // sort interactions into type buckets for fast handling
        this.typeById = new Map(); // keep track of each id type for easy removal
        this.filters = new Map(); // cache compiled filter expressions for each interaction

        this.delegatedHandlers = new Map(); // keep track of delegated handlers for easy removal
        this.handleType = this.handleType.bind(this);
    }

    add(id: string, interaction: Interaction) {
        if (this.typeById.has(id)) {
            throw new Error(`Interaction id "${id}" already exists.`);
        }

        const {type, filter} = interaction;

        if (filter) {
            this.filters.set(id, featureFilter(filter));
        }

        const interactions = this.interactionsByType.get(type) || new Map();

        // if we didn't have an interaction of this type before, add a map listener for it
        if (interactions.size === 0) {
            if (delegatedEventTypes.includes(type as DelegatedEventType)) {
                const {mousemove, mouseout} = this._createDelegatedHandlers(id, interaction);
                this.map.on('mousemove', mousemove);
                this.map.on('mouseout', mouseout);
                this.delegatedHandlers.set(id, {mousemove, mouseout});
            } else {
                this.map.on(type, this.handleType);
            }
            this.interactionsByType.set(type, interactions);
        }

        interactions.set(id, interaction);
        this.typeById.set(id, type);
    }

    get(id: string): Interaction | undefined {
        const type = this.typeById.get(id);
        if (!type) return;

        const interactions = this.interactionsByType.get(type);
        if (!interactions) return;

        return interactions.get(id);
    }

    remove(id: string) {
        const type = this.typeById.get(id);
        if (!type) return;

        this.typeById.delete(id);
        this.filters.delete(id);

        const interactions = this.interactionsByType.get(type);
        if (!interactions) return;

        interactions.delete(id);

        // remove delegated handlers if they exist
        if (this.delegatedHandlers.has(id)) {
            const {mousemove, mouseout} = this.delegatedHandlers.get(id);
            this.map.off('mousemove', mousemove);
            this.map.off('mouseout', mouseout);
            this.delegatedHandlers.delete(id);
        }

        // if there are no more interactions of this type, remove the map listener
        if (interactions.size === 0) {
            this.map.off(type, this.handleType);
        }
    }

    queryTargets(point: Point, interactions: [string, Interaction][]): Feature[] {
        const targets: QrfTarget[] = [];
        for (const [targetId, interaction] of interactions) {
            if (interaction.target) {
                targets.push({targetId, target: interaction.target, filter: this.filters.get(targetId)});
            }
        }
        return this.map.style.queryRenderedTargets(point, targets, this.map.transform);
    }

    handleType(event: MapMouseEvent, features?: Feature[]) {
        const interactions = this.interactionsByType.get(event.type);
        // The interactions are handled in reverse order of addition,
        // so that the last added interaction to the same target handles it first.
        const reversedInteractions = Array.from(interactions).reverse();
        features = features || this.queryTargets(event.point, reversedInteractions);

        let eventHandled = false;
        for (const feature of features) {
            for (const [id, interaction] of reversedInteractions) {
                // Skip interactions that don't have a featureset, they will be handled later.
                if (!interaction.target) continue;

                // Skip feature if it doesn't have variants for the interaction.
                const variants = feature.variants ? feature.variants[id] : null;
                if (!variants) continue;

                for (const variant of variants) {
                    const targetFeature = new TargetFeature(feature, variant);
                    const stop = interaction.handler(new InteractionEvent(event, id, interaction, targetFeature));

                    // If the interaction handler explicitly returned `false`, continue to the next interaction.
                    // Otherwise, mark the event as handled and quit the feature processing loop.
                    if (stop !== false) {
                        eventHandled = true;
                        break;
                    }
                }

                // If the event was handled, quit the feature processing loop.
                if (eventHandled) break;
            }

            if (eventHandled) break;
        }

        if (eventHandled) return;

        // If no interactions handled target, the targetless intaractions have chance to handle it.
        for (const [id, interaction] of reversedInteractions) {
            const {handler, target} = interaction;
            if (target) continue;

            const stop = handler(new InteractionEvent(event, id, interaction, null));
            if (stop !== false) {
                break;
            }
        }
    }

    /**
     * Create delegated handlers for `mouseenter`, `mouseover`, `mouseleave`, and `mouseout` events.
     */
    _createDelegatedHandlers(id: string, interaction: Interaction): DelegatedHandlers {
        switch (interaction.type as DelegatedEventType) {
        case 'mouseenter':
        case 'mouseover': {
            let mousein = false;
            let prevFeatureIds = new Set();

            const mousemove = (event: MapMouseEvent) => {
                const features = this.queryTargets(event.point, [[id, interaction]]);
                const nextFeatureIds = new Set();

                if (!features.length) {
                    mousein = false;
                    prevFeatureIds.clear();
                    return;
                }

                const featuresToHandle = [];
                for (const feature of features) {
                    if (!prevFeatureIds.has(feature.id)) {
                        nextFeatureIds.add(feature.id);
                        featuresToHandle.push(feature);
                    }
                }

                if (!mousein || featuresToHandle.length) {
                    mousein = true;
                    prevFeatureIds = nextFeatureIds;

                    event.type = interaction.type as MapMouseEventType;
                    this.handleType(event, featuresToHandle);
                }
            };

            const mouseout = () => {
                mousein = false;
                prevFeatureIds.clear();
            };

            return {mousemove, mouseout};
        }
        case 'mouseleave':
        case 'mouseout': {
            let prevFeatures: Feature[] = [];

            const mousemove = (event: MapMouseEvent) => {
                const features = this.queryTargets(event.point, [[id, interaction]]);

                if (!features.length) {
                    event.type = interaction.type as MapMouseEventType;
                    this.handleType(event, prevFeatures);
                    prevFeatures = features;
                    return;
                }

                const featuresToHandle = [];
                const featureIds = new Set(features.map(f => f.id));
                for (const prevFeature of prevFeatures) {
                    if (!featureIds.has(prevFeature.id)) {
                        featuresToHandle.push(prevFeature);
                    }
                }

                if (featuresToHandle.length) {
                    event.type = interaction.type as MapMouseEventType;
                    this.handleType(event, featuresToHandle);
                }

                prevFeatures = features;
            };

            const mouseout = (event) => {
                if (prevFeatures.length) {
                    event.type = interaction.type;
                    this.handleType(event, prevFeatures);
                    prevFeatures = [];
                }
            };

            return {mousemove, mouseout};
        }
        default:
            assert(false, `Unknown delegated event type "${interaction.type}"`);
        }
    }
}
