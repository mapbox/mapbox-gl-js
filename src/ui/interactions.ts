import {Event} from '../util/evented';
import {TargetFeature} from '../util/vectortile_to_geojson';
import featureFilter from '../style-spec/feature_filter/index';
import {shouldSkipFeatureVariant, getFeatureTargetKey, type QrfTarget} from '../source/query_features';
import {warnOnce} from '../util/util';

import type Point from '@mapbox/point-geometry';
import type LngLat from '../geo/lng_lat';
import type Feature from '../util/vectortile_to_geojson';
import type {FeatureFilter} from '../style-spec/feature_filter/index';
import type {Map as MapboxMap} from './map';
import type {FilterSpecification} from '../style-spec/types';
import type {TargetDescriptor, FeaturesetDescriptor} from '../util/vectortile_to_geojson';
import type {MapEvents, MapInteractionEventType, MapMouseEvent} from './events';

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
     *
     * @param {InteractionEvent} event The event object.
     * @returns
     */
    handler: (event: InteractionEvent) => boolean | void;
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
    interactionsByType: Map<MapInteractionEventType, Map<string, Interaction>>;
    delegatedInteractions: Map<string, Interaction>;
    hoveredFeatures: Map<string, {feature: Feature; stop: boolean | void}>;
    prevHoveredFeatures: Map<string, {feature: Feature; stop: boolean | void}>;

    constructor(map) {
        this.map = map;
        this.interactionsByType = new Map(); // sort interactions into type buckets for fast handling
        this.delegatedInteractions = new Map();
        this.typeById = new Map(); // keep track of each id type for easy removal
        this.filters = new Map(); // cache compiled filter expressions for each interaction
        this.handleType = this.handleType.bind(this);
        this.handleMove = this.handleMove.bind(this);
        this.handleOut = this.handleOut.bind(this);
        this.hoveredFeatures = new Map();
        this.prevHoveredFeatures = new Map();
    }

    add(id: string, interaction: Interaction) {
        if (this.typeById.has(id)) {
            throw new Error(`Interaction id "${id}" already exists.`);
        }

        const filter = interaction.filter;
        let type = interaction.type;

        if (filter) {
            this.filters.set(id, featureFilter(filter));
        }

        // aliases
        if (type === 'mouseover') type = 'mouseenter';
        if (type === 'mouseout') type = 'mouseleave';

        const interactions = this.interactionsByType.get(type) || new Map();

        // set up delegated map listeners if it's a hover interaction
        if (type === 'mouseenter' || type === 'mouseleave') {
            if (this.delegatedInteractions.size === 0) {
                this.map.on('mousemove', this.handleMove);
                this.map.on('mouseout', this.handleOut);
            }
            this.delegatedInteractions.set(id, interaction);

        // if we didn't have an interaction of this type before, add a map listener for it
        } else if (interactions.size === 0) {
            this.map.on(type, this.handleType);
        }

        if (interactions.size === 0) {
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

        // if there are no more interactions of this type, remove the map listener
        if (type === 'mouseenter' || type === 'mouseleave') {
            this.delegatedInteractions.delete(id);
            if (this.delegatedInteractions.size === 0) {
                this.map.off('mousemove', this.handleMove);
                this.map.off('mouseout', this.handleOut);
            }
        } else if (interactions.size === 0) {
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

    handleMove(event: MapMouseEvent) {
        this.prevHoveredFeatures = this.hoveredFeatures;
        this.hoveredFeatures = new Map();

        const features = this.queryTargets(event.point, Array.from(this.delegatedInteractions).reverse());
        if (features.length) {
            event.type = 'mouseenter';
            this.handleType(event, features);
        }

        const featuresLeaving = new Map();
        for (const [id, {feature}] of this.prevHoveredFeatures) {
            if (!this.hoveredFeatures.has(id)) {
                // previously hovered features are no longer hovered; fire mouseleave for them; deduplicate by feature id
                featuresLeaving.set(feature.id, feature);
            }
        }
        if (featuresLeaving.size) {
            event.type = 'mouseleave';
            this.handleType(event, Array.from(featuresLeaving.values()));
        }
    }

    handleOut(event: MapMouseEvent) {
        const featuresLeaving = Array.from(this.hoveredFeatures.values()).map(({feature}) => feature);
        if (featuresLeaving.length) {
            event.type = 'mouseleave';
            this.handleType(event, featuresLeaving);
        }
        this.hoveredFeatures.clear();
    }

    handleType(event: MapMouseEvent, features?: Feature[]) {
        const isMouseEnter = event.type === 'mouseenter';

        if (isMouseEnter && !this.interactionsByType.has(event.type)) {
            warnOnce(`mouseenter interaction required for mouseleave to work.`);
            return;
        }

        // The interactions are handled in reverse order of addition,
        // so that the last added interaction to the same target handles it first.
        const interactions = Array.from(this.interactionsByType.get(event.type)).reverse();
        const delegated = !!features;
        features = features || this.queryTargets(event.point, interactions);

        let eventHandled = false;
        const uniqueFeatureSet = new Set<string>();
        for (const feature of features) {
            for (const [id, interaction] of interactions) {
                // Skip interactions that don't have a featureset, they will be handled later.
                if (!interaction.target) continue;

                // Skip feature if it doesn't have variants for the interaction.
                const variants = feature.variants ? feature.variants[id] : null;
                if (!variants) continue;

                for (const variant of variants) {
                    if (shouldSkipFeatureVariant(variant, feature, uniqueFeatureSet, id)) {
                        continue;
                    }
                    const targetFeature = new TargetFeature(feature, variant);
                    const targetFeatureId = getFeatureTargetKey(variant, feature, id);

                    // refresh feature state for features from delegated events (they're cached from previous move event)
                    if (delegated) targetFeature.state = this.map.getFeatureState(targetFeature);

                    const hovered = isMouseEnter ? this.prevHoveredFeatures.get(targetFeatureId) : null;
                    const interactionEvent = new InteractionEvent(event, id, interaction, targetFeature);

                    // don't handle interaction if it's already activated
                    const stop = hovered ? hovered.stop : interaction.handler(interactionEvent);

                    // save all features we handled mouseenter on as hovered
                    if (isMouseEnter) {
                        this.hoveredFeatures.set(targetFeatureId, {feature, stop});
                    }

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
        for (const [id, interaction] of interactions) {
            const {handler, target} = interaction;
            if (target) continue;

            const stop = handler(new InteractionEvent(event, id, interaction, null));
            if (stop !== false) {
                break;
            }
        }
    }
}
