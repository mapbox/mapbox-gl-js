import {createExpression} from '../style-spec/expression/index';
import {deepEqual} from '../util/util';
import {Event} from '../util/evented';

import type {MapEvents, MapInteractionEventType, MapMouseEvent} from './events';
import type {Map as MapboxMap} from './map';
import type {GeoJSONFeature, FeaturesetDescriptor} from '../util/vectortile_to_geojson';
import type {FilterSpecification} from '../style-spec/types';
import type {StyleExpression} from '../style-spec/expression/index';
import type LngLat from '../geo/lng_lat';
import type Point from '@mapbox/point-geometry';

/**
 * Configuration object for adding an interaction to a map in `Map#addInteraction()`.
 * Interactions allow you to handle user events like clicks and hovers, either globally
 * or for specific featuresets.
 */
export type Interaction = {
    /**
     * A type of interaction.
     */
    type: MapInteractionEventType;
    /**
     * A featureset to add interaction to.
     */
    featureset?: FeaturesetDescriptor;
    /**
     * A feature namespace to distinguish between features in the same sources but different featuresets.
     */
    namespace?: string;
    /**
     * A filter allows to specify which features from the featureset should handle the interaction.
     * This parameter only applies when the featureset is specified.
     */
    filter?: FilterSpecification;
    /**
     * Radius of an extra area around click or touch. Default value: 0.
     * This parameter only applies when the featureset is specified.
     */
    radius?: number;
    /**
     * A function that will be called when the interaction is triggered.
     * @param event - The event object.
     * @returns
     */
    handler: (event: InteractionEvent) => boolean | void;
};

/**
 * Event types that require a featureset to be specified.
 */
const delegatedEventTypes = ['mouseenter', 'mouseover', 'mouseleave', 'mouseout'];

export class InteractionEvent extends Event<MapEvents, MapInteractionEventType> {
    override type: MapInteractionEventType;
    override target: MapboxMap;
    originalEvent: MouseEvent;
    point: Point;
    lngLat: LngLat;
    preventDefault: () => void;

    id: string;
    interaction: Interaction;
    feature?: GeoJSONFeature;

    constructor(e: MapMouseEvent, id: string, interaction: Interaction, feature?: GeoJSONFeature) {
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
    interactionsByType: Map<MapInteractionEventType, Map<string, Interaction>>;
    typeById: Map<string, MapInteractionEventType>;
    filters: Map<string, StyleExpression>;

    constructor(map) {
        this.map = map;
        this.interactionsByType = new Map(); // sort interactions into type buckets for fast handling
        this.typeById = new Map(); // keep track of each id type for easy removal
        this.filters = new Map(); // cache compiled filter expressions for each interaction

        this.handleType = this.handleType.bind(this);
    }

    add(id: string, interaction: Interaction) {
        if (this.typeById.has(id)) {
            throw new Error(`Interaction id "${id}" already exists.`);
        }
        const {type, filter} = interaction;

        if (filter) {
            const compiled = createExpression(filter, {type: 'boolean', 'property-type': 'data-driven', overridable: false, transition: false});
            if (compiled.result === 'error')
                throw new Error(compiled.value.map(err => `${err.key}: ${err.message}`).join(', '));

            this.filters.set(id, compiled.value);
        }

        const interactions = this.interactionsByType.get(type) || new Map();

        // if we didn't have an interaction of this type before, add a map listener for it
        if (interactions.size === 0) {
            if (delegatedEventTypes.includes(type)) {
                this.map.on(type, interaction.featureset, this.handleType);
            } else {
                this.map.on(type, this.handleType);
            }

            this.interactionsByType.set(type, interactions);
        }

        interactions.set(id, interaction);
        this.typeById.set(id, type);
    }

    remove(id: string) {
        const type = this.typeById.get(id);
        if (!type) return;

        this.typeById.delete(id);
        this.filters.delete(id);

        const interactions = this.interactionsByType.get(type);
        if (!interactions) return;

        interactions.delete(id);

        // if there are no more interactions of this type, remove the map listener
        if (interactions.size === 0) {
            this.map.off(type, this.handleType);
        }
    }

    handleType(event: MapMouseEvent) {
        const interactions = this.interactionsByType.get(event.type);
        // The interactions are handled in reverse order of addition,
        // so that the last added interaction to the same target handles it first.
        const reversedInteractions = Array.from(interactions).reverse();

        const targets = [];
        for (const [, interaction] of reversedInteractions) {
            if (interaction.featureset) {
                targets.push({featureset: interaction.featureset, filter: interaction.filter, radius: interaction.radius});
            }
        }

        let features = this.map.style.queryRenderedFeaturesForInteractions(event.point, targets, this.map.transform);

        // To handle event types that require a featureset to be specified
        // but no features are returned, we create an empty feature
        // to trigger the interactions processing loop.
        if (!features.length && delegatedEventTypes.includes(event.type)) {
            features = [null];
        }

        let handled = false;
        for (const feature of features) {
            for (const [id, interaction] of reversedInteractions) {
                const {handler, featureset} = interaction;
                if (!featureset) continue;

                // check if the feature belongs to the interaction
                if (feature != null && !deepEqual(feature.featureset, featureset)) continue;

                // if we explicitly returned false in a feature handler, pass through to the feature below it
                const stop = handler(new InteractionEvent(event, id, interaction, feature));
                if (stop !== false) {
                    handled = true;
                    break;
                }
            }

            if (handled) break;
        }

        if (handled) return;

        // If no interactions targeted to a featureset handled it, the targetless intaractions have chance to handle.
        for (const [id, interaction] of reversedInteractions) {
            const {handler, featureset} = interaction;
            if (featureset) {
                continue;
            }

            const stop = handler(new InteractionEvent(event, id, interaction, null));
            if (stop !== false) {
                break;
            }
        }
    }
}
