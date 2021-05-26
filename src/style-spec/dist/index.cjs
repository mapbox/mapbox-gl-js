(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.mapboxGlStyleSpecification = {}));
}(this, (function (exports) { 'use strict';

  var $version = 8;
  var $root = {
  	version: {
  		required: true,
  		type: "enum",
  		values: [
  			8
  		],
  		doc: "Style specification version number. Must be 8.",
  		example: 8
  	},
  	name: {
  		type: "string",
  		doc: "A human-readable name for the style.",
  		example: "Bright"
  	},
  	metadata: {
  		type: "*",
  		doc: "Arbitrary properties useful to track with the stylesheet, but do not influence rendering. Properties should be prefixed to avoid collisions, like 'mapbox:'."
  	},
  	center: {
  		type: "array",
  		value: "number",
  		doc: "Default map center in longitude and latitude.  The style center will be used only if the map has not been positioned by other means (e.g. map options or user interaction).",
  		example: [
  			-73.9749,
  			40.7736
  		]
  	},
  	zoom: {
  		type: "number",
  		doc: "Default zoom level.  The style zoom will be used only if the map has not been positioned by other means (e.g. map options or user interaction).",
  		example: 12.5
  	},
  	bearing: {
  		type: "number",
  		"default": 0,
  		period: 360,
  		units: "degrees",
  		doc: "Default bearing, in degrees. The bearing is the compass direction that is \"up\"; for example, a bearing of 90° orients the map so that east is up. This value will be used only if the map has not been positioned by other means (e.g. map options or user interaction).",
  		example: 29
  	},
  	pitch: {
  		type: "number",
  		"default": 0,
  		units: "degrees",
  		doc: "Default pitch, in degrees. Zero is perpendicular to the surface, for a look straight down at the map, while a greater value like 60 looks ahead towards the horizon. The style pitch will be used only if the map has not been positioned by other means (e.g. map options or user interaction).",
  		example: 50
  	},
  	light: {
  		type: "light",
  		doc: "The global light source.",
  		example: {
  			anchor: "viewport",
  			color: "white",
  			intensity: 0.4
  		}
  	},
  	terrain: {
  		type: "terrain",
  		doc: "A global modifier that elevates layers and markers based on a DEM data source."
  	},
  	fog: {
  		type: "fog",
  		doc: "A global effect that fades layers and markers based on their distance to the camera. The fog can be used to approximate the effect of atmosphere on distant objects and enhance the depth perception of the map when used with terrain or 3D features."
  	},
  	sources: {
  		required: true,
  		type: "sources",
  		doc: "Data source specifications.",
  		example: {
  			"mapbox-streets": {
  				type: "vector",
  				url: "mapbox://mapbox.mapbox-streets-v6"
  			}
  		}
  	},
  	sprite: {
  		type: "string",
  		doc: "A base URL for retrieving the sprite image and metadata. The extensions `.png`, `.json` and scale factor `@2x.png` will be automatically appended. This property is required if any layer uses the `background-pattern`, `fill-pattern`, `line-pattern`, `fill-extrusion-pattern`, or `icon-image` properties. The URL must be absolute, containing the [scheme, authority and path components](https://en.wikipedia.org/wiki/URL#Syntax).",
  		example: "mapbox://sprites/mapbox/bright-v8"
  	},
  	glyphs: {
  		type: "string",
  		doc: "A URL template for loading signed-distance-field glyph sets in PBF format. The URL must include `{fontstack}` and `{range}` tokens. This property is required if any layer uses the `text-field` layout property. The URL must be absolute, containing the [scheme, authority and path components](https://en.wikipedia.org/wiki/URL#Syntax).",
  		example: "mapbox://fonts/mapbox/{fontstack}/{range}.pbf"
  	},
  	transition: {
  		type: "transition",
  		doc: "A global transition definition to use as a default across properties, to be used for timing transitions between one value and the next when no property-specific transition is set. Collision-based symbol fading is controlled independently of the style's `transition` property.",
  		example: {
  			duration: 300,
  			delay: 0
  		}
  	},
  	layers: {
  		required: true,
  		type: "array",
  		value: "layer",
  		doc: "Layers will be drawn in the order of this array.",
  		example: [
  			{
  				id: "water",
  				source: "mapbox-streets",
  				"source-layer": "water",
  				type: "fill",
  				paint: {
  					"fill-color": "#00ffff"
  				}
  			}
  		]
  	}
  };
  var sources = {
  	"*": {
  		type: "source",
  		doc: "Specification of a data source. For vector and raster sources, either TileJSON or a URL to a TileJSON must be provided. For image and video sources, a URL must be provided. For GeoJSON sources, a URL or inline GeoJSON must be provided."
  	}
  };
  var source = [
  	"source_vector",
  	"source_raster",
  	"source_raster_dem",
  	"source_geojson",
  	"source_video",
  	"source_image"
  ];
  var source_vector = {
  	type: {
  		required: true,
  		type: "enum",
  		values: {
  			vector: {
  				doc: "A vector tile source."
  			}
  		},
  		doc: "The type of the source."
  	},
  	url: {
  		type: "string",
  		doc: "A URL to a TileJSON resource. Supported protocols are `http:`, `https:`, and `mapbox://<Tileset ID>`."
  	},
  	tiles: {
  		type: "array",
  		value: "string",
  		doc: "An array of one or more tile source URLs, as in the TileJSON spec."
  	},
  	bounds: {
  		type: "array",
  		value: "number",
  		length: 4,
  		"default": [
  			-180,
  			-85.051129,
  			180,
  			85.051129
  		],
  		doc: "An array containing the longitude and latitude of the southwest and northeast corners of the source's bounding box in the following order: `[sw.lng, sw.lat, ne.lng, ne.lat]`. When this property is included in a source, no tiles outside of the given bounds are requested by Mapbox GL."
  	},
  	scheme: {
  		type: "enum",
  		values: {
  			xyz: {
  				doc: "Slippy map tilenames scheme."
  			},
  			tms: {
  				doc: "OSGeo spec scheme."
  			}
  		},
  		"default": "xyz",
  		doc: "Influences the y direction of the tile coordinates. The global-mercator (aka Spherical Mercator) profile is assumed."
  	},
  	minzoom: {
  		type: "number",
  		"default": 0,
  		doc: "Minimum zoom level for which tiles are available, as in the TileJSON spec."
  	},
  	maxzoom: {
  		type: "number",
  		"default": 22,
  		doc: "Maximum zoom level for which tiles are available, as in the TileJSON spec. Data from tiles at the maxzoom are used when displaying the map at higher zoom levels."
  	},
  	attribution: {
  		type: "string",
  		doc: "Contains an attribution to be displayed when the map is shown to a user."
  	},
  	promoteId: {
  		type: "promoteId",
  		doc: "A property to use as a feature id (for feature state). Either a property name, or an object of the form `{<sourceLayer>: <propertyName>}`. If specified as a string for a vector tile source, the same property is used across all its source layers."
  	},
  	volatile: {
  		type: "boolean",
  		"default": false,
  		doc: "A setting to determine whether a source's tiles are cached locally.",
  		"sdk-support": {
  			"basic functionality": {
  				android: "9.3.0",
  				ios: "5.10.0"
  			}
  		}
  	},
  	"*": {
  		type: "*",
  		doc: "Other keys to configure the data source."
  	}
  };
  var source_raster = {
  	type: {
  		required: true,
  		type: "enum",
  		values: {
  			raster: {
  				doc: "A raster tile source."
  			}
  		},
  		doc: "The type of the source."
  	},
  	url: {
  		type: "string",
  		doc: "A URL to a TileJSON resource. Supported protocols are `http:`, `https:`, and `mapbox://<Tileset ID>`."
  	},
  	tiles: {
  		type: "array",
  		value: "string",
  		doc: "An array of one or more tile source URLs, as in the TileJSON spec."
  	},
  	bounds: {
  		type: "array",
  		value: "number",
  		length: 4,
  		"default": [
  			-180,
  			-85.051129,
  			180,
  			85.051129
  		],
  		doc: "An array containing the longitude and latitude of the southwest and northeast corners of the source's bounding box in the following order: `[sw.lng, sw.lat, ne.lng, ne.lat]`. When this property is included in a source, no tiles outside of the given bounds are requested by Mapbox GL."
  	},
  	minzoom: {
  		type: "number",
  		"default": 0,
  		doc: "Minimum zoom level for which tiles are available, as in the TileJSON spec."
  	},
  	maxzoom: {
  		type: "number",
  		"default": 22,
  		doc: "Maximum zoom level for which tiles are available, as in the TileJSON spec. Data from tiles at the maxzoom are used when displaying the map at higher zoom levels."
  	},
  	tileSize: {
  		type: "number",
  		"default": 512,
  		units: "pixels",
  		doc: "The minimum visual size to display tiles for this layer. Only configurable for raster layers."
  	},
  	scheme: {
  		type: "enum",
  		values: {
  			xyz: {
  				doc: "Slippy map tilenames scheme."
  			},
  			tms: {
  				doc: "OSGeo spec scheme."
  			}
  		},
  		"default": "xyz",
  		doc: "Influences the y direction of the tile coordinates. The global-mercator (aka Spherical Mercator) profile is assumed."
  	},
  	attribution: {
  		type: "string",
  		doc: "Contains an attribution to be displayed when the map is shown to a user."
  	},
  	volatile: {
  		type: "boolean",
  		"default": false,
  		doc: "A setting to determine whether a source's tiles are cached locally.",
  		"sdk-support": {
  			"basic functionality": {
  				android: "9.3.0",
  				ios: "5.10.0"
  			}
  		}
  	},
  	"*": {
  		type: "*",
  		doc: "Other keys to configure the data source."
  	}
  };
  var source_raster_dem = {
  	type: {
  		required: true,
  		type: "enum",
  		values: {
  			"raster-dem": {
  				doc: "A RGB-encoded raster DEM source"
  			}
  		},
  		doc: "The type of the source."
  	},
  	url: {
  		type: "string",
  		doc: "A URL to a TileJSON resource. Supported protocols are `http:`, `https:`, and `mapbox://<Tileset ID>`."
  	},
  	tiles: {
  		type: "array",
  		value: "string",
  		doc: "An array of one or more tile source URLs, as in the TileJSON spec."
  	},
  	bounds: {
  		type: "array",
  		value: "number",
  		length: 4,
  		"default": [
  			-180,
  			-85.051129,
  			180,
  			85.051129
  		],
  		doc: "An array containing the longitude and latitude of the southwest and northeast corners of the source's bounding box in the following order: `[sw.lng, sw.lat, ne.lng, ne.lat]`. When this property is included in a source, no tiles outside of the given bounds are requested by Mapbox GL."
  	},
  	minzoom: {
  		type: "number",
  		"default": 0,
  		doc: "Minimum zoom level for which tiles are available, as in the TileJSON spec."
  	},
  	maxzoom: {
  		type: "number",
  		"default": 22,
  		doc: "Maximum zoom level for which tiles are available, as in the TileJSON spec. Data from tiles at the maxzoom are used when displaying the map at higher zoom levels."
  	},
  	tileSize: {
  		type: "number",
  		"default": 512,
  		units: "pixels",
  		doc: "The minimum visual size to display tiles for this layer. Only configurable for raster layers."
  	},
  	attribution: {
  		type: "string",
  		doc: "Contains an attribution to be displayed when the map is shown to a user."
  	},
  	encoding: {
  		type: "enum",
  		values: {
  			terrarium: {
  				doc: "Terrarium format PNG tiles. See https://aws.amazon.com/es/public-datasets/terrain/ for more info."
  			},
  			mapbox: {
  				doc: "Mapbox Terrain RGB tiles. See https://www.mapbox.com/help/access-elevation-data/#mapbox-terrain-rgb for more info."
  			}
  		},
  		"default": "mapbox",
  		doc: "The encoding used by this source. Mapbox Terrain RGB is used by default"
  	},
  	volatile: {
  		type: "boolean",
  		"default": false,
  		doc: "A setting to determine whether a source's tiles are cached locally.",
  		"sdk-support": {
  			"basic functionality": {
  				android: "9.3.0",
  				ios: "5.10.0"
  			}
  		}
  	},
  	"*": {
  		type: "*",
  		doc: "Other keys to configure the data source."
  	}
  };
  var source_geojson = {
  	type: {
  		required: true,
  		type: "enum",
  		values: {
  			geojson: {
  				doc: "A GeoJSON data source."
  			}
  		},
  		doc: "The data type of the GeoJSON source."
  	},
  	data: {
  		type: "*",
  		doc: "A URL to a GeoJSON file, or inline GeoJSON."
  	},
  	maxzoom: {
  		type: "number",
  		"default": 18,
  		doc: "Maximum zoom level at which to create vector tiles (higher means greater detail at high zoom levels)."
  	},
  	attribution: {
  		type: "string",
  		doc: "Contains an attribution to be displayed when the map is shown to a user."
  	},
  	buffer: {
  		type: "number",
  		"default": 128,
  		maximum: 512,
  		minimum: 0,
  		doc: "Size of the tile buffer on each side. A value of 0 produces no buffer. A value of 512 produces a buffer as wide as the tile itself. Larger values produce fewer rendering artifacts near tile edges and slower performance."
  	},
  	filter: {
  		type: "*",
  		doc: "An expression for filtering features prior to processing them for rendering."
  	},
  	tolerance: {
  		type: "number",
  		"default": 0.375,
  		doc: "Douglas-Peucker simplification tolerance (higher means simpler geometries and faster performance)."
  	},
  	cluster: {
  		type: "boolean",
  		"default": false,
  		doc: "If the data is a collection of point features, setting this to true clusters the points by radius into groups. Cluster groups become new `Point` features in the source with additional properties:\n * `cluster` Is `true` if the point is a cluster \n * `cluster_id` A unqiue id for the cluster to be used in conjunction with the [cluster inspection methods](https://www.mapbox.com/mapbox-gl-js/api/#geojsonsource#getclusterexpansionzoom)\n * `point_count` Number of original points grouped into this cluster\n * `point_count_abbreviated` An abbreviated point count"
  	},
  	clusterRadius: {
  		type: "number",
  		"default": 50,
  		minimum: 0,
  		doc: "Radius of each cluster if clustering is enabled. A value of 512 indicates a radius equal to the width of a tile."
  	},
  	clusterMaxZoom: {
  		type: "number",
  		doc: "Max zoom on which to cluster points if clustering is enabled. Defaults to one zoom less than maxzoom (so that last zoom features are not clustered). Clusters are re-evaluated at integer zoom levels so setting clusterMaxZoom to 14 means the clusters will be displayed until z15."
  	},
  	clusterMinPoints: {
  		type: "number",
  		doc: "Minimum number of points necessary to form a cluster if clustering is enabled. Defaults to `2`."
  	},
  	clusterProperties: {
  		type: "*",
  		doc: "An object defining custom properties on the generated clusters if clustering is enabled, aggregating values from clustered points. Has the form `{\"property_name\": [operator, map_expression]}`. `operator` is any expression function that accepts at least 2 operands (e.g. `\"+\"` or `\"max\"`) — it accumulates the property value from clusters/points the cluster contains; `map_expression` produces the value of a single point.\n\nExample: `{\"sum\": [\"+\", [\"get\", \"scalerank\"]]}`.\n\nFor more advanced use cases, in place of `operator`, you can use a custom reduce expression that references a special `[\"accumulated\"]` value, e.g.:\n`{\"sum\": [[\"+\", [\"accumulated\"], [\"get\", \"sum\"]], [\"get\", \"scalerank\"]]}`"
  	},
  	lineMetrics: {
  		type: "boolean",
  		"default": false,
  		doc: "Whether to calculate line distance metrics. This is required for line layers that specify `line-gradient` values."
  	},
  	generateId: {
  		type: "boolean",
  		"default": false,
  		doc: "Whether to generate ids for the geojson features. When enabled, the `feature.id` property will be auto assigned based on its index in the `features` array, over-writing any previous values."
  	},
  	promoteId: {
  		type: "promoteId",
  		doc: "A property to use as a feature id (for feature state). Either a property name, or an object of the form `{<sourceLayer>: <propertyName>}`."
  	}
  };
  var source_video = {
  	type: {
  		required: true,
  		type: "enum",
  		values: {
  			video: {
  				doc: "A video data source."
  			}
  		},
  		doc: "The data type of the video source."
  	},
  	urls: {
  		required: true,
  		type: "array",
  		value: "string",
  		doc: "URLs to video content in order of preferred format."
  	},
  	coordinates: {
  		required: true,
  		doc: "Corners of video specified in longitude, latitude pairs.",
  		type: "array",
  		length: 4,
  		value: {
  			type: "array",
  			length: 2,
  			value: "number",
  			doc: "A single longitude, latitude pair."
  		}
  	}
  };
  var source_image = {
  	type: {
  		required: true,
  		type: "enum",
  		values: {
  			image: {
  				doc: "An image data source."
  			}
  		},
  		doc: "The data type of the image source."
  	},
  	url: {
  		required: true,
  		type: "string",
  		doc: "URL that points to an image."
  	},
  	coordinates: {
  		required: true,
  		doc: "Corners of image specified in longitude, latitude pairs.",
  		type: "array",
  		length: 4,
  		value: {
  			type: "array",
  			length: 2,
  			value: "number",
  			doc: "A single longitude, latitude pair."
  		}
  	}
  };
  var layer = {
  	id: {
  		type: "string",
  		doc: "Unique layer name.",
  		required: true
  	},
  	type: {
  		type: "enum",
  		values: {
  			fill: {
  				doc: "A filled polygon with an optional stroked border.",
  				"sdk-support": {
  					"basic functionality": {
  						js: "0.10.0",
  						android: "2.0.1",
  						ios: "2.0.0",
  						macos: "0.1.0"
  					}
  				}
  			},
  			line: {
  				doc: "A stroked line.",
  				"sdk-support": {
  					"basic functionality": {
  						js: "0.10.0",
  						android: "2.0.1",
  						ios: "2.0.0",
  						macos: "0.1.0"
  					}
  				}
  			},
  			symbol: {
  				doc: "An icon or a text label.",
  				"sdk-support": {
  					"basic functionality": {
  						js: "0.10.0",
  						android: "2.0.1",
  						ios: "2.0.0",
  						macos: "0.1.0"
  					}
  				}
  			},
  			circle: {
  				doc: "A filled circle.",
  				"sdk-support": {
  					"basic functionality": {
  						js: "0.10.0",
  						android: "2.0.1",
  						ios: "2.0.0",
  						macos: "0.1.0"
  					}
  				}
  			},
  			heatmap: {
  				doc: "A heatmap.",
  				"sdk-support": {
  					"basic functionality": {
  						js: "0.41.0",
  						android: "6.0.0",
  						ios: "4.0.0",
  						macos: "0.7.0"
  					}
  				}
  			},
  			"fill-extrusion": {
  				doc: "An extruded (3D) polygon.",
  				"sdk-support": {
  					"basic functionality": {
  						js: "0.27.0",
  						android: "5.1.0",
  						ios: "3.6.0",
  						macos: "0.5.0"
  					}
  				}
  			},
  			raster: {
  				doc: "Raster map textures such as satellite imagery.",
  				"sdk-support": {
  					"basic functionality": {
  						js: "0.10.0",
  						android: "2.0.1",
  						ios: "2.0.0",
  						macos: "0.1.0"
  					}
  				}
  			},
  			hillshade: {
  				doc: "Client-side hillshading visualization based on DEM data. Currently, the implementation only supports Mapbox Terrain RGB and Mapzen Terrarium tiles.",
  				"sdk-support": {
  					"basic functionality": {
  						js: "0.43.0",
  						android: "6.0.0",
  						ios: "4.0.0",
  						macos: "0.7.0"
  					}
  				}
  			},
  			background: {
  				doc: "The background color or pattern of the map.",
  				"sdk-support": {
  					"basic functionality": {
  						js: "0.10.0",
  						android: "2.0.1",
  						ios: "2.0.0",
  						macos: "0.1.0"
  					}
  				}
  			},
  			sky: {
  				doc: "A spherical dome around the map that is always rendered behind all other layers.",
  				"sdk-support": {
  					"basic functionality": {
  						js: "2.0.0"
  					}
  				}
  			}
  		},
  		doc: "Rendering type of this layer.",
  		required: true
  	},
  	metadata: {
  		type: "*",
  		doc: "Arbitrary properties useful to track with the layer, but do not influence rendering. Properties should be prefixed to avoid collisions, like 'mapbox:'."
  	},
  	source: {
  		type: "string",
  		doc: "Name of a source description to be used for this layer. Required for all layer types except `background`."
  	},
  	"source-layer": {
  		type: "string",
  		doc: "Layer to use from a vector tile source. Required for vector tile sources; prohibited for all other source types, including GeoJSON sources."
  	},
  	minzoom: {
  		type: "number",
  		minimum: 0,
  		maximum: 24,
  		doc: "The minimum zoom level for the layer. At zoom levels less than the minzoom, the layer will be hidden."
  	},
  	maxzoom: {
  		type: "number",
  		minimum: 0,
  		maximum: 24,
  		doc: "The maximum zoom level for the layer. At zoom levels equal to or greater than the maxzoom, the layer will be hidden."
  	},
  	filter: {
  		type: "filter",
  		doc: "A expression specifying conditions on source features. Only features that match the filter are displayed. Zoom expressions in filters are only evaluated at integer zoom levels. The `feature-state` expression is not supported in filter expressions."
  	},
  	layout: {
  		type: "layout",
  		doc: "Layout properties for the layer."
  	},
  	paint: {
  		type: "paint",
  		doc: "Default paint properties for this layer."
  	}
  };
  var layout = [
  	"layout_fill",
  	"layout_line",
  	"layout_circle",
  	"layout_heatmap",
  	"layout_fill-extrusion",
  	"layout_symbol",
  	"layout_raster",
  	"layout_hillshade",
  	"layout_background",
  	"layout_sky"
  ];
  var layout_background = {
  	visibility: {
  		type: "enum",
  		values: {
  			visible: {
  				doc: "The layer is shown."
  			},
  			none: {
  				doc: "The layer is not shown."
  			}
  		},
  		"default": "visible",
  		doc: "Whether this layer is displayed.",
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			}
  		},
  		"property-type": "constant"
  	}
  };
  var layout_sky = {
  	visibility: {
  		type: "enum",
  		values: {
  			visible: {
  				doc: "The layer is shown."
  			},
  			none: {
  				doc: "The layer is not shown."
  			}
  		},
  		"default": "visible",
  		doc: "Whether this layer is displayed.",
  		"sdk-support": {
  			"basic functionality": {
  				js: "2.0.0"
  			}
  		},
  		"property-type": "constant"
  	}
  };
  var layout_fill = {
  	"fill-sort-key": {
  		type: "number",
  		doc: "Sorts features in ascending order based on this value. Features with a higher sort key will appear above features with a lower sort key.",
  		"sdk-support": {
  			"basic functionality": {
  				js: "1.2.0",
  				android: "9.1.0",
  				ios: "5.8.0",
  				macos: "0.15.0"
  			},
  			"data-driven styling": {
  				js: "1.2.0",
  				android: "9.1.0",
  				ios: "5.8.0",
  				macos: "0.15.0"
  			}
  		},
  		expression: {
  			interpolated: false,
  			parameters: [
  				"zoom",
  				"feature"
  			]
  		},
  		"property-type": "data-driven"
  	},
  	visibility: {
  		type: "enum",
  		values: {
  			visible: {
  				doc: "The layer is shown."
  			},
  			none: {
  				doc: "The layer is not shown."
  			}
  		},
  		"default": "visible",
  		doc: "Whether this layer is displayed.",
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			}
  		},
  		"property-type": "constant"
  	}
  };
  var layout_circle = {
  	"circle-sort-key": {
  		type: "number",
  		doc: "Sorts features in ascending order based on this value. Features with a higher sort key will appear above features with a lower sort key.",
  		"sdk-support": {
  			"basic functionality": {
  				js: "1.2.0",
  				android: "9.2.0",
  				ios: "5.9.0",
  				macos: "0.16.0"
  			},
  			"data-driven styling": {
  				js: "1.2.0",
  				android: "9.2.0",
  				ios: "5.9.0",
  				macos: "0.16.0"
  			}
  		},
  		expression: {
  			interpolated: false,
  			parameters: [
  				"zoom",
  				"feature"
  			]
  		},
  		"property-type": "data-driven"
  	},
  	visibility: {
  		type: "enum",
  		values: {
  			visible: {
  				doc: "The layer is shown."
  			},
  			none: {
  				doc: "The layer is not shown."
  			}
  		},
  		"default": "visible",
  		doc: "Whether this layer is displayed.",
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			}
  		},
  		"property-type": "constant"
  	}
  };
  var layout_heatmap = {
  	visibility: {
  		type: "enum",
  		values: {
  			visible: {
  				doc: "The layer is shown."
  			},
  			none: {
  				doc: "The layer is not shown."
  			}
  		},
  		"default": "visible",
  		doc: "Whether this layer is displayed.",
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.41.0",
  				android: "6.0.0",
  				ios: "4.0.0",
  				macos: "0.7.0"
  			}
  		},
  		"property-type": "constant"
  	}
  };
  var layout_line = {
  	"line-cap": {
  		type: "enum",
  		values: {
  			butt: {
  				doc: "A cap with a squared-off end which is drawn to the exact endpoint of the line."
  			},
  			round: {
  				doc: "A cap with a rounded end which is drawn beyond the endpoint of the line at a radius of one-half of the line's width and centered on the endpoint of the line."
  			},
  			square: {
  				doc: "A cap with a squared-off end which is drawn beyond the endpoint of the line at a distance of one-half of the line's width."
  			}
  		},
  		"default": "butt",
  		doc: "The display of line endings.",
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			},
  			"data-driven styling": {
  				js: "2.3.0"
  			}
  		},
  		expression: {
  			interpolated: false,
  			parameters: [
  				"zoom",
  				"feature"
  			]
  		},
  		"property-type": "data-driven"
  	},
  	"line-join": {
  		type: "enum",
  		values: {
  			bevel: {
  				doc: "A join with a squared-off end which is drawn beyond the endpoint of the line at a distance of one-half of the line's width."
  			},
  			round: {
  				doc: "A join with a rounded end which is drawn beyond the endpoint of the line at a radius of one-half of the line's width and centered on the endpoint of the line."
  			},
  			miter: {
  				doc: "A join with a sharp, angled corner which is drawn with the outer sides beyond the endpoint of the path until they meet."
  			}
  		},
  		"default": "miter",
  		doc: "The display of lines when joining.",
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			},
  			"data-driven styling": {
  				js: "0.40.0",
  				android: "5.2.0",
  				ios: "3.7.0",
  				macos: "0.6.0"
  			}
  		},
  		expression: {
  			interpolated: false,
  			parameters: [
  				"zoom",
  				"feature"
  			]
  		},
  		"property-type": "data-driven"
  	},
  	"line-miter-limit": {
  		type: "number",
  		"default": 2,
  		doc: "Used to automatically convert miter joins to bevel joins for sharp angles.",
  		requires: [
  			{
  				"line-join": "miter"
  			}
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"line-round-limit": {
  		type: "number",
  		"default": 1.05,
  		doc: "Used to automatically convert round joins to miter joins for shallow angles.",
  		requires: [
  			{
  				"line-join": "round"
  			}
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"line-sort-key": {
  		type: "number",
  		doc: "Sorts features in ascending order based on this value. Features with a higher sort key will appear above features with a lower sort key.",
  		"sdk-support": {
  			"basic functionality": {
  				js: "1.2.0",
  				android: "9.1.0",
  				ios: "5.8.0",
  				macos: "0.15.0"
  			},
  			"data-driven styling": {
  				js: "1.2.0",
  				android: "9.1.0",
  				ios: "5.8.0",
  				macos: "0.15.0"
  			}
  		},
  		expression: {
  			interpolated: false,
  			parameters: [
  				"zoom",
  				"feature"
  			]
  		},
  		"property-type": "data-driven"
  	},
  	visibility: {
  		type: "enum",
  		values: {
  			visible: {
  				doc: "The layer is shown."
  			},
  			none: {
  				doc: "The layer is not shown."
  			}
  		},
  		"default": "visible",
  		doc: "Whether this layer is displayed.",
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			}
  		},
  		"property-type": "constant"
  	}
  };
  var layout_symbol = {
  	"symbol-placement": {
  		type: "enum",
  		values: {
  			point: {
  				doc: "The label is placed at the point where the geometry is located."
  			},
  			line: {
  				doc: "The label is placed along the line of the geometry. Can only be used on `LineString` and `Polygon` geometries."
  			},
  			"line-center": {
  				doc: "The label is placed at the center of the line of the geometry. Can only be used on `LineString` and `Polygon` geometries. Note that a single feature in a vector tile may contain multiple line geometries."
  			}
  		},
  		"default": "point",
  		doc: "Label placement relative to its geometry.",
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			},
  			"`line-center` value": {
  				js: "0.47.0",
  				android: "6.4.0",
  				ios: "4.3.0",
  				macos: "0.10.0"
  			}
  		},
  		expression: {
  			interpolated: false,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"symbol-spacing": {
  		type: "number",
  		"default": 250,
  		minimum: 1,
  		units: "pixels",
  		doc: "Distance between two symbol anchors.",
  		requires: [
  			{
  				"symbol-placement": "line"
  			}
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"symbol-avoid-edges": {
  		type: "boolean",
  		"default": false,
  		doc: "If true, the symbols will not cross tile edges to avoid mutual collisions. Recommended in layers that don't have enough padding in the vector tile to prevent collisions, or if it is a point symbol layer placed after a line symbol layer. When using a client that supports global collision detection, like Mapbox GL JS version 0.42.0 or greater, enabling this property is not needed to prevent clipped labels at tile boundaries.",
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			}
  		},
  		expression: {
  			interpolated: false,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"symbol-sort-key": {
  		type: "number",
  		doc: "Sorts features in ascending order based on this value. Features with lower sort keys are drawn and placed first.  When `icon-allow-overlap` or `text-allow-overlap` is `false`, features with a lower sort key will have priority during placement. When `icon-allow-overlap` or `text-allow-overlap` is set to `true`, features with a higher sort key will overlap over features with a lower sort key.",
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.53.0",
  				android: "7.4.0",
  				ios: "4.11.0",
  				macos: "0.14.0"
  			},
  			"data-driven styling": {
  				js: "0.53.0",
  				android: "7.4.0",
  				ios: "4.11.0",
  				macos: "0.14.0"
  			}
  		},
  		expression: {
  			interpolated: false,
  			parameters: [
  				"zoom",
  				"feature"
  			]
  		},
  		"property-type": "data-driven"
  	},
  	"symbol-z-order": {
  		type: "enum",
  		values: {
  			auto: {
  				doc: "Sorts symbols by `symbol-sort-key` if set. Otherwise, sorts symbols by their y-position relative to the viewport if `icon-allow-overlap` or `text-allow-overlap` is set to `true` or `icon-ignore-placement` or `text-ignore-placement` is `false`."
  			},
  			"viewport-y": {
  				doc: "Sorts symbols by their y-position relative to the viewport if `icon-allow-overlap` or `text-allow-overlap` is set to `true` or `icon-ignore-placement` or `text-ignore-placement` is `false`."
  			},
  			source: {
  				doc: "Sorts symbols by `symbol-sort-key` if set. Otherwise, no sorting is applied; symbols are rendered in the same order as the source data."
  			}
  		},
  		"default": "auto",
  		doc: "Determines whether overlapping symbols in the same layer are rendered in the order that they appear in the data source or by their y-position relative to the viewport. To control the order and prioritization of symbols otherwise, use `symbol-sort-key`.",
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.49.0",
  				android: "6.6.0",
  				ios: "4.5.0",
  				macos: "0.12.0"
  			}
  		},
  		expression: {
  			interpolated: false,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"icon-allow-overlap": {
  		type: "boolean",
  		"default": false,
  		doc: "If true, the icon will be visible even if it collides with other previously drawn symbols.",
  		requires: [
  			"icon-image"
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			}
  		},
  		expression: {
  			interpolated: false,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"icon-ignore-placement": {
  		type: "boolean",
  		"default": false,
  		doc: "If true, other symbols can be visible even if they collide with the icon.",
  		requires: [
  			"icon-image"
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			}
  		},
  		expression: {
  			interpolated: false,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"icon-optional": {
  		type: "boolean",
  		"default": false,
  		doc: "If true, text will display without their corresponding icons when the icon collides with other symbols and the text does not.",
  		requires: [
  			"icon-image",
  			"text-field"
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			}
  		},
  		expression: {
  			interpolated: false,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"icon-rotation-alignment": {
  		type: "enum",
  		values: {
  			map: {
  				doc: "When `symbol-placement` is set to `point`, aligns icons east-west. When `symbol-placement` is set to `line` or `line-center`, aligns icon x-axes with the line."
  			},
  			viewport: {
  				doc: "Produces icons whose x-axes are aligned with the x-axis of the viewport, regardless of the value of `symbol-placement`."
  			},
  			auto: {
  				doc: "When `symbol-placement` is set to `point`, this is equivalent to `viewport`. When `symbol-placement` is set to `line` or `line-center`, this is equivalent to `map`."
  			}
  		},
  		"default": "auto",
  		doc: "In combination with `symbol-placement`, determines the rotation behavior of icons.",
  		requires: [
  			"icon-image"
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			},
  			"`auto` value": {
  				js: "0.25.0",
  				android: "4.2.0",
  				ios: "3.4.0",
  				macos: "0.3.0"
  			}
  		},
  		expression: {
  			interpolated: false,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"icon-size": {
  		type: "number",
  		"default": 1,
  		minimum: 0,
  		units: "factor of the original icon size",
  		doc: "Scales the original size of the icon by the provided factor. The new pixel size of the image will be the original pixel size multiplied by `icon-size`. 1 is the original size; 3 triples the size of the image.",
  		requires: [
  			"icon-image"
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			},
  			"data-driven styling": {
  				js: "0.35.0",
  				android: "5.1.0",
  				ios: "3.6.0",
  				macos: "0.5.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom",
  				"feature"
  			]
  		},
  		"property-type": "data-driven"
  	},
  	"icon-text-fit": {
  		type: "enum",
  		values: {
  			none: {
  				doc: "The icon is displayed at its intrinsic aspect ratio."
  			},
  			width: {
  				doc: "The icon is scaled in the x-dimension to fit the width of the text."
  			},
  			height: {
  				doc: "The icon is scaled in the y-dimension to fit the height of the text."
  			},
  			both: {
  				doc: "The icon is scaled in both x- and y-dimensions."
  			}
  		},
  		"default": "none",
  		doc: "Scales the icon to fit around the associated text.",
  		requires: [
  			"icon-image",
  			"text-field"
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.21.0",
  				android: "4.2.0",
  				ios: "3.4.0",
  				macos: "0.2.1"
  			},
  			"stretchable icons": {
  				js: "1.6.0",
  				android: "9.2.0",
  				ios: "5.8.0",
  				macos: "0.15.0"
  			}
  		},
  		expression: {
  			interpolated: false,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"icon-text-fit-padding": {
  		type: "array",
  		value: "number",
  		length: 4,
  		"default": [
  			0,
  			0,
  			0,
  			0
  		],
  		units: "pixels",
  		doc: "Size of the additional area added to dimensions determined by `icon-text-fit`, in clockwise order: top, right, bottom, left.",
  		requires: [
  			"icon-image",
  			"text-field",
  			{
  				"icon-text-fit": [
  					"both",
  					"width",
  					"height"
  				]
  			}
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.21.0",
  				android: "4.2.0",
  				ios: "3.4.0",
  				macos: "0.2.1"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"icon-image": {
  		type: "resolvedImage",
  		doc: "Name of image in sprite to use for drawing an image background.",
  		tokens: true,
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			},
  			"data-driven styling": {
  				js: "0.35.0",
  				android: "5.1.0",
  				ios: "3.6.0",
  				macos: "0.5.0"
  			}
  		},
  		expression: {
  			interpolated: false,
  			parameters: [
  				"zoom",
  				"feature"
  			]
  		},
  		"property-type": "data-driven"
  	},
  	"icon-rotate": {
  		type: "number",
  		"default": 0,
  		period: 360,
  		units: "degrees",
  		doc: "Rotates the icon clockwise.",
  		requires: [
  			"icon-image"
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			},
  			"data-driven styling": {
  				js: "0.21.0",
  				android: "5.0.0",
  				ios: "3.5.0",
  				macos: "0.4.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom",
  				"feature"
  			]
  		},
  		"property-type": "data-driven"
  	},
  	"icon-padding": {
  		type: "number",
  		"default": 2,
  		minimum: 0,
  		units: "pixels",
  		doc: "Size of the additional area around the icon bounding box used for detecting symbol collisions.",
  		requires: [
  			"icon-image"
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"icon-keep-upright": {
  		type: "boolean",
  		"default": false,
  		doc: "If true, the icon may be flipped to prevent it from being rendered upside-down.",
  		requires: [
  			"icon-image",
  			{
  				"icon-rotation-alignment": "map"
  			},
  			{
  				"symbol-placement": [
  					"line",
  					"line-center"
  				]
  			}
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			}
  		},
  		expression: {
  			interpolated: false,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"icon-offset": {
  		type: "array",
  		value: "number",
  		length: 2,
  		"default": [
  			0,
  			0
  		],
  		doc: "Offset distance of icon from its anchor. Positive values indicate right and down, while negative values indicate left and up. Each component is multiplied by the value of `icon-size` to obtain the final offset in pixels. When combined with `icon-rotate` the offset will be as if the rotated direction was up.",
  		requires: [
  			"icon-image"
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			},
  			"data-driven styling": {
  				js: "0.29.0",
  				android: "5.0.0",
  				ios: "3.5.0",
  				macos: "0.4.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom",
  				"feature"
  			]
  		},
  		"property-type": "data-driven"
  	},
  	"icon-anchor": {
  		type: "enum",
  		values: {
  			center: {
  				doc: "The center of the icon is placed closest to the anchor."
  			},
  			left: {
  				doc: "The left side of the icon is placed closest to the anchor."
  			},
  			right: {
  				doc: "The right side of the icon is placed closest to the anchor."
  			},
  			top: {
  				doc: "The top of the icon is placed closest to the anchor."
  			},
  			bottom: {
  				doc: "The bottom of the icon is placed closest to the anchor."
  			},
  			"top-left": {
  				doc: "The top left corner of the icon is placed closest to the anchor."
  			},
  			"top-right": {
  				doc: "The top right corner of the icon is placed closest to the anchor."
  			},
  			"bottom-left": {
  				doc: "The bottom left corner of the icon is placed closest to the anchor."
  			},
  			"bottom-right": {
  				doc: "The bottom right corner of the icon is placed closest to the anchor."
  			}
  		},
  		"default": "center",
  		doc: "Part of the icon placed closest to the anchor.",
  		requires: [
  			"icon-image"
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.40.0",
  				android: "5.2.0",
  				ios: "3.7.0",
  				macos: "0.6.0"
  			},
  			"data-driven styling": {
  				js: "0.40.0",
  				android: "5.2.0",
  				ios: "3.7.0",
  				macos: "0.6.0"
  			}
  		},
  		expression: {
  			interpolated: false,
  			parameters: [
  				"zoom",
  				"feature"
  			]
  		},
  		"property-type": "data-driven"
  	},
  	"icon-pitch-alignment": {
  		type: "enum",
  		values: {
  			map: {
  				doc: "The icon is aligned to the plane of the map."
  			},
  			viewport: {
  				doc: "The icon is aligned to the plane of the viewport."
  			},
  			auto: {
  				doc: "Automatically matches the value of `icon-rotation-alignment`."
  			}
  		},
  		"default": "auto",
  		doc: "Orientation of icon when map is pitched.",
  		requires: [
  			"icon-image"
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.39.0",
  				android: "5.2.0",
  				ios: "3.7.0",
  				macos: "0.6.0"
  			}
  		},
  		expression: {
  			interpolated: false,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"text-pitch-alignment": {
  		type: "enum",
  		values: {
  			map: {
  				doc: "The text is aligned to the plane of the map."
  			},
  			viewport: {
  				doc: "The text is aligned to the plane of the viewport."
  			},
  			auto: {
  				doc: "Automatically matches the value of `text-rotation-alignment`."
  			}
  		},
  		"default": "auto",
  		doc: "Orientation of text when map is pitched.",
  		requires: [
  			"text-field"
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.21.0",
  				android: "4.2.0",
  				ios: "3.4.0",
  				macos: "0.2.1"
  			},
  			"`auto` value": {
  				js: "0.25.0",
  				android: "4.2.0",
  				ios: "3.4.0",
  				macos: "0.3.0"
  			}
  		},
  		expression: {
  			interpolated: false,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"text-rotation-alignment": {
  		type: "enum",
  		values: {
  			map: {
  				doc: "When `symbol-placement` is set to `point`, aligns text east-west. When `symbol-placement` is set to `line` or `line-center`, aligns text x-axes with the line."
  			},
  			viewport: {
  				doc: "Produces glyphs whose x-axes are aligned with the x-axis of the viewport, regardless of the value of `symbol-placement`."
  			},
  			auto: {
  				doc: "When `symbol-placement` is set to `point`, this is equivalent to `viewport`. When `symbol-placement` is set to `line` or `line-center`, this is equivalent to `map`."
  			}
  		},
  		"default": "auto",
  		doc: "In combination with `symbol-placement`, determines the rotation behavior of the individual glyphs forming the text.",
  		requires: [
  			"text-field"
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			},
  			"`auto` value": {
  				js: "0.25.0",
  				android: "4.2.0",
  				ios: "3.4.0",
  				macos: "0.3.0"
  			}
  		},
  		expression: {
  			interpolated: false,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"text-field": {
  		type: "formatted",
  		"default": "",
  		tokens: true,
  		doc: "Value to use for a text label. If a plain `string` is provided, it will be treated as a `formatted` with default/inherited formatting options.",
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			},
  			"data-driven styling": {
  				js: "0.33.0",
  				android: "5.0.0",
  				ios: "3.5.0",
  				macos: "0.4.0"
  			}
  		},
  		expression: {
  			interpolated: false,
  			parameters: [
  				"zoom",
  				"feature"
  			]
  		},
  		"property-type": "data-driven"
  	},
  	"text-font": {
  		type: "array",
  		value: "string",
  		"default": [
  			"Open Sans Regular",
  			"Arial Unicode MS Regular"
  		],
  		doc: "Font stack to use for displaying text.",
  		requires: [
  			"text-field"
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			},
  			"data-driven styling": {
  				js: "0.43.0",
  				android: "6.0.0",
  				ios: "4.0.0",
  				macos: "0.7.0"
  			}
  		},
  		expression: {
  			interpolated: false,
  			parameters: [
  				"zoom",
  				"feature"
  			]
  		},
  		"property-type": "data-driven"
  	},
  	"text-size": {
  		type: "number",
  		"default": 16,
  		minimum: 0,
  		units: "pixels",
  		doc: "Font size.",
  		requires: [
  			"text-field"
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			},
  			"data-driven styling": {
  				js: "0.35.0",
  				android: "5.1.0",
  				ios: "3.6.0",
  				macos: "0.5.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom",
  				"feature"
  			]
  		},
  		"property-type": "data-driven"
  	},
  	"text-max-width": {
  		type: "number",
  		"default": 10,
  		minimum: 0,
  		units: "ems",
  		doc: "The maximum line width for text wrapping.",
  		requires: [
  			"text-field"
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			},
  			"data-driven styling": {
  				js: "0.40.0",
  				android: "5.2.0",
  				ios: "3.7.0",
  				macos: "0.6.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom",
  				"feature"
  			]
  		},
  		"property-type": "data-driven"
  	},
  	"text-line-height": {
  		type: "number",
  		"default": 1.2,
  		units: "ems",
  		doc: "Text leading value for multi-line text.",
  		requires: [
  			"text-field"
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			},
  			"data-driven styling": {
  				js: "2.3.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom",
  				"feature"
  			]
  		},
  		"property-type": "data-driven"
  	},
  	"text-letter-spacing": {
  		type: "number",
  		"default": 0,
  		units: "ems",
  		doc: "Text tracking amount.",
  		requires: [
  			"text-field"
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			},
  			"data-driven styling": {
  				js: "0.40.0",
  				android: "5.2.0",
  				ios: "3.7.0",
  				macos: "0.6.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom",
  				"feature"
  			]
  		},
  		"property-type": "data-driven"
  	},
  	"text-justify": {
  		type: "enum",
  		values: {
  			auto: {
  				doc: "The text is aligned towards the anchor position."
  			},
  			left: {
  				doc: "The text is aligned to the left."
  			},
  			center: {
  				doc: "The text is centered."
  			},
  			right: {
  				doc: "The text is aligned to the right."
  			}
  		},
  		"default": "center",
  		doc: "Text justification options.",
  		requires: [
  			"text-field"
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			},
  			"data-driven styling": {
  				js: "0.39.0",
  				android: "5.2.0",
  				ios: "3.7.0",
  				macos: "0.6.0"
  			},
  			auto: {
  				js: "0.54.0",
  				android: "7.4.0",
  				ios: "4.10.0",
  				macos: "0.14.0"
  			}
  		},
  		expression: {
  			interpolated: false,
  			parameters: [
  				"zoom",
  				"feature"
  			]
  		},
  		"property-type": "data-driven"
  	},
  	"text-radial-offset": {
  		type: "number",
  		units: "ems",
  		"default": 0,
  		doc: "Radial offset of text, in the direction of the symbol's anchor. Useful in combination with `text-variable-anchor`, which defaults to using the two-dimensional `text-offset` if present.",
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.54.0",
  				android: "7.4.0",
  				ios: "4.10.0",
  				macos: "0.14.0"
  			},
  			"data-driven styling": {
  				js: "0.54.0",
  				android: "7.4.0",
  				ios: "4.10.0",
  				macos: "0.14.0"
  			}
  		},
  		requires: [
  			"text-field"
  		],
  		"property-type": "data-driven",
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom",
  				"feature"
  			]
  		}
  	},
  	"text-variable-anchor": {
  		type: "array",
  		value: "enum",
  		values: {
  			center: {
  				doc: "The center of the text is placed closest to the anchor."
  			},
  			left: {
  				doc: "The left side of the text is placed closest to the anchor."
  			},
  			right: {
  				doc: "The right side of the text is placed closest to the anchor."
  			},
  			top: {
  				doc: "The top of the text is placed closest to the anchor."
  			},
  			bottom: {
  				doc: "The bottom of the text is placed closest to the anchor."
  			},
  			"top-left": {
  				doc: "The top left corner of the text is placed closest to the anchor."
  			},
  			"top-right": {
  				doc: "The top right corner of the text is placed closest to the anchor."
  			},
  			"bottom-left": {
  				doc: "The bottom left corner of the text is placed closest to the anchor."
  			},
  			"bottom-right": {
  				doc: "The bottom right corner of the text is placed closest to the anchor."
  			}
  		},
  		requires: [
  			"text-field",
  			{
  				"symbol-placement": [
  					"point"
  				]
  			}
  		],
  		doc: "To increase the chance of placing high-priority labels on the map, you can provide an array of `text-anchor` locations: the renderer will attempt to place the label at each location, in order, before moving onto the next label. Use `text-justify: auto` to choose justification based on anchor position. To apply an offset, use the `text-radial-offset` or the two-dimensional `text-offset`.",
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.54.0",
  				android: "7.4.0",
  				ios: "4.10.0",
  				macos: "0.14.0"
  			}
  		},
  		expression: {
  			interpolated: false,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"text-anchor": {
  		type: "enum",
  		values: {
  			center: {
  				doc: "The center of the text is placed closest to the anchor."
  			},
  			left: {
  				doc: "The left side of the text is placed closest to the anchor."
  			},
  			right: {
  				doc: "The right side of the text is placed closest to the anchor."
  			},
  			top: {
  				doc: "The top of the text is placed closest to the anchor."
  			},
  			bottom: {
  				doc: "The bottom of the text is placed closest to the anchor."
  			},
  			"top-left": {
  				doc: "The top left corner of the text is placed closest to the anchor."
  			},
  			"top-right": {
  				doc: "The top right corner of the text is placed closest to the anchor."
  			},
  			"bottom-left": {
  				doc: "The bottom left corner of the text is placed closest to the anchor."
  			},
  			"bottom-right": {
  				doc: "The bottom right corner of the text is placed closest to the anchor."
  			}
  		},
  		"default": "center",
  		doc: "Part of the text placed closest to the anchor.",
  		requires: [
  			"text-field",
  			{
  				"!": "text-variable-anchor"
  			}
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			},
  			"data-driven styling": {
  				js: "0.39.0",
  				android: "5.2.0",
  				ios: "3.7.0",
  				macos: "0.6.0"
  			}
  		},
  		expression: {
  			interpolated: false,
  			parameters: [
  				"zoom",
  				"feature"
  			]
  		},
  		"property-type": "data-driven"
  	},
  	"text-max-angle": {
  		type: "number",
  		"default": 45,
  		units: "degrees",
  		doc: "Maximum angle change between adjacent characters.",
  		requires: [
  			"text-field",
  			{
  				"symbol-placement": [
  					"line",
  					"line-center"
  				]
  			}
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"text-writing-mode": {
  		type: "array",
  		value: "enum",
  		values: {
  			horizontal: {
  				doc: "If a text's language supports horizontal writing mode, symbols with point placement would be laid out horizontally."
  			},
  			vertical: {
  				doc: "If a text's language supports vertical writing mode, symbols with point placement would be laid out vertically."
  			}
  		},
  		doc: "The property allows control over a symbol's orientation. Note that the property values act as a hint, so that a symbol whose language doesn’t support the provided orientation will be laid out in its natural orientation. Example: English point symbol will be rendered horizontally even if array value contains single 'vertical' enum value. The order of elements in an array define priority order for the placement of an orientation variant.",
  		requires: [
  			"text-field",
  			{
  				"symbol-placement": [
  					"point"
  				]
  			}
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "1.3.0",
  				android: "8.3.0",
  				ios: "5.3.0",
  				macos: "0.15.0"
  			}
  		},
  		expression: {
  			interpolated: false,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"text-rotate": {
  		type: "number",
  		"default": 0,
  		period: 360,
  		units: "degrees",
  		doc: "Rotates the text clockwise.",
  		requires: [
  			"text-field"
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			},
  			"data-driven styling": {
  				js: "0.35.0",
  				android: "5.1.0",
  				ios: "3.6.0",
  				macos: "0.5.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom",
  				"feature"
  			]
  		},
  		"property-type": "data-driven"
  	},
  	"text-padding": {
  		type: "number",
  		"default": 2,
  		minimum: 0,
  		units: "pixels",
  		doc: "Size of the additional area around the text bounding box used for detecting symbol collisions.",
  		requires: [
  			"text-field"
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"text-keep-upright": {
  		type: "boolean",
  		"default": true,
  		doc: "If true, the text may be flipped vertically to prevent it from being rendered upside-down.",
  		requires: [
  			"text-field",
  			{
  				"text-rotation-alignment": "map"
  			},
  			{
  				"symbol-placement": [
  					"line",
  					"line-center"
  				]
  			}
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			}
  		},
  		expression: {
  			interpolated: false,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"text-transform": {
  		type: "enum",
  		values: {
  			none: {
  				doc: "The text is not altered."
  			},
  			uppercase: {
  				doc: "Forces all letters to be displayed in uppercase."
  			},
  			lowercase: {
  				doc: "Forces all letters to be displayed in lowercase."
  			}
  		},
  		"default": "none",
  		doc: "Specifies how to capitalize text, similar to the CSS `text-transform` property.",
  		requires: [
  			"text-field"
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			},
  			"data-driven styling": {
  				js: "0.33.0",
  				android: "5.0.0",
  				ios: "3.5.0",
  				macos: "0.4.0"
  			}
  		},
  		expression: {
  			interpolated: false,
  			parameters: [
  				"zoom",
  				"feature"
  			]
  		},
  		"property-type": "data-driven"
  	},
  	"text-offset": {
  		type: "array",
  		doc: "Offset distance of text from its anchor. Positive values indicate right and down, while negative values indicate left and up. If used with text-variable-anchor, input values will be taken as absolute values. Offsets along the x- and y-axis will be applied automatically based on the anchor position.",
  		value: "number",
  		units: "ems",
  		length: 2,
  		"default": [
  			0,
  			0
  		],
  		requires: [
  			"text-field",
  			{
  				"!": "text-radial-offset"
  			}
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			},
  			"data-driven styling": {
  				js: "0.35.0",
  				android: "5.1.0",
  				ios: "3.6.0",
  				macos: "0.5.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom",
  				"feature"
  			]
  		},
  		"property-type": "data-driven"
  	},
  	"text-allow-overlap": {
  		type: "boolean",
  		"default": false,
  		doc: "If true, the text will be visible even if it collides with other previously drawn symbols.",
  		requires: [
  			"text-field"
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			}
  		},
  		expression: {
  			interpolated: false,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"text-ignore-placement": {
  		type: "boolean",
  		"default": false,
  		doc: "If true, other symbols can be visible even if they collide with the text.",
  		requires: [
  			"text-field"
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			}
  		},
  		expression: {
  			interpolated: false,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"text-optional": {
  		type: "boolean",
  		"default": false,
  		doc: "If true, icons will display without their corresponding text when the text collides with other symbols and the icon does not.",
  		requires: [
  			"text-field",
  			"icon-image"
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			}
  		},
  		expression: {
  			interpolated: false,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	visibility: {
  		type: "enum",
  		values: {
  			visible: {
  				doc: "The layer is shown."
  			},
  			none: {
  				doc: "The layer is not shown."
  			}
  		},
  		"default": "visible",
  		doc: "Whether this layer is displayed.",
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			}
  		},
  		"property-type": "constant"
  	}
  };
  var layout_raster = {
  	visibility: {
  		type: "enum",
  		values: {
  			visible: {
  				doc: "The layer is shown."
  			},
  			none: {
  				doc: "The layer is not shown."
  			}
  		},
  		"default": "visible",
  		doc: "Whether this layer is displayed.",
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			}
  		},
  		"property-type": "constant"
  	}
  };
  var layout_hillshade = {
  	visibility: {
  		type: "enum",
  		values: {
  			visible: {
  				doc: "The layer is shown."
  			},
  			none: {
  				doc: "The layer is not shown."
  			}
  		},
  		"default": "visible",
  		doc: "Whether this layer is displayed.",
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.43.0",
  				android: "6.0.0",
  				ios: "4.0.0",
  				macos: "0.7.0"
  			}
  		},
  		"property-type": "constant"
  	}
  };
  var filter = {
  	type: "array",
  	value: "*",
  	doc: "A filter selects specific features from a layer."
  };
  var filter_operator = {
  	type: "enum",
  	values: {
  		"==": {
  			doc: "`[\"==\", key, value]` equality: `feature[key] = value`"
  		},
  		"!=": {
  			doc: "`[\"!=\", key, value]` inequality: `feature[key] ≠ value`"
  		},
  		">": {
  			doc: "`[\">\", key, value]` greater than: `feature[key] > value`"
  		},
  		">=": {
  			doc: "`[\">=\", key, value]` greater than or equal: `feature[key] ≥ value`"
  		},
  		"<": {
  			doc: "`[\"<\", key, value]` less than: `feature[key] < value`"
  		},
  		"<=": {
  			doc: "`[\"<=\", key, value]` less than or equal: `feature[key] ≤ value`"
  		},
  		"in": {
  			doc: "`[\"in\", key, v0, ..., vn]` set inclusion: `feature[key] ∈ {v0, ..., vn}`"
  		},
  		"!in": {
  			doc: "`[\"!in\", key, v0, ..., vn]` set exclusion: `feature[key] ∉ {v0, ..., vn}`"
  		},
  		all: {
  			doc: "`[\"all\", f0, ..., fn]` logical `AND`: `f0 ∧ ... ∧ fn`"
  		},
  		any: {
  			doc: "`[\"any\", f0, ..., fn]` logical `OR`: `f0 ∨ ... ∨ fn`"
  		},
  		none: {
  			doc: "`[\"none\", f0, ..., fn]` logical `NOR`: `¬f0 ∧ ... ∧ ¬fn`"
  		},
  		has: {
  			doc: "`[\"has\", key]` `feature[key]` exists"
  		},
  		"!has": {
  			doc: "`[\"!has\", key]` `feature[key]` does not exist"
  		},
  		within: {
  			doc: "`[\"within\", object]` feature geometry is within object geometry"
  		}
  	},
  	doc: "The filter operator."
  };
  var geometry_type = {
  	type: "enum",
  	values: {
  		Point: {
  			doc: "Filter to point geometries."
  		},
  		LineString: {
  			doc: "Filter to line geometries."
  		},
  		Polygon: {
  			doc: "Filter to polygon geometries."
  		}
  	},
  	doc: "The geometry type for the filter to select."
  };
  var function_stop = {
  	type: "array",
  	minimum: 0,
  	maximum: 24,
  	value: [
  		"number",
  		"color"
  	],
  	length: 2,
  	doc: "Zoom level and value pair."
  };
  var expression = {
  	type: "array",
  	value: "*",
  	minimum: 1,
  	doc: "An expression defines a function that can be used for data-driven style properties or feature filters."
  };
  var expression_name = {
  	doc: "",
  	type: "enum",
  	values: {
  		"let": {
  			doc: "Binds expressions to named variables, which can then be referenced in the result expression using [\"var\", \"variable_name\"].",
  			group: "Variable binding",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		"var": {
  			doc: "References variable bound using \"let\".",
  			group: "Variable binding",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		literal: {
  			doc: "Provides a literal array or object value.",
  			group: "Types",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		array: {
  			doc: "Asserts that the input is an array (optionally with a specific item type and length).  If, when the input expression is evaluated, it is not of the asserted type, then this assertion will cause the whole expression to be aborted.",
  			group: "Types",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		at: {
  			doc: "Retrieves an item from an array.",
  			group: "Lookup",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		"in": {
  			doc: "Determines whether an item exists in an array or a substring exists in a string.",
  			group: "Lookup",
  			"sdk-support": {
  				"basic functionality": {
  					js: "1.6.0",
  					android: "9.1.0",
  					ios: "5.8.0",
  					macos: "0.15.0"
  				}
  			}
  		},
  		"index-of": {
  			doc: "Returns the first position at which an item can be found in an array or a substring can be found in a string, or `-1` if the input cannot be found. Accepts an optional index from where to begin the search.",
  			group: "Lookup",
  			"sdk-support": {
  				"basic functionality": {
  					js: "1.10.0"
  				}
  			}
  		},
  		slice: {
  			doc: "Returns an item from an array or a substring from a string from a specified start index, or between a start index and an end index if set. The return value is inclusive of the start index but not of the end index.",
  			group: "Lookup",
  			"sdk-support": {
  				"basic functionality": {
  					js: "1.10.0"
  				}
  			}
  		},
  		"case": {
  			doc: "Selects the first output whose corresponding test condition evaluates to true, or the fallback value otherwise.",
  			group: "Decision",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		match: {
  			doc: "Selects the output for which the label value matches the input value, or the fallback value if no match is found. The input can be any expression (for example, `[\"get\", \"building_type\"]`). Each label must be unique, and must be either:\n - a single literal value; or\n - an array of literal values, the values of which must be all strings or all numbers (for example `[100, 101]` or `[\"c\", \"b\"]`).\n\nThe input matches if any of the values in the array matches using strict equality, similar to the `\"in\"` operator.\nIf the input type does not match the type of the labels, the result will be the fallback value.",
  			group: "Decision",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		coalesce: {
  			doc: "Evaluates each expression in turn until the first non-null value is obtained, and returns that value.",
  			group: "Decision",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		step: {
  			doc: "Produces discrete, stepped results by evaluating a piecewise-constant function defined by pairs of input and output values (\"stops\"). The `input` may be any numeric expression (e.g., `[\"get\", \"population\"]`). Stop inputs must be numeric literals in strictly ascending order. Returns the output value of the stop just less than the input, or the first output if the input is less than the first stop.",
  			group: "Ramps, scales, curves",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.42.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		interpolate: {
  			doc: "Produces continuous, smooth results by interpolating between pairs of input and output values (\"stops\"). The `input` may be any numeric expression (e.g., `[\"get\", \"population\"]`). Stop inputs must be numeric literals in strictly ascending order. The output type must be `number`, `array<number>`, or `color`.\n\nInterpolation types:\n- `[\"linear\"]`: Interpolates linearly between the pair of stops just less than and just greater than the input.\n- `[\"exponential\", base]`: Interpolates exponentially between the stops just less than and just greater than the input. `base` controls the rate at which the output increases: higher values make the output increase more towards the high end of the range. With values close to 1 the output increases linearly.\n- `[\"cubic-bezier\", x1, y1, x2, y2]`: Interpolates using the cubic bezier curve defined by the given control points.",
  			group: "Ramps, scales, curves",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.42.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		"interpolate-hcl": {
  			doc: "Produces continuous, smooth results by interpolating between pairs of input and output values (\"stops\"). Works like `interpolate`, but the output type must be `color`, and the interpolation is performed in the Hue-Chroma-Luminance color space.",
  			group: "Ramps, scales, curves",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.49.0"
  				}
  			}
  		},
  		"interpolate-lab": {
  			doc: "Produces continuous, smooth results by interpolating between pairs of input and output values (\"stops\"). Works like `interpolate`, but the output type must be `color`, and the interpolation is performed in the CIELAB color space.",
  			group: "Ramps, scales, curves",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.49.0"
  				}
  			}
  		},
  		ln2: {
  			doc: "Returns mathematical constant ln(2).",
  			group: "Math",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		pi: {
  			doc: "Returns the mathematical constant pi.",
  			group: "Math",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		e: {
  			doc: "Returns the mathematical constant e.",
  			group: "Math",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		"typeof": {
  			doc: "Returns a string describing the type of the given value.",
  			group: "Types",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		string: {
  			doc: "Asserts that the input value is a string. If multiple values are provided, each one is evaluated in order until a string is obtained. If none of the inputs are strings, the expression is an error.",
  			group: "Types",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		number: {
  			doc: "Asserts that the input value is a number. If multiple values are provided, each one is evaluated in order until a number is obtained. If none of the inputs are numbers, the expression is an error.",
  			group: "Types",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		boolean: {
  			doc: "Asserts that the input value is a boolean. If multiple values are provided, each one is evaluated in order until a boolean is obtained. If none of the inputs are booleans, the expression is an error.",
  			group: "Types",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		object: {
  			doc: "Asserts that the input value is an object. If multiple values are provided, each one is evaluated in order until an object is obtained. If none of the inputs are objects, the expression is an error.",
  			group: "Types",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		collator: {
  			doc: "Returns a `collator` for use in locale-dependent comparison operations. The `case-sensitive` and `diacritic-sensitive` options default to `false`. The `locale` argument specifies the IETF language tag of the locale to use. If none is provided, the default locale is used. If the requested locale is not available, the `collator` will use a system-defined fallback locale. Use `resolved-locale` to test the results of locale fallback behavior.",
  			group: "Types",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.45.0",
  					android: "6.5.0",
  					ios: "4.2.0",
  					macos: "0.9.0"
  				}
  			}
  		},
  		format: {
  			doc: "Returns a `formatted` string for displaying mixed-format text in the `text-field` property. The input may contain a string literal or expression, including an [`'image'`](#types-image) expression. Strings may be followed by a style override object that supports the following properties:\n- `\"text-font\"`: Overrides the font stack specified by the root layout property.\n- `\"text-color\"`: Overrides the color specified by the root paint property.\n- `\"font-scale\"`: Applies a scaling factor on `text-size` as specified by the root layout property.",
  			group: "Types",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.48.0",
  					android: "6.7.0",
  					ios: "4.6.0",
  					macos: "0.12.0"
  				},
  				"text-font": {
  					js: "0.48.0",
  					android: "6.7.0",
  					ios: "4.6.0",
  					macos: "0.12.0"
  				},
  				"font-scale": {
  					js: "0.48.0",
  					android: "6.7.0",
  					ios: "4.6.0",
  					macos: "0.12.0"
  				},
  				"text-color": {
  					js: "1.3.0",
  					android: "7.3.0",
  					ios: "4.10.0",
  					macos: "0.14.0"
  				},
  				image: {
  					js: "1.6.0",
  					android: "8.6.0",
  					ios: "5.7.0",
  					macos: "0.15.0"
  				}
  			}
  		},
  		image: {
  			doc: "Returns an `image` type for use in `icon-image`, `*-pattern` entries and as a section in the `format` expression. If set, the `image` argument will check that the requested image exists in the style and will return either the resolved image name or `null`, depending on whether or not the image is currently in the style. This validation process is synchronous and requires the image to have been added to the style before requesting it in the `image` argument.",
  			group: "Types",
  			"sdk-support": {
  				"basic functionality": {
  					js: "1.4.0",
  					android: "8.6.0",
  					ios: "5.7.0",
  					macos: "0.15.0"
  				}
  			}
  		},
  		"number-format": {
  			doc: "Converts the input number into a string representation using the providing formatting rules. If set, the `locale` argument specifies the locale to use, as a BCP 47 language tag. If set, the `currency` argument specifies an ISO 4217 code to use for currency-style formatting. If set, the `min-fraction-digits` and `max-fraction-digits` arguments specify the minimum and maximum number of fractional digits to include.",
  			group: "Types",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.54.0"
  				}
  			}
  		},
  		"to-string": {
  			doc: "Converts the input value to a string. If the input is `null`, the result is `\"\"`. If the input is a boolean, the result is `\"true\"` or `\"false\"`. If the input is a number, it is converted to a string as specified by the [\"NumberToString\" algorithm](https://tc39.github.io/ecma262/#sec-tostring-applied-to-the-number-type) of the ECMAScript Language Specification. If the input is a color, it is converted to a string of the form `\"rgba(r,g,b,a)\"`, where `r`, `g`, and `b` are numerals ranging from 0 to 255, and `a` ranges from 0 to 1. Otherwise, the input is converted to a string in the format specified by the [`JSON.stringify`](https://tc39.github.io/ecma262/#sec-json.stringify) function of the ECMAScript Language Specification.",
  			group: "Types",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		"to-number": {
  			doc: "Converts the input value to a number, if possible. If the input is `null` or `false`, the result is 0. If the input is `true`, the result is 1. If the input is a string, it is converted to a number as specified by the [\"ToNumber Applied to the String Type\" algorithm](https://tc39.github.io/ecma262/#sec-tonumber-applied-to-the-string-type) of the ECMAScript Language Specification. If multiple values are provided, each one is evaluated in order until the first successful conversion is obtained. If none of the inputs can be converted, the expression is an error.",
  			group: "Types",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		"to-boolean": {
  			doc: "Converts the input value to a boolean. The result is `false` when then input is an empty string, 0, `false`, `null`, or `NaN`; otherwise it is `true`.",
  			group: "Types",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		"to-rgba": {
  			doc: "Returns a four-element array containing the input color's red, green, blue, and alpha components, in that order.",
  			group: "Color",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		"to-color": {
  			doc: "Converts the input value to a color. If multiple values are provided, each one is evaluated in order until the first successful conversion is obtained. If none of the inputs can be converted, the expression is an error.",
  			group: "Types",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		rgb: {
  			doc: "Creates a color value from red, green, and blue components, which must range between 0 and 255, and an alpha component of 1. If any component is out of range, the expression is an error.",
  			group: "Color",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		rgba: {
  			doc: "Creates a color value from red, green, blue components, which must range between 0 and 255, and an alpha component which must range between 0 and 1. If any component is out of range, the expression is an error.",
  			group: "Color",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		get: {
  			doc: "Retrieves a property value from the current feature's properties, or from another object if a second argument is provided. Returns null if the requested property is missing.",
  			group: "Lookup",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		has: {
  			doc: "Tests for the presence of an property value in the current feature's properties, or from another object if a second argument is provided.",
  			group: "Lookup",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		length: {
  			doc: "Gets the length of an array or string.",
  			group: "Lookup",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		properties: {
  			doc: "Gets the feature properties object.  Note that in some cases, it may be more efficient to use [\"get\", \"property_name\"] directly.",
  			group: "Feature data",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		"feature-state": {
  			doc: "Retrieves a property value from the current feature's state. Returns null if the requested property is not present on the feature's state. A feature's state is not part of the GeoJSON or vector tile data, and must be set programmatically on each feature. Features are identified by their `id` attribute, which must be an integer or a string that can be cast to an integer. Note that [\"feature-state\"] can only be used with paint properties that support data-driven styling.",
  			group: "Feature data",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.46.0"
  				}
  			}
  		},
  		"geometry-type": {
  			doc: "Gets the feature's geometry type: `Point`, `MultiPoint`, `LineString`, `MultiLineString`, `Polygon`, `MultiPolygon`.",
  			group: "Feature data",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		id: {
  			doc: "Gets the feature's id, if it has one.",
  			group: "Feature data",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		zoom: {
  			doc: "Gets the current zoom level.  Note that in style layout and paint properties, [\"zoom\"] may only appear as the input to a top-level \"step\" or \"interpolate\" expression.",
  			group: "Zoom",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		"heatmap-density": {
  			doc: "Gets the kernel density estimation of a pixel in a heatmap layer, which is a relative measure of how many data points are crowded around a particular pixel. Can only be used in the `heatmap-color` property.",
  			group: "Heatmap",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		"line-progress": {
  			doc: "Gets the progress along a gradient line. Can only be used in the `line-gradient` property.",
  			group: "Feature data",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.45.0",
  					android: "6.5.0",
  					ios: "4.6.0",
  					macos: "0.12.0"
  				}
  			}
  		},
  		"sky-radial-progress": {
  			doc: "Gets the distance of a point on the sky from the sun position. Returns 0 at sun position and 1 when the distance reaches `sky-gradient-radius`. Can only be used in the `sky-gradient` property.",
  			group: "sky",
  			"sdk-support": {
  				"basic functionality": {
  					js: "2.0.0"
  				}
  			}
  		},
  		accumulated: {
  			doc: "Gets the value of a cluster property accumulated so far. Can only be used in the `clusterProperties` option of a clustered GeoJSON source.",
  			group: "Feature data",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.53.0"
  				}
  			}
  		},
  		"+": {
  			doc: "Returns the sum of the inputs.",
  			group: "Math",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		"*": {
  			doc: "Returns the product of the inputs.",
  			group: "Math",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		"-": {
  			doc: "For two inputs, returns the result of subtracting the second input from the first. For a single input, returns the result of subtracting it from 0.",
  			group: "Math",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		"/": {
  			doc: "Returns the result of floating point division of the first input by the second.",
  			group: "Math",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		"%": {
  			doc: "Returns the remainder after integer division of the first input by the second.",
  			group: "Math",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		"^": {
  			doc: "Returns the result of raising the first input to the power specified by the second.",
  			group: "Math",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		sqrt: {
  			doc: "Returns the square root of the input.",
  			group: "Math",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.42.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		log10: {
  			doc: "Returns the base-ten logarithm of the input.",
  			group: "Math",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		ln: {
  			doc: "Returns the natural logarithm of the input.",
  			group: "Math",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		log2: {
  			doc: "Returns the base-two logarithm of the input.",
  			group: "Math",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		sin: {
  			doc: "Returns the sine of the input.",
  			group: "Math",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		cos: {
  			doc: "Returns the cosine of the input.",
  			group: "Math",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		tan: {
  			doc: "Returns the tangent of the input.",
  			group: "Math",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		asin: {
  			doc: "Returns the arcsine of the input.",
  			group: "Math",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		acos: {
  			doc: "Returns the arccosine of the input.",
  			group: "Math",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		atan: {
  			doc: "Returns the arctangent of the input.",
  			group: "Math",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		min: {
  			doc: "Returns the minimum value of the inputs.",
  			group: "Math",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		max: {
  			doc: "Returns the maximum value of the inputs.",
  			group: "Math",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		round: {
  			doc: "Rounds the input to the nearest integer. Halfway values are rounded away from zero. For example, `[\"round\", -1.5]` evaluates to -2.",
  			group: "Math",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.45.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		abs: {
  			doc: "Returns the absolute value of the input.",
  			group: "Math",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.45.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		ceil: {
  			doc: "Returns the smallest integer that is greater than or equal to the input.",
  			group: "Math",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.45.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		floor: {
  			doc: "Returns the largest integer that is less than or equal to the input.",
  			group: "Math",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.45.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		distance: {
  			doc: "Returns the shortest distance in meters between the evaluated feature and the input geometry. The input value can be a valid GeoJSON of type `Point`, `MultiPoint`, `LineString`, `MultiLineString`, `Polygon`, `MultiPolygon`, `Feature`, or `FeatureCollection`. Distance values returned may vary in precision due to loss in precision from encoding geometries, particularly below zoom level 13.",
  			group: "Math",
  			"sdk-support": {
  				"basic functionality": {
  					android: "9.2.0",
  					ios: "5.9.0",
  					macos: "0.16.0"
  				}
  			}
  		},
  		"==": {
  			doc: "Returns `true` if the input values are equal, `false` otherwise. The comparison is strictly typed: values of different runtime types are always considered unequal. Cases where the types are known to be different at parse time are considered invalid and will produce a parse error. Accepts an optional `collator` argument to control locale-dependent string comparisons.",
  			group: "Decision",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				},
  				collator: {
  					js: "0.45.0",
  					android: "6.5.0",
  					ios: "4.2.0",
  					macos: "0.9.0"
  				}
  			}
  		},
  		"!=": {
  			doc: "Returns `true` if the input values are not equal, `false` otherwise. The comparison is strictly typed: values of different runtime types are always considered unequal. Cases where the types are known to be different at parse time are considered invalid and will produce a parse error. Accepts an optional `collator` argument to control locale-dependent string comparisons.",
  			group: "Decision",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				},
  				collator: {
  					js: "0.45.0",
  					android: "6.5.0",
  					ios: "4.2.0",
  					macos: "0.9.0"
  				}
  			}
  		},
  		">": {
  			doc: "Returns `true` if the first input is strictly greater than the second, `false` otherwise. The arguments are required to be either both strings or both numbers; if during evaluation they are not, expression evaluation produces an error. Cases where this constraint is known not to hold at parse time are considered in valid and will produce a parse error. Accepts an optional `collator` argument to control locale-dependent string comparisons.",
  			group: "Decision",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				},
  				collator: {
  					js: "0.45.0",
  					android: "6.5.0",
  					ios: "4.2.0",
  					macos: "0.9.0"
  				}
  			}
  		},
  		"<": {
  			doc: "Returns `true` if the first input is strictly less than the second, `false` otherwise. The arguments are required to be either both strings or both numbers; if during evaluation they are not, expression evaluation produces an error. Cases where this constraint is known not to hold at parse time are considered in valid and will produce a parse error. Accepts an optional `collator` argument to control locale-dependent string comparisons.",
  			group: "Decision",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				},
  				collator: {
  					js: "0.45.0",
  					android: "6.5.0",
  					ios: "4.2.0",
  					macos: "0.9.0"
  				}
  			}
  		},
  		">=": {
  			doc: "Returns `true` if the first input is greater than or equal to the second, `false` otherwise. The arguments are required to be either both strings or both numbers; if during evaluation they are not, expression evaluation produces an error. Cases where this constraint is known not to hold at parse time are considered in valid and will produce a parse error. Accepts an optional `collator` argument to control locale-dependent string comparisons.",
  			group: "Decision",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				},
  				collator: {
  					js: "0.45.0",
  					android: "6.5.0",
  					ios: "4.2.0",
  					macos: "0.9.0"
  				}
  			}
  		},
  		"<=": {
  			doc: "Returns `true` if the first input is less than or equal to the second, `false` otherwise. The arguments are required to be either both strings or both numbers; if during evaluation they are not, expression evaluation produces an error. Cases where this constraint is known not to hold at parse time are considered in valid and will produce a parse error. Accepts an optional `collator` argument to control locale-dependent string comparisons.",
  			group: "Decision",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				},
  				collator: {
  					js: "0.45.0",
  					android: "6.5.0",
  					ios: "4.2.0",
  					macos: "0.9.0"
  				}
  			}
  		},
  		all: {
  			doc: "Returns `true` if all the inputs are `true`, `false` otherwise. The inputs are evaluated in order, and evaluation is short-circuiting: once an input expression evaluates to `false`, the result is `false` and no further input expressions are evaluated.",
  			group: "Decision",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		any: {
  			doc: "Returns `true` if any of the inputs are `true`, `false` otherwise. The inputs are evaluated in order, and evaluation is short-circuiting: once an input expression evaluates to `true`, the result is `true` and no further input expressions are evaluated.",
  			group: "Decision",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		"!": {
  			doc: "Logical negation. Returns `true` if the input is `false`, and `false` if the input is `true`.",
  			group: "Decision",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		within: {
  			doc: "Returns `true` if the evaluated feature is fully contained inside a boundary of the input geometry, `false` otherwise. The input value can be a valid GeoJSON of type `Polygon`, `MultiPolygon`, `Feature`, or `FeatureCollection`. Supported features for evaluation:\n- `Point`: Returns `false` if a point is on the boundary or falls outside the boundary.\n- `LineString`: Returns `false` if any part of a line falls outside the boundary, the line intersects the boundary, or a line's endpoint is on the boundary.",
  			group: "Decision",
  			"sdk-support": {
  				"basic functionality": {
  					js: "1.9.0",
  					android: "9.1.0",
  					ios: "5.8.0",
  					macos: "0.15.0"
  				}
  			}
  		},
  		"is-supported-script": {
  			doc: "Returns `true` if the input string is expected to render legibly. Returns `false` if the input string contains sections that cannot be rendered without potential loss of meaning (e.g. Indic scripts that require complex text shaping, or right-to-left scripts if the the `mapbox-gl-rtl-text` plugin is not in use in Mapbox GL JS).",
  			group: "String",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.45.0",
  					android: "6.6.0"
  				}
  			}
  		},
  		upcase: {
  			doc: "Returns the input string converted to uppercase. Follows the Unicode Default Case Conversion algorithm and the locale-insensitive case mappings in the Unicode Character Database.",
  			group: "String",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		downcase: {
  			doc: "Returns the input string converted to lowercase. Follows the Unicode Default Case Conversion algorithm and the locale-insensitive case mappings in the Unicode Character Database.",
  			group: "String",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		concat: {
  			doc: "Returns a `string` consisting of the concatenation of the inputs. Each input is converted to a string as if by `to-string`.",
  			group: "String",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.41.0",
  					android: "6.0.0",
  					ios: "4.0.0",
  					macos: "0.7.0"
  				}
  			}
  		},
  		"resolved-locale": {
  			doc: "Returns the IETF language tag of the locale being used by the provided `collator`. This can be used to determine the default system locale, or to determine if a requested locale was successfully loaded.",
  			group: "String",
  			"sdk-support": {
  				"basic functionality": {
  					js: "0.45.0",
  					android: "6.5.0",
  					ios: "4.2.0",
  					macos: "0.9.0"
  				}
  			}
  		}
  	}
  };
  var fog = {
  	range: {
  		type: "array",
  		"default": [
  			0.5,
  			10
  		],
  		minimum: -20,
  		maximum: 20,
  		length: 2,
  		value: "number",
  		"property-type": "data-constant",
  		transition: true,
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom"
  			]
  		},
  		doc: "The start and end distance range in which fog fades from fully transparent to fully opaque. The distance to the point at the center of the map is defined as zero, so that negative range values are closer to the camera, and positive values are farther away.",
  		example: [
  			0.5,
  			10
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "2.3.0"
  			}
  		}
  	},
  	color: {
  		type: "color",
  		"property-type": "data-constant",
  		"default": "#ffffff",
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom"
  			]
  		},
  		transition: true,
  		doc: "The color of the fog. Using opacity is recommended only for smoothly transitioning fog on/off as anything less than 100% opacity results in more tiles loaded and drawn.",
  		"sdk-support": {
  			"basic functionality": {
  				js: "2.3.0"
  			}
  		}
  	},
  	"horizon-blend": {
  		type: "number",
  		"property-type": "data-constant",
  		"default": 0.1,
  		minimum: 0,
  		maximum: 1,
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom"
  			]
  		},
  		transition: true,
  		doc: "Horizon blend applies a smooth fade from the color of the fog to the color of the sky. A value of zero leaves a sharp transition from fog to sky. Increasing the value blends the color of fog into increasingly high angles of the sky.",
  		"sdk-support": {
  			"basic functionality": {
  				js: "2.3.0"
  			}
  		}
  	}
  };
  var light = {
  	anchor: {
  		type: "enum",
  		"default": "viewport",
  		values: {
  			map: {
  				doc: "The position of the light source is aligned to the rotation of the map."
  			},
  			viewport: {
  				doc: "The position of the light source is aligned to the rotation of the viewport."
  			}
  		},
  		"property-type": "data-constant",
  		transition: false,
  		expression: {
  			interpolated: false,
  			parameters: [
  				"zoom"
  			]
  		},
  		doc: "Whether extruded geometries are lit relative to the map or viewport.",
  		example: "map",
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.27.0",
  				android: "5.1.0",
  				ios: "3.6.0",
  				macos: "0.5.0"
  			}
  		}
  	},
  	position: {
  		type: "array",
  		"default": [
  			1.15,
  			210,
  			30
  		],
  		length: 3,
  		value: "number",
  		"property-type": "data-constant",
  		transition: true,
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom"
  			]
  		},
  		doc: "Position of the light source relative to lit (extruded) geometries, in [r radial coordinate, a azimuthal angle, p polar angle] where r indicates the distance from the center of the base of an object to its light, a indicates the position of the light relative to 0° (0° when `light.anchor` is set to `viewport` corresponds to the top of the viewport, or 0° when `light.anchor` is set to `map` corresponds to due north, and degrees proceed clockwise), and p indicates the height of the light (from 0°, directly above, to 180°, directly below).",
  		example: [
  			1.5,
  			90,
  			80
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.27.0",
  				android: "5.1.0",
  				ios: "3.6.0",
  				macos: "0.5.0"
  			}
  		}
  	},
  	color: {
  		type: "color",
  		"property-type": "data-constant",
  		"default": "#ffffff",
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom"
  			]
  		},
  		transition: true,
  		doc: "Color tint for lighting extruded geometries.",
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.27.0",
  				android: "5.1.0",
  				ios: "3.6.0",
  				macos: "0.5.0"
  			}
  		}
  	},
  	intensity: {
  		type: "number",
  		"property-type": "data-constant",
  		"default": 0.5,
  		minimum: 0,
  		maximum: 1,
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom"
  			]
  		},
  		transition: true,
  		doc: "Intensity of lighting (on a scale from 0 to 1). Higher numbers will present as more extreme contrast.",
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.27.0",
  				android: "5.1.0",
  				ios: "3.6.0",
  				macos: "0.5.0"
  			}
  		}
  	}
  };
  var terrain = {
  	source: {
  		type: "string",
  		doc: "Name of a source of `raster_dem` type to be used for terrain elevation.",
  		required: true,
  		"sdk-support": {
  			"basic functionality": {
  				js: "2.0.0"
  			}
  		}
  	},
  	exaggeration: {
  		type: "number",
  		"property-type": "data-constant",
  		"default": 1,
  		minimum: 0,
  		maximum: 1000,
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom"
  			]
  		},
  		transition: true,
  		doc: "Exaggerates the elevation of the terrain by multiplying the data from the DEM with this value.",
  		"sdk-support": {
  			"basic functionality": {
  				js: "2.0.0"
  			}
  		}
  	}
  };
  var paint = [
  	"paint_fill",
  	"paint_line",
  	"paint_circle",
  	"paint_heatmap",
  	"paint_fill-extrusion",
  	"paint_symbol",
  	"paint_raster",
  	"paint_hillshade",
  	"paint_background",
  	"paint_sky"
  ];
  var paint_fill = {
  	"fill-antialias": {
  		type: "boolean",
  		"default": true,
  		doc: "Whether or not the fill should be antialiased.",
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			}
  		},
  		expression: {
  			interpolated: false,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"fill-opacity": {
  		type: "number",
  		"default": 1,
  		minimum: 0,
  		maximum: 1,
  		doc: "The opacity of the entire fill layer. In contrast to the `fill-color`, this value will also affect the 1px stroke around the fill, if the stroke is used.",
  		transition: true,
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			},
  			"data-driven styling": {
  				js: "0.21.0",
  				android: "5.0.0",
  				ios: "3.5.0",
  				macos: "0.4.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom",
  				"feature",
  				"feature-state"
  			]
  		},
  		"property-type": "data-driven"
  	},
  	"fill-color": {
  		type: "color",
  		"default": "#000000",
  		doc: "The color of the filled part of this layer. This color can be specified as `rgba` with an alpha component and the color's opacity will not affect the opacity of the 1px stroke, if it is used.",
  		transition: true,
  		requires: [
  			{
  				"!": "fill-pattern"
  			}
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			},
  			"data-driven styling": {
  				js: "0.19.0",
  				android: "5.0.0",
  				ios: "3.5.0",
  				macos: "0.4.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom",
  				"feature",
  				"feature-state"
  			]
  		},
  		"property-type": "data-driven"
  	},
  	"fill-outline-color": {
  		type: "color",
  		doc: "The outline color of the fill. Matches the value of `fill-color` if unspecified.",
  		transition: true,
  		requires: [
  			{
  				"!": "fill-pattern"
  			},
  			{
  				"fill-antialias": true
  			}
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			},
  			"data-driven styling": {
  				js: "0.19.0",
  				android: "5.0.0",
  				ios: "3.5.0",
  				macos: "0.4.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom",
  				"feature",
  				"feature-state"
  			]
  		},
  		"property-type": "data-driven"
  	},
  	"fill-translate": {
  		type: "array",
  		value: "number",
  		length: 2,
  		"default": [
  			0,
  			0
  		],
  		transition: true,
  		units: "pixels",
  		doc: "The geometry's offset. Values are [x, y] where negatives indicate left and up, respectively.",
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"fill-translate-anchor": {
  		type: "enum",
  		values: {
  			map: {
  				doc: "The fill is translated relative to the map."
  			},
  			viewport: {
  				doc: "The fill is translated relative to the viewport."
  			}
  		},
  		doc: "Controls the frame of reference for `fill-translate`.",
  		"default": "map",
  		requires: [
  			"fill-translate"
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			}
  		},
  		expression: {
  			interpolated: false,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"fill-pattern": {
  		type: "resolvedImage",
  		transition: true,
  		doc: "Name of image in sprite to use for drawing image fills. For seamless patterns, image width and height must be a factor of two (2, 4, 8, ..., 512). Note that zoom-dependent expressions will be evaluated only at integer zoom levels.",
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			},
  			"data-driven styling": {
  				js: "0.49.0",
  				android: "6.5.0",
  				macos: "0.11.0",
  				ios: "4.4.0"
  			}
  		},
  		expression: {
  			interpolated: false,
  			parameters: [
  				"zoom",
  				"feature"
  			]
  		},
  		"property-type": "cross-faded-data-driven"
  	}
  };
  var paint_line = {
  	"line-opacity": {
  		type: "number",
  		doc: "The opacity at which the line will be drawn.",
  		"default": 1,
  		minimum: 0,
  		maximum: 1,
  		transition: true,
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			},
  			"data-driven styling": {
  				js: "0.29.0",
  				android: "5.0.0",
  				ios: "3.5.0",
  				macos: "0.4.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom",
  				"feature",
  				"feature-state"
  			]
  		},
  		"property-type": "data-driven"
  	},
  	"line-color": {
  		type: "color",
  		doc: "The color with which the line will be drawn.",
  		"default": "#000000",
  		transition: true,
  		requires: [
  			{
  				"!": "line-pattern"
  			}
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			},
  			"data-driven styling": {
  				js: "0.23.0",
  				android: "5.0.0",
  				ios: "3.5.0",
  				macos: "0.4.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom",
  				"feature",
  				"feature-state"
  			]
  		},
  		"property-type": "data-driven"
  	},
  	"line-translate": {
  		type: "array",
  		value: "number",
  		length: 2,
  		"default": [
  			0,
  			0
  		],
  		transition: true,
  		units: "pixels",
  		doc: "The geometry's offset. Values are [x, y] where negatives indicate left and up, respectively.",
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"line-translate-anchor": {
  		type: "enum",
  		values: {
  			map: {
  				doc: "The line is translated relative to the map."
  			},
  			viewport: {
  				doc: "The line is translated relative to the viewport."
  			}
  		},
  		doc: "Controls the frame of reference for `line-translate`.",
  		"default": "map",
  		requires: [
  			"line-translate"
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			}
  		},
  		expression: {
  			interpolated: false,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"line-width": {
  		type: "number",
  		"default": 1,
  		minimum: 0,
  		transition: true,
  		units: "pixels",
  		doc: "Stroke thickness.",
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			},
  			"data-driven styling": {
  				js: "0.39.0",
  				android: "5.2.0",
  				ios: "3.7.0",
  				macos: "0.6.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom",
  				"feature",
  				"feature-state"
  			]
  		},
  		"property-type": "data-driven"
  	},
  	"line-gap-width": {
  		type: "number",
  		"default": 0,
  		minimum: 0,
  		doc: "Draws a line casing outside of a line's actual path. Value indicates the width of the inner gap.",
  		transition: true,
  		units: "pixels",
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			},
  			"data-driven styling": {
  				js: "0.29.0",
  				android: "5.0.0",
  				ios: "3.5.0",
  				macos: "0.4.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom",
  				"feature",
  				"feature-state"
  			]
  		},
  		"property-type": "data-driven"
  	},
  	"line-offset": {
  		type: "number",
  		"default": 0,
  		doc: "The line's offset. For linear features, a positive value offsets the line to the right, relative to the direction of the line, and a negative value to the left. For polygon features, a positive value results in an inset, and a negative value results in an outset.",
  		transition: true,
  		units: "pixels",
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.12.1",
  				android: "3.0.0",
  				ios: "3.1.0",
  				macos: "0.1.0"
  			},
  			"data-driven styling": {
  				js: "0.29.0",
  				android: "5.0.0",
  				ios: "3.5.0",
  				macos: "0.4.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom",
  				"feature",
  				"feature-state"
  			]
  		},
  		"property-type": "data-driven"
  	},
  	"line-blur": {
  		type: "number",
  		"default": 0,
  		minimum: 0,
  		transition: true,
  		units: "pixels",
  		doc: "Blur applied to the line, in pixels.",
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			},
  			"data-driven styling": {
  				js: "0.29.0",
  				android: "5.0.0",
  				ios: "3.5.0",
  				macos: "0.4.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom",
  				"feature",
  				"feature-state"
  			]
  		},
  		"property-type": "data-driven"
  	},
  	"line-dasharray": {
  		type: "array",
  		value: "number",
  		doc: "Specifies the lengths of the alternating dashes and gaps that form the dash pattern. The lengths are later scaled by the line width. To convert a dash length to pixels, multiply the length by the current line width. Note that GeoJSON sources with `lineMetrics: true` specified won't render dashed lines to the expected scale. Also note that zoom-dependent expressions will be evaluated only at integer zoom levels.",
  		minimum: 0,
  		transition: true,
  		units: "line widths",
  		requires: [
  			{
  				"!": "line-pattern"
  			}
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			},
  			"data-driven styling": {
  				js: "2.3.0"
  			}
  		},
  		expression: {
  			interpolated: false,
  			parameters: [
  				"zoom",
  				"feature"
  			]
  		},
  		"property-type": "cross-faded-data-driven"
  	},
  	"line-pattern": {
  		type: "resolvedImage",
  		transition: true,
  		doc: "Name of image in sprite to use for drawing image lines. For seamless patterns, image width must be a factor of two (2, 4, 8, ..., 512). Note that zoom-dependent expressions will be evaluated only at integer zoom levels.",
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			},
  			"data-driven styling": {
  				js: "0.49.0",
  				android: "6.5.0",
  				macos: "0.11.0",
  				ios: "4.4.0"
  			}
  		},
  		expression: {
  			interpolated: false,
  			parameters: [
  				"zoom",
  				"feature"
  			]
  		},
  		"property-type": "cross-faded-data-driven"
  	},
  	"line-gradient": {
  		type: "color",
  		doc: "Defines a gradient with which to color a line feature. Can only be used with GeoJSON sources that specify `\"lineMetrics\": true`.",
  		transition: false,
  		requires: [
  			{
  				"!": "line-dasharray"
  			},
  			{
  				"!": "line-pattern"
  			},
  			{
  				source: "geojson",
  				has: {
  					lineMetrics: true
  				}
  			}
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.45.0",
  				android: "6.5.0",
  				ios: "4.4.0",
  				macos: "0.11.0"
  			},
  			"data-driven styling": {
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"line-progress"
  			]
  		},
  		"property-type": "color-ramp"
  	}
  };
  var paint_circle = {
  	"circle-radius": {
  		type: "number",
  		"default": 5,
  		minimum: 0,
  		transition: true,
  		units: "pixels",
  		doc: "Circle radius.",
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			},
  			"data-driven styling": {
  				js: "0.18.0",
  				android: "5.0.0",
  				ios: "3.5.0",
  				macos: "0.4.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom",
  				"feature",
  				"feature-state"
  			]
  		},
  		"property-type": "data-driven"
  	},
  	"circle-color": {
  		type: "color",
  		"default": "#000000",
  		doc: "The fill color of the circle.",
  		transition: true,
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			},
  			"data-driven styling": {
  				js: "0.18.0",
  				android: "5.0.0",
  				ios: "3.5.0",
  				macos: "0.4.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom",
  				"feature",
  				"feature-state"
  			]
  		},
  		"property-type": "data-driven"
  	},
  	"circle-blur": {
  		type: "number",
  		"default": 0,
  		doc: "Amount to blur the circle. 1 blurs the circle such that only the centerpoint is full opacity.",
  		transition: true,
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			},
  			"data-driven styling": {
  				js: "0.20.0",
  				android: "5.0.0",
  				ios: "3.5.0",
  				macos: "0.4.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom",
  				"feature",
  				"feature-state"
  			]
  		},
  		"property-type": "data-driven"
  	},
  	"circle-opacity": {
  		type: "number",
  		doc: "The opacity at which the circle will be drawn.",
  		"default": 1,
  		minimum: 0,
  		maximum: 1,
  		transition: true,
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			},
  			"data-driven styling": {
  				js: "0.20.0",
  				android: "5.0.0",
  				ios: "3.5.0",
  				macos: "0.4.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom",
  				"feature",
  				"feature-state"
  			]
  		},
  		"property-type": "data-driven"
  	},
  	"circle-translate": {
  		type: "array",
  		value: "number",
  		length: 2,
  		"default": [
  			0,
  			0
  		],
  		transition: true,
  		units: "pixels",
  		doc: "The geometry's offset. Values are [x, y] where negatives indicate left and up, respectively.",
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"circle-translate-anchor": {
  		type: "enum",
  		values: {
  			map: {
  				doc: "The circle is translated relative to the map."
  			},
  			viewport: {
  				doc: "The circle is translated relative to the viewport."
  			}
  		},
  		doc: "Controls the frame of reference for `circle-translate`.",
  		"default": "map",
  		requires: [
  			"circle-translate"
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			}
  		},
  		expression: {
  			interpolated: false,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"circle-pitch-scale": {
  		type: "enum",
  		values: {
  			map: {
  				doc: "Circles are scaled according to their apparent distance to the camera."
  			},
  			viewport: {
  				doc: "Circles are not scaled."
  			}
  		},
  		"default": "map",
  		doc: "Controls the scaling behavior of the circle when the map is pitched.",
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.21.0",
  				android: "4.2.0",
  				ios: "3.4.0",
  				macos: "0.2.1"
  			}
  		},
  		expression: {
  			interpolated: false,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"circle-pitch-alignment": {
  		type: "enum",
  		values: {
  			map: {
  				doc: "The circle is aligned to the plane of the map."
  			},
  			viewport: {
  				doc: "The circle is aligned to the plane of the viewport."
  			}
  		},
  		"default": "viewport",
  		doc: "Orientation of circle when map is pitched.",
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.39.0",
  				android: "5.2.0",
  				ios: "3.7.0",
  				macos: "0.6.0"
  			}
  		},
  		expression: {
  			interpolated: false,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"circle-stroke-width": {
  		type: "number",
  		"default": 0,
  		minimum: 0,
  		transition: true,
  		units: "pixels",
  		doc: "The width of the circle's stroke. Strokes are placed outside of the `circle-radius`.",
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.29.0",
  				android: "5.0.0",
  				ios: "3.5.0",
  				macos: "0.4.0"
  			},
  			"data-driven styling": {
  				js: "0.29.0",
  				android: "5.0.0",
  				ios: "3.5.0",
  				macos: "0.4.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom",
  				"feature",
  				"feature-state"
  			]
  		},
  		"property-type": "data-driven"
  	},
  	"circle-stroke-color": {
  		type: "color",
  		"default": "#000000",
  		doc: "The stroke color of the circle.",
  		transition: true,
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.29.0",
  				android: "5.0.0",
  				ios: "3.5.0",
  				macos: "0.4.0"
  			},
  			"data-driven styling": {
  				js: "0.29.0",
  				android: "5.0.0",
  				ios: "3.5.0",
  				macos: "0.4.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom",
  				"feature",
  				"feature-state"
  			]
  		},
  		"property-type": "data-driven"
  	},
  	"circle-stroke-opacity": {
  		type: "number",
  		doc: "The opacity of the circle's stroke.",
  		"default": 1,
  		minimum: 0,
  		maximum: 1,
  		transition: true,
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.29.0",
  				android: "5.0.0",
  				ios: "3.5.0",
  				macos: "0.4.0"
  			},
  			"data-driven styling": {
  				js: "0.29.0",
  				android: "5.0.0",
  				ios: "3.5.0",
  				macos: "0.4.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom",
  				"feature",
  				"feature-state"
  			]
  		},
  		"property-type": "data-driven"
  	}
  };
  var paint_heatmap = {
  	"heatmap-radius": {
  		type: "number",
  		"default": 30,
  		minimum: 1,
  		transition: true,
  		units: "pixels",
  		doc: "Radius of influence of one heatmap point in pixels. Increasing the value makes the heatmap smoother, but less detailed.",
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.41.0",
  				android: "6.0.0",
  				ios: "4.0.0",
  				macos: "0.7.0"
  			},
  			"data-driven styling": {
  				js: "0.43.0",
  				android: "6.0.0",
  				ios: "4.0.0",
  				macos: "0.7.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom",
  				"feature",
  				"feature-state"
  			]
  		},
  		"property-type": "data-driven"
  	},
  	"heatmap-weight": {
  		type: "number",
  		"default": 1,
  		minimum: 0,
  		transition: false,
  		doc: "A measure of how much an individual point contributes to the heatmap. A value of 10 would be equivalent to having 10 points of weight 1 in the same spot. Especially useful when combined with clustering.",
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.41.0",
  				android: "6.0.0",
  				ios: "4.0.0",
  				macos: "0.7.0"
  			},
  			"data-driven styling": {
  				js: "0.41.0",
  				android: "6.0.0",
  				ios: "4.0.0",
  				macos: "0.7.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom",
  				"feature",
  				"feature-state"
  			]
  		},
  		"property-type": "data-driven"
  	},
  	"heatmap-intensity": {
  		type: "number",
  		"default": 1,
  		minimum: 0,
  		transition: true,
  		doc: "Similar to `heatmap-weight` but controls the intensity of the heatmap globally. Primarily used for adjusting the heatmap based on zoom level.",
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.41.0",
  				android: "6.0.0",
  				ios: "4.0.0",
  				macos: "0.7.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"heatmap-color": {
  		type: "color",
  		"default": [
  			"interpolate",
  			[
  				"linear"
  			],
  			[
  				"heatmap-density"
  			],
  			0,
  			"rgba(0, 0, 255, 0)",
  			0.1,
  			"royalblue",
  			0.3,
  			"cyan",
  			0.5,
  			"lime",
  			0.7,
  			"yellow",
  			1,
  			"red"
  		],
  		doc: "Defines the color of each pixel based on its density value in a heatmap.  Should be an expression that uses `[\"heatmap-density\"]` as input.",
  		transition: false,
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.41.0",
  				android: "6.0.0",
  				ios: "4.0.0",
  				macos: "0.7.0"
  			},
  			"data-driven styling": {
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"heatmap-density"
  			]
  		},
  		"property-type": "color-ramp"
  	},
  	"heatmap-opacity": {
  		type: "number",
  		doc: "The global opacity at which the heatmap layer will be drawn.",
  		"default": 1,
  		minimum: 0,
  		maximum: 1,
  		transition: true,
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.41.0",
  				android: "6.0.0",
  				ios: "4.0.0",
  				macos: "0.7.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	}
  };
  var paint_symbol = {
  	"icon-opacity": {
  		doc: "The opacity at which the icon will be drawn.",
  		type: "number",
  		"default": 1,
  		minimum: 0,
  		maximum: 1,
  		transition: true,
  		requires: [
  			"icon-image"
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			},
  			"data-driven styling": {
  				js: "0.33.0",
  				android: "5.0.0",
  				ios: "3.5.0",
  				macos: "0.4.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom",
  				"feature",
  				"feature-state"
  			]
  		},
  		"property-type": "data-driven"
  	},
  	"icon-color": {
  		type: "color",
  		"default": "#000000",
  		transition: true,
  		doc: "The color of the icon. This can only be used with sdf icons.",
  		requires: [
  			"icon-image"
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			},
  			"data-driven styling": {
  				js: "0.33.0",
  				android: "5.0.0",
  				ios: "3.5.0",
  				macos: "0.4.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom",
  				"feature",
  				"feature-state"
  			]
  		},
  		"property-type": "data-driven"
  	},
  	"icon-halo-color": {
  		type: "color",
  		"default": "rgba(0, 0, 0, 0)",
  		transition: true,
  		doc: "The color of the icon's halo. Icon halos can only be used with SDF icons.",
  		requires: [
  			"icon-image"
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			},
  			"data-driven styling": {
  				js: "0.33.0",
  				android: "5.0.0",
  				ios: "3.5.0",
  				macos: "0.4.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom",
  				"feature",
  				"feature-state"
  			]
  		},
  		"property-type": "data-driven"
  	},
  	"icon-halo-width": {
  		type: "number",
  		"default": 0,
  		minimum: 0,
  		transition: true,
  		units: "pixels",
  		doc: "Distance of halo to the icon outline.",
  		requires: [
  			"icon-image"
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			},
  			"data-driven styling": {
  				js: "0.33.0",
  				android: "5.0.0",
  				ios: "3.5.0",
  				macos: "0.4.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom",
  				"feature",
  				"feature-state"
  			]
  		},
  		"property-type": "data-driven"
  	},
  	"icon-halo-blur": {
  		type: "number",
  		"default": 0,
  		minimum: 0,
  		transition: true,
  		units: "pixels",
  		doc: "Fade out the halo towards the outside.",
  		requires: [
  			"icon-image"
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			},
  			"data-driven styling": {
  				js: "0.33.0",
  				android: "5.0.0",
  				ios: "3.5.0",
  				macos: "0.4.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom",
  				"feature",
  				"feature-state"
  			]
  		},
  		"property-type": "data-driven"
  	},
  	"icon-translate": {
  		type: "array",
  		value: "number",
  		length: 2,
  		"default": [
  			0,
  			0
  		],
  		transition: true,
  		units: "pixels",
  		doc: "Distance that the icon's anchor is moved from its original placement. Positive values indicate right and down, while negative values indicate left and up.",
  		requires: [
  			"icon-image"
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"icon-translate-anchor": {
  		type: "enum",
  		values: {
  			map: {
  				doc: "Icons are translated relative to the map."
  			},
  			viewport: {
  				doc: "Icons are translated relative to the viewport."
  			}
  		},
  		doc: "Controls the frame of reference for `icon-translate`.",
  		"default": "map",
  		requires: [
  			"icon-image",
  			"icon-translate"
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			}
  		},
  		expression: {
  			interpolated: false,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"text-opacity": {
  		type: "number",
  		doc: "The opacity at which the text will be drawn.",
  		"default": 1,
  		minimum: 0,
  		maximum: 1,
  		transition: true,
  		requires: [
  			"text-field"
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			},
  			"data-driven styling": {
  				js: "0.33.0",
  				android: "5.0.0",
  				ios: "3.5.0",
  				macos: "0.4.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom",
  				"feature",
  				"feature-state"
  			]
  		},
  		"property-type": "data-driven"
  	},
  	"text-color": {
  		type: "color",
  		doc: "The color with which the text will be drawn.",
  		"default": "#000000",
  		transition: true,
  		overridable: true,
  		requires: [
  			"text-field"
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			},
  			"data-driven styling": {
  				js: "0.33.0",
  				android: "5.0.0",
  				ios: "3.5.0",
  				macos: "0.4.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom",
  				"feature",
  				"feature-state"
  			]
  		},
  		"property-type": "data-driven"
  	},
  	"text-halo-color": {
  		type: "color",
  		"default": "rgba(0, 0, 0, 0)",
  		transition: true,
  		doc: "The color of the text's halo, which helps it stand out from backgrounds.",
  		requires: [
  			"text-field"
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			},
  			"data-driven styling": {
  				js: "0.33.0",
  				android: "5.0.0",
  				ios: "3.5.0",
  				macos: "0.4.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom",
  				"feature",
  				"feature-state"
  			]
  		},
  		"property-type": "data-driven"
  	},
  	"text-halo-width": {
  		type: "number",
  		"default": 0,
  		minimum: 0,
  		transition: true,
  		units: "pixels",
  		doc: "Distance of halo to the font outline. Max text halo width is 1/4 of the font-size.",
  		requires: [
  			"text-field"
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			},
  			"data-driven styling": {
  				js: "0.33.0",
  				android: "5.0.0",
  				ios: "3.5.0",
  				macos: "0.4.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom",
  				"feature",
  				"feature-state"
  			]
  		},
  		"property-type": "data-driven"
  	},
  	"text-halo-blur": {
  		type: "number",
  		"default": 0,
  		minimum: 0,
  		transition: true,
  		units: "pixels",
  		doc: "The halo's fadeout distance towards the outside.",
  		requires: [
  			"text-field"
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			},
  			"data-driven styling": {
  				js: "0.33.0",
  				android: "5.0.0",
  				ios: "3.5.0",
  				macos: "0.4.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom",
  				"feature",
  				"feature-state"
  			]
  		},
  		"property-type": "data-driven"
  	},
  	"text-translate": {
  		type: "array",
  		value: "number",
  		length: 2,
  		"default": [
  			0,
  			0
  		],
  		transition: true,
  		units: "pixels",
  		doc: "Distance that the text's anchor is moved from its original placement. Positive values indicate right and down, while negative values indicate left and up.",
  		requires: [
  			"text-field"
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"text-translate-anchor": {
  		type: "enum",
  		values: {
  			map: {
  				doc: "The text is translated relative to the map."
  			},
  			viewport: {
  				doc: "The text is translated relative to the viewport."
  			}
  		},
  		doc: "Controls the frame of reference for `text-translate`.",
  		"default": "map",
  		requires: [
  			"text-field",
  			"text-translate"
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			}
  		},
  		expression: {
  			interpolated: false,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	}
  };
  var paint_raster = {
  	"raster-opacity": {
  		type: "number",
  		doc: "The opacity at which the image will be drawn.",
  		"default": 1,
  		minimum: 0,
  		maximum: 1,
  		transition: true,
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"raster-hue-rotate": {
  		type: "number",
  		"default": 0,
  		period: 360,
  		transition: true,
  		units: "degrees",
  		doc: "Rotates hues around the color wheel.",
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"raster-brightness-min": {
  		type: "number",
  		doc: "Increase or reduce the brightness of the image. The value is the minimum brightness.",
  		"default": 0,
  		minimum: 0,
  		maximum: 1,
  		transition: true,
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"raster-brightness-max": {
  		type: "number",
  		doc: "Increase or reduce the brightness of the image. The value is the maximum brightness.",
  		"default": 1,
  		minimum: 0,
  		maximum: 1,
  		transition: true,
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"raster-saturation": {
  		type: "number",
  		doc: "Increase or reduce the saturation of the image.",
  		"default": 0,
  		minimum: -1,
  		maximum: 1,
  		transition: true,
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"raster-contrast": {
  		type: "number",
  		doc: "Increase or reduce the contrast of the image.",
  		"default": 0,
  		minimum: -1,
  		maximum: 1,
  		transition: true,
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"raster-resampling": {
  		type: "enum",
  		doc: "The resampling/interpolation method to use for overscaling, also known as texture magnification filter",
  		values: {
  			linear: {
  				doc: "(Bi)linear filtering interpolates pixel values using the weighted average of the four closest original source pixels creating a smooth but blurry look when overscaled"
  			},
  			nearest: {
  				doc: "Nearest neighbor filtering interpolates pixel values using the nearest original source pixel creating a sharp but pixelated look when overscaled"
  			}
  		},
  		"default": "linear",
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.47.0",
  				android: "6.3.0",
  				ios: "4.2.0",
  				macos: "0.9.0"
  			}
  		},
  		expression: {
  			interpolated: false,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"raster-fade-duration": {
  		type: "number",
  		"default": 300,
  		minimum: 0,
  		transition: false,
  		units: "milliseconds",
  		doc: "Fade duration when a new tile is added.",
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	}
  };
  var paint_hillshade = {
  	"hillshade-illumination-direction": {
  		type: "number",
  		"default": 335,
  		minimum: 0,
  		maximum: 359,
  		doc: "The direction of the light source used to generate the hillshading with 0 as the top of the viewport if `hillshade-illumination-anchor` is set to `viewport` and due north if `hillshade-illumination-anchor` is set to `map`.",
  		transition: false,
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.43.0",
  				android: "6.0.0",
  				ios: "4.0.0",
  				macos: "0.7.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"hillshade-illumination-anchor": {
  		type: "enum",
  		values: {
  			map: {
  				doc: "The hillshade illumination is relative to the north direction."
  			},
  			viewport: {
  				doc: "The hillshade illumination is relative to the top of the viewport."
  			}
  		},
  		"default": "viewport",
  		doc: "Direction of light source when map is rotated.",
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.43.0",
  				android: "6.0.0",
  				ios: "4.0.0",
  				macos: "0.7.0"
  			}
  		},
  		expression: {
  			interpolated: false,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"hillshade-exaggeration": {
  		type: "number",
  		doc: "Intensity of the hillshade",
  		"default": 0.5,
  		minimum: 0,
  		maximum: 1,
  		transition: true,
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.43.0",
  				android: "6.0.0",
  				ios: "4.0.0",
  				macos: "0.7.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"hillshade-shadow-color": {
  		type: "color",
  		"default": "#000000",
  		doc: "The shading color of areas that face away from the light source.",
  		transition: true,
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.43.0",
  				android: "6.0.0",
  				ios: "4.0.0",
  				macos: "0.7.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"hillshade-highlight-color": {
  		type: "color",
  		"default": "#FFFFFF",
  		doc: "The shading color of areas that faces towards the light source.",
  		transition: true,
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.43.0",
  				android: "6.0.0",
  				ios: "4.0.0",
  				macos: "0.7.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"hillshade-accent-color": {
  		type: "color",
  		"default": "#000000",
  		doc: "The shading color used to accentuate rugged terrain like sharp cliffs and gorges.",
  		transition: true,
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.43.0",
  				android: "6.0.0",
  				ios: "4.0.0",
  				macos: "0.7.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	}
  };
  var paint_background = {
  	"background-color": {
  		type: "color",
  		"default": "#000000",
  		doc: "The color with which the background will be drawn.",
  		transition: true,
  		requires: [
  			{
  				"!": "background-pattern"
  			}
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"background-pattern": {
  		type: "resolvedImage",
  		transition: true,
  		doc: "Name of image in sprite to use for drawing an image background. For seamless patterns, image width and height must be a factor of two (2, 4, 8, ..., 512). Note that zoom-dependent expressions will be evaluated only at integer zoom levels.",
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			},
  			"data-driven styling": {
  			}
  		},
  		expression: {
  			interpolated: false,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "cross-faded"
  	},
  	"background-opacity": {
  		type: "number",
  		"default": 1,
  		minimum: 0,
  		maximum: 1,
  		doc: "The opacity at which the background will be drawn.",
  		transition: true,
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.10.0",
  				android: "2.0.1",
  				ios: "2.0.0",
  				macos: "0.1.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	}
  };
  var paint_sky = {
  	"sky-type": {
  		type: "enum",
  		values: {
  			gradient: {
  				doc: "Renders the sky with a gradient that can be configured with `sky-gradient-radius` and `sky-gradient`."
  			},
  			atmosphere: {
  				doc: "Renders the sky with a simulated atmospheric scattering algorithm, the sun direction can be attached to the light position or explicitly set through `sky-atmosphere-sun`."
  			}
  		},
  		"default": "atmosphere",
  		doc: "The type of the sky",
  		"sdk-support": {
  			"basic functionality": {
  				js: "2.0.0"
  			}
  		},
  		expression: {
  			interpolated: false,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"sky-atmosphere-sun": {
  		type: "array",
  		value: "number",
  		length: 2,
  		units: "degrees",
  		minimum: [
  			0,
  			0
  		],
  		maximum: [
  			360,
  			180
  		],
  		transition: false,
  		doc: "Position of the sun center [a azimuthal angle, p polar angle]. The azimuthal angle indicates the position of the sun relative to 0° north, where degrees proceed clockwise. The polar angle indicates the height of the sun, where 0° is directly above, at zenith, and 90° at the horizon. When this property is ommitted, the sun center is directly inherited from the light position.",
  		"sdk-support": {
  			"basic functionality": {
  				js: "2.0.0"
  			}
  		},
  		requires: [
  			{
  				"sky-type": "atmosphere"
  			}
  		],
  		expression: {
  			interpolated: false,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"sky-atmosphere-sun-intensity": {
  		type: "number",
  		requires: [
  			{
  				"sky-type": "atmosphere"
  			}
  		],
  		"default": 10,
  		minimum: 0,
  		maximum: 100,
  		transition: false,
  		doc: "Intensity of the sun as a light source in the atmosphere (on a scale from 0 to a 100). Setting higher values will brighten up the sky.",
  		"sdk-support": {
  			"basic functionality": {
  				js: "2.0.0"
  			}
  		},
  		"property-type": "data-constant"
  	},
  	"sky-gradient-center": {
  		type: "array",
  		requires: [
  			{
  				"sky-type": "gradient"
  			}
  		],
  		value: "number",
  		"default": [
  			0,
  			0
  		],
  		length: 2,
  		units: "degrees",
  		minimum: [
  			0,
  			0
  		],
  		maximum: [
  			360,
  			180
  		],
  		transition: false,
  		doc: "Position of the gradient center [a azimuthal angle, p polar angle]. The azimuthal angle indicates the position of the gradient center relative to 0° north, where degrees proceed clockwise. The polar angle indicates the height of the gradient center, where 0° is directly above, at zenith, and 90° at the horizon.",
  		"sdk-support": {
  			"basic functionality": {
  				js: "2.0.0"
  			}
  		},
  		expression: {
  			interpolated: false,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"sky-gradient-radius": {
  		type: "number",
  		requires: [
  			{
  				"sky-type": "gradient"
  			}
  		],
  		"default": 90,
  		minimum: 0,
  		maximum: 180,
  		transition: false,
  		doc: "The angular distance (measured in degrees) from `sky-gradient-center` up to which the gradient extends. A value of 180 causes the gradient to wrap around to the opposite direction from `sky-gradient-center`.",
  		"sdk-support": {
  			"basic functionality": {
  				js: "2.0.0"
  			}
  		},
  		expression: {
  			interpolated: false,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"sky-gradient": {
  		type: "color",
  		"default": [
  			"interpolate",
  			[
  				"linear"
  			],
  			[
  				"sky-radial-progress"
  			],
  			0.8,
  			"#87ceeb",
  			1,
  			"white"
  		],
  		doc: "Defines a radial color gradient with which to color the sky. The color values can be interpolated with an expression using `sky-radial-progress`. The range [0, 1] for the interpolant covers a radial distance (in degrees) of [0, `sky-gradient-radius`] centered at the position specified by `sky-gradient-center`.",
  		transition: false,
  		requires: [
  			{
  				"sky-type": "gradient"
  			}
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "2.0.0"
  			},
  			"data-driven styling": {
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"sky-radial-progress"
  			]
  		},
  		"property-type": "color-ramp"
  	},
  	"sky-atmosphere-halo-color": {
  		type: "color",
  		"default": "white",
  		doc: "A color applied to the atmosphere sun halo. The alpha channel describes how strongly the sun halo is represented in an atmosphere sky layer.",
  		transition: false,
  		requires: [
  			{
  				"sky-type": "atmosphere"
  			}
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "2.0.0"
  			}
  		},
  		"property-type": "data-constant"
  	},
  	"sky-atmosphere-color": {
  		type: "color",
  		"default": "white",
  		doc: "A color used to tweak the main atmospheric scattering coefficients. Using white applies the default coefficients giving the natural blue color to the atmosphere. This color affects how heavily the corresponding wavelength is represented during scattering. The alpha channel describes the density of the atmosphere, with 1 maximum density and 0 no density.",
  		transition: false,
  		requires: [
  			{
  				"sky-type": "atmosphere"
  			}
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "2.0.0"
  			}
  		},
  		"property-type": "data-constant"
  	},
  	"sky-opacity": {
  		type: "number",
  		"default": 1,
  		minimum: 0,
  		maximum: 1,
  		doc: "The opacity of the entire sky layer.",
  		transition: true,
  		"sdk-support": {
  			"basic functionality": {
  				js: "2.0.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	}
  };
  var transition = {
  	duration: {
  		type: "number",
  		"default": 300,
  		minimum: 0,
  		units: "milliseconds",
  		doc: "Time allotted for transitions to complete."
  	},
  	delay: {
  		type: "number",
  		"default": 0,
  		minimum: 0,
  		units: "milliseconds",
  		doc: "Length of time before a transition begins."
  	}
  };
  var promoteId = {
  	"*": {
  		type: "string",
  		doc: "A name of a feature property to use as ID for feature state."
  	}
  };
  var v8 = {
  	$version: $version,
  	$root: $root,
  	sources: sources,
  	source: source,
  	source_vector: source_vector,
  	source_raster: source_raster,
  	source_raster_dem: source_raster_dem,
  	source_geojson: source_geojson,
  	source_video: source_video,
  	source_image: source_image,
  	layer: layer,
  	layout: layout,
  	layout_background: layout_background,
  	layout_sky: layout_sky,
  	layout_fill: layout_fill,
  	layout_circle: layout_circle,
  	layout_heatmap: layout_heatmap,
  	"layout_fill-extrusion": {
  	visibility: {
  		type: "enum",
  		values: {
  			visible: {
  				doc: "The layer is shown."
  			},
  			none: {
  				doc: "The layer is not shown."
  			}
  		},
  		"default": "visible",
  		doc: "Whether this layer is displayed.",
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.27.0",
  				android: "5.1.0",
  				ios: "3.6.0",
  				macos: "0.5.0"
  			}
  		},
  		"property-type": "constant"
  	}
  },
  	layout_line: layout_line,
  	layout_symbol: layout_symbol,
  	layout_raster: layout_raster,
  	layout_hillshade: layout_hillshade,
  	filter: filter,
  	filter_operator: filter_operator,
  	geometry_type: geometry_type,
  	"function": {
  	expression: {
  		type: "expression",
  		doc: "An expression."
  	},
  	stops: {
  		type: "array",
  		doc: "An array of stops.",
  		value: "function_stop"
  	},
  	base: {
  		type: "number",
  		"default": 1,
  		minimum: 0,
  		doc: "The exponential base of the interpolation curve. It controls the rate at which the result increases. Higher values make the result increase more towards the high end of the range. With `1` the stops are interpolated linearly."
  	},
  	property: {
  		type: "string",
  		doc: "The name of a feature property to use as the function input.",
  		"default": "$zoom"
  	},
  	type: {
  		type: "enum",
  		values: {
  			identity: {
  				doc: "Return the input value as the output value."
  			},
  			exponential: {
  				doc: "Generate an output by interpolating between stops just less than and just greater than the function input."
  			},
  			interval: {
  				doc: "Return the output value of the stop just less than the function input."
  			},
  			categorical: {
  				doc: "Return the output value of the stop equal to the function input."
  			}
  		},
  		doc: "The interpolation strategy to use in function evaluation.",
  		"default": "exponential"
  	},
  	colorSpace: {
  		type: "enum",
  		values: {
  			rgb: {
  				doc: "Use the RGB color space to interpolate color values"
  			},
  			lab: {
  				doc: "Use the LAB color space to interpolate color values."
  			},
  			hcl: {
  				doc: "Use the HCL color space to interpolate color values, interpolating the Hue, Chroma, and Luminance channels individually."
  			}
  		},
  		doc: "The color space in which colors interpolated. Interpolating colors in perceptual color spaces like LAB and HCL tend to produce color ramps that look more consistent and produce colors that can be differentiated more easily than those interpolated in RGB space.",
  		"default": "rgb"
  	},
  	"default": {
  		type: "*",
  		required: false,
  		doc: "A value to serve as a fallback function result when a value isn't otherwise available. It is used in the following circumstances:\n* In categorical functions, when the feature value does not match any of the stop domain values.\n* In property and zoom-and-property functions, when a feature does not contain a value for the specified property.\n* In identity functions, when the feature value is not valid for the style property (for example, if the function is being used for a `circle-color` property but the feature property value is not a string or not a valid color).\n* In interval or exponential property and zoom-and-property functions, when the feature value is not numeric.\nIf no default is provided, the style property's default is used in these circumstances."
  	}
  },
  	function_stop: function_stop,
  	expression: expression,
  	expression_name: expression_name,
  	fog: fog,
  	light: light,
  	terrain: terrain,
  	paint: paint,
  	paint_fill: paint_fill,
  	"paint_fill-extrusion": {
  	"fill-extrusion-opacity": {
  		type: "number",
  		"default": 1,
  		minimum: 0,
  		maximum: 1,
  		doc: "The opacity of the entire fill extrusion layer. This is rendered on a per-layer, not per-feature, basis, and data-driven styling is not available.",
  		transition: true,
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.27.0",
  				android: "5.1.0",
  				ios: "3.6.0",
  				macos: "0.5.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"fill-extrusion-color": {
  		type: "color",
  		"default": "#000000",
  		doc: "The base color of the extruded fill. The extrusion's surfaces will be shaded differently based on this color in combination with the root `light` settings. If this color is specified as `rgba` with an alpha component, the alpha component will be ignored; use `fill-extrusion-opacity` to set layer opacity.",
  		transition: true,
  		requires: [
  			{
  				"!": "fill-extrusion-pattern"
  			}
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.27.0",
  				android: "5.1.0",
  				ios: "3.6.0",
  				macos: "0.5.0"
  			},
  			"data-driven styling": {
  				js: "0.27.0",
  				android: "5.1.0",
  				ios: "3.6.0",
  				macos: "0.5.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom",
  				"feature",
  				"feature-state"
  			]
  		},
  		"property-type": "data-driven"
  	},
  	"fill-extrusion-translate": {
  		type: "array",
  		value: "number",
  		length: 2,
  		"default": [
  			0,
  			0
  		],
  		transition: true,
  		units: "pixels",
  		doc: "The geometry's offset. Values are [x, y] where negatives indicate left and up (on the flat plane), respectively.",
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.27.0",
  				android: "5.1.0",
  				ios: "3.6.0",
  				macos: "0.5.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"fill-extrusion-translate-anchor": {
  		type: "enum",
  		values: {
  			map: {
  				doc: "The fill extrusion is translated relative to the map."
  			},
  			viewport: {
  				doc: "The fill extrusion is translated relative to the viewport."
  			}
  		},
  		doc: "Controls the frame of reference for `fill-extrusion-translate`.",
  		"default": "map",
  		requires: [
  			"fill-extrusion-translate"
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.27.0",
  				android: "5.1.0",
  				ios: "3.6.0",
  				macos: "0.5.0"
  			}
  		},
  		expression: {
  			interpolated: false,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	},
  	"fill-extrusion-pattern": {
  		type: "resolvedImage",
  		transition: true,
  		doc: "Name of image in sprite to use for drawing images on extruded fills. For seamless patterns, image width and height must be a factor of two (2, 4, 8, ..., 512). Note that zoom-dependent expressions will be evaluated only at integer zoom levels.",
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.27.0",
  				android: "5.1.0",
  				ios: "3.6.0",
  				macos: "0.5.0"
  			},
  			"data-driven styling": {
  				js: "0.49.0",
  				android: "6.5.0",
  				macos: "0.11.0",
  				ios: "4.4.0"
  			}
  		},
  		expression: {
  			interpolated: false,
  			parameters: [
  				"zoom",
  				"feature"
  			]
  		},
  		"property-type": "cross-faded-data-driven"
  	},
  	"fill-extrusion-height": {
  		type: "number",
  		"default": 0,
  		minimum: 0,
  		units: "meters",
  		doc: "The height with which to extrude this layer.",
  		transition: true,
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.27.0",
  				android: "5.1.0",
  				ios: "3.6.0",
  				macos: "0.5.0"
  			},
  			"data-driven styling": {
  				js: "0.27.0",
  				android: "5.1.0",
  				ios: "3.6.0",
  				macos: "0.5.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom",
  				"feature",
  				"feature-state"
  			]
  		},
  		"property-type": "data-driven"
  	},
  	"fill-extrusion-base": {
  		type: "number",
  		"default": 0,
  		minimum: 0,
  		units: "meters",
  		doc: "The height with which to extrude the base of this layer. Must be less than or equal to `fill-extrusion-height`.",
  		transition: true,
  		requires: [
  			"fill-extrusion-height"
  		],
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.27.0",
  				android: "5.1.0",
  				ios: "3.6.0",
  				macos: "0.5.0"
  			},
  			"data-driven styling": {
  				js: "0.27.0",
  				android: "5.1.0",
  				ios: "3.6.0",
  				macos: "0.5.0"
  			}
  		},
  		expression: {
  			interpolated: true,
  			parameters: [
  				"zoom",
  				"feature",
  				"feature-state"
  			]
  		},
  		"property-type": "data-driven"
  	},
  	"fill-extrusion-vertical-gradient": {
  		type: "boolean",
  		"default": true,
  		doc: "Whether to apply a vertical gradient to the sides of a fill-extrusion layer. If true, sides will be shaded slightly darker farther down.",
  		transition: false,
  		"sdk-support": {
  			"basic functionality": {
  				js: "0.50.0",
  				ios: "4.7.0",
  				macos: "0.13.0"
  			}
  		},
  		expression: {
  			interpolated: false,
  			parameters: [
  				"zoom"
  			]
  		},
  		"property-type": "data-constant"
  	}
  },
  	paint_line: paint_line,
  	paint_circle: paint_circle,
  	paint_heatmap: paint_heatmap,
  	paint_symbol: paint_symbol,
  	paint_raster: paint_raster,
  	paint_hillshade: paint_hillshade,
  	paint_background: paint_background,
  	paint_sky: paint_sky,
  	transition: transition,
  	"property-type": {
  	"data-driven": {
  		type: "property-type",
  		doc: "Property is interpolable and can be represented using a property expression."
  	},
  	"cross-faded": {
  		type: "property-type",
  		doc: "Property is non-interpolable; rather, its values will be cross-faded to smoothly transition between integer zooms."
  	},
  	"cross-faded-data-driven": {
  		type: "property-type",
  		doc: "Property is non-interpolable; rather, its values will be cross-faded to smoothly transition between integer zooms. It can be represented using a property expression."
  	},
  	"color-ramp": {
  		type: "property-type",
  		doc: "Property should be specified using a color ramp from which the output color can be sampled based on a property calculation."
  	},
  	"data-constant": {
  		type: "property-type",
  		doc: "Property is interpolable but cannot be represented using a property expression."
  	},
  	constant: {
  		type: "property-type",
  		doc: "Property is constant across all zoom levels and property values."
  	}
  },
  	promoteId: promoteId
  };

  // Note: This regex matches even invalid JSON strings, but since we’re
  // working on the output of `JSON.stringify` we know that only valid strings
  // are present (unless the user supplied a weird `options.indent` but in
  // that case we don’t care since the output would be invalid anyway).
  var stringOrChar = /("(?:[^\\"]|\\.)*")|[:,]/g;

  var jsonStringifyPrettyCompact = function stringify(passedObj, options) {
    var indent, maxLength, replacer;

    options = options || {};
    indent = JSON.stringify(
      [1],
      undefined,
      options.indent === undefined ? 2 : options.indent
    ).slice(2, -3);
    maxLength =
      indent === ""
        ? Infinity
        : options.maxLength === undefined
        ? 80
        : options.maxLength;
    replacer = options.replacer;

    return (function _stringify(obj, currentIndent, reserved) {
      // prettier-ignore
      var end, index, items, key, keyPart, keys, length, nextIndent, prettified, start, string, value;

      if (obj && typeof obj.toJSON === "function") {
        obj = obj.toJSON();
      }

      string = JSON.stringify(obj, replacer);

      if (string === undefined) {
        return string;
      }

      length = maxLength - currentIndent.length - reserved;

      if (string.length <= length) {
        prettified = string.replace(stringOrChar, function(match, stringLiteral) {
          return stringLiteral || match + " ";
        });
        if (prettified.length <= length) {
          return prettified;
        }
      }

      if (replacer != null) {
        obj = JSON.parse(string);
        replacer = undefined;
      }

      if (typeof obj === "object" && obj !== null) {
        nextIndent = currentIndent + indent;
        items = [];
        index = 0;

        if (Array.isArray(obj)) {
          start = "[";
          end = "]";
          length = obj.length;
          for (; index < length; index++) {
            items.push(
              _stringify(obj[index], nextIndent, index === length - 1 ? 0 : 1) ||
                "null"
            );
          }
        } else {
          start = "{";
          end = "}";
          keys = Object.keys(obj);
          length = keys.length;
          for (; index < length; index++) {
            key = keys[index];
            keyPart = JSON.stringify(key) + ": ";
            value = _stringify(
              obj[key],
              nextIndent,
              keyPart.length + (index === length - 1 ? 0 : 1)
            );
            if (value !== undefined) {
              items.push(keyPart + value);
            }
          }
        }

        if (items.length > 0) {
          return [start, indent + items.join(",\n" + nextIndent), end].join(
            "\n" + currentIndent
          );
        }
      }

      return string;
    })(passedObj, "", 0);
  };

  function sortKeysBy(obj, reference) {
      const result = {};
      for (const key in reference) {
          if (obj[key] !== undefined) {
              result[key] = obj[key];
          }
      }
      for (const key in obj) {
          if (result[key] === undefined) {
              result[key] = obj[key];
          }
      }
      return result;
  }
  function format(style, space = 2) {
      style = sortKeysBy(style, v8.$root);
      if (style.layers) {
          style.layers = style.layers.map(layer => sortKeysBy(layer, v8.layer));
      }
      return jsonStringifyPrettyCompact(style, { indent: space });
  }

  var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

  function createCommonjsModule(fn) {
    var module = { exports: {} };
  	return fn(module, module.exports), module.exports;
  }

  function commonjsRequire (target) {
  	throw new Error('Could not dynamically require "' + target + '". Please configure the dynamicRequireTargets option of @rollup/plugin-commonjs appropriately for this require call to behave properly.');
  }

  /*! https://mths.be/punycode v1.3.2 by @mathias */

  var punycode = createCommonjsModule(function (module, exports) {
  (function(root) {

  	/** Detect free variables */
  	var freeExports = exports &&
  		!exports.nodeType && exports;
  	var freeModule = module &&
  		!module.nodeType && module;
  	var freeGlobal = typeof commonjsGlobal == 'object' && commonjsGlobal;
  	if (
  		freeGlobal.global === freeGlobal ||
  		freeGlobal.window === freeGlobal ||
  		freeGlobal.self === freeGlobal
  	) {
  		root = freeGlobal;
  	}

  	/**
  	 * The `punycode` object.
  	 * @name punycode
  	 * @type Object
  	 */
  	var punycode,

  	/** Highest positive signed 32-bit float value */
  	maxInt = 2147483647, // aka. 0x7FFFFFFF or 2^31-1

  	/** Bootstring parameters */
  	base = 36,
  	tMin = 1,
  	tMax = 26,
  	skew = 38,
  	damp = 700,
  	initialBias = 72,
  	initialN = 128, // 0x80
  	delimiter = '-', // '\x2D'

  	/** Regular expressions */
  	regexPunycode = /^xn--/,
  	regexNonASCII = /[^\x20-\x7E]/, // unprintable ASCII chars + non-ASCII chars
  	regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g, // RFC 3490 separators

  	/** Error messages */
  	errors = {
  		'overflow': 'Overflow: input needs wider integers to process',
  		'not-basic': 'Illegal input >= 0x80 (not a basic code point)',
  		'invalid-input': 'Invalid input'
  	},

  	/** Convenience shortcuts */
  	baseMinusTMin = base - tMin,
  	floor = Math.floor,
  	stringFromCharCode = String.fromCharCode,

  	/** Temporary variable */
  	key;

  	/*--------------------------------------------------------------------------*/

  	/**
  	 * A generic error utility function.
  	 * @private
  	 * @param {String} type The error type.
  	 * @returns {Error} Throws a `RangeError` with the applicable error message.
  	 */
  	function error(type) {
  		throw RangeError(errors[type]);
  	}

  	/**
  	 * A generic `Array#map` utility function.
  	 * @private
  	 * @param {Array} array The array to iterate over.
  	 * @param {Function} callback The function that gets called for every array
  	 * item.
  	 * @returns {Array} A new array of values returned by the callback function.
  	 */
  	function map(array, fn) {
  		var length = array.length;
  		var result = [];
  		while (length--) {
  			result[length] = fn(array[length]);
  		}
  		return result;
  	}

  	/**
  	 * A simple `Array#map`-like wrapper to work with domain name strings or email
  	 * addresses.
  	 * @private
  	 * @param {String} domain The domain name or email address.
  	 * @param {Function} callback The function that gets called for every
  	 * character.
  	 * @returns {Array} A new string of characters returned by the callback
  	 * function.
  	 */
  	function mapDomain(string, fn) {
  		var parts = string.split('@');
  		var result = '';
  		if (parts.length > 1) {
  			// In email addresses, only the domain name should be punycoded. Leave
  			// the local part (i.e. everything up to `@`) intact.
  			result = parts[0] + '@';
  			string = parts[1];
  		}
  		// Avoid `split(regex)` for IE8 compatibility. See #17.
  		string = string.replace(regexSeparators, '\x2E');
  		var labels = string.split('.');
  		var encoded = map(labels, fn).join('.');
  		return result + encoded;
  	}

  	/**
  	 * Creates an array containing the numeric code points of each Unicode
  	 * character in the string. While JavaScript uses UCS-2 internally,
  	 * this function will convert a pair of surrogate halves (each of which
  	 * UCS-2 exposes as separate characters) into a single code point,
  	 * matching UTF-16.
  	 * @see `punycode.ucs2.encode`
  	 * @see <https://mathiasbynens.be/notes/javascript-encoding>
  	 * @memberOf punycode.ucs2
  	 * @name decode
  	 * @param {String} string The Unicode input string (UCS-2).
  	 * @returns {Array} The new array of code points.
  	 */
  	function ucs2decode(string) {
  		var output = [],
  		    counter = 0,
  		    length = string.length,
  		    value,
  		    extra;
  		while (counter < length) {
  			value = string.charCodeAt(counter++);
  			if (value >= 0xD800 && value <= 0xDBFF && counter < length) {
  				// high surrogate, and there is a next character
  				extra = string.charCodeAt(counter++);
  				if ((extra & 0xFC00) == 0xDC00) { // low surrogate
  					output.push(((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000);
  				} else {
  					// unmatched surrogate; only append this code unit, in case the next
  					// code unit is the high surrogate of a surrogate pair
  					output.push(value);
  					counter--;
  				}
  			} else {
  				output.push(value);
  			}
  		}
  		return output;
  	}

  	/**
  	 * Creates a string based on an array of numeric code points.
  	 * @see `punycode.ucs2.decode`
  	 * @memberOf punycode.ucs2
  	 * @name encode
  	 * @param {Array} codePoints The array of numeric code points.
  	 * @returns {String} The new Unicode string (UCS-2).
  	 */
  	function ucs2encode(array) {
  		return map(array, function(value) {
  			var output = '';
  			if (value > 0xFFFF) {
  				value -= 0x10000;
  				output += stringFromCharCode(value >>> 10 & 0x3FF | 0xD800);
  				value = 0xDC00 | value & 0x3FF;
  			}
  			output += stringFromCharCode(value);
  			return output;
  		}).join('');
  	}

  	/**
  	 * Converts a basic code point into a digit/integer.
  	 * @see `digitToBasic()`
  	 * @private
  	 * @param {Number} codePoint The basic numeric code point value.
  	 * @returns {Number} The numeric value of a basic code point (for use in
  	 * representing integers) in the range `0` to `base - 1`, or `base` if
  	 * the code point does not represent a value.
  	 */
  	function basicToDigit(codePoint) {
  		if (codePoint - 48 < 10) {
  			return codePoint - 22;
  		}
  		if (codePoint - 65 < 26) {
  			return codePoint - 65;
  		}
  		if (codePoint - 97 < 26) {
  			return codePoint - 97;
  		}
  		return base;
  	}

  	/**
  	 * Converts a digit/integer into a basic code point.
  	 * @see `basicToDigit()`
  	 * @private
  	 * @param {Number} digit The numeric value of a basic code point.
  	 * @returns {Number} The basic code point whose value (when used for
  	 * representing integers) is `digit`, which needs to be in the range
  	 * `0` to `base - 1`. If `flag` is non-zero, the uppercase form is
  	 * used; else, the lowercase form is used. The behavior is undefined
  	 * if `flag` is non-zero and `digit` has no uppercase form.
  	 */
  	function digitToBasic(digit, flag) {
  		//  0..25 map to ASCII a..z or A..Z
  		// 26..35 map to ASCII 0..9
  		return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
  	}

  	/**
  	 * Bias adaptation function as per section 3.4 of RFC 3492.
  	 * http://tools.ietf.org/html/rfc3492#section-3.4
  	 * @private
  	 */
  	function adapt(delta, numPoints, firstTime) {
  		var k = 0;
  		delta = firstTime ? floor(delta / damp) : delta >> 1;
  		delta += floor(delta / numPoints);
  		for (/* no initialization */; delta > baseMinusTMin * tMax >> 1; k += base) {
  			delta = floor(delta / baseMinusTMin);
  		}
  		return floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
  	}

  	/**
  	 * Converts a Punycode string of ASCII-only symbols to a string of Unicode
  	 * symbols.
  	 * @memberOf punycode
  	 * @param {String} input The Punycode string of ASCII-only symbols.
  	 * @returns {String} The resulting string of Unicode symbols.
  	 */
  	function decode(input) {
  		// Don't use UCS-2
  		var output = [],
  		    inputLength = input.length,
  		    out,
  		    i = 0,
  		    n = initialN,
  		    bias = initialBias,
  		    basic,
  		    j,
  		    index,
  		    oldi,
  		    w,
  		    k,
  		    digit,
  		    t,
  		    /** Cached calculation results */
  		    baseMinusT;

  		// Handle the basic code points: let `basic` be the number of input code
  		// points before the last delimiter, or `0` if there is none, then copy
  		// the first basic code points to the output.

  		basic = input.lastIndexOf(delimiter);
  		if (basic < 0) {
  			basic = 0;
  		}

  		for (j = 0; j < basic; ++j) {
  			// if it's not a basic code point
  			if (input.charCodeAt(j) >= 0x80) {
  				error('not-basic');
  			}
  			output.push(input.charCodeAt(j));
  		}

  		// Main decoding loop: start just after the last delimiter if any basic code
  		// points were copied; start at the beginning otherwise.

  		for (index = basic > 0 ? basic + 1 : 0; index < inputLength; /* no final expression */) {

  			// `index` is the index of the next character to be consumed.
  			// Decode a generalized variable-length integer into `delta`,
  			// which gets added to `i`. The overflow checking is easier
  			// if we increase `i` as we go, then subtract off its starting
  			// value at the end to obtain `delta`.
  			for (oldi = i, w = 1, k = base; /* no condition */; k += base) {

  				if (index >= inputLength) {
  					error('invalid-input');
  				}

  				digit = basicToDigit(input.charCodeAt(index++));

  				if (digit >= base || digit > floor((maxInt - i) / w)) {
  					error('overflow');
  				}

  				i += digit * w;
  				t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);

  				if (digit < t) {
  					break;
  				}

  				baseMinusT = base - t;
  				if (w > floor(maxInt / baseMinusT)) {
  					error('overflow');
  				}

  				w *= baseMinusT;

  			}

  			out = output.length + 1;
  			bias = adapt(i - oldi, out, oldi == 0);

  			// `i` was supposed to wrap around from `out` to `0`,
  			// incrementing `n` each time, so we'll fix that now:
  			if (floor(i / out) > maxInt - n) {
  				error('overflow');
  			}

  			n += floor(i / out);
  			i %= out;

  			// Insert `n` at position `i` of the output
  			output.splice(i++, 0, n);

  		}

  		return ucs2encode(output);
  	}

  	/**
  	 * Converts a string of Unicode symbols (e.g. a domain name label) to a
  	 * Punycode string of ASCII-only symbols.
  	 * @memberOf punycode
  	 * @param {String} input The string of Unicode symbols.
  	 * @returns {String} The resulting Punycode string of ASCII-only symbols.
  	 */
  	function encode(input) {
  		var n,
  		    delta,
  		    handledCPCount,
  		    basicLength,
  		    bias,
  		    j,
  		    m,
  		    q,
  		    k,
  		    t,
  		    currentValue,
  		    output = [],
  		    /** `inputLength` will hold the number of code points in `input`. */
  		    inputLength,
  		    /** Cached calculation results */
  		    handledCPCountPlusOne,
  		    baseMinusT,
  		    qMinusT;

  		// Convert the input in UCS-2 to Unicode
  		input = ucs2decode(input);

  		// Cache the length
  		inputLength = input.length;

  		// Initialize the state
  		n = initialN;
  		delta = 0;
  		bias = initialBias;

  		// Handle the basic code points
  		for (j = 0; j < inputLength; ++j) {
  			currentValue = input[j];
  			if (currentValue < 0x80) {
  				output.push(stringFromCharCode(currentValue));
  			}
  		}

  		handledCPCount = basicLength = output.length;

  		// `handledCPCount` is the number of code points that have been handled;
  		// `basicLength` is the number of basic code points.

  		// Finish the basic string - if it is not empty - with a delimiter
  		if (basicLength) {
  			output.push(delimiter);
  		}

  		// Main encoding loop:
  		while (handledCPCount < inputLength) {

  			// All non-basic code points < n have been handled already. Find the next
  			// larger one:
  			for (m = maxInt, j = 0; j < inputLength; ++j) {
  				currentValue = input[j];
  				if (currentValue >= n && currentValue < m) {
  					m = currentValue;
  				}
  			}

  			// Increase `delta` enough to advance the decoder's <n,i> state to <m,0>,
  			// but guard against overflow
  			handledCPCountPlusOne = handledCPCount + 1;
  			if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
  				error('overflow');
  			}

  			delta += (m - n) * handledCPCountPlusOne;
  			n = m;

  			for (j = 0; j < inputLength; ++j) {
  				currentValue = input[j];

  				if (currentValue < n && ++delta > maxInt) {
  					error('overflow');
  				}

  				if (currentValue == n) {
  					// Represent delta as a generalized variable-length integer
  					for (q = delta, k = base; /* no condition */; k += base) {
  						t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);
  						if (q < t) {
  							break;
  						}
  						qMinusT = q - t;
  						baseMinusT = base - t;
  						output.push(
  							stringFromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0))
  						);
  						q = floor(qMinusT / baseMinusT);
  					}

  					output.push(stringFromCharCode(digitToBasic(q, 0)));
  					bias = adapt(delta, handledCPCountPlusOne, handledCPCount == basicLength);
  					delta = 0;
  					++handledCPCount;
  				}
  			}

  			++delta;
  			++n;

  		}
  		return output.join('');
  	}

  	/**
  	 * Converts a Punycode string representing a domain name or an email address
  	 * to Unicode. Only the Punycoded parts of the input will be converted, i.e.
  	 * it doesn't matter if you call it on a string that has already been
  	 * converted to Unicode.
  	 * @memberOf punycode
  	 * @param {String} input The Punycoded domain name or email address to
  	 * convert to Unicode.
  	 * @returns {String} The Unicode representation of the given Punycode
  	 * string.
  	 */
  	function toUnicode(input) {
  		return mapDomain(input, function(string) {
  			return regexPunycode.test(string)
  				? decode(string.slice(4).toLowerCase())
  				: string;
  		});
  	}

  	/**
  	 * Converts a Unicode string representing a domain name or an email address to
  	 * Punycode. Only the non-ASCII parts of the domain name will be converted,
  	 * i.e. it doesn't matter if you call it with a domain that's already in
  	 * ASCII.
  	 * @memberOf punycode
  	 * @param {String} input The domain name or email address to convert, as a
  	 * Unicode string.
  	 * @returns {String} The Punycode representation of the given domain name or
  	 * email address.
  	 */
  	function toASCII(input) {
  		return mapDomain(input, function(string) {
  			return regexNonASCII.test(string)
  				? 'xn--' + encode(string)
  				: string;
  		});
  	}

  	/*--------------------------------------------------------------------------*/

  	/** Define the public API */
  	punycode = {
  		/**
  		 * A string representing the current Punycode.js version number.
  		 * @memberOf punycode
  		 * @type String
  		 */
  		'version': '1.3.2',
  		/**
  		 * An object of methods to convert from JavaScript's internal character
  		 * representation (UCS-2) to Unicode code points, and back.
  		 * @see <https://mathiasbynens.be/notes/javascript-encoding>
  		 * @memberOf punycode
  		 * @type Object
  		 */
  		'ucs2': {
  			'decode': ucs2decode,
  			'encode': ucs2encode
  		},
  		'decode': decode,
  		'encode': encode,
  		'toASCII': toASCII,
  		'toUnicode': toUnicode
  	};

  	/** Expose `punycode` */
  	// Some AMD build optimizers, like r.js, check for specific condition patterns
  	// like the following:
  	if (freeExports && freeModule) {
  		if (module.exports == freeExports) { // in Node.js or RingoJS v0.8.0+
  			freeModule.exports = punycode;
  		} else { // in Narwhal or RingoJS v0.7.0-
  			for (key in punycode) {
  				punycode.hasOwnProperty(key) && (freeExports[key] = punycode[key]);
  			}
  		}
  	} else { // in Rhino or a web browser
  		root.punycode = punycode;
  	}

  }(commonjsGlobal));
  });

  var util = {
    isString: function(arg) {
      return typeof(arg) === 'string';
    },
    isObject: function(arg) {
      return typeof(arg) === 'object' && arg !== null;
    },
    isNull: function(arg) {
      return arg === null;
    },
    isNullOrUndefined: function(arg) {
      return arg == null;
    }
  };

  // Copyright Joyent, Inc. and other Node contributors.

  // If obj.hasOwnProperty has been overridden, then calling
  // obj.hasOwnProperty(prop) will break.
  // See: https://github.com/joyent/node/issues/1707
  function hasOwnProperty(obj, prop) {
    return Object.prototype.hasOwnProperty.call(obj, prop);
  }

  var decode = function(qs, sep, eq, options) {
    sep = sep || '&';
    eq = eq || '=';
    var obj = {};

    if (typeof qs !== 'string' || qs.length === 0) {
      return obj;
    }

    var regexp = /\+/g;
    qs = qs.split(sep);

    var maxKeys = 1000;
    if (options && typeof options.maxKeys === 'number') {
      maxKeys = options.maxKeys;
    }

    var len = qs.length;
    // maxKeys <= 0 means that we should not limit keys count
    if (maxKeys > 0 && len > maxKeys) {
      len = maxKeys;
    }

    for (var i = 0; i < len; ++i) {
      var x = qs[i].replace(regexp, '%20'),
          idx = x.indexOf(eq),
          kstr, vstr, k, v;

      if (idx >= 0) {
        kstr = x.substr(0, idx);
        vstr = x.substr(idx + 1);
      } else {
        kstr = x;
        vstr = '';
      }

      k = decodeURIComponent(kstr);
      v = decodeURIComponent(vstr);

      if (!hasOwnProperty(obj, k)) {
        obj[k] = v;
      } else if (Array.isArray(obj[k])) {
        obj[k].push(v);
      } else {
        obj[k] = [obj[k], v];
      }
    }

    return obj;
  };

  // Copyright Joyent, Inc. and other Node contributors.

  var stringifyPrimitive = function(v) {
    switch (typeof v) {
      case 'string':
        return v;

      case 'boolean':
        return v ? 'true' : 'false';

      case 'number':
        return isFinite(v) ? v : '';

      default:
        return '';
    }
  };

  var encode = function(obj, sep, eq, name) {
    sep = sep || '&';
    eq = eq || '=';
    if (obj === null) {
      obj = undefined;
    }

    if (typeof obj === 'object') {
      return Object.keys(obj).map(function(k) {
        var ks = encodeURIComponent(stringifyPrimitive(k)) + eq;
        if (Array.isArray(obj[k])) {
          return obj[k].map(function(v) {
            return ks + encodeURIComponent(stringifyPrimitive(v));
          }).join(sep);
        } else {
          return ks + encodeURIComponent(stringifyPrimitive(obj[k]));
        }
      }).join(sep);

    }

    if (!name) return '';
    return encodeURIComponent(stringifyPrimitive(name)) + eq +
           encodeURIComponent(stringifyPrimitive(obj));
  };

  var querystring = createCommonjsModule(function (module, exports) {

  exports.decode = exports.parse = decode;
  exports.encode = exports.stringify = encode;
  });

  var parse = urlParse;
  var resolve = urlResolve;
  var resolveObject = urlResolveObject;
  var format$1 = urlFormat;

  var Url_1 = Url;

  function Url() {
    this.protocol = null;
    this.slashes = null;
    this.auth = null;
    this.host = null;
    this.port = null;
    this.hostname = null;
    this.hash = null;
    this.search = null;
    this.query = null;
    this.pathname = null;
    this.path = null;
    this.href = null;
  }

  // Reference: RFC 3986, RFC 1808, RFC 2396

  // define these here so at least they only have to be
  // compiled once on the first module load.
  var protocolPattern = /^([a-z0-9.+-]+:)/i,
      portPattern = /:[0-9]*$/,

      // Special case for a simple path URL
      simplePathPattern = /^(\/\/?(?!\/)[^\?\s]*)(\?[^\s]*)?$/,

      // RFC 2396: characters reserved for delimiting URLs.
      // We actually just auto-escape these.
      delims = ['<', '>', '"', '`', ' ', '\r', '\n', '\t'],

      // RFC 2396: characters not allowed for various reasons.
      unwise = ['{', '}', '|', '\\', '^', '`'].concat(delims),

      // Allowed by RFCs, but cause of XSS attacks.  Always escape these.
      autoEscape = ['\''].concat(unwise),
      // Characters that are never ever allowed in a hostname.
      // Note that any invalid chars are also handled, but these
      // are the ones that are *expected* to be seen, so we fast-path
      // them.
      nonHostChars = ['%', '/', '?', ';', '#'].concat(autoEscape),
      hostEndingChars = ['/', '?', '#'],
      hostnameMaxLen = 255,
      hostnamePartPattern = /^[+a-z0-9A-Z_-]{0,63}$/,
      hostnamePartStart = /^([+a-z0-9A-Z_-]{0,63})(.*)$/,
      // protocols that can allow "unsafe" and "unwise" chars.
      unsafeProtocol = {
        'javascript': true,
        'javascript:': true
      },
      // protocols that never have a hostname.
      hostlessProtocol = {
        'javascript': true,
        'javascript:': true
      },
      // protocols that always contain a // bit.
      slashedProtocol = {
        'http': true,
        'https': true,
        'ftp': true,
        'gopher': true,
        'file': true,
        'http:': true,
        'https:': true,
        'ftp:': true,
        'gopher:': true,
        'file:': true
      };

  function urlParse(url, parseQueryString, slashesDenoteHost) {
    if (url && util.isObject(url) && url instanceof Url) return url;

    var u = new Url;
    u.parse(url, parseQueryString, slashesDenoteHost);
    return u;
  }

  Url.prototype.parse = function(url, parseQueryString, slashesDenoteHost) {
    if (!util.isString(url)) {
      throw new TypeError("Parameter 'url' must be a string, not " + typeof url);
    }

    // Copy chrome, IE, opera backslash-handling behavior.
    // Back slashes before the query string get converted to forward slashes
    // See: https://code.google.com/p/chromium/issues/detail?id=25916
    var queryIndex = url.indexOf('?'),
        splitter =
            (queryIndex !== -1 && queryIndex < url.indexOf('#')) ? '?' : '#',
        uSplit = url.split(splitter),
        slashRegex = /\\/g;
    uSplit[0] = uSplit[0].replace(slashRegex, '/');
    url = uSplit.join(splitter);

    var rest = url;

    // trim before proceeding.
    // This is to support parse stuff like "  http://foo.com  \n"
    rest = rest.trim();

    if (!slashesDenoteHost && url.split('#').length === 1) {
      // Try fast path regexp
      var simplePath = simplePathPattern.exec(rest);
      if (simplePath) {
        this.path = rest;
        this.href = rest;
        this.pathname = simplePath[1];
        if (simplePath[2]) {
          this.search = simplePath[2];
          if (parseQueryString) {
            this.query = querystring.parse(this.search.substr(1));
          } else {
            this.query = this.search.substr(1);
          }
        } else if (parseQueryString) {
          this.search = '';
          this.query = {};
        }
        return this;
      }
    }

    var proto = protocolPattern.exec(rest);
    if (proto) {
      proto = proto[0];
      var lowerProto = proto.toLowerCase();
      this.protocol = lowerProto;
      rest = rest.substr(proto.length);
    }

    // figure out if it's got a host
    // user@server is *always* interpreted as a hostname, and url
    // resolution will treat //foo/bar as host=foo,path=bar because that's
    // how the browser resolves relative URLs.
    if (slashesDenoteHost || proto || rest.match(/^\/\/[^@\/]+@[^@\/]+/)) {
      var slashes = rest.substr(0, 2) === '//';
      if (slashes && !(proto && hostlessProtocol[proto])) {
        rest = rest.substr(2);
        this.slashes = true;
      }
    }

    if (!hostlessProtocol[proto] &&
        (slashes || (proto && !slashedProtocol[proto]))) {

      // there's a hostname.
      // the first instance of /, ?, ;, or # ends the host.
      //
      // If there is an @ in the hostname, then non-host chars *are* allowed
      // to the left of the last @ sign, unless some host-ending character
      // comes *before* the @-sign.
      // URLs are obnoxious.
      //
      // ex:
      // http://a@b@c/ => user:a@b host:c
      // http://a@b?@c => user:a host:c path:/?@c

      // v0.12 TODO(isaacs): This is not quite how Chrome does things.
      // Review our test case against browsers more comprehensively.

      // find the first instance of any hostEndingChars
      var hostEnd = -1;
      for (var i = 0; i < hostEndingChars.length; i++) {
        var hec = rest.indexOf(hostEndingChars[i]);
        if (hec !== -1 && (hostEnd === -1 || hec < hostEnd))
          hostEnd = hec;
      }

      // at this point, either we have an explicit point where the
      // auth portion cannot go past, or the last @ char is the decider.
      var auth, atSign;
      if (hostEnd === -1) {
        // atSign can be anywhere.
        atSign = rest.lastIndexOf('@');
      } else {
        // atSign must be in auth portion.
        // http://a@b/c@d => host:b auth:a path:/c@d
        atSign = rest.lastIndexOf('@', hostEnd);
      }

      // Now we have a portion which is definitely the auth.
      // Pull that off.
      if (atSign !== -1) {
        auth = rest.slice(0, atSign);
        rest = rest.slice(atSign + 1);
        this.auth = decodeURIComponent(auth);
      }

      // the host is the remaining to the left of the first non-host char
      hostEnd = -1;
      for (var i = 0; i < nonHostChars.length; i++) {
        var hec = rest.indexOf(nonHostChars[i]);
        if (hec !== -1 && (hostEnd === -1 || hec < hostEnd))
          hostEnd = hec;
      }
      // if we still have not hit it, then the entire thing is a host.
      if (hostEnd === -1)
        hostEnd = rest.length;

      this.host = rest.slice(0, hostEnd);
      rest = rest.slice(hostEnd);

      // pull out port.
      this.parseHost();

      // we've indicated that there is a hostname,
      // so even if it's empty, it has to be present.
      this.hostname = this.hostname || '';

      // if hostname begins with [ and ends with ]
      // assume that it's an IPv6 address.
      var ipv6Hostname = this.hostname[0] === '[' &&
          this.hostname[this.hostname.length - 1] === ']';

      // validate a little.
      if (!ipv6Hostname) {
        var hostparts = this.hostname.split(/\./);
        for (var i = 0, l = hostparts.length; i < l; i++) {
          var part = hostparts[i];
          if (!part) continue;
          if (!part.match(hostnamePartPattern)) {
            var newpart = '';
            for (var j = 0, k = part.length; j < k; j++) {
              if (part.charCodeAt(j) > 127) {
                // we replace non-ASCII char with a temporary placeholder
                // we need this to make sure size of hostname is not
                // broken by replacing non-ASCII by nothing
                newpart += 'x';
              } else {
                newpart += part[j];
              }
            }
            // we test again with ASCII char only
            if (!newpart.match(hostnamePartPattern)) {
              var validParts = hostparts.slice(0, i);
              var notHost = hostparts.slice(i + 1);
              var bit = part.match(hostnamePartStart);
              if (bit) {
                validParts.push(bit[1]);
                notHost.unshift(bit[2]);
              }
              if (notHost.length) {
                rest = '/' + notHost.join('.') + rest;
              }
              this.hostname = validParts.join('.');
              break;
            }
          }
        }
      }

      if (this.hostname.length > hostnameMaxLen) {
        this.hostname = '';
      } else {
        // hostnames are always lower case.
        this.hostname = this.hostname.toLowerCase();
      }

      if (!ipv6Hostname) {
        // IDNA Support: Returns a punycoded representation of "domain".
        // It only converts parts of the domain name that
        // have non-ASCII characters, i.e. it doesn't matter if
        // you call it with a domain that already is ASCII-only.
        this.hostname = punycode.toASCII(this.hostname);
      }

      var p = this.port ? ':' + this.port : '';
      var h = this.hostname || '';
      this.host = h + p;
      this.href += this.host;

      // strip [ and ] from the hostname
      // the host field still retains them, though
      if (ipv6Hostname) {
        this.hostname = this.hostname.substr(1, this.hostname.length - 2);
        if (rest[0] !== '/') {
          rest = '/' + rest;
        }
      }
    }

    // now rest is set to the post-host stuff.
    // chop off any delim chars.
    if (!unsafeProtocol[lowerProto]) {

      // First, make 100% sure that any "autoEscape" chars get
      // escaped, even if encodeURIComponent doesn't think they
      // need to be.
      for (var i = 0, l = autoEscape.length; i < l; i++) {
        var ae = autoEscape[i];
        if (rest.indexOf(ae) === -1)
          continue;
        var esc = encodeURIComponent(ae);
        if (esc === ae) {
          esc = escape(ae);
        }
        rest = rest.split(ae).join(esc);
      }
    }


    // chop off from the tail first.
    var hash = rest.indexOf('#');
    if (hash !== -1) {
      // got a fragment string.
      this.hash = rest.substr(hash);
      rest = rest.slice(0, hash);
    }
    var qm = rest.indexOf('?');
    if (qm !== -1) {
      this.search = rest.substr(qm);
      this.query = rest.substr(qm + 1);
      if (parseQueryString) {
        this.query = querystring.parse(this.query);
      }
      rest = rest.slice(0, qm);
    } else if (parseQueryString) {
      // no query string, but parseQueryString still requested
      this.search = '';
      this.query = {};
    }
    if (rest) this.pathname = rest;
    if (slashedProtocol[lowerProto] &&
        this.hostname && !this.pathname) {
      this.pathname = '/';
    }

    //to support http.request
    if (this.pathname || this.search) {
      var p = this.pathname || '';
      var s = this.search || '';
      this.path = p + s;
    }

    // finally, reconstruct the href based on what has been validated.
    this.href = this.format();
    return this;
  };

  // format a parsed object into a url string
  function urlFormat(obj) {
    // ensure it's an object, and not a string url.
    // If it's an obj, this is a no-op.
    // this way, you can call url_format() on strings
    // to clean up potentially wonky urls.
    if (util.isString(obj)) obj = urlParse(obj);
    if (!(obj instanceof Url)) return Url.prototype.format.call(obj);
    return obj.format();
  }

  Url.prototype.format = function() {
    var auth = this.auth || '';
    if (auth) {
      auth = encodeURIComponent(auth);
      auth = auth.replace(/%3A/i, ':');
      auth += '@';
    }

    var protocol = this.protocol || '',
        pathname = this.pathname || '',
        hash = this.hash || '',
        host = false,
        query = '';

    if (this.host) {
      host = auth + this.host;
    } else if (this.hostname) {
      host = auth + (this.hostname.indexOf(':') === -1 ?
          this.hostname :
          '[' + this.hostname + ']');
      if (this.port) {
        host += ':' + this.port;
      }
    }

    if (this.query &&
        util.isObject(this.query) &&
        Object.keys(this.query).length) {
      query = querystring.stringify(this.query);
    }

    var search = this.search || (query && ('?' + query)) || '';

    if (protocol && protocol.substr(-1) !== ':') protocol += ':';

    // only the slashedProtocols get the //.  Not mailto:, xmpp:, etc.
    // unless they had them to begin with.
    if (this.slashes ||
        (!protocol || slashedProtocol[protocol]) && host !== false) {
      host = '//' + (host || '');
      if (pathname && pathname.charAt(0) !== '/') pathname = '/' + pathname;
    } else if (!host) {
      host = '';
    }

    if (hash && hash.charAt(0) !== '#') hash = '#' + hash;
    if (search && search.charAt(0) !== '?') search = '?' + search;

    pathname = pathname.replace(/[?#]/g, function(match) {
      return encodeURIComponent(match);
    });
    search = search.replace('#', '%23');

    return protocol + host + pathname + search + hash;
  };

  function urlResolve(source, relative) {
    return urlParse(source, false, true).resolve(relative);
  }

  Url.prototype.resolve = function(relative) {
    return this.resolveObject(urlParse(relative, false, true)).format();
  };

  function urlResolveObject(source, relative) {
    if (!source) return relative;
    return urlParse(source, false, true).resolveObject(relative);
  }

  Url.prototype.resolveObject = function(relative) {
    if (util.isString(relative)) {
      var rel = new Url();
      rel.parse(relative, false, true);
      relative = rel;
    }

    var result = new Url();
    var tkeys = Object.keys(this);
    for (var tk = 0; tk < tkeys.length; tk++) {
      var tkey = tkeys[tk];
      result[tkey] = this[tkey];
    }

    // hash is always overridden, no matter what.
    // even href="" will remove it.
    result.hash = relative.hash;

    // if the relative url is empty, then there's nothing left to do here.
    if (relative.href === '') {
      result.href = result.format();
      return result;
    }

    // hrefs like //foo/bar always cut to the protocol.
    if (relative.slashes && !relative.protocol) {
      // take everything except the protocol from relative
      var rkeys = Object.keys(relative);
      for (var rk = 0; rk < rkeys.length; rk++) {
        var rkey = rkeys[rk];
        if (rkey !== 'protocol')
          result[rkey] = relative[rkey];
      }

      //urlParse appends trailing / to urls like http://www.example.com
      if (slashedProtocol[result.protocol] &&
          result.hostname && !result.pathname) {
        result.path = result.pathname = '/';
      }

      result.href = result.format();
      return result;
    }

    if (relative.protocol && relative.protocol !== result.protocol) {
      // if it's a known url protocol, then changing
      // the protocol does weird things
      // first, if it's not file:, then we MUST have a host,
      // and if there was a path
      // to begin with, then we MUST have a path.
      // if it is file:, then the host is dropped,
      // because that's known to be hostless.
      // anything else is assumed to be absolute.
      if (!slashedProtocol[relative.protocol]) {
        var keys = Object.keys(relative);
        for (var v = 0; v < keys.length; v++) {
          var k = keys[v];
          result[k] = relative[k];
        }
        result.href = result.format();
        return result;
      }

      result.protocol = relative.protocol;
      if (!relative.host && !hostlessProtocol[relative.protocol]) {
        var relPath = (relative.pathname || '').split('/');
        while (relPath.length && !(relative.host = relPath.shift()));
        if (!relative.host) relative.host = '';
        if (!relative.hostname) relative.hostname = '';
        if (relPath[0] !== '') relPath.unshift('');
        if (relPath.length < 2) relPath.unshift('');
        result.pathname = relPath.join('/');
      } else {
        result.pathname = relative.pathname;
      }
      result.search = relative.search;
      result.query = relative.query;
      result.host = relative.host || '';
      result.auth = relative.auth;
      result.hostname = relative.hostname || relative.host;
      result.port = relative.port;
      // to support http.request
      if (result.pathname || result.search) {
        var p = result.pathname || '';
        var s = result.search || '';
        result.path = p + s;
      }
      result.slashes = result.slashes || relative.slashes;
      result.href = result.format();
      return result;
    }

    var isSourceAbs = (result.pathname && result.pathname.charAt(0) === '/'),
        isRelAbs = (
            relative.host ||
            relative.pathname && relative.pathname.charAt(0) === '/'
        ),
        mustEndAbs = (isRelAbs || isSourceAbs ||
                      (result.host && relative.pathname)),
        removeAllDots = mustEndAbs,
        srcPath = result.pathname && result.pathname.split('/') || [],
        relPath = relative.pathname && relative.pathname.split('/') || [],
        psychotic = result.protocol && !slashedProtocol[result.protocol];

    // if the url is a non-slashed url, then relative
    // links like ../.. should be able
    // to crawl up to the hostname, as well.  This is strange.
    // result.protocol has already been set by now.
    // Later on, put the first path part into the host field.
    if (psychotic) {
      result.hostname = '';
      result.port = null;
      if (result.host) {
        if (srcPath[0] === '') srcPath[0] = result.host;
        else srcPath.unshift(result.host);
      }
      result.host = '';
      if (relative.protocol) {
        relative.hostname = null;
        relative.port = null;
        if (relative.host) {
          if (relPath[0] === '') relPath[0] = relative.host;
          else relPath.unshift(relative.host);
        }
        relative.host = null;
      }
      mustEndAbs = mustEndAbs && (relPath[0] === '' || srcPath[0] === '');
    }

    if (isRelAbs) {
      // it's absolute.
      result.host = (relative.host || relative.host === '') ?
                    relative.host : result.host;
      result.hostname = (relative.hostname || relative.hostname === '') ?
                        relative.hostname : result.hostname;
      result.search = relative.search;
      result.query = relative.query;
      srcPath = relPath;
      // fall through to the dot-handling below.
    } else if (relPath.length) {
      // it's relative
      // throw away the existing file, and take the new path instead.
      if (!srcPath) srcPath = [];
      srcPath.pop();
      srcPath = srcPath.concat(relPath);
      result.search = relative.search;
      result.query = relative.query;
    } else if (!util.isNullOrUndefined(relative.search)) {
      // just pull out the search.
      // like href='?foo'.
      // Put this after the other two cases because it simplifies the booleans
      if (psychotic) {
        result.hostname = result.host = srcPath.shift();
        //occationaly the auth can get stuck only in host
        //this especially happens in cases like
        //url.resolveObject('mailto:local1@domain1', 'local2@domain2')
        var authInHost = result.host && result.host.indexOf('@') > 0 ?
                         result.host.split('@') : false;
        if (authInHost) {
          result.auth = authInHost.shift();
          result.host = result.hostname = authInHost.shift();
        }
      }
      result.search = relative.search;
      result.query = relative.query;
      //to support http.request
      if (!util.isNull(result.pathname) || !util.isNull(result.search)) {
        result.path = (result.pathname ? result.pathname : '') +
                      (result.search ? result.search : '');
      }
      result.href = result.format();
      return result;
    }

    if (!srcPath.length) {
      // no path at all.  easy.
      // we've already handled the other stuff above.
      result.pathname = null;
      //to support http.request
      if (result.search) {
        result.path = '/' + result.search;
      } else {
        result.path = null;
      }
      result.href = result.format();
      return result;
    }

    // if a url ENDs in . or .., then it must get a trailing slash.
    // however, if it ends in anything else non-slashy,
    // then it must NOT get a trailing slash.
    var last = srcPath.slice(-1)[0];
    var hasTrailingSlash = (
        (result.host || relative.host || srcPath.length > 1) &&
        (last === '.' || last === '..') || last === '');

    // strip single dots, resolve double dots to parent dir
    // if the path tries to go above the root, `up` ends up > 0
    var up = 0;
    for (var i = srcPath.length; i >= 0; i--) {
      last = srcPath[i];
      if (last === '.') {
        srcPath.splice(i, 1);
      } else if (last === '..') {
        srcPath.splice(i, 1);
        up++;
      } else if (up) {
        srcPath.splice(i, 1);
        up--;
      }
    }

    // if the path is allowed to go above the root, restore leading ..s
    if (!mustEndAbs && !removeAllDots) {
      for (; up--; up) {
        srcPath.unshift('..');
      }
    }

    if (mustEndAbs && srcPath[0] !== '' &&
        (!srcPath[0] || srcPath[0].charAt(0) !== '/')) {
      srcPath.unshift('');
    }

    if (hasTrailingSlash && (srcPath.join('/').substr(-1) !== '/')) {
      srcPath.push('');
    }

    var isAbsolute = srcPath[0] === '' ||
        (srcPath[0] && srcPath[0].charAt(0) === '/');

    // put the host back
    if (psychotic) {
      result.hostname = result.host = isAbsolute ? '' :
                                      srcPath.length ? srcPath.shift() : '';
      //occationaly the auth can get stuck only in host
      //this especially happens in cases like
      //url.resolveObject('mailto:local1@domain1', 'local2@domain2')
      var authInHost = result.host && result.host.indexOf('@') > 0 ?
                       result.host.split('@') : false;
      if (authInHost) {
        result.auth = authInHost.shift();
        result.host = result.hostname = authInHost.shift();
      }
    }

    mustEndAbs = mustEndAbs || (result.host && srcPath.length);

    if (mustEndAbs && !isAbsolute) {
      srcPath.unshift('');
    }

    if (!srcPath.length) {
      result.pathname = null;
      result.path = null;
    } else {
      result.pathname = srcPath.join('/');
    }

    //to support request.http
    if (!util.isNull(result.pathname) || !util.isNull(result.search)) {
      result.path = (result.pathname ? result.pathname : '') +
                    (result.search ? result.search : '');
    }
    result.auth = relative.auth || result.auth;
    result.slashes = result.slashes || relative.slashes;
    result.href = result.format();
    return result;
  };

  Url.prototype.parseHost = function() {
    var host = this.host;
    var port = portPattern.exec(host);
    if (port) {
      port = port[0];
      if (port !== ':') {
        this.port = port.substr(1);
      }
      host = host.substr(0, host.length - port.length);
    }
    if (host) this.hostname = host;
  };

  var url = {
  	parse: parse,
  	resolve: resolve,
  	resolveObject: resolveObject,
  	format: format$1,
  	Url: Url_1
  };

  function getPropertyReference(propertyName) {
      for (let i = 0; i < v8.layout.length; i++) {
          for (const key in v8[v8.layout[i]]) {
              if (key === propertyName)
                  return v8[v8.layout[i]][key];
          }
      }
      for (let i = 0; i < v8.paint.length; i++) {
          for (const key in v8[v8.paint[i]]) {
              if (key === propertyName)
                  return v8[v8.paint[i]][key];
          }
      }
      return null;
  }
  function eachSource(style, callback) {
      for (const k in style.sources) {
          callback(style.sources[k]);
      }
  }
  function eachLayer(style, callback) {
      for (const layer of style.layers) {
          callback(layer);
      }
  }
  function eachProperty(style, options, callback) {
      function inner(layer, propertyType) {
          const properties = layer[propertyType];
          if (!properties)
              return;
          Object.keys(properties).forEach(key => {
              callback({
                  path: [
                      layer.id,
                      propertyType,
                      key
                  ],
                  key,
                  value: properties[key],
                  reference: getPropertyReference(key),
                  set(x) {
                      properties[key] = x;
                  }
              });
          });
      }
      eachLayer(style, layer => {
          if (options.paint) {
              inner(layer, 'paint');
          }
          if (options.layout) {
              inner(layer, 'layout');
          }
      });
  }

  function eachLayout(layer, callback) {
      for (const k in layer) {
          if (k.indexOf('layout') === 0) {
              callback(layer[k], k);
          }
      }
  }
  function eachPaint(layer, callback) {
      for (const k in layer) {
          if (k.indexOf('paint') === 0) {
              callback(layer[k], k);
          }
      }
  }
  function resolveConstant(style, value) {
      if (typeof value === 'string' && value[0] === '@') {
          return resolveConstant(style, style.constants[value]);
      } else {
          return value;
      }
  }
  function isFunction(value) {
      return Array.isArray(value.stops);
  }
  function renameProperty(obj, from, to) {
      obj[to] = obj[from];
      delete obj[from];
  }
  function migrateToV8 (style) {
      style.version = 8;
      eachSource(style, source => {
          if (source.type === 'video' && source.url !== undefined) {
              renameProperty(source, 'url', 'urls');
          }
          if (source.type === 'video') {
              source.coordinates.forEach(coord => {
                  return coord.reverse();
              });
          }
      });
      eachLayer(style, layer => {
          eachLayout(layer, layout => {
              if (layout['symbol-min-distance'] !== undefined) {
                  renameProperty(layout, 'symbol-min-distance', 'symbol-spacing');
              }
          });
          eachPaint(layer, paint => {
              if (paint['background-image'] !== undefined) {
                  renameProperty(paint, 'background-image', 'background-pattern');
              }
              if (paint['line-image'] !== undefined) {
                  renameProperty(paint, 'line-image', 'line-pattern');
              }
              if (paint['fill-image'] !== undefined) {
                  renameProperty(paint, 'fill-image', 'fill-pattern');
              }
          });
      });
      eachProperty(style, {
          paint: true,
          layout: true
      }, property => {
          const value = resolveConstant(style, property.value);
          if (isFunction(value)) {
              value.stops.forEach(stop => {
                  stop[1] = resolveConstant(style, stop[1]);
              });
          }
          property.set(value);
      });
      delete style.constants;
      eachLayer(style, layer => {
          eachLayout(layer, layout => {
              delete layout['text-max-size'];
              delete layout['icon-max-size'];
          });
          eachPaint(layer, paint => {
              if (paint['text-size']) {
                  if (!layer.layout)
                      layer.layout = {};
                  layer.layout['text-size'] = paint['text-size'];
                  delete paint['text-size'];
              }
              if (paint['icon-size']) {
                  if (!layer.layout)
                      layer.layout = {};
                  layer.layout['icon-size'] = paint['icon-size'];
                  delete paint['icon-size'];
              }
          });
      });
      function migrateFontstackURL(input) {
          const inputParsed = url.parse(input);
          const inputPathnameParts = inputParsed.pathname.split('/');
          if (inputParsed.protocol !== 'mapbox:') {
              return input;
          } else if (inputParsed.hostname === 'fontstack') {
              return 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf';
          } else if (inputParsed.hostname === 'fonts') {
              return `mapbox://fonts/${ inputPathnameParts[2] }/{fontstack}/{range}.pbf`;
          } else ;
      }
      if (style.glyphs) {
          style.glyphs = migrateFontstackURL(style.glyphs);
      }
      function migrateFontStack(font) {
          function splitAndTrim(string) {
              return string.split(',').map(s => {
                  return s.trim();
              });
          }
          if (Array.isArray(font)) {
              return font;
          } else if (typeof font === 'string') {
              return splitAndTrim(font);
          } else if (typeof font === 'object') {
              font.stops.forEach(stop => {
                  stop[1] = splitAndTrim(stop[1]);
              });
              return font;
          } else {
              throw new Error('unexpected font value');
          }
      }
      eachLayer(style, layer => {
          eachLayout(layer, layout => {
              if (layout['text-font']) {
                  layout['text-font'] = migrateFontStack(layout['text-font']);
              }
          });
      });
      let firstSymbolLayer = 0;
      for (let i = style.layers.length - 1; i >= 0; i--) {
          const layer = style.layers[i];
          if (layer.type !== 'symbol') {
              firstSymbolLayer = i + 1;
              break;
          }
      }
      const symbolLayers = style.layers.splice(firstSymbolLayer);
      symbolLayers.reverse();
      style.layers = style.layers.concat(symbolLayers);
      return style;
  }

  function extend (output, ...inputs) {
      for (const input of inputs) {
          for (const k in input) {
              output[k] = input[k];
          }
      }
      return output;
  }

  class ParsingError extends Error {
      constructor(key, message) {
          super(message);
          this.message = message;
          this.key = key;
      }
  }

  class Scope {
      constructor(parent, bindings = []) {
          this.parent = parent;
          this.bindings = {};
          for (const [name, expression] of bindings) {
              this.bindings[name] = expression;
          }
      }
      concat(bindings) {
          return new Scope(this, bindings);
      }
      get(name) {
          if (this.bindings[name]) {
              return this.bindings[name];
          }
          if (this.parent) {
              return this.parent.get(name);
          }
          throw new Error(`${ name } not found in scope.`);
      }
      has(name) {
          if (this.bindings[name])
              return true;
          return this.parent ? this.parent.has(name) : false;
      }
  }

  const NullType = { kind: 'null' };
  const NumberType = { kind: 'number' };
  const StringType = { kind: 'string' };
  const BooleanType = { kind: 'boolean' };
  const ColorType = { kind: 'color' };
  const ObjectType = { kind: 'object' };
  const ValueType = { kind: 'value' };
  const ErrorType = { kind: 'error' };
  const CollatorType = { kind: 'collator' };
  const FormattedType = { kind: 'formatted' };
  const ResolvedImageType = { kind: 'resolvedImage' };
  function array(itemType, N) {
      return {
          kind: 'array',
          itemType,
          N
      };
  }
  function toString(type) {
      if (type.kind === 'array') {
          const itemType = toString(type.itemType);
          return typeof type.N === 'number' ? `array<${ itemType }, ${ type.N }>` : type.itemType.kind === 'value' ? 'array' : `array<${ itemType }>`;
      } else {
          return type.kind;
      }
  }
  const valueMemberTypes = [
      NullType,
      NumberType,
      StringType,
      BooleanType,
      ColorType,
      FormattedType,
      ObjectType,
      array(ValueType),
      ResolvedImageType
  ];
  function checkSubtype(expected, t) {
      if (t.kind === 'error') {
          return null;
      } else if (expected.kind === 'array') {
          if (t.kind === 'array' && (t.N === 0 && t.itemType.kind === 'value' || !checkSubtype(expected.itemType, t.itemType)) && (typeof expected.N !== 'number' || expected.N === t.N)) {
              return null;
          }
      } else if (expected.kind === t.kind) {
          return null;
      } else if (expected.kind === 'value') {
          for (const memberType of valueMemberTypes) {
              if (!checkSubtype(memberType, t)) {
                  return null;
              }
          }
      }
      return `Expected ${ toString(expected) } but found ${ toString(t) } instead.`;
  }
  function isValidType(provided, allowedTypes) {
      return allowedTypes.some(t => t.kind === provided.kind);
  }
  function isValidNativeType(provided, allowedTypes) {
      return allowedTypes.some(t => {
          if (t === 'null') {
              return provided === null;
          } else if (t === 'array') {
              return Array.isArray(provided);
          } else if (t === 'object') {
              return provided && !Array.isArray(provided) && typeof provided === 'object';
          } else {
              return t === typeof provided;
          }
      });
  }

  var csscolorparser = createCommonjsModule(function (module, exports) {
  // (c) Dean McNamee <dean@gmail.com>, 2012.
  //
  // https://github.com/deanm/css-color-parser-js
  //
  // Permission is hereby granted, free of charge, to any person obtaining a copy
  // of this software and associated documentation files (the "Software"), to
  // deal in the Software without restriction, including without limitation the
  // rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
  // sell copies of the Software, and to permit persons to whom the Software is
  // furnished to do so, subject to the following conditions:
  //
  // The above copyright notice and this permission notice shall be included in
  // all copies or substantial portions of the Software.
  //
  // THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  // IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  // FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  // AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  // LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
  // FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
  // IN THE SOFTWARE.

  // http://www.w3.org/TR/css3-color/
  var kCSSColorTable = {
    "transparent": [0,0,0,0], "aliceblue": [240,248,255,1],
    "antiquewhite": [250,235,215,1], "aqua": [0,255,255,1],
    "aquamarine": [127,255,212,1], "azure": [240,255,255,1],
    "beige": [245,245,220,1], "bisque": [255,228,196,1],
    "black": [0,0,0,1], "blanchedalmond": [255,235,205,1],
    "blue": [0,0,255,1], "blueviolet": [138,43,226,1],
    "brown": [165,42,42,1], "burlywood": [222,184,135,1],
    "cadetblue": [95,158,160,1], "chartreuse": [127,255,0,1],
    "chocolate": [210,105,30,1], "coral": [255,127,80,1],
    "cornflowerblue": [100,149,237,1], "cornsilk": [255,248,220,1],
    "crimson": [220,20,60,1], "cyan": [0,255,255,1],
    "darkblue": [0,0,139,1], "darkcyan": [0,139,139,1],
    "darkgoldenrod": [184,134,11,1], "darkgray": [169,169,169,1],
    "darkgreen": [0,100,0,1], "darkgrey": [169,169,169,1],
    "darkkhaki": [189,183,107,1], "darkmagenta": [139,0,139,1],
    "darkolivegreen": [85,107,47,1], "darkorange": [255,140,0,1],
    "darkorchid": [153,50,204,1], "darkred": [139,0,0,1],
    "darksalmon": [233,150,122,1], "darkseagreen": [143,188,143,1],
    "darkslateblue": [72,61,139,1], "darkslategray": [47,79,79,1],
    "darkslategrey": [47,79,79,1], "darkturquoise": [0,206,209,1],
    "darkviolet": [148,0,211,1], "deeppink": [255,20,147,1],
    "deepskyblue": [0,191,255,1], "dimgray": [105,105,105,1],
    "dimgrey": [105,105,105,1], "dodgerblue": [30,144,255,1],
    "firebrick": [178,34,34,1], "floralwhite": [255,250,240,1],
    "forestgreen": [34,139,34,1], "fuchsia": [255,0,255,1],
    "gainsboro": [220,220,220,1], "ghostwhite": [248,248,255,1],
    "gold": [255,215,0,1], "goldenrod": [218,165,32,1],
    "gray": [128,128,128,1], "green": [0,128,0,1],
    "greenyellow": [173,255,47,1], "grey": [128,128,128,1],
    "honeydew": [240,255,240,1], "hotpink": [255,105,180,1],
    "indianred": [205,92,92,1], "indigo": [75,0,130,1],
    "ivory": [255,255,240,1], "khaki": [240,230,140,1],
    "lavender": [230,230,250,1], "lavenderblush": [255,240,245,1],
    "lawngreen": [124,252,0,1], "lemonchiffon": [255,250,205,1],
    "lightblue": [173,216,230,1], "lightcoral": [240,128,128,1],
    "lightcyan": [224,255,255,1], "lightgoldenrodyellow": [250,250,210,1],
    "lightgray": [211,211,211,1], "lightgreen": [144,238,144,1],
    "lightgrey": [211,211,211,1], "lightpink": [255,182,193,1],
    "lightsalmon": [255,160,122,1], "lightseagreen": [32,178,170,1],
    "lightskyblue": [135,206,250,1], "lightslategray": [119,136,153,1],
    "lightslategrey": [119,136,153,1], "lightsteelblue": [176,196,222,1],
    "lightyellow": [255,255,224,1], "lime": [0,255,0,1],
    "limegreen": [50,205,50,1], "linen": [250,240,230,1],
    "magenta": [255,0,255,1], "maroon": [128,0,0,1],
    "mediumaquamarine": [102,205,170,1], "mediumblue": [0,0,205,1],
    "mediumorchid": [186,85,211,1], "mediumpurple": [147,112,219,1],
    "mediumseagreen": [60,179,113,1], "mediumslateblue": [123,104,238,1],
    "mediumspringgreen": [0,250,154,1], "mediumturquoise": [72,209,204,1],
    "mediumvioletred": [199,21,133,1], "midnightblue": [25,25,112,1],
    "mintcream": [245,255,250,1], "mistyrose": [255,228,225,1],
    "moccasin": [255,228,181,1], "navajowhite": [255,222,173,1],
    "navy": [0,0,128,1], "oldlace": [253,245,230,1],
    "olive": [128,128,0,1], "olivedrab": [107,142,35,1],
    "orange": [255,165,0,1], "orangered": [255,69,0,1],
    "orchid": [218,112,214,1], "palegoldenrod": [238,232,170,1],
    "palegreen": [152,251,152,1], "paleturquoise": [175,238,238,1],
    "palevioletred": [219,112,147,1], "papayawhip": [255,239,213,1],
    "peachpuff": [255,218,185,1], "peru": [205,133,63,1],
    "pink": [255,192,203,1], "plum": [221,160,221,1],
    "powderblue": [176,224,230,1], "purple": [128,0,128,1],
    "rebeccapurple": [102,51,153,1],
    "red": [255,0,0,1], "rosybrown": [188,143,143,1],
    "royalblue": [65,105,225,1], "saddlebrown": [139,69,19,1],
    "salmon": [250,128,114,1], "sandybrown": [244,164,96,1],
    "seagreen": [46,139,87,1], "seashell": [255,245,238,1],
    "sienna": [160,82,45,1], "silver": [192,192,192,1],
    "skyblue": [135,206,235,1], "slateblue": [106,90,205,1],
    "slategray": [112,128,144,1], "slategrey": [112,128,144,1],
    "snow": [255,250,250,1], "springgreen": [0,255,127,1],
    "steelblue": [70,130,180,1], "tan": [210,180,140,1],
    "teal": [0,128,128,1], "thistle": [216,191,216,1],
    "tomato": [255,99,71,1], "turquoise": [64,224,208,1],
    "violet": [238,130,238,1], "wheat": [245,222,179,1],
    "white": [255,255,255,1], "whitesmoke": [245,245,245,1],
    "yellow": [255,255,0,1], "yellowgreen": [154,205,50,1]};

  function clamp_css_byte(i) {  // Clamp to integer 0 .. 255.
    i = Math.round(i);  // Seems to be what Chrome does (vs truncation).
    return i < 0 ? 0 : i > 255 ? 255 : i;
  }

  function clamp_css_float(f) {  // Clamp to float 0.0 .. 1.0.
    return f < 0 ? 0 : f > 1 ? 1 : f;
  }

  function parse_css_int(str) {  // int or percentage.
    if (str[str.length - 1] === '%')
      return clamp_css_byte(parseFloat(str) / 100 * 255);
    return clamp_css_byte(parseInt(str));
  }

  function parse_css_float(str) {  // float or percentage.
    if (str[str.length - 1] === '%')
      return clamp_css_float(parseFloat(str) / 100);
    return clamp_css_float(parseFloat(str));
  }

  function css_hue_to_rgb(m1, m2, h) {
    if (h < 0) h += 1;
    else if (h > 1) h -= 1;

    if (h * 6 < 1) return m1 + (m2 - m1) * h * 6;
    if (h * 2 < 1) return m2;
    if (h * 3 < 2) return m1 + (m2 - m1) * (2/3 - h) * 6;
    return m1;
  }

  function parseCSSColor(css_str) {
    // Remove all whitespace, not compliant, but should just be more accepting.
    var str = css_str.replace(/ /g, '').toLowerCase();

    // Color keywords (and transparent) lookup.
    if (str in kCSSColorTable) return kCSSColorTable[str].slice();  // dup.

    // #abc and #abc123 syntax.
    if (str[0] === '#') {
      if (str.length === 4) {
        var iv = parseInt(str.substr(1), 16);  // TODO(deanm): Stricter parsing.
        if (!(iv >= 0 && iv <= 0xfff)) return null;  // Covers NaN.
        return [((iv & 0xf00) >> 4) | ((iv & 0xf00) >> 8),
                (iv & 0xf0) | ((iv & 0xf0) >> 4),
                (iv & 0xf) | ((iv & 0xf) << 4),
                1];
      } else if (str.length === 7) {
        var iv = parseInt(str.substr(1), 16);  // TODO(deanm): Stricter parsing.
        if (!(iv >= 0 && iv <= 0xffffff)) return null;  // Covers NaN.
        return [(iv & 0xff0000) >> 16,
                (iv & 0xff00) >> 8,
                iv & 0xff,
                1];
      }

      return null;
    }

    var op = str.indexOf('('), ep = str.indexOf(')');
    if (op !== -1 && ep + 1 === str.length) {
      var fname = str.substr(0, op);
      var params = str.substr(op+1, ep-(op+1)).split(',');
      var alpha = 1;  // To allow case fallthrough.
      switch (fname) {
        case 'rgba':
          if (params.length !== 4) return null;
          alpha = parse_css_float(params.pop());
          // Fall through.
        case 'rgb':
          if (params.length !== 3) return null;
          return [parse_css_int(params[0]),
                  parse_css_int(params[1]),
                  parse_css_int(params[2]),
                  alpha];
        case 'hsla':
          if (params.length !== 4) return null;
          alpha = parse_css_float(params.pop());
          // Fall through.
        case 'hsl':
          if (params.length !== 3) return null;
          var h = (((parseFloat(params[0]) % 360) + 360) % 360) / 360;  // 0 .. 1
          // NOTE(deanm): According to the CSS spec s/l should only be
          // percentages, but we don't bother and let float or percentage.
          var s = parse_css_float(params[1]);
          var l = parse_css_float(params[2]);
          var m2 = l <= 0.5 ? l * (s + 1) : l + s - l * s;
          var m1 = l * 2 - m2;
          return [clamp_css_byte(css_hue_to_rgb(m1, m2, h+1/3) * 255),
                  clamp_css_byte(css_hue_to_rgb(m1, m2, h) * 255),
                  clamp_css_byte(css_hue_to_rgb(m1, m2, h-1/3) * 255),
                  alpha];
        default:
          return null;
      }
    }

    return null;
  }

  try { exports.parseCSSColor = parseCSSColor; } catch(e) { }
  });

  class Color {
      constructor(r, g, b, a = 1) {
          this.r = r;
          this.g = g;
          this.b = b;
          this.a = a;
      }
      static parse(input) {
          if (!input) {
              return undefined;
          }
          if (input instanceof Color) {
              return input;
          }
          if (typeof input !== 'string') {
              return undefined;
          }
          const rgba = csscolorparser.parseCSSColor(input);
          if (!rgba) {
              return undefined;
          }
          return new Color(rgba[0] / 255 * rgba[3], rgba[1] / 255 * rgba[3], rgba[2] / 255 * rgba[3], rgba[3]);
      }
      toString() {
          const [r, g, b, a] = this.toArray();
          return `rgba(${ Math.round(r) },${ Math.round(g) },${ Math.round(b) },${ a })`;
      }
      toArray() {
          const {r, g, b, a} = this;
          return a === 0 ? [
              0,
              0,
              0,
              0
          ] : [
              r * 255 / a,
              g * 255 / a,
              b * 255 / a,
              a
          ];
      }
  }
  Color.black = new Color(0, 0, 0, 1);
  Color.white = new Color(1, 1, 1, 1);
  Color.transparent = new Color(0, 0, 0, 0);
  Color.red = new Color(1, 0, 0, 1);
  Color.blue = new Color(0, 0, 1, 1);

  class Collator {
      constructor(caseSensitive, diacriticSensitive, locale) {
          if (caseSensitive)
              this.sensitivity = diacriticSensitive ? 'variant' : 'case';
          else
              this.sensitivity = diacriticSensitive ? 'accent' : 'base';
          this.locale = locale;
          this.collator = new Intl.Collator(this.locale ? this.locale : [], {
              sensitivity: this.sensitivity,
              usage: 'search'
          });
      }
      compare(lhs, rhs) {
          return this.collator.compare(lhs, rhs);
      }
      resolvedLocale() {
          return new Intl.Collator(this.locale ? this.locale : []).resolvedOptions().locale;
      }
  }

  class FormattedSection {
      constructor(text, image, scale, fontStack, textColor) {
          this.text = text;
          this.image = image;
          this.scale = scale;
          this.fontStack = fontStack;
          this.textColor = textColor;
      }
  }
  class Formatted {
      constructor(sections) {
          this.sections = sections;
      }
      static fromString(unformatted) {
          return new Formatted([new FormattedSection(unformatted, null, null, null, null)]);
      }
      isEmpty() {
          if (this.sections.length === 0)
              return true;
          return !this.sections.some(section => section.text.length !== 0 || section.image && section.image.name.length !== 0);
      }
      static factory(text) {
          if (text instanceof Formatted) {
              return text;
          } else {
              return Formatted.fromString(text);
          }
      }
      toString() {
          if (this.sections.length === 0)
              return '';
          return this.sections.map(section => section.text).join('');
      }
      serialize() {
          const serialized = ['format'];
          for (const section of this.sections) {
              if (section.image) {
                  serialized.push([
                      'image',
                      section.image.name
                  ]);
                  continue;
              }
              serialized.push(section.text);
              const options = {};
              if (section.fontStack) {
                  options['text-font'] = [
                      'literal',
                      section.fontStack.split(',')
                  ];
              }
              if (section.scale) {
                  options['font-scale'] = section.scale;
              }
              if (section.textColor) {
                  options['text-color'] = ['rgba'].concat(section.textColor.toArray());
              }
              serialized.push(options);
          }
          return serialized;
      }
  }

  class ResolvedImage {
      constructor(options) {
          this.name = options.name;
          this.available = options.available;
      }
      toString() {
          return this.name;
      }
      static fromString(name) {
          if (!name)
              return null;
          return new ResolvedImage({
              name,
              available: false
          });
      }
      serialize() {
          return [
              'image',
              this.name
          ];
      }
  }

  function validateRGBA(r, g, b, a) {
      if (!(typeof r === 'number' && r >= 0 && r <= 255 && typeof g === 'number' && g >= 0 && g <= 255 && typeof b === 'number' && b >= 0 && b <= 255)) {
          const value = typeof a === 'number' ? [
              r,
              g,
              b,
              a
          ] : [
              r,
              g,
              b
          ];
          return `Invalid rgba value [${ value.join(', ') }]: 'r', 'g', and 'b' must be between 0 and 255.`;
      }
      if (!(typeof a === 'undefined' || typeof a === 'number' && a >= 0 && a <= 1)) {
          return `Invalid rgba value [${ [
            r,
            g,
            b,
            a
        ].join(', ') }]: 'a' must be between 0 and 1.`;
      }
      return null;
  }
  function isValue(mixed) {
      if (mixed === null) {
          return true;
      } else if (typeof mixed === 'string') {
          return true;
      } else if (typeof mixed === 'boolean') {
          return true;
      } else if (typeof mixed === 'number') {
          return true;
      } else if (mixed instanceof Color) {
          return true;
      } else if (mixed instanceof Collator) {
          return true;
      } else if (mixed instanceof Formatted) {
          return true;
      } else if (mixed instanceof ResolvedImage) {
          return true;
      } else if (Array.isArray(mixed)) {
          for (const item of mixed) {
              if (!isValue(item)) {
                  return false;
              }
          }
          return true;
      } else if (typeof mixed === 'object') {
          for (const key in mixed) {
              if (!isValue(mixed[key])) {
                  return false;
              }
          }
          return true;
      } else {
          return false;
      }
  }
  function typeOf(value) {
      if (value === null) {
          return NullType;
      } else if (typeof value === 'string') {
          return StringType;
      } else if (typeof value === 'boolean') {
          return BooleanType;
      } else if (typeof value === 'number') {
          return NumberType;
      } else if (value instanceof Color) {
          return ColorType;
      } else if (value instanceof Collator) {
          return CollatorType;
      } else if (value instanceof Formatted) {
          return FormattedType;
      } else if (value instanceof ResolvedImage) {
          return ResolvedImageType;
      } else if (Array.isArray(value)) {
          const length = value.length;
          let itemType;
          for (const item of value) {
              const t = typeOf(item);
              if (!itemType) {
                  itemType = t;
              } else if (itemType === t) {
                  continue;
              } else {
                  itemType = ValueType;
                  break;
              }
          }
          return array(itemType || ValueType, length);
      } else {
          return ObjectType;
      }
  }
  function toString$1(value) {
      const type = typeof value;
      if (value === null) {
          return '';
      } else if (type === 'string' || type === 'number' || type === 'boolean') {
          return String(value);
      } else if (value instanceof Color || value instanceof Formatted || value instanceof ResolvedImage) {
          return value.toString();
      } else {
          return JSON.stringify(value);
      }
  }

  class Literal {
      constructor(type, value) {
          this.type = type;
          this.value = value;
      }
      static parse(args, context) {
          if (args.length !== 2)
              return context.error(`'literal' expression requires exactly one argument, but found ${ args.length - 1 } instead.`);
          if (!isValue(args[1]))
              return context.error(`invalid value`);
          const value = args[1];
          let type = typeOf(value);
          const expected = context.expectedType;
          if (type.kind === 'array' && type.N === 0 && expected && expected.kind === 'array' && (typeof expected.N !== 'number' || expected.N === 0)) {
              type = expected;
          }
          return new Literal(type, value);
      }
      evaluate() {
          return this.value;
      }
      eachChild() {
      }
      outputDefined() {
          return true;
      }
      serialize() {
          if (this.type.kind === 'array' || this.type.kind === 'object') {
              return [
                  'literal',
                  this.value
              ];
          } else if (this.value instanceof Color) {
              return ['rgba'].concat(this.value.toArray());
          } else if (this.value instanceof Formatted) {
              return this.value.serialize();
          } else {
              return this.value;
          }
      }
  }

  class RuntimeError {
      constructor(message) {
          this.name = 'ExpressionEvaluationError';
          this.message = message;
      }
      toJSON() {
          return this.message;
      }
  }

  const types = {
      string: StringType,
      number: NumberType,
      boolean: BooleanType,
      object: ObjectType
  };
  class Assertion {
      constructor(type, args) {
          this.type = type;
          this.args = args;
      }
      static parse(args, context) {
          if (args.length < 2)
              return context.error(`Expected at least one argument.`);
          let i = 1;
          let type;
          const name = args[0];
          if (name === 'array') {
              let itemType;
              if (args.length > 2) {
                  const type = args[1];
                  if (typeof type !== 'string' || !(type in types) || type === 'object')
                      return context.error('The item type argument of "array" must be one of string, number, boolean', 1);
                  itemType = types[type];
                  i++;
              } else {
                  itemType = ValueType;
              }
              let N;
              if (args.length > 3) {
                  if (args[2] !== null && (typeof args[2] !== 'number' || args[2] < 0 || args[2] !== Math.floor(args[2]))) {
                      return context.error('The length argument to "array" must be a positive integer literal', 2);
                  }
                  N = args[2];
                  i++;
              }
              type = array(itemType, N);
          } else {
              type = types[name];
          }
          const parsed = [];
          for (; i < args.length; i++) {
              const input = context.parse(args[i], i, ValueType);
              if (!input)
                  return null;
              parsed.push(input);
          }
          return new Assertion(type, parsed);
      }
      evaluate(ctx) {
          for (let i = 0; i < this.args.length; i++) {
              const value = this.args[i].evaluate(ctx);
              const error = checkSubtype(this.type, typeOf(value));
              if (!error) {
                  return value;
              } else if (i === this.args.length - 1) {
                  throw new RuntimeError(`Expected value to be of type ${ toString(this.type) }, but found ${ toString(typeOf(value)) } instead.`);
              }
          }
          return null;
      }
      eachChild(fn) {
          this.args.forEach(fn);
      }
      outputDefined() {
          return this.args.every(arg => arg.outputDefined());
      }
      serialize() {
          const type = this.type;
          const serialized = [type.kind];
          if (type.kind === 'array') {
              const itemType = type.itemType;
              if (itemType.kind === 'string' || itemType.kind === 'number' || itemType.kind === 'boolean') {
                  serialized.push(itemType.kind);
                  const N = type.N;
                  if (typeof N === 'number' || this.args.length > 1) {
                      serialized.push(N);
                  }
              }
          }
          return serialized.concat(this.args.map(arg => arg.serialize()));
      }
  }

  class FormatExpression {
      constructor(sections) {
          this.type = FormattedType;
          this.sections = sections;
      }
      static parse(args, context) {
          if (args.length < 2) {
              return context.error(`Expected at least one argument.`);
          }
          const firstArg = args[1];
          if (!Array.isArray(firstArg) && typeof firstArg === 'object') {
              return context.error(`First argument must be an image or text section.`);
          }
          const sections = [];
          let nextTokenMayBeObject = false;
          for (let i = 1; i <= args.length - 1; ++i) {
              const arg = args[i];
              if (nextTokenMayBeObject && typeof arg === 'object' && !Array.isArray(arg)) {
                  nextTokenMayBeObject = false;
                  let scale = null;
                  if (arg['font-scale']) {
                      scale = context.parse(arg['font-scale'], 1, NumberType);
                      if (!scale)
                          return null;
                  }
                  let font = null;
                  if (arg['text-font']) {
                      font = context.parse(arg['text-font'], 1, array(StringType));
                      if (!font)
                          return null;
                  }
                  let textColor = null;
                  if (arg['text-color']) {
                      textColor = context.parse(arg['text-color'], 1, ColorType);
                      if (!textColor)
                          return null;
                  }
                  const lastExpression = sections[sections.length - 1];
                  lastExpression.scale = scale;
                  lastExpression.font = font;
                  lastExpression.textColor = textColor;
              } else {
                  const content = context.parse(args[i], 1, ValueType);
                  if (!content)
                      return null;
                  const kind = content.type.kind;
                  if (kind !== 'string' && kind !== 'value' && kind !== 'null' && kind !== 'resolvedImage')
                      return context.error(`Formatted text type must be 'string', 'value', 'image' or 'null'.`);
                  nextTokenMayBeObject = true;
                  sections.push({
                      content,
                      scale: null,
                      font: null,
                      textColor: null
                  });
              }
          }
          return new FormatExpression(sections);
      }
      evaluate(ctx) {
          const evaluateSection = section => {
              const evaluatedContent = section.content.evaluate(ctx);
              if (typeOf(evaluatedContent) === ResolvedImageType) {
                  return new FormattedSection('', evaluatedContent, null, null, null);
              }
              return new FormattedSection(toString$1(evaluatedContent), null, section.scale ? section.scale.evaluate(ctx) : null, section.font ? section.font.evaluate(ctx).join(',') : null, section.textColor ? section.textColor.evaluate(ctx) : null);
          };
          return new Formatted(this.sections.map(evaluateSection));
      }
      eachChild(fn) {
          for (const section of this.sections) {
              fn(section.content);
              if (section.scale) {
                  fn(section.scale);
              }
              if (section.font) {
                  fn(section.font);
              }
              if (section.textColor) {
                  fn(section.textColor);
              }
          }
      }
      outputDefined() {
          return false;
      }
      serialize() {
          const serialized = ['format'];
          for (const section of this.sections) {
              serialized.push(section.content.serialize());
              const options = {};
              if (section.scale) {
                  options['font-scale'] = section.scale.serialize();
              }
              if (section.font) {
                  options['text-font'] = section.font.serialize();
              }
              if (section.textColor) {
                  options['text-color'] = section.textColor.serialize();
              }
              serialized.push(options);
          }
          return serialized;
      }
  }

  class ImageExpression {
      constructor(input) {
          this.type = ResolvedImageType;
          this.input = input;
      }
      static parse(args, context) {
          if (args.length !== 2) {
              return context.error(`Expected two arguments.`);
          }
          const name = context.parse(args[1], 1, StringType);
          if (!name)
              return context.error(`No image name provided.`);
          return new ImageExpression(name);
      }
      evaluate(ctx) {
          const evaluatedImageName = this.input.evaluate(ctx);
          const value = ResolvedImage.fromString(evaluatedImageName);
          if (value && ctx.availableImages)
              value.available = ctx.availableImages.indexOf(evaluatedImageName) > -1;
          return value;
      }
      eachChild(fn) {
          fn(this.input);
      }
      outputDefined() {
          return false;
      }
      serialize() {
          return [
              'image',
              this.input.serialize()
          ];
      }
  }

  const types$1 = {
      'to-boolean': BooleanType,
      'to-color': ColorType,
      'to-number': NumberType,
      'to-string': StringType
  };
  class Coercion {
      constructor(type, args) {
          this.type = type;
          this.args = args;
      }
      static parse(args, context) {
          if (args.length < 2)
              return context.error(`Expected at least one argument.`);
          const name = args[0];
          if ((name === 'to-boolean' || name === 'to-string') && args.length !== 2)
              return context.error(`Expected one argument.`);
          const type = types$1[name];
          const parsed = [];
          for (let i = 1; i < args.length; i++) {
              const input = context.parse(args[i], i, ValueType);
              if (!input)
                  return null;
              parsed.push(input);
          }
          return new Coercion(type, parsed);
      }
      evaluate(ctx) {
          if (this.type.kind === 'boolean') {
              return Boolean(this.args[0].evaluate(ctx));
          } else if (this.type.kind === 'color') {
              let input;
              let error;
              for (const arg of this.args) {
                  input = arg.evaluate(ctx);
                  error = null;
                  if (input instanceof Color) {
                      return input;
                  } else if (typeof input === 'string') {
                      const c = ctx.parseColor(input);
                      if (c)
                          return c;
                  } else if (Array.isArray(input)) {
                      if (input.length < 3 || input.length > 4) {
                          error = `Invalid rbga value ${ JSON.stringify(input) }: expected an array containing either three or four numeric values.`;
                      } else {
                          error = validateRGBA(input[0], input[1], input[2], input[3]);
                      }
                      if (!error) {
                          return new Color(input[0] / 255, input[1] / 255, input[2] / 255, input[3]);
                      }
                  }
              }
              throw new RuntimeError(error || `Could not parse color from value '${ typeof input === 'string' ? input : String(JSON.stringify(input)) }'`);
          } else if (this.type.kind === 'number') {
              let value = null;
              for (const arg of this.args) {
                  value = arg.evaluate(ctx);
                  if (value === null)
                      return 0;
                  const num = Number(value);
                  if (isNaN(num))
                      continue;
                  return num;
              }
              throw new RuntimeError(`Could not convert ${ JSON.stringify(value) } to number.`);
          } else if (this.type.kind === 'formatted') {
              return Formatted.fromString(toString$1(this.args[0].evaluate(ctx)));
          } else if (this.type.kind === 'resolvedImage') {
              return ResolvedImage.fromString(toString$1(this.args[0].evaluate(ctx)));
          } else {
              return toString$1(this.args[0].evaluate(ctx));
          }
      }
      eachChild(fn) {
          this.args.forEach(fn);
      }
      outputDefined() {
          return this.args.every(arg => arg.outputDefined());
      }
      serialize() {
          if (this.type.kind === 'formatted') {
              return new FormatExpression([{
                      content: this.args[0],
                      scale: null,
                      font: null,
                      textColor: null
                  }]).serialize();
          }
          if (this.type.kind === 'resolvedImage') {
              return new ImageExpression(this.args[0]).serialize();
          }
          const serialized = [`to-${ this.type.kind }`];
          this.eachChild(child => {
              serialized.push(child.serialize());
          });
          return serialized;
      }
  }

  const geometryTypes = [
      'Unknown',
      'Point',
      'LineString',
      'Polygon'
  ];
  class EvaluationContext {
      constructor() {
          this.globals = null;
          this.feature = null;
          this.featureState = null;
          this.formattedSection = null;
          this._parseColorCache = {};
          this.availableImages = null;
          this.canonical = null;
      }
      id() {
          return this.feature && 'id' in this.feature ? this.feature.id : null;
      }
      geometryType() {
          return this.feature ? typeof this.feature.type === 'number' ? geometryTypes[this.feature.type] : this.feature.type : null;
      }
      geometry() {
          return this.feature && 'geometry' in this.feature ? this.feature.geometry : null;
      }
      canonicalID() {
          return this.canonical;
      }
      properties() {
          return this.feature && this.feature.properties || {};
      }
      parseColor(input) {
          let cached = this._parseColorCache[input];
          if (!cached) {
              cached = this._parseColorCache[input] = Color.parse(input);
          }
          return cached;
      }
  }

  class CompoundExpression {
      constructor(name, type, evaluate, args) {
          this.name = name;
          this.type = type;
          this._evaluate = evaluate;
          this.args = args;
      }
      evaluate(ctx) {
          return this._evaluate(ctx, this.args);
      }
      eachChild(fn) {
          this.args.forEach(fn);
      }
      outputDefined() {
          return false;
      }
      serialize() {
          return [this.name].concat(this.args.map(arg => arg.serialize()));
      }
      static parse(args, context) {
          const op = args[0];
          const definition = CompoundExpression.definitions[op];
          if (!definition) {
              return context.error(`Unknown expression "${ op }". If you wanted a literal array, use ["literal", [...]].`, 0);
          }
          const type = Array.isArray(definition) ? definition[0] : definition.type;
          const availableOverloads = Array.isArray(definition) ? [[
                  definition[1],
                  definition[2]
              ]] : definition.overloads;
          const overloads = availableOverloads.filter(([signature]) => !Array.isArray(signature) || signature.length === args.length - 1);
          let signatureContext = null;
          for (const [params, evaluate] of overloads) {
              signatureContext = new ParsingContext(context.registry, context.path, null, context.scope);
              const parsedArgs = [];
              let argParseFailed = false;
              for (let i = 1; i < args.length; i++) {
                  const arg = args[i];
                  const expectedType = Array.isArray(params) ? params[i - 1] : params.type;
                  const parsed = signatureContext.parse(arg, 1 + parsedArgs.length, expectedType);
                  if (!parsed) {
                      argParseFailed = true;
                      break;
                  }
                  parsedArgs.push(parsed);
              }
              if (argParseFailed) {
                  continue;
              }
              if (Array.isArray(params)) {
                  if (params.length !== parsedArgs.length) {
                      signatureContext.error(`Expected ${ params.length } arguments, but found ${ parsedArgs.length } instead.`);
                      continue;
                  }
              }
              for (let i = 0; i < parsedArgs.length; i++) {
                  const expected = Array.isArray(params) ? params[i] : params.type;
                  const arg = parsedArgs[i];
                  signatureContext.concat(i + 1).checkSubtype(expected, arg.type);
              }
              if (signatureContext.errors.length === 0) {
                  return new CompoundExpression(op, type, evaluate, parsedArgs);
              }
          }
          if (overloads.length === 1) {
              context.errors.push(...signatureContext.errors);
          } else {
              const expected = overloads.length ? overloads : availableOverloads;
              const signatures = expected.map(([params]) => stringifySignature(params)).join(' | ');
              const actualTypes = [];
              for (let i = 1; i < args.length; i++) {
                  const parsed = context.parse(args[i], 1 + actualTypes.length);
                  if (!parsed)
                      return null;
                  actualTypes.push(toString(parsed.type));
              }
              context.error(`Expected arguments of type ${ signatures }, but found (${ actualTypes.join(', ') }) instead.`);
          }
          return null;
      }
      static register(registry, definitions) {
          CompoundExpression.definitions = definitions;
          for (const name in definitions) {
              registry[name] = CompoundExpression;
          }
      }
  }
  function stringifySignature(signature) {
      if (Array.isArray(signature)) {
          return `(${ signature.map(toString).join(', ') })`;
      } else {
          return `(${ toString(signature.type) }...)`;
      }
  }

  class CollatorExpression {
      constructor(caseSensitive, diacriticSensitive, locale) {
          this.type = CollatorType;
          this.locale = locale;
          this.caseSensitive = caseSensitive;
          this.diacriticSensitive = diacriticSensitive;
      }
      static parse(args, context) {
          if (args.length !== 2)
              return context.error(`Expected one argument.`);
          const options = args[1];
          if (typeof options !== 'object' || Array.isArray(options))
              return context.error(`Collator options argument must be an object.`);
          const caseSensitive = context.parse(options['case-sensitive'] === undefined ? false : options['case-sensitive'], 1, BooleanType);
          if (!caseSensitive)
              return null;
          const diacriticSensitive = context.parse(options['diacritic-sensitive'] === undefined ? false : options['diacritic-sensitive'], 1, BooleanType);
          if (!diacriticSensitive)
              return null;
          let locale = null;
          if (options['locale']) {
              locale = context.parse(options['locale'], 1, StringType);
              if (!locale)
                  return null;
          }
          return new CollatorExpression(caseSensitive, diacriticSensitive, locale);
      }
      evaluate(ctx) {
          return new Collator(this.caseSensitive.evaluate(ctx), this.diacriticSensitive.evaluate(ctx), this.locale ? this.locale.evaluate(ctx) : null);
      }
      eachChild(fn) {
          fn(this.caseSensitive);
          fn(this.diacriticSensitive);
          if (this.locale) {
              fn(this.locale);
          }
      }
      outputDefined() {
          return false;
      }
      serialize() {
          const options = {};
          options['case-sensitive'] = this.caseSensitive.serialize();
          options['diacritic-sensitive'] = this.diacriticSensitive.serialize();
          if (this.locale) {
              options['locale'] = this.locale.serialize();
          }
          return [
              'collator',
              options
          ];
      }
  }

  const EXTENT = 8192;
  function updateBBox(bbox, coord) {
      bbox[0] = Math.min(bbox[0], coord[0]);
      bbox[1] = Math.min(bbox[1], coord[1]);
      bbox[2] = Math.max(bbox[2], coord[0]);
      bbox[3] = Math.max(bbox[3], coord[1]);
  }
  function mercatorXfromLng(lng) {
      return (180 + lng) / 360;
  }
  function mercatorYfromLat(lat) {
      return (180 - 180 / Math.PI * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360))) / 360;
  }
  function boxWithinBox(bbox1, bbox2) {
      if (bbox1[0] <= bbox2[0])
          return false;
      if (bbox1[2] >= bbox2[2])
          return false;
      if (bbox1[1] <= bbox2[1])
          return false;
      if (bbox1[3] >= bbox2[3])
          return false;
      return true;
  }
  function getTileCoordinates(p, canonical) {
      const x = mercatorXfromLng(p[0]);
      const y = mercatorYfromLat(p[1]);
      const tilesAtZoom = Math.pow(2, canonical.z);
      return [
          Math.round(x * tilesAtZoom * EXTENT),
          Math.round(y * tilesAtZoom * EXTENT)
      ];
  }
  function onBoundary(p, p1, p2) {
      const x1 = p[0] - p1[0];
      const y1 = p[1] - p1[1];
      const x2 = p[0] - p2[0];
      const y2 = p[1] - p2[1];
      return x1 * y2 - x2 * y1 === 0 && x1 * x2 <= 0 && y1 * y2 <= 0;
  }
  function rayIntersect(p, p1, p2) {
      return p1[1] > p[1] !== p2[1] > p[1] && p[0] < (p2[0] - p1[0]) * (p[1] - p1[1]) / (p2[1] - p1[1]) + p1[0];
  }
  function pointWithinPolygon(point, rings) {
      let inside = false;
      for (let i = 0, len = rings.length; i < len; i++) {
          const ring = rings[i];
          for (let j = 0, len2 = ring.length; j < len2 - 1; j++) {
              if (onBoundary(point, ring[j], ring[j + 1]))
                  return false;
              if (rayIntersect(point, ring[j], ring[j + 1]))
                  inside = !inside;
          }
      }
      return inside;
  }
  function pointWithinPolygons(point, polygons) {
      for (let i = 0; i < polygons.length; i++) {
          if (pointWithinPolygon(point, polygons[i]))
              return true;
      }
      return false;
  }
  function perp(v1, v2) {
      return v1[0] * v2[1] - v1[1] * v2[0];
  }
  function twoSided(p1, p2, q1, q2) {
      const x1 = p1[0] - q1[0];
      const y1 = p1[1] - q1[1];
      const x2 = p2[0] - q1[0];
      const y2 = p2[1] - q1[1];
      const x3 = q2[0] - q1[0];
      const y3 = q2[1] - q1[1];
      const det1 = x1 * y3 - x3 * y1;
      const det2 = x2 * y3 - x3 * y2;
      if (det1 > 0 && det2 < 0 || det1 < 0 && det2 > 0)
          return true;
      return false;
  }
  function lineIntersectLine(a, b, c, d) {
      const vectorP = [
          b[0] - a[0],
          b[1] - a[1]
      ];
      const vectorQ = [
          d[0] - c[0],
          d[1] - c[1]
      ];
      if (perp(vectorQ, vectorP) === 0)
          return false;
      if (twoSided(a, b, c, d) && twoSided(c, d, a, b))
          return true;
      return false;
  }
  function lineIntersectPolygon(p1, p2, polygon) {
      for (const ring of polygon) {
          for (let j = 0; j < ring.length - 1; ++j) {
              if (lineIntersectLine(p1, p2, ring[j], ring[j + 1])) {
                  return true;
              }
          }
      }
      return false;
  }
  function lineStringWithinPolygon(line, polygon) {
      for (let i = 0; i < line.length; ++i) {
          if (!pointWithinPolygon(line[i], polygon)) {
              return false;
          }
      }
      for (let i = 0; i < line.length - 1; ++i) {
          if (lineIntersectPolygon(line[i], line[i + 1], polygon)) {
              return false;
          }
      }
      return true;
  }
  function lineStringWithinPolygons(line, polygons) {
      for (let i = 0; i < polygons.length; i++) {
          if (lineStringWithinPolygon(line, polygons[i]))
              return true;
      }
      return false;
  }
  function getTilePolygon(coordinates, bbox, canonical) {
      const polygon = [];
      for (let i = 0; i < coordinates.length; i++) {
          const ring = [];
          for (let j = 0; j < coordinates[i].length; j++) {
              const coord = getTileCoordinates(coordinates[i][j], canonical);
              updateBBox(bbox, coord);
              ring.push(coord);
          }
          polygon.push(ring);
      }
      return polygon;
  }
  function getTilePolygons(coordinates, bbox, canonical) {
      const polygons = [];
      for (let i = 0; i < coordinates.length; i++) {
          const polygon = getTilePolygon(coordinates[i], bbox, canonical);
          polygons.push(polygon);
      }
      return polygons;
  }
  function updatePoint(p, bbox, polyBBox, worldSize) {
      if (p[0] < polyBBox[0] || p[0] > polyBBox[2]) {
          const halfWorldSize = worldSize * 0.5;
          let shift = p[0] - polyBBox[0] > halfWorldSize ? -worldSize : polyBBox[0] - p[0] > halfWorldSize ? worldSize : 0;
          if (shift === 0) {
              shift = p[0] - polyBBox[2] > halfWorldSize ? -worldSize : polyBBox[2] - p[0] > halfWorldSize ? worldSize : 0;
          }
          p[0] += shift;
      }
      updateBBox(bbox, p);
  }
  function resetBBox(bbox) {
      bbox[0] = bbox[1] = Infinity;
      bbox[2] = bbox[3] = -Infinity;
  }
  function getTilePoints(geometry, pointBBox, polyBBox, canonical) {
      const worldSize = Math.pow(2, canonical.z) * EXTENT;
      const shifts = [
          canonical.x * EXTENT,
          canonical.y * EXTENT
      ];
      const tilePoints = [];
      for (const points of geometry) {
          for (const point of points) {
              const p = [
                  point.x + shifts[0],
                  point.y + shifts[1]
              ];
              updatePoint(p, pointBBox, polyBBox, worldSize);
              tilePoints.push(p);
          }
      }
      return tilePoints;
  }
  function getTileLines(geometry, lineBBox, polyBBox, canonical) {
      const worldSize = Math.pow(2, canonical.z) * EXTENT;
      const shifts = [
          canonical.x * EXTENT,
          canonical.y * EXTENT
      ];
      const tileLines = [];
      for (const line of geometry) {
          const tileLine = [];
          for (const point of line) {
              const p = [
                  point.x + shifts[0],
                  point.y + shifts[1]
              ];
              updateBBox(lineBBox, p);
              tileLine.push(p);
          }
          tileLines.push(tileLine);
      }
      if (lineBBox[2] - lineBBox[0] <= worldSize / 2) {
          resetBBox(lineBBox);
          for (const line of tileLines) {
              for (const p of line) {
                  updatePoint(p, lineBBox, polyBBox, worldSize);
              }
          }
      }
      return tileLines;
  }
  function pointsWithinPolygons(ctx, polygonGeometry) {
      const pointBBox = [
          Infinity,
          Infinity,
          -Infinity,
          -Infinity
      ];
      const polyBBox = [
          Infinity,
          Infinity,
          -Infinity,
          -Infinity
      ];
      const canonical = ctx.canonicalID();
      if (polygonGeometry.type === 'Polygon') {
          const tilePolygon = getTilePolygon(polygonGeometry.coordinates, polyBBox, canonical);
          const tilePoints = getTilePoints(ctx.geometry(), pointBBox, polyBBox, canonical);
          if (!boxWithinBox(pointBBox, polyBBox))
              return false;
          for (const point of tilePoints) {
              if (!pointWithinPolygon(point, tilePolygon))
                  return false;
          }
      }
      if (polygonGeometry.type === 'MultiPolygon') {
          const tilePolygons = getTilePolygons(polygonGeometry.coordinates, polyBBox, canonical);
          const tilePoints = getTilePoints(ctx.geometry(), pointBBox, polyBBox, canonical);
          if (!boxWithinBox(pointBBox, polyBBox))
              return false;
          for (const point of tilePoints) {
              if (!pointWithinPolygons(point, tilePolygons))
                  return false;
          }
      }
      return true;
  }
  function linesWithinPolygons(ctx, polygonGeometry) {
      const lineBBox = [
          Infinity,
          Infinity,
          -Infinity,
          -Infinity
      ];
      const polyBBox = [
          Infinity,
          Infinity,
          -Infinity,
          -Infinity
      ];
      const canonical = ctx.canonicalID();
      if (polygonGeometry.type === 'Polygon') {
          const tilePolygon = getTilePolygon(polygonGeometry.coordinates, polyBBox, canonical);
          const tileLines = getTileLines(ctx.geometry(), lineBBox, polyBBox, canonical);
          if (!boxWithinBox(lineBBox, polyBBox))
              return false;
          for (const line of tileLines) {
              if (!lineStringWithinPolygon(line, tilePolygon))
                  return false;
          }
      }
      if (polygonGeometry.type === 'MultiPolygon') {
          const tilePolygons = getTilePolygons(polygonGeometry.coordinates, polyBBox, canonical);
          const tileLines = getTileLines(ctx.geometry(), lineBBox, polyBBox, canonical);
          if (!boxWithinBox(lineBBox, polyBBox))
              return false;
          for (const line of tileLines) {
              if (!lineStringWithinPolygons(line, tilePolygons))
                  return false;
          }
      }
      return true;
  }
  class Within {
      constructor(geojson, geometries) {
          this.type = BooleanType;
          this.geojson = geojson;
          this.geometries = geometries;
      }
      static parse(args, context) {
          if (args.length !== 2)
              return context.error(`'within' expression requires exactly one argument, but found ${ args.length - 1 } instead.`);
          if (isValue(args[1])) {
              const geojson = args[1];
              if (geojson.type === 'FeatureCollection') {
                  for (let i = 0; i < geojson.features.length; ++i) {
                      const type = geojson.features[i].geometry.type;
                      if (type === 'Polygon' || type === 'MultiPolygon') {
                          return new Within(geojson, geojson.features[i].geometry);
                      }
                  }
              } else if (geojson.type === 'Feature') {
                  const type = geojson.geometry.type;
                  if (type === 'Polygon' || type === 'MultiPolygon') {
                      return new Within(geojson, geojson.geometry);
                  }
              } else if (geojson.type === 'Polygon' || geojson.type === 'MultiPolygon') {
                  return new Within(geojson, geojson);
              }
          }
          return context.error(`'within' expression requires valid geojson object that contains polygon geometry type.`);
      }
      evaluate(ctx) {
          if (ctx.geometry() != null && ctx.canonicalID() != null) {
              if (ctx.geometryType() === 'Point') {
                  return pointsWithinPolygons(ctx, this.geometries);
              } else if (ctx.geometryType() === 'LineString') {
                  return linesWithinPolygons(ctx, this.geometries);
              }
          }
          return false;
      }
      eachChild() {
      }
      outputDefined() {
          return true;
      }
      serialize() {
          return [
              'within',
              this.geojson
          ];
      }
  }

  function isFeatureConstant(e) {
      if (e instanceof CompoundExpression) {
          if (e.name === 'get' && e.args.length === 1) {
              return false;
          } else if (e.name === 'feature-state') {
              return false;
          } else if (e.name === 'has' && e.args.length === 1) {
              return false;
          } else if (e.name === 'properties' || e.name === 'geometry-type' || e.name === 'id') {
              return false;
          } else if (/^filter-/.test(e.name)) {
              return false;
          }
      }
      if (e instanceof Within) {
          return false;
      }
      let result = true;
      e.eachChild(arg => {
          if (result && !isFeatureConstant(arg)) {
              result = false;
          }
      });
      return result;
  }
  function isStateConstant(e) {
      if (e instanceof CompoundExpression) {
          if (e.name === 'feature-state') {
              return false;
          }
      }
      let result = true;
      e.eachChild(arg => {
          if (result && !isStateConstant(arg)) {
              result = false;
          }
      });
      return result;
  }
  function isGlobalPropertyConstant(e, properties) {
      if (e instanceof CompoundExpression && properties.indexOf(e.name) >= 0) {
          return false;
      }
      let result = true;
      e.eachChild(arg => {
          if (result && !isGlobalPropertyConstant(arg, properties)) {
              result = false;
          }
      });
      return result;
  }

  class Var {
      constructor(name, boundExpression) {
          this.type = boundExpression.type;
          this.name = name;
          this.boundExpression = boundExpression;
      }
      static parse(args, context) {
          if (args.length !== 2 || typeof args[1] !== 'string')
              return context.error(`'var' expression requires exactly one string literal argument.`);
          const name = args[1];
          if (!context.scope.has(name)) {
              return context.error(`Unknown variable "${ name }". Make sure "${ name }" has been bound in an enclosing "let" expression before using it.`, 1);
          }
          return new Var(name, context.scope.get(name));
      }
      evaluate(ctx) {
          return this.boundExpression.evaluate(ctx);
      }
      eachChild() {
      }
      outputDefined() {
          return false;
      }
      serialize() {
          return [
              'var',
              this.name
          ];
      }
  }

  class ParsingContext {
      constructor(registry, path = [], expectedType, scope = new Scope(), errors = []) {
          this.registry = registry;
          this.path = path;
          this.key = path.map(part => `[${ part }]`).join('');
          this.scope = scope;
          this.errors = errors;
          this.expectedType = expectedType;
      }
      parse(expr, index, expectedType, bindings, options = {}) {
          if (index) {
              return this.concat(index, expectedType, bindings)._parse(expr, options);
          }
          return this._parse(expr, options);
      }
      _parse(expr, options) {
          if (expr === null || typeof expr === 'string' || typeof expr === 'boolean' || typeof expr === 'number') {
              expr = [
                  'literal',
                  expr
              ];
          }
          function annotate(parsed, type, typeAnnotation) {
              if (typeAnnotation === 'assert') {
                  return new Assertion(type, [parsed]);
              } else if (typeAnnotation === 'coerce') {
                  return new Coercion(type, [parsed]);
              } else {
                  return parsed;
              }
          }
          if (Array.isArray(expr)) {
              if (expr.length === 0) {
                  return this.error(`Expected an array with at least one element. If you wanted a literal array, use ["literal", []].`);
              }
              const op = expr[0];
              if (typeof op !== 'string') {
                  this.error(`Expression name must be a string, but found ${ typeof op } instead. If you wanted a literal array, use ["literal", [...]].`, 0);
                  return null;
              }
              const Expr = this.registry[op];
              if (Expr) {
                  let parsed = Expr.parse(expr, this);
                  if (!parsed)
                      return null;
                  if (this.expectedType) {
                      const expected = this.expectedType;
                      const actual = parsed.type;
                      if ((expected.kind === 'string' || expected.kind === 'number' || expected.kind === 'boolean' || expected.kind === 'object' || expected.kind === 'array') && actual.kind === 'value') {
                          parsed = annotate(parsed, expected, options.typeAnnotation || 'assert');
                      } else if ((expected.kind === 'color' || expected.kind === 'formatted' || expected.kind === 'resolvedImage') && (actual.kind === 'value' || actual.kind === 'string')) {
                          parsed = annotate(parsed, expected, options.typeAnnotation || 'coerce');
                      } else if (this.checkSubtype(expected, actual)) {
                          return null;
                      }
                  }
                  if (!(parsed instanceof Literal) && parsed.type.kind !== 'resolvedImage' && isConstant(parsed)) {
                      const ec = new EvaluationContext();
                      try {
                          parsed = new Literal(parsed.type, parsed.evaluate(ec));
                      } catch (e) {
                          this.error(e.message);
                          return null;
                      }
                  }
                  return parsed;
              }
              return this.error(`Unknown expression "${ op }". If you wanted a literal array, use ["literal", [...]].`, 0);
          } else if (typeof expr === 'undefined') {
              return this.error(`'undefined' value invalid. Use null instead.`);
          } else if (typeof expr === 'object') {
              return this.error(`Bare objects invalid. Use ["literal", {...}] instead.`);
          } else {
              return this.error(`Expected an array, but found ${ typeof expr } instead.`);
          }
      }
      concat(index, expectedType, bindings) {
          const path = typeof index === 'number' ? this.path.concat(index) : this.path;
          const scope = bindings ? this.scope.concat(bindings) : this.scope;
          return new ParsingContext(this.registry, path, expectedType || null, scope, this.errors);
      }
      error(error, ...keys) {
          const key = `${ this.key }${ keys.map(k => `[${ k }]`).join('') }`;
          this.errors.push(new ParsingError(key, error));
      }
      checkSubtype(expected, t) {
          const error = checkSubtype(expected, t);
          if (error)
              this.error(error);
          return error;
      }
  }
  function isConstant(expression) {
      if (expression instanceof Var) {
          return isConstant(expression.boundExpression);
      } else if (expression instanceof CompoundExpression && expression.name === 'error') {
          return false;
      } else if (expression instanceof CollatorExpression) {
          return false;
      } else if (expression instanceof Within) {
          return false;
      }
      const isTypeAnnotation = expression instanceof Coercion || expression instanceof Assertion;
      let childrenConstant = true;
      expression.eachChild(child => {
          if (isTypeAnnotation) {
              childrenConstant = childrenConstant && isConstant(child);
          } else {
              childrenConstant = childrenConstant && child instanceof Literal;
          }
      });
      if (!childrenConstant) {
          return false;
      }
      return isFeatureConstant(expression) && isGlobalPropertyConstant(expression, [
          'zoom',
          'heatmap-density',
          'line-progress',
          'sky-radial-progress',
          'accumulated',
          'is-supported-script'
      ]);
  }

  function findStopLessThanOrEqualTo(stops, input) {
      const lastIndex = stops.length - 1;
      let lowerIndex = 0;
      let upperIndex = lastIndex;
      let currentIndex = 0;
      let currentValue, nextValue;
      while (lowerIndex <= upperIndex) {
          currentIndex = Math.floor((lowerIndex + upperIndex) / 2);
          currentValue = stops[currentIndex];
          nextValue = stops[currentIndex + 1];
          if (currentValue <= input) {
              if (currentIndex === lastIndex || input < nextValue) {
                  return currentIndex;
              }
              lowerIndex = currentIndex + 1;
          } else if (currentValue > input) {
              upperIndex = currentIndex - 1;
          } else {
              throw new RuntimeError('Input is not a number.');
          }
      }
      return 0;
  }

  class Step {
      constructor(type, input, stops) {
          this.type = type;
          this.input = input;
          this.labels = [];
          this.outputs = [];
          for (const [label, expression] of stops) {
              this.labels.push(label);
              this.outputs.push(expression);
          }
      }
      static parse(args, context) {
          if (args.length - 1 < 4) {
              return context.error(`Expected at least 4 arguments, but found only ${ args.length - 1 }.`);
          }
          if ((args.length - 1) % 2 !== 0) {
              return context.error(`Expected an even number of arguments.`);
          }
          const input = context.parse(args[1], 1, NumberType);
          if (!input)
              return null;
          const stops = [];
          let outputType = null;
          if (context.expectedType && context.expectedType.kind !== 'value') {
              outputType = context.expectedType;
          }
          for (let i = 1; i < args.length; i += 2) {
              const label = i === 1 ? -Infinity : args[i];
              const value = args[i + 1];
              const labelKey = i;
              const valueKey = i + 1;
              if (typeof label !== 'number') {
                  return context.error('Input/output pairs for "step" expressions must be defined using literal numeric values (not computed expressions) for the input values.', labelKey);
              }
              if (stops.length && stops[stops.length - 1][0] >= label) {
                  return context.error('Input/output pairs for "step" expressions must be arranged with input values in strictly ascending order.', labelKey);
              }
              const parsed = context.parse(value, valueKey, outputType);
              if (!parsed)
                  return null;
              outputType = outputType || parsed.type;
              stops.push([
                  label,
                  parsed
              ]);
          }
          return new Step(outputType, input, stops);
      }
      evaluate(ctx) {
          const labels = this.labels;
          const outputs = this.outputs;
          if (labels.length === 1) {
              return outputs[0].evaluate(ctx);
          }
          const value = this.input.evaluate(ctx);
          if (value <= labels[0]) {
              return outputs[0].evaluate(ctx);
          }
          const stopCount = labels.length;
          if (value >= labels[stopCount - 1]) {
              return outputs[stopCount - 1].evaluate(ctx);
          }
          const index = findStopLessThanOrEqualTo(labels, value);
          return outputs[index].evaluate(ctx);
      }
      eachChild(fn) {
          fn(this.input);
          for (const expression of this.outputs) {
              fn(expression);
          }
      }
      outputDefined() {
          return this.outputs.every(out => out.outputDefined());
      }
      serialize() {
          const serialized = [
              'step',
              this.input.serialize()
          ];
          for (let i = 0; i < this.labels.length; i++) {
              if (i > 0) {
                  serialized.push(this.labels[i]);
              }
              serialized.push(this.outputs[i].serialize());
          }
          return serialized;
      }
  }

  /*
   * Copyright (C) 2008 Apple Inc. All Rights Reserved.
   *
   * Redistribution and use in source and binary forms, with or without
   * modification, are permitted provided that the following conditions
   * are met:
   * 1. Redistributions of source code must retain the above copyright
   *    notice, this list of conditions and the following disclaimer.
   * 2. Redistributions in binary form must reproduce the above copyright
   *    notice, this list of conditions and the following disclaimer in the
   *    documentation and/or other materials provided with the distribution.
   *
   * THIS SOFTWARE IS PROVIDED BY APPLE INC. ``AS IS'' AND ANY
   * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
   * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
   * PURPOSE ARE DISCLAIMED.  IN NO EVENT SHALL APPLE INC. OR
   * CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
   * EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
   * PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
   * PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY
   * OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
   * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
   * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
   *
   * Ported from Webkit
   * http://svn.webkit.org/repository/webkit/trunk/Source/WebCore/platform/graphics/UnitBezier.h
   */
  var unitbezier = UnitBezier;

  function UnitBezier(p1x, p1y, p2x, p2y) {
      // Calculate the polynomial coefficients, implicit first and last control points are (0,0) and (1,1).
      this.cx = 3.0 * p1x;
      this.bx = 3.0 * (p2x - p1x) - this.cx;
      this.ax = 1.0 - this.cx - this.bx;

      this.cy = 3.0 * p1y;
      this.by = 3.0 * (p2y - p1y) - this.cy;
      this.ay = 1.0 - this.cy - this.by;

      this.p1x = p1x;
      this.p1y = p2y;
      this.p2x = p2x;
      this.p2y = p2y;
  }

  UnitBezier.prototype.sampleCurveX = function(t) {
      // `ax t^3 + bx t^2 + cx t' expanded using Horner's rule.
      return ((this.ax * t + this.bx) * t + this.cx) * t;
  };

  UnitBezier.prototype.sampleCurveY = function(t) {
      return ((this.ay * t + this.by) * t + this.cy) * t;
  };

  UnitBezier.prototype.sampleCurveDerivativeX = function(t) {
      return (3.0 * this.ax * t + 2.0 * this.bx) * t + this.cx;
  };

  UnitBezier.prototype.solveCurveX = function(x, epsilon) {
      if (typeof epsilon === 'undefined') epsilon = 1e-6;

      var t0, t1, t2, x2, i;

      // First try a few iterations of Newton's method -- normally very fast.
      for (t2 = x, i = 0; i < 8; i++) {

          x2 = this.sampleCurveX(t2) - x;
          if (Math.abs(x2) < epsilon) return t2;

          var d2 = this.sampleCurveDerivativeX(t2);
          if (Math.abs(d2) < 1e-6) break;

          t2 = t2 - x2 / d2;
      }

      // Fall back to the bisection method for reliability.
      t0 = 0.0;
      t1 = 1.0;
      t2 = x;

      if (t2 < t0) return t0;
      if (t2 > t1) return t1;

      while (t0 < t1) {

          x2 = this.sampleCurveX(t2);
          if (Math.abs(x2 - x) < epsilon) return t2;

          if (x > x2) {
              t0 = t2;
          } else {
              t1 = t2;
          }

          t2 = (t1 - t0) * 0.5 + t0;
      }

      // Failure.
      return t2;
  };

  UnitBezier.prototype.solve = function(x, epsilon) {
      return this.sampleCurveY(this.solveCurveX(x, epsilon));
  };

  function number(a, b, t) {
      return a * (1 - t) + b * t;
  }
  function color(from, to, t) {
      return new Color(number(from.r, to.r, t), number(from.g, to.g, t), number(from.b, to.b, t), number(from.a, to.a, t));
  }
  function array$1(from, to, t) {
      return from.map((d, i) => {
          return number(d, to[i], t);
      });
  }

  var interpolate = /*#__PURE__*/Object.freeze({
    __proto__: null,
    number: number,
    color: color,
    array: array$1
  });

  const Xn = 0.95047, Yn = 1, Zn = 1.08883, t0 = 4 / 29, t1 = 6 / 29, t2 = 3 * t1 * t1, t3 = t1 * t1 * t1, deg2rad = Math.PI / 180, rad2deg = 180 / Math.PI;
  function xyz2lab(t) {
      return t > t3 ? Math.pow(t, 1 / 3) : t / t2 + t0;
  }
  function lab2xyz(t) {
      return t > t1 ? t * t * t : t2 * (t - t0);
  }
  function xyz2rgb(x) {
      return 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
  }
  function rgb2xyz(x) {
      x /= 255;
      return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  }
  function rgbToLab(rgbColor) {
      const b = rgb2xyz(rgbColor.r), a = rgb2xyz(rgbColor.g), l = rgb2xyz(rgbColor.b), x = xyz2lab((0.4124564 * b + 0.3575761 * a + 0.1804375 * l) / Xn), y = xyz2lab((0.2126729 * b + 0.7151522 * a + 0.072175 * l) / Yn), z = xyz2lab((0.0193339 * b + 0.119192 * a + 0.9503041 * l) / Zn);
      return {
          l: 116 * y - 16,
          a: 500 * (x - y),
          b: 200 * (y - z),
          alpha: rgbColor.a
      };
  }
  function labToRgb(labColor) {
      let y = (labColor.l + 16) / 116, x = isNaN(labColor.a) ? y : y + labColor.a / 500, z = isNaN(labColor.b) ? y : y - labColor.b / 200;
      y = Yn * lab2xyz(y);
      x = Xn * lab2xyz(x);
      z = Zn * lab2xyz(z);
      return new Color(xyz2rgb(3.2404542 * x - 1.5371385 * y - 0.4985314 * z), xyz2rgb(-0.969266 * x + 1.8760108 * y + 0.041556 * z), xyz2rgb(0.0556434 * x - 0.2040259 * y + 1.0572252 * z), labColor.alpha);
  }
  function interpolateLab(from, to, t) {
      return {
          l: number(from.l, to.l, t),
          a: number(from.a, to.a, t),
          b: number(from.b, to.b, t),
          alpha: number(from.alpha, to.alpha, t)
      };
  }
  function rgbToHcl(rgbColor) {
      const {l, a, b} = rgbToLab(rgbColor);
      const h = Math.atan2(b, a) * rad2deg;
      return {
          h: h < 0 ? h + 360 : h,
          c: Math.sqrt(a * a + b * b),
          l,
          alpha: rgbColor.a
      };
  }
  function hclToRgb(hclColor) {
      const h = hclColor.h * deg2rad, c = hclColor.c, l = hclColor.l;
      return labToRgb({
          l,
          a: Math.cos(h) * c,
          b: Math.sin(h) * c,
          alpha: hclColor.alpha
      });
  }
  function interpolateHue(a, b, t) {
      const d = b - a;
      return a + t * (d > 180 || d < -180 ? d - 360 * Math.round(d / 360) : d);
  }
  function interpolateHcl(from, to, t) {
      return {
          h: interpolateHue(from.h, to.h, t),
          c: number(from.c, to.c, t),
          l: number(from.l, to.l, t),
          alpha: number(from.alpha, to.alpha, t)
      };
  }
  const lab = {
      forward: rgbToLab,
      reverse: labToRgb,
      interpolate: interpolateLab
  };
  const hcl = {
      forward: rgbToHcl,
      reverse: hclToRgb,
      interpolate: interpolateHcl
  };

  var colorSpaces = /*#__PURE__*/Object.freeze({
    __proto__: null,
    lab: lab,
    hcl: hcl
  });

  class Interpolate {
      constructor(type, operator, interpolation, input, stops) {
          this.type = type;
          this.operator = operator;
          this.interpolation = interpolation;
          this.input = input;
          this.labels = [];
          this.outputs = [];
          for (const [label, expression] of stops) {
              this.labels.push(label);
              this.outputs.push(expression);
          }
      }
      static interpolationFactor(interpolation, input, lower, upper) {
          let t = 0;
          if (interpolation.name === 'exponential') {
              t = exponentialInterpolation(input, interpolation.base, lower, upper);
          } else if (interpolation.name === 'linear') {
              t = exponentialInterpolation(input, 1, lower, upper);
          } else if (interpolation.name === 'cubic-bezier') {
              const c = interpolation.controlPoints;
              const ub = new unitbezier(c[0], c[1], c[2], c[3]);
              t = ub.solve(exponentialInterpolation(input, 1, lower, upper));
          }
          return t;
      }
      static parse(args, context) {
          let [operator, interpolation, input, ...rest] = args;
          if (!Array.isArray(interpolation) || interpolation.length === 0) {
              return context.error(`Expected an interpolation type expression.`, 1);
          }
          if (interpolation[0] === 'linear') {
              interpolation = { name: 'linear' };
          } else if (interpolation[0] === 'exponential') {
              const base = interpolation[1];
              if (typeof base !== 'number')
                  return context.error(`Exponential interpolation requires a numeric base.`, 1, 1);
              interpolation = {
                  name: 'exponential',
                  base
              };
          } else if (interpolation[0] === 'cubic-bezier') {
              const controlPoints = interpolation.slice(1);
              if (controlPoints.length !== 4 || controlPoints.some(t => typeof t !== 'number' || t < 0 || t > 1)) {
                  return context.error('Cubic bezier interpolation requires four numeric arguments with values between 0 and 1.', 1);
              }
              interpolation = {
                  name: 'cubic-bezier',
                  controlPoints: controlPoints
              };
          } else {
              return context.error(`Unknown interpolation type ${ String(interpolation[0]) }`, 1, 0);
          }
          if (args.length - 1 < 4) {
              return context.error(`Expected at least 4 arguments, but found only ${ args.length - 1 }.`);
          }
          if ((args.length - 1) % 2 !== 0) {
              return context.error(`Expected an even number of arguments.`);
          }
          input = context.parse(input, 2, NumberType);
          if (!input)
              return null;
          const stops = [];
          let outputType = null;
          if (operator === 'interpolate-hcl' || operator === 'interpolate-lab') {
              outputType = ColorType;
          } else if (context.expectedType && context.expectedType.kind !== 'value') {
              outputType = context.expectedType;
          }
          for (let i = 0; i < rest.length; i += 2) {
              const label = rest[i];
              const value = rest[i + 1];
              const labelKey = i + 3;
              const valueKey = i + 4;
              if (typeof label !== 'number') {
                  return context.error('Input/output pairs for "interpolate" expressions must be defined using literal numeric values (not computed expressions) for the input values.', labelKey);
              }
              if (stops.length && stops[stops.length - 1][0] >= label) {
                  return context.error('Input/output pairs for "interpolate" expressions must be arranged with input values in strictly ascending order.', labelKey);
              }
              const parsed = context.parse(value, valueKey, outputType);
              if (!parsed)
                  return null;
              outputType = outputType || parsed.type;
              stops.push([
                  label,
                  parsed
              ]);
          }
          if (outputType.kind !== 'number' && outputType.kind !== 'color' && !(outputType.kind === 'array' && outputType.itemType.kind === 'number' && typeof outputType.N === 'number')) {
              return context.error(`Type ${ toString(outputType) } is not interpolatable.`);
          }
          return new Interpolate(outputType, operator, interpolation, input, stops);
      }
      evaluate(ctx) {
          const labels = this.labels;
          const outputs = this.outputs;
          if (labels.length === 1) {
              return outputs[0].evaluate(ctx);
          }
          const value = this.input.evaluate(ctx);
          if (value <= labels[0]) {
              return outputs[0].evaluate(ctx);
          }
          const stopCount = labels.length;
          if (value >= labels[stopCount - 1]) {
              return outputs[stopCount - 1].evaluate(ctx);
          }
          const index = findStopLessThanOrEqualTo(labels, value);
          const lower = labels[index];
          const upper = labels[index + 1];
          const t = Interpolate.interpolationFactor(this.interpolation, value, lower, upper);
          const outputLower = outputs[index].evaluate(ctx);
          const outputUpper = outputs[index + 1].evaluate(ctx);
          if (this.operator === 'interpolate') {
              return interpolate[this.type.kind.toLowerCase()](outputLower, outputUpper, t);
          } else if (this.operator === 'interpolate-hcl') {
              return hcl.reverse(hcl.interpolate(hcl.forward(outputLower), hcl.forward(outputUpper), t));
          } else {
              return lab.reverse(lab.interpolate(lab.forward(outputLower), lab.forward(outputUpper), t));
          }
      }
      eachChild(fn) {
          fn(this.input);
          for (const expression of this.outputs) {
              fn(expression);
          }
      }
      outputDefined() {
          return this.outputs.every(out => out.outputDefined());
      }
      serialize() {
          let interpolation;
          if (this.interpolation.name === 'linear') {
              interpolation = ['linear'];
          } else if (this.interpolation.name === 'exponential') {
              if (this.interpolation.base === 1) {
                  interpolation = ['linear'];
              } else {
                  interpolation = [
                      'exponential',
                      this.interpolation.base
                  ];
              }
          } else {
              interpolation = ['cubic-bezier'].concat(this.interpolation.controlPoints);
          }
          const serialized = [
              this.operator,
              interpolation,
              this.input.serialize()
          ];
          for (let i = 0; i < this.labels.length; i++) {
              serialized.push(this.labels[i], this.outputs[i].serialize());
          }
          return serialized;
      }
  }
  function exponentialInterpolation(input, base, lowerValue, upperValue) {
      const difference = upperValue - lowerValue;
      const progress = input - lowerValue;
      if (difference === 0) {
          return 0;
      } else if (base === 1) {
          return progress / difference;
      } else {
          return (Math.pow(base, progress) - 1) / (Math.pow(base, difference) - 1);
      }
  }

  class Coalesce {
      constructor(type, args) {
          this.type = type;
          this.args = args;
      }
      static parse(args, context) {
          if (args.length < 2) {
              return context.error('Expectected at least one argument.');
          }
          let outputType = null;
          const expectedType = context.expectedType;
          if (expectedType && expectedType.kind !== 'value') {
              outputType = expectedType;
          }
          const parsedArgs = [];
          for (const arg of args.slice(1)) {
              const parsed = context.parse(arg, 1 + parsedArgs.length, outputType, undefined, { typeAnnotation: 'omit' });
              if (!parsed)
                  return null;
              outputType = outputType || parsed.type;
              parsedArgs.push(parsed);
          }
          const needsAnnotation = expectedType && parsedArgs.some(arg => checkSubtype(expectedType, arg.type));
          return needsAnnotation ? new Coalesce(ValueType, parsedArgs) : new Coalesce(outputType, parsedArgs);
      }
      evaluate(ctx) {
          let result = null;
          let argCount = 0;
          let requestedImageName;
          for (const arg of this.args) {
              argCount++;
              result = arg.evaluate(ctx);
              if (result && result instanceof ResolvedImage && !result.available) {
                  if (!requestedImageName) {
                      requestedImageName = result.name;
                  }
                  result = null;
                  if (argCount === this.args.length) {
                      result = requestedImageName;
                  }
              }
              if (result !== null)
                  break;
          }
          return result;
      }
      eachChild(fn) {
          this.args.forEach(fn);
      }
      outputDefined() {
          return this.args.every(arg => arg.outputDefined());
      }
      serialize() {
          const serialized = ['coalesce'];
          this.eachChild(child => {
              serialized.push(child.serialize());
          });
          return serialized;
      }
  }

  class Let {
      constructor(bindings, result) {
          this.type = result.type;
          this.bindings = [].concat(bindings);
          this.result = result;
      }
      evaluate(ctx) {
          return this.result.evaluate(ctx);
      }
      eachChild(fn) {
          for (const binding of this.bindings) {
              fn(binding[1]);
          }
          fn(this.result);
      }
      static parse(args, context) {
          if (args.length < 4)
              return context.error(`Expected at least 3 arguments, but found ${ args.length - 1 } instead.`);
          const bindings = [];
          for (let i = 1; i < args.length - 1; i += 2) {
              const name = args[i];
              if (typeof name !== 'string') {
                  return context.error(`Expected string, but found ${ typeof name } instead.`, i);
              }
              if (/[^a-zA-Z0-9_]/.test(name)) {
                  return context.error(`Variable names must contain only alphanumeric characters or '_'.`, i);
              }
              const value = context.parse(args[i + 1], i + 1);
              if (!value)
                  return null;
              bindings.push([
                  name,
                  value
              ]);
          }
          const result = context.parse(args[args.length - 1], args.length - 1, context.expectedType, bindings);
          if (!result)
              return null;
          return new Let(bindings, result);
      }
      outputDefined() {
          return this.result.outputDefined();
      }
      serialize() {
          const serialized = ['let'];
          for (const [name, expr] of this.bindings) {
              serialized.push(name, expr.serialize());
          }
          serialized.push(this.result.serialize());
          return serialized;
      }
  }

  class At {
      constructor(type, index, input) {
          this.type = type;
          this.index = index;
          this.input = input;
      }
      static parse(args, context) {
          if (args.length !== 3)
              return context.error(`Expected 2 arguments, but found ${ args.length - 1 } instead.`);
          const index = context.parse(args[1], 1, NumberType);
          const input = context.parse(args[2], 2, array(context.expectedType || ValueType));
          if (!index || !input)
              return null;
          const t = input.type;
          return new At(t.itemType, index, input);
      }
      evaluate(ctx) {
          const index = this.index.evaluate(ctx);
          const array = this.input.evaluate(ctx);
          if (index < 0) {
              throw new RuntimeError(`Array index out of bounds: ${ index } < 0.`);
          }
          if (index >= array.length) {
              throw new RuntimeError(`Array index out of bounds: ${ index } > ${ array.length - 1 }.`);
          }
          if (index !== Math.floor(index)) {
              throw new RuntimeError(`Array index must be an integer, but found ${ index } instead.`);
          }
          return array[index];
      }
      eachChild(fn) {
          fn(this.index);
          fn(this.input);
      }
      outputDefined() {
          return false;
      }
      serialize() {
          return [
              'at',
              this.index.serialize(),
              this.input.serialize()
          ];
      }
  }

  class In {
      constructor(needle, haystack) {
          this.type = BooleanType;
          this.needle = needle;
          this.haystack = haystack;
      }
      static parse(args, context) {
          if (args.length !== 3) {
              return context.error(`Expected 2 arguments, but found ${ args.length - 1 } instead.`);
          }
          const needle = context.parse(args[1], 1, ValueType);
          const haystack = context.parse(args[2], 2, ValueType);
          if (!needle || !haystack)
              return null;
          if (!isValidType(needle.type, [
                  BooleanType,
                  StringType,
                  NumberType,
                  NullType,
                  ValueType
              ])) {
              return context.error(`Expected first argument to be of type boolean, string, number or null, but found ${ toString(needle.type) } instead`);
          }
          return new In(needle, haystack);
      }
      evaluate(ctx) {
          const needle = this.needle.evaluate(ctx);
          const haystack = this.haystack.evaluate(ctx);
          if (!haystack)
              return false;
          if (!isValidNativeType(needle, [
                  'boolean',
                  'string',
                  'number',
                  'null'
              ])) {
              throw new RuntimeError(`Expected first argument to be of type boolean, string, number or null, but found ${ toString(typeOf(needle)) } instead.`);
          }
          if (!isValidNativeType(haystack, [
                  'string',
                  'array'
              ])) {
              throw new RuntimeError(`Expected second argument to be of type array or string, but found ${ toString(typeOf(haystack)) } instead.`);
          }
          return haystack.indexOf(needle) >= 0;
      }
      eachChild(fn) {
          fn(this.needle);
          fn(this.haystack);
      }
      outputDefined() {
          return true;
      }
      serialize() {
          return [
              'in',
              this.needle.serialize(),
              this.haystack.serialize()
          ];
      }
  }

  class IndexOf {
      constructor(needle, haystack, fromIndex) {
          this.type = NumberType;
          this.needle = needle;
          this.haystack = haystack;
          this.fromIndex = fromIndex;
      }
      static parse(args, context) {
          if (args.length <= 2 || args.length >= 5) {
              return context.error(`Expected 3 or 4 arguments, but found ${ args.length - 1 } instead.`);
          }
          const needle = context.parse(args[1], 1, ValueType);
          const haystack = context.parse(args[2], 2, ValueType);
          if (!needle || !haystack)
              return null;
          if (!isValidType(needle.type, [
                  BooleanType,
                  StringType,
                  NumberType,
                  NullType,
                  ValueType
              ])) {
              return context.error(`Expected first argument to be of type boolean, string, number or null, but found ${ toString(needle.type) } instead`);
          }
          if (args.length === 4) {
              const fromIndex = context.parse(args[3], 3, NumberType);
              if (!fromIndex)
                  return null;
              return new IndexOf(needle, haystack, fromIndex);
          } else {
              return new IndexOf(needle, haystack);
          }
      }
      evaluate(ctx) {
          const needle = this.needle.evaluate(ctx);
          const haystack = this.haystack.evaluate(ctx);
          if (!isValidNativeType(needle, [
                  'boolean',
                  'string',
                  'number',
                  'null'
              ])) {
              throw new RuntimeError(`Expected first argument to be of type boolean, string, number or null, but found ${ toString(typeOf(needle)) } instead.`);
          }
          if (!isValidNativeType(haystack, [
                  'string',
                  'array'
              ])) {
              throw new RuntimeError(`Expected second argument to be of type array or string, but found ${ toString(typeOf(haystack)) } instead.`);
          }
          if (this.fromIndex) {
              const fromIndex = this.fromIndex.evaluate(ctx);
              return haystack.indexOf(needle, fromIndex);
          }
          return haystack.indexOf(needle);
      }
      eachChild(fn) {
          fn(this.needle);
          fn(this.haystack);
          if (this.fromIndex) {
              fn(this.fromIndex);
          }
      }
      outputDefined() {
          return false;
      }
      serialize() {
          if (this.fromIndex != null && this.fromIndex !== undefined) {
              const fromIndex = this.fromIndex.serialize();
              return [
                  'index-of',
                  this.needle.serialize(),
                  this.haystack.serialize(),
                  fromIndex
              ];
          }
          return [
              'index-of',
              this.needle.serialize(),
              this.haystack.serialize()
          ];
      }
  }

  class Match {
      constructor(inputType, outputType, input, cases, outputs, otherwise) {
          this.inputType = inputType;
          this.type = outputType;
          this.input = input;
          this.cases = cases;
          this.outputs = outputs;
          this.otherwise = otherwise;
      }
      static parse(args, context) {
          if (args.length < 5)
              return context.error(`Expected at least 4 arguments, but found only ${ args.length - 1 }.`);
          if (args.length % 2 !== 1)
              return context.error(`Expected an even number of arguments.`);
          let inputType;
          let outputType;
          if (context.expectedType && context.expectedType.kind !== 'value') {
              outputType = context.expectedType;
          }
          const cases = {};
          const outputs = [];
          for (let i = 2; i < args.length - 1; i += 2) {
              let labels = args[i];
              const value = args[i + 1];
              if (!Array.isArray(labels)) {
                  labels = [labels];
              }
              const labelContext = context.concat(i);
              if (labels.length === 0) {
                  return labelContext.error('Expected at least one branch label.');
              }
              for (const label of labels) {
                  if (typeof label !== 'number' && typeof label !== 'string') {
                      return labelContext.error(`Branch labels must be numbers or strings.`);
                  } else if (typeof label === 'number' && Math.abs(label) > Number.MAX_SAFE_INTEGER) {
                      return labelContext.error(`Branch labels must be integers no larger than ${ Number.MAX_SAFE_INTEGER }.`);
                  } else if (typeof label === 'number' && Math.floor(label) !== label) {
                      return labelContext.error(`Numeric branch labels must be integer values.`);
                  } else if (!inputType) {
                      inputType = typeOf(label);
                  } else if (labelContext.checkSubtype(inputType, typeOf(label))) {
                      return null;
                  }
                  if (typeof cases[String(label)] !== 'undefined') {
                      return labelContext.error('Branch labels must be unique.');
                  }
                  cases[String(label)] = outputs.length;
              }
              const result = context.parse(value, i, outputType);
              if (!result)
                  return null;
              outputType = outputType || result.type;
              outputs.push(result);
          }
          const input = context.parse(args[1], 1, ValueType);
          if (!input)
              return null;
          const otherwise = context.parse(args[args.length - 1], args.length - 1, outputType);
          if (!otherwise)
              return null;
          if (input.type.kind !== 'value' && context.concat(1).checkSubtype(inputType, input.type)) {
              return null;
          }
          return new Match(inputType, outputType, input, cases, outputs, otherwise);
      }
      evaluate(ctx) {
          const input = this.input.evaluate(ctx);
          const output = typeOf(input) === this.inputType && this.outputs[this.cases[input]] || this.otherwise;
          return output.evaluate(ctx);
      }
      eachChild(fn) {
          fn(this.input);
          this.outputs.forEach(fn);
          fn(this.otherwise);
      }
      outputDefined() {
          return this.outputs.every(out => out.outputDefined()) && this.otherwise.outputDefined();
      }
      serialize() {
          const serialized = [
              'match',
              this.input.serialize()
          ];
          const sortedLabels = Object.keys(this.cases).sort();
          const groupedByOutput = [];
          const outputLookup = {};
          for (const label of sortedLabels) {
              const outputIndex = outputLookup[this.cases[label]];
              if (outputIndex === undefined) {
                  outputLookup[this.cases[label]] = groupedByOutput.length;
                  groupedByOutput.push([
                      this.cases[label],
                      [label]
                  ]);
              } else {
                  groupedByOutput[outputIndex][1].push(label);
              }
          }
          const coerceLabel = label => this.inputType.kind === 'number' ? Number(label) : label;
          for (const [outputIndex, labels] of groupedByOutput) {
              if (labels.length === 1) {
                  serialized.push(coerceLabel(labels[0]));
              } else {
                  serialized.push(labels.map(coerceLabel));
              }
              serialized.push(this.outputs[outputIndex].serialize());
          }
          serialized.push(this.otherwise.serialize());
          return serialized;
      }
  }

  class Case {
      constructor(type, branches, otherwise) {
          this.type = type;
          this.branches = branches;
          this.otherwise = otherwise;
      }
      static parse(args, context) {
          if (args.length < 4)
              return context.error(`Expected at least 3 arguments, but found only ${ args.length - 1 }.`);
          if (args.length % 2 !== 0)
              return context.error(`Expected an odd number of arguments.`);
          let outputType;
          if (context.expectedType && context.expectedType.kind !== 'value') {
              outputType = context.expectedType;
          }
          const branches = [];
          for (let i = 1; i < args.length - 1; i += 2) {
              const test = context.parse(args[i], i, BooleanType);
              if (!test)
                  return null;
              const result = context.parse(args[i + 1], i + 1, outputType);
              if (!result)
                  return null;
              branches.push([
                  test,
                  result
              ]);
              outputType = outputType || result.type;
          }
          const otherwise = context.parse(args[args.length - 1], args.length - 1, outputType);
          if (!otherwise)
              return null;
          return new Case(outputType, branches, otherwise);
      }
      evaluate(ctx) {
          for (const [test, expression] of this.branches) {
              if (test.evaluate(ctx)) {
                  return expression.evaluate(ctx);
              }
          }
          return this.otherwise.evaluate(ctx);
      }
      eachChild(fn) {
          for (const [test, expression] of this.branches) {
              fn(test);
              fn(expression);
          }
          fn(this.otherwise);
      }
      outputDefined() {
          return this.branches.every(([_, out]) => out.outputDefined()) && this.otherwise.outputDefined();
      }
      serialize() {
          const serialized = ['case'];
          this.eachChild(child => {
              serialized.push(child.serialize());
          });
          return serialized;
      }
  }

  class Slice {
      constructor(type, input, beginIndex, endIndex) {
          this.type = type;
          this.input = input;
          this.beginIndex = beginIndex;
          this.endIndex = endIndex;
      }
      static parse(args, context) {
          if (args.length <= 2 || args.length >= 5) {
              return context.error(`Expected 3 or 4 arguments, but found ${ args.length - 1 } instead.`);
          }
          const input = context.parse(args[1], 1, ValueType);
          const beginIndex = context.parse(args[2], 2, NumberType);
          if (!input || !beginIndex)
              return null;
          if (!isValidType(input.type, [
                  array(ValueType),
                  StringType,
                  ValueType
              ])) {
              return context.error(`Expected first argument to be of type array or string, but found ${ toString(input.type) } instead`);
          }
          if (args.length === 4) {
              const endIndex = context.parse(args[3], 3, NumberType);
              if (!endIndex)
                  return null;
              return new Slice(input.type, input, beginIndex, endIndex);
          } else {
              return new Slice(input.type, input, beginIndex);
          }
      }
      evaluate(ctx) {
          const input = this.input.evaluate(ctx);
          const beginIndex = this.beginIndex.evaluate(ctx);
          if (!isValidNativeType(input, [
                  'string',
                  'array'
              ])) {
              throw new RuntimeError(`Expected first argument to be of type array or string, but found ${ toString(typeOf(input)) } instead.`);
          }
          if (this.endIndex) {
              const endIndex = this.endIndex.evaluate(ctx);
              return input.slice(beginIndex, endIndex);
          }
          return input.slice(beginIndex);
      }
      eachChild(fn) {
          fn(this.input);
          fn(this.beginIndex);
          if (this.endIndex) {
              fn(this.endIndex);
          }
      }
      outputDefined() {
          return false;
      }
      serialize() {
          if (this.endIndex != null && this.endIndex !== undefined) {
              const endIndex = this.endIndex.serialize();
              return [
                  'slice',
                  this.input.serialize(),
                  this.beginIndex.serialize(),
                  endIndex
              ];
          }
          return [
              'slice',
              this.input.serialize(),
              this.beginIndex.serialize()
          ];
      }
  }

  function isComparableType(op, type) {
      if (op === '==' || op === '!=') {
          return type.kind === 'boolean' || type.kind === 'string' || type.kind === 'number' || type.kind === 'null' || type.kind === 'value';
      } else {
          return type.kind === 'string' || type.kind === 'number' || type.kind === 'value';
      }
  }
  function eq(ctx, a, b) {
      return a === b;
  }
  function neq(ctx, a, b) {
      return a !== b;
  }
  function lt(ctx, a, b) {
      return a < b;
  }
  function gt(ctx, a, b) {
      return a > b;
  }
  function lteq(ctx, a, b) {
      return a <= b;
  }
  function gteq(ctx, a, b) {
      return a >= b;
  }
  function eqCollate(ctx, a, b, c) {
      return c.compare(a, b) === 0;
  }
  function neqCollate(ctx, a, b, c) {
      return !eqCollate(ctx, a, b, c);
  }
  function ltCollate(ctx, a, b, c) {
      return c.compare(a, b) < 0;
  }
  function gtCollate(ctx, a, b, c) {
      return c.compare(a, b) > 0;
  }
  function lteqCollate(ctx, a, b, c) {
      return c.compare(a, b) <= 0;
  }
  function gteqCollate(ctx, a, b, c) {
      return c.compare(a, b) >= 0;
  }
  function makeComparison(op, compareBasic, compareWithCollator) {
      const isOrderComparison = op !== '==' && op !== '!=';
      return class Comparison {
          constructor(lhs, rhs, collator) {
              this.type = BooleanType;
              this.lhs = lhs;
              this.rhs = rhs;
              this.collator = collator;
              this.hasUntypedArgument = lhs.type.kind === 'value' || rhs.type.kind === 'value';
          }
          static parse(args, context) {
              if (args.length !== 3 && args.length !== 4)
                  return context.error(`Expected two or three arguments.`);
              const op = args[0];
              let lhs = context.parse(args[1], 1, ValueType);
              if (!lhs)
                  return null;
              if (!isComparableType(op, lhs.type)) {
                  return context.concat(1).error(`"${ op }" comparisons are not supported for type '${ toString(lhs.type) }'.`);
              }
              let rhs = context.parse(args[2], 2, ValueType);
              if (!rhs)
                  return null;
              if (!isComparableType(op, rhs.type)) {
                  return context.concat(2).error(`"${ op }" comparisons are not supported for type '${ toString(rhs.type) }'.`);
              }
              if (lhs.type.kind !== rhs.type.kind && lhs.type.kind !== 'value' && rhs.type.kind !== 'value') {
                  return context.error(`Cannot compare types '${ toString(lhs.type) }' and '${ toString(rhs.type) }'.`);
              }
              if (isOrderComparison) {
                  if (lhs.type.kind === 'value' && rhs.type.kind !== 'value') {
                      lhs = new Assertion(rhs.type, [lhs]);
                  } else if (lhs.type.kind !== 'value' && rhs.type.kind === 'value') {
                      rhs = new Assertion(lhs.type, [rhs]);
                  }
              }
              let collator = null;
              if (args.length === 4) {
                  if (lhs.type.kind !== 'string' && rhs.type.kind !== 'string' && lhs.type.kind !== 'value' && rhs.type.kind !== 'value') {
                      return context.error(`Cannot use collator to compare non-string types.`);
                  }
                  collator = context.parse(args[3], 3, CollatorType);
                  if (!collator)
                      return null;
              }
              return new Comparison(lhs, rhs, collator);
          }
          evaluate(ctx) {
              const lhs = this.lhs.evaluate(ctx);
              const rhs = this.rhs.evaluate(ctx);
              if (isOrderComparison && this.hasUntypedArgument) {
                  const lt = typeOf(lhs);
                  const rt = typeOf(rhs);
                  if (lt.kind !== rt.kind || !(lt.kind === 'string' || lt.kind === 'number')) {
                      throw new RuntimeError(`Expected arguments for "${ op }" to be (string, string) or (number, number), but found (${ lt.kind }, ${ rt.kind }) instead.`);
                  }
              }
              if (this.collator && !isOrderComparison && this.hasUntypedArgument) {
                  const lt = typeOf(lhs);
                  const rt = typeOf(rhs);
                  if (lt.kind !== 'string' || rt.kind !== 'string') {
                      return compareBasic(ctx, lhs, rhs);
                  }
              }
              return this.collator ? compareWithCollator(ctx, lhs, rhs, this.collator.evaluate(ctx)) : compareBasic(ctx, lhs, rhs);
          }
          eachChild(fn) {
              fn(this.lhs);
              fn(this.rhs);
              if (this.collator) {
                  fn(this.collator);
              }
          }
          outputDefined() {
              return true;
          }
          serialize() {
              const serialized = [op];
              this.eachChild(child => {
                  serialized.push(child.serialize());
              });
              return serialized;
          }
      };
  }
  const Equals = makeComparison('==', eq, eqCollate);
  const NotEquals = makeComparison('!=', neq, neqCollate);
  const LessThan = makeComparison('<', lt, ltCollate);
  const GreaterThan = makeComparison('>', gt, gtCollate);
  const LessThanOrEqual = makeComparison('<=', lteq, lteqCollate);
  const GreaterThanOrEqual = makeComparison('>=', gteq, gteqCollate);

  class NumberFormat {
      constructor(number, locale, currency, minFractionDigits, maxFractionDigits) {
          this.type = StringType;
          this.number = number;
          this.locale = locale;
          this.currency = currency;
          this.minFractionDigits = minFractionDigits;
          this.maxFractionDigits = maxFractionDigits;
      }
      static parse(args, context) {
          if (args.length !== 3)
              return context.error(`Expected two arguments.`);
          const number = context.parse(args[1], 1, NumberType);
          if (!number)
              return null;
          const options = args[2];
          if (typeof options !== 'object' || Array.isArray(options))
              return context.error(`NumberFormat options argument must be an object.`);
          let locale = null;
          if (options['locale']) {
              locale = context.parse(options['locale'], 1, StringType);
              if (!locale)
                  return null;
          }
          let currency = null;
          if (options['currency']) {
              currency = context.parse(options['currency'], 1, StringType);
              if (!currency)
                  return null;
          }
          let minFractionDigits = null;
          if (options['min-fraction-digits']) {
              minFractionDigits = context.parse(options['min-fraction-digits'], 1, NumberType);
              if (!minFractionDigits)
                  return null;
          }
          let maxFractionDigits = null;
          if (options['max-fraction-digits']) {
              maxFractionDigits = context.parse(options['max-fraction-digits'], 1, NumberType);
              if (!maxFractionDigits)
                  return null;
          }
          return new NumberFormat(number, locale, currency, minFractionDigits, maxFractionDigits);
      }
      evaluate(ctx) {
          return new Intl.NumberFormat(this.locale ? this.locale.evaluate(ctx) : [], {
              style: this.currency ? 'currency' : 'decimal',
              currency: this.currency ? this.currency.evaluate(ctx) : undefined,
              minimumFractionDigits: this.minFractionDigits ? this.minFractionDigits.evaluate(ctx) : undefined,
              maximumFractionDigits: this.maxFractionDigits ? this.maxFractionDigits.evaluate(ctx) : undefined
          }).format(this.number.evaluate(ctx));
      }
      eachChild(fn) {
          fn(this.number);
          if (this.locale) {
              fn(this.locale);
          }
          if (this.currency) {
              fn(this.currency);
          }
          if (this.minFractionDigits) {
              fn(this.minFractionDigits);
          }
          if (this.maxFractionDigits) {
              fn(this.maxFractionDigits);
          }
      }
      outputDefined() {
          return false;
      }
      serialize() {
          const options = {};
          if (this.locale) {
              options['locale'] = this.locale.serialize();
          }
          if (this.currency) {
              options['currency'] = this.currency.serialize();
          }
          if (this.minFractionDigits) {
              options['min-fraction-digits'] = this.minFractionDigits.serialize();
          }
          if (this.maxFractionDigits) {
              options['max-fraction-digits'] = this.maxFractionDigits.serialize();
          }
          return [
              'number-format',
              this.number.serialize(),
              options
          ];
      }
  }

  class Length {
      constructor(input) {
          this.type = NumberType;
          this.input = input;
      }
      static parse(args, context) {
          if (args.length !== 2)
              return context.error(`Expected 1 argument, but found ${ args.length - 1 } instead.`);
          const input = context.parse(args[1], 1);
          if (!input)
              return null;
          if (input.type.kind !== 'array' && input.type.kind !== 'string' && input.type.kind !== 'value')
              return context.error(`Expected argument of type string or array, but found ${ toString(input.type) } instead.`);
          return new Length(input);
      }
      evaluate(ctx) {
          const input = this.input.evaluate(ctx);
          if (typeof input === 'string') {
              return input.length;
          } else if (Array.isArray(input)) {
              return input.length;
          } else {
              throw new RuntimeError(`Expected value to be of type string or array, but found ${ toString(typeOf(input)) } instead.`);
          }
      }
      eachChild(fn) {
          fn(this.input);
      }
      outputDefined() {
          return false;
      }
      serialize() {
          const serialized = ['length'];
          this.eachChild(child => {
              serialized.push(child.serialize());
          });
          return serialized;
      }
  }

  const expressions = {
      '==': Equals,
      '!=': NotEquals,
      '>': GreaterThan,
      '<': LessThan,
      '>=': GreaterThanOrEqual,
      '<=': LessThanOrEqual,
      'array': Assertion,
      'at': At,
      'boolean': Assertion,
      'case': Case,
      'coalesce': Coalesce,
      'collator': CollatorExpression,
      'format': FormatExpression,
      'image': ImageExpression,
      'in': In,
      'index-of': IndexOf,
      'interpolate': Interpolate,
      'interpolate-hcl': Interpolate,
      'interpolate-lab': Interpolate,
      'length': Length,
      'let': Let,
      'literal': Literal,
      'match': Match,
      'number': Assertion,
      'number-format': NumberFormat,
      'object': Assertion,
      'slice': Slice,
      'step': Step,
      'string': Assertion,
      'to-boolean': Coercion,
      'to-color': Coercion,
      'to-number': Coercion,
      'to-string': Coercion,
      'var': Var,
      'within': Within
  };
  function rgba(ctx, [r, g, b, a]) {
      r = r.evaluate(ctx);
      g = g.evaluate(ctx);
      b = b.evaluate(ctx);
      const alpha = a ? a.evaluate(ctx) : 1;
      const error = validateRGBA(r, g, b, alpha);
      if (error)
          throw new RuntimeError(error);
      return new Color(r / 255 * alpha, g / 255 * alpha, b / 255 * alpha, alpha);
  }
  function has(key, obj) {
      return key in obj;
  }
  function get(key, obj) {
      const v = obj[key];
      return typeof v === 'undefined' ? null : v;
  }
  function binarySearch(v, a, i, j) {
      while (i <= j) {
          const m = i + j >> 1;
          if (a[m] === v)
              return true;
          if (a[m] > v)
              j = m - 1;
          else
              i = m + 1;
      }
      return false;
  }
  function varargs(type) {
      return { type };
  }
  CompoundExpression.register(expressions, {
      'error': [
          ErrorType,
          [StringType],
          (ctx, [v]) => {
              throw new RuntimeError(v.evaluate(ctx));
          }
      ],
      'typeof': [
          StringType,
          [ValueType],
          (ctx, [v]) => toString(typeOf(v.evaluate(ctx)))
      ],
      'to-rgba': [
          array(NumberType, 4),
          [ColorType],
          (ctx, [v]) => {
              return v.evaluate(ctx).toArray();
          }
      ],
      'rgb': [
          ColorType,
          [
              NumberType,
              NumberType,
              NumberType
          ],
          rgba
      ],
      'rgba': [
          ColorType,
          [
              NumberType,
              NumberType,
              NumberType,
              NumberType
          ],
          rgba
      ],
      'has': {
          type: BooleanType,
          overloads: [
              [
                  [StringType],
                  (ctx, [key]) => has(key.evaluate(ctx), ctx.properties())
              ],
              [
                  [
                      StringType,
                      ObjectType
                  ],
                  (ctx, [key, obj]) => has(key.evaluate(ctx), obj.evaluate(ctx))
              ]
          ]
      },
      'get': {
          type: ValueType,
          overloads: [
              [
                  [StringType],
                  (ctx, [key]) => get(key.evaluate(ctx), ctx.properties())
              ],
              [
                  [
                      StringType,
                      ObjectType
                  ],
                  (ctx, [key, obj]) => get(key.evaluate(ctx), obj.evaluate(ctx))
              ]
          ]
      },
      'feature-state': [
          ValueType,
          [StringType],
          (ctx, [key]) => get(key.evaluate(ctx), ctx.featureState || {})
      ],
      'properties': [
          ObjectType,
          [],
          ctx => ctx.properties()
      ],
      'geometry-type': [
          StringType,
          [],
          ctx => ctx.geometryType()
      ],
      'id': [
          ValueType,
          [],
          ctx => ctx.id()
      ],
      'zoom': [
          NumberType,
          [],
          ctx => ctx.globals.zoom
      ],
      'heatmap-density': [
          NumberType,
          [],
          ctx => ctx.globals.heatmapDensity || 0
      ],
      'line-progress': [
          NumberType,
          [],
          ctx => ctx.globals.lineProgress || 0
      ],
      'sky-radial-progress': [
          NumberType,
          [],
          ctx => ctx.globals.skyRadialProgress || 0
      ],
      'accumulated': [
          ValueType,
          [],
          ctx => ctx.globals.accumulated === undefined ? null : ctx.globals.accumulated
      ],
      '+': [
          NumberType,
          varargs(NumberType),
          (ctx, args) => {
              let result = 0;
              for (const arg of args) {
                  result += arg.evaluate(ctx);
              }
              return result;
          }
      ],
      '*': [
          NumberType,
          varargs(NumberType),
          (ctx, args) => {
              let result = 1;
              for (const arg of args) {
                  result *= arg.evaluate(ctx);
              }
              return result;
          }
      ],
      '-': {
          type: NumberType,
          overloads: [
              [
                  [
                      NumberType,
                      NumberType
                  ],
                  (ctx, [a, b]) => a.evaluate(ctx) - b.evaluate(ctx)
              ],
              [
                  [NumberType],
                  (ctx, [a]) => -a.evaluate(ctx)
              ]
          ]
      },
      '/': [
          NumberType,
          [
              NumberType,
              NumberType
          ],
          (ctx, [a, b]) => a.evaluate(ctx) / b.evaluate(ctx)
      ],
      '%': [
          NumberType,
          [
              NumberType,
              NumberType
          ],
          (ctx, [a, b]) => a.evaluate(ctx) % b.evaluate(ctx)
      ],
      'ln2': [
          NumberType,
          [],
          () => Math.LN2
      ],
      'pi': [
          NumberType,
          [],
          () => Math.PI
      ],
      'e': [
          NumberType,
          [],
          () => Math.E
      ],
      '^': [
          NumberType,
          [
              NumberType,
              NumberType
          ],
          (ctx, [b, e]) => Math.pow(b.evaluate(ctx), e.evaluate(ctx))
      ],
      'sqrt': [
          NumberType,
          [NumberType],
          (ctx, [x]) => Math.sqrt(x.evaluate(ctx))
      ],
      'log10': [
          NumberType,
          [NumberType],
          (ctx, [n]) => Math.log(n.evaluate(ctx)) / Math.LN10
      ],
      'ln': [
          NumberType,
          [NumberType],
          (ctx, [n]) => Math.log(n.evaluate(ctx))
      ],
      'log2': [
          NumberType,
          [NumberType],
          (ctx, [n]) => Math.log(n.evaluate(ctx)) / Math.LN2
      ],
      'sin': [
          NumberType,
          [NumberType],
          (ctx, [n]) => Math.sin(n.evaluate(ctx))
      ],
      'cos': [
          NumberType,
          [NumberType],
          (ctx, [n]) => Math.cos(n.evaluate(ctx))
      ],
      'tan': [
          NumberType,
          [NumberType],
          (ctx, [n]) => Math.tan(n.evaluate(ctx))
      ],
      'asin': [
          NumberType,
          [NumberType],
          (ctx, [n]) => Math.asin(n.evaluate(ctx))
      ],
      'acos': [
          NumberType,
          [NumberType],
          (ctx, [n]) => Math.acos(n.evaluate(ctx))
      ],
      'atan': [
          NumberType,
          [NumberType],
          (ctx, [n]) => Math.atan(n.evaluate(ctx))
      ],
      'min': [
          NumberType,
          varargs(NumberType),
          (ctx, args) => Math.min(...args.map(arg => arg.evaluate(ctx)))
      ],
      'max': [
          NumberType,
          varargs(NumberType),
          (ctx, args) => Math.max(...args.map(arg => arg.evaluate(ctx)))
      ],
      'abs': [
          NumberType,
          [NumberType],
          (ctx, [n]) => Math.abs(n.evaluate(ctx))
      ],
      'round': [
          NumberType,
          [NumberType],
          (ctx, [n]) => {
              const v = n.evaluate(ctx);
              return v < 0 ? -Math.round(-v) : Math.round(v);
          }
      ],
      'floor': [
          NumberType,
          [NumberType],
          (ctx, [n]) => Math.floor(n.evaluate(ctx))
      ],
      'ceil': [
          NumberType,
          [NumberType],
          (ctx, [n]) => Math.ceil(n.evaluate(ctx))
      ],
      'filter-==': [
          BooleanType,
          [
              StringType,
              ValueType
          ],
          (ctx, [k, v]) => ctx.properties()[k.value] === v.value
      ],
      'filter-id-==': [
          BooleanType,
          [ValueType],
          (ctx, [v]) => ctx.id() === v.value
      ],
      'filter-type-==': [
          BooleanType,
          [StringType],
          (ctx, [v]) => ctx.geometryType() === v.value
      ],
      'filter-<': [
          BooleanType,
          [
              StringType,
              ValueType
          ],
          (ctx, [k, v]) => {
              const a = ctx.properties()[k.value];
              const b = v.value;
              return typeof a === typeof b && a < b;
          }
      ],
      'filter-id-<': [
          BooleanType,
          [ValueType],
          (ctx, [v]) => {
              const a = ctx.id();
              const b = v.value;
              return typeof a === typeof b && a < b;
          }
      ],
      'filter->': [
          BooleanType,
          [
              StringType,
              ValueType
          ],
          (ctx, [k, v]) => {
              const a = ctx.properties()[k.value];
              const b = v.value;
              return typeof a === typeof b && a > b;
          }
      ],
      'filter-id->': [
          BooleanType,
          [ValueType],
          (ctx, [v]) => {
              const a = ctx.id();
              const b = v.value;
              return typeof a === typeof b && a > b;
          }
      ],
      'filter-<=': [
          BooleanType,
          [
              StringType,
              ValueType
          ],
          (ctx, [k, v]) => {
              const a = ctx.properties()[k.value];
              const b = v.value;
              return typeof a === typeof b && a <= b;
          }
      ],
      'filter-id-<=': [
          BooleanType,
          [ValueType],
          (ctx, [v]) => {
              const a = ctx.id();
              const b = v.value;
              return typeof a === typeof b && a <= b;
          }
      ],
      'filter->=': [
          BooleanType,
          [
              StringType,
              ValueType
          ],
          (ctx, [k, v]) => {
              const a = ctx.properties()[k.value];
              const b = v.value;
              return typeof a === typeof b && a >= b;
          }
      ],
      'filter-id->=': [
          BooleanType,
          [ValueType],
          (ctx, [v]) => {
              const a = ctx.id();
              const b = v.value;
              return typeof a === typeof b && a >= b;
          }
      ],
      'filter-has': [
          BooleanType,
          [ValueType],
          (ctx, [k]) => k.value in ctx.properties()
      ],
      'filter-has-id': [
          BooleanType,
          [],
          ctx => ctx.id() !== null && ctx.id() !== undefined
      ],
      'filter-type-in': [
          BooleanType,
          [array(StringType)],
          (ctx, [v]) => v.value.indexOf(ctx.geometryType()) >= 0
      ],
      'filter-id-in': [
          BooleanType,
          [array(ValueType)],
          (ctx, [v]) => v.value.indexOf(ctx.id()) >= 0
      ],
      'filter-in-small': [
          BooleanType,
          [
              StringType,
              array(ValueType)
          ],
          (ctx, [k, v]) => v.value.indexOf(ctx.properties()[k.value]) >= 0
      ],
      'filter-in-large': [
          BooleanType,
          [
              StringType,
              array(ValueType)
          ],
          (ctx, [k, v]) => binarySearch(ctx.properties()[k.value], v.value, 0, v.value.length - 1)
      ],
      'all': {
          type: BooleanType,
          overloads: [
              [
                  [
                      BooleanType,
                      BooleanType
                  ],
                  (ctx, [a, b]) => a.evaluate(ctx) && b.evaluate(ctx)
              ],
              [
                  varargs(BooleanType),
                  (ctx, args) => {
                      for (const arg of args) {
                          if (!arg.evaluate(ctx))
                              return false;
                      }
                      return true;
                  }
              ]
          ]
      },
      'any': {
          type: BooleanType,
          overloads: [
              [
                  [
                      BooleanType,
                      BooleanType
                  ],
                  (ctx, [a, b]) => a.evaluate(ctx) || b.evaluate(ctx)
              ],
              [
                  varargs(BooleanType),
                  (ctx, args) => {
                      for (const arg of args) {
                          if (arg.evaluate(ctx))
                              return true;
                      }
                      return false;
                  }
              ]
          ]
      },
      '!': [
          BooleanType,
          [BooleanType],
          (ctx, [b]) => !b.evaluate(ctx)
      ],
      'is-supported-script': [
          BooleanType,
          [StringType],
          (ctx, [s]) => {
              const isSupportedScript = ctx.globals && ctx.globals.isSupportedScript;
              if (isSupportedScript) {
                  return isSupportedScript(s.evaluate(ctx));
              }
              return true;
          }
      ],
      'upcase': [
          StringType,
          [StringType],
          (ctx, [s]) => s.evaluate(ctx).toUpperCase()
      ],
      'downcase': [
          StringType,
          [StringType],
          (ctx, [s]) => s.evaluate(ctx).toLowerCase()
      ],
      'concat': [
          StringType,
          varargs(ValueType),
          (ctx, args) => args.map(arg => toString$1(arg.evaluate(ctx))).join('')
      ],
      'resolved-locale': [
          StringType,
          [CollatorType],
          (ctx, [collator]) => collator.evaluate(ctx).resolvedLocale()
      ]
  });

  function success(value) {
      return {
          result: 'success',
          value
      };
  }
  function error(value) {
      return {
          result: 'error',
          value
      };
  }

  function supportsPropertyExpression(spec) {
      return spec['property-type'] === 'data-driven' || spec['property-type'] === 'cross-faded-data-driven';
  }
  function supportsZoomExpression(spec) {
      return !!spec.expression && spec.expression.parameters.indexOf('zoom') > -1;
  }
  function supportsInterpolation(spec) {
      return !!spec.expression && spec.expression.interpolated;
  }

  function getType(val) {
      if (val instanceof Number) {
          return 'number';
      } else if (val instanceof String) {
          return 'string';
      } else if (val instanceof Boolean) {
          return 'boolean';
      } else if (Array.isArray(val)) {
          return 'array';
      } else if (val === null) {
          return 'null';
      } else {
          return typeof val;
      }
  }

  function isFunction$1(value) {
      return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
  function identityFunction(x) {
      return x;
  }
  function createFunction(parameters, propertySpec) {
      const isColor = propertySpec.type === 'color';
      const zoomAndFeatureDependent = parameters.stops && typeof parameters.stops[0][0] === 'object';
      const featureDependent = zoomAndFeatureDependent || parameters.property !== undefined;
      const zoomDependent = zoomAndFeatureDependent || !featureDependent;
      const type = parameters.type || (supportsInterpolation(propertySpec) ? 'exponential' : 'interval');
      if (isColor) {
          parameters = extend({}, parameters);
          if (parameters.stops) {
              parameters.stops = parameters.stops.map(stop => {
                  return [
                      stop[0],
                      Color.parse(stop[1])
                  ];
              });
          }
          if (parameters.default) {
              parameters.default = Color.parse(parameters.default);
          } else {
              parameters.default = Color.parse(propertySpec.default);
          }
      }
      if (parameters.colorSpace && parameters.colorSpace !== 'rgb' && !colorSpaces[parameters.colorSpace]) {
          throw new Error(`Unknown color space: ${ parameters.colorSpace }`);
      }
      let innerFun;
      let hashedStops;
      let categoricalKeyType;
      if (type === 'exponential') {
          innerFun = evaluateExponentialFunction;
      } else if (type === 'interval') {
          innerFun = evaluateIntervalFunction;
      } else if (type === 'categorical') {
          innerFun = evaluateCategoricalFunction;
          hashedStops = Object.create(null);
          for (const stop of parameters.stops) {
              hashedStops[stop[0]] = stop[1];
          }
          categoricalKeyType = typeof parameters.stops[0][0];
      } else if (type === 'identity') {
          innerFun = evaluateIdentityFunction;
      } else {
          throw new Error(`Unknown function type "${ type }"`);
      }
      if (zoomAndFeatureDependent) {
          const featureFunctions = {};
          const zoomStops = [];
          for (let s = 0; s < parameters.stops.length; s++) {
              const stop = parameters.stops[s];
              const zoom = stop[0].zoom;
              if (featureFunctions[zoom] === undefined) {
                  featureFunctions[zoom] = {
                      zoom,
                      type: parameters.type,
                      property: parameters.property,
                      default: parameters.default,
                      stops: []
                  };
                  zoomStops.push(zoom);
              }
              featureFunctions[zoom].stops.push([
                  stop[0].value,
                  stop[1]
              ]);
          }
          const featureFunctionStops = [];
          for (const z of zoomStops) {
              featureFunctionStops.push([
                  featureFunctions[z].zoom,
                  createFunction(featureFunctions[z], propertySpec)
              ]);
          }
          const interpolationType = { name: 'linear' };
          return {
              kind: 'composite',
              interpolationType,
              interpolationFactor: Interpolate.interpolationFactor.bind(undefined, interpolationType),
              zoomStops: featureFunctionStops.map(s => s[0]),
              evaluate({zoom}, properties) {
                  return evaluateExponentialFunction({
                      stops: featureFunctionStops,
                      base: parameters.base
                  }, propertySpec, zoom).evaluate(zoom, properties);
              }
          };
      } else if (zoomDependent) {
          const interpolationType = type === 'exponential' ? {
              name: 'exponential',
              base: parameters.base !== undefined ? parameters.base : 1
          } : null;
          return {
              kind: 'camera',
              interpolationType,
              interpolationFactor: Interpolate.interpolationFactor.bind(undefined, interpolationType),
              zoomStops: parameters.stops.map(s => s[0]),
              evaluate: ({zoom}) => innerFun(parameters, propertySpec, zoom, hashedStops, categoricalKeyType)
          };
      } else {
          return {
              kind: 'source',
              evaluate(_, feature) {
                  const value = feature && feature.properties ? feature.properties[parameters.property] : undefined;
                  if (value === undefined) {
                      return coalesce(parameters.default, propertySpec.default);
                  }
                  return innerFun(parameters, propertySpec, value, hashedStops, categoricalKeyType);
              }
          };
      }
  }
  function coalesce(a, b, c) {
      if (a !== undefined)
          return a;
      if (b !== undefined)
          return b;
      if (c !== undefined)
          return c;
  }
  function evaluateCategoricalFunction(parameters, propertySpec, input, hashedStops, keyType) {
      const evaluated = typeof input === keyType ? hashedStops[input] : undefined;
      return coalesce(evaluated, parameters.default, propertySpec.default);
  }
  function evaluateIntervalFunction(parameters, propertySpec, input) {
      if (getType(input) !== 'number')
          return coalesce(parameters.default, propertySpec.default);
      const n = parameters.stops.length;
      if (n === 1)
          return parameters.stops[0][1];
      if (input <= parameters.stops[0][0])
          return parameters.stops[0][1];
      if (input >= parameters.stops[n - 1][0])
          return parameters.stops[n - 1][1];
      const index = findStopLessThanOrEqualTo(parameters.stops.map(stop => stop[0]), input);
      return parameters.stops[index][1];
  }
  function evaluateExponentialFunction(parameters, propertySpec, input) {
      const base = parameters.base !== undefined ? parameters.base : 1;
      if (getType(input) !== 'number')
          return coalesce(parameters.default, propertySpec.default);
      const n = parameters.stops.length;
      if (n === 1)
          return parameters.stops[0][1];
      if (input <= parameters.stops[0][0])
          return parameters.stops[0][1];
      if (input >= parameters.stops[n - 1][0])
          return parameters.stops[n - 1][1];
      const index = findStopLessThanOrEqualTo(parameters.stops.map(stop => stop[0]), input);
      const t = interpolationFactor(input, base, parameters.stops[index][0], parameters.stops[index + 1][0]);
      const outputLower = parameters.stops[index][1];
      const outputUpper = parameters.stops[index + 1][1];
      let interp = interpolate[propertySpec.type] || identityFunction;
      if (parameters.colorSpace && parameters.colorSpace !== 'rgb') {
          const colorspace = colorSpaces[parameters.colorSpace];
          interp = (a, b) => colorspace.reverse(colorspace.interpolate(colorspace.forward(a), colorspace.forward(b), t));
      }
      if (typeof outputLower.evaluate === 'function') {
          return {
              evaluate(...args) {
                  const evaluatedLower = outputLower.evaluate.apply(undefined, args);
                  const evaluatedUpper = outputUpper.evaluate.apply(undefined, args);
                  if (evaluatedLower === undefined || evaluatedUpper === undefined) {
                      return undefined;
                  }
                  return interp(evaluatedLower, evaluatedUpper, t);
              }
          };
      }
      return interp(outputLower, outputUpper, t);
  }
  function evaluateIdentityFunction(parameters, propertySpec, input) {
      if (propertySpec.type === 'color') {
          input = Color.parse(input);
      } else if (propertySpec.type === 'formatted') {
          input = Formatted.fromString(input.toString());
      } else if (propertySpec.type === 'resolvedImage') {
          input = ResolvedImage.fromString(input.toString());
      } else if (getType(input) !== propertySpec.type && (propertySpec.type !== 'enum' || !propertySpec.values[input])) {
          input = undefined;
      }
      return coalesce(input, parameters.default, propertySpec.default);
  }
  function interpolationFactor(input, base, lowerValue, upperValue) {
      const difference = upperValue - lowerValue;
      const progress = input - lowerValue;
      if (difference === 0) {
          return 0;
      } else if (base === 1) {
          return progress / difference;
      } else {
          return (Math.pow(base, progress) - 1) / (Math.pow(base, difference) - 1);
      }
  }

  class StyleExpression {
      constructor(expression, propertySpec) {
          this.expression = expression;
          this._warningHistory = {};
          this._evaluator = new EvaluationContext();
          this._defaultValue = propertySpec ? getDefaultValue(propertySpec) : null;
          this._enumValues = propertySpec && propertySpec.type === 'enum' ? propertySpec.values : null;
      }
      evaluateWithoutErrorHandling(globals, feature, featureState, canonical, availableImages, formattedSection) {
          this._evaluator.globals = globals;
          this._evaluator.feature = feature;
          this._evaluator.featureState = featureState;
          this._evaluator.canonical = canonical;
          this._evaluator.availableImages = availableImages || null;
          this._evaluator.formattedSection = formattedSection;
          return this.expression.evaluate(this._evaluator);
      }
      evaluate(globals, feature, featureState, canonical, availableImages, formattedSection) {
          this._evaluator.globals = globals;
          this._evaluator.feature = feature || null;
          this._evaluator.featureState = featureState || null;
          this._evaluator.canonical = canonical;
          this._evaluator.availableImages = availableImages || null;
          this._evaluator.formattedSection = formattedSection || null;
          try {
              const val = this.expression.evaluate(this._evaluator);
              if (val === null || val === undefined || typeof val === 'number' && val !== val) {
                  return this._defaultValue;
              }
              if (this._enumValues && !(val in this._enumValues)) {
                  throw new RuntimeError(`Expected value to be one of ${ Object.keys(this._enumValues).map(v => JSON.stringify(v)).join(', ') }, but found ${ JSON.stringify(val) } instead.`);
              }
              return val;
          } catch (e) {
              if (!this._warningHistory[e.message]) {
                  this._warningHistory[e.message] = true;
                  if (typeof console !== 'undefined') {
                      console.warn(e.message);
                  }
              }
              return this._defaultValue;
          }
      }
  }
  function isExpression(expression) {
      return Array.isArray(expression) && expression.length > 0 && typeof expression[0] === 'string' && expression[0] in expressions;
  }
  function createExpression(expression, propertySpec) {
      const parser = new ParsingContext(expressions, [], propertySpec ? getExpectedType(propertySpec) : undefined);
      const parsed = parser.parse(expression, undefined, undefined, undefined, propertySpec && propertySpec.type === 'string' ? { typeAnnotation: 'coerce' } : undefined);
      if (!parsed) {
          return error(parser.errors);
      }
      return success(new StyleExpression(parsed, propertySpec));
  }
  class ZoomConstantExpression {
      constructor(kind, expression) {
          this.kind = kind;
          this._styleExpression = expression;
          this.isStateDependent = kind !== 'constant' && !isStateConstant(expression.expression);
      }
      evaluateWithoutErrorHandling(globals, feature, featureState, canonical, availableImages, formattedSection) {
          return this._styleExpression.evaluateWithoutErrorHandling(globals, feature, featureState, canonical, availableImages, formattedSection);
      }
      evaluate(globals, feature, featureState, canonical, availableImages, formattedSection) {
          return this._styleExpression.evaluate(globals, feature, featureState, canonical, availableImages, formattedSection);
      }
  }
  class ZoomDependentExpression {
      constructor(kind, expression, zoomStops, interpolationType) {
          this.kind = kind;
          this.zoomStops = zoomStops;
          this._styleExpression = expression;
          this.isStateDependent = kind !== 'camera' && !isStateConstant(expression.expression);
          this.interpolationType = interpolationType;
      }
      evaluateWithoutErrorHandling(globals, feature, featureState, canonical, availableImages, formattedSection) {
          return this._styleExpression.evaluateWithoutErrorHandling(globals, feature, featureState, canonical, availableImages, formattedSection);
      }
      evaluate(globals, feature, featureState, canonical, availableImages, formattedSection) {
          return this._styleExpression.evaluate(globals, feature, featureState, canonical, availableImages, formattedSection);
      }
      interpolationFactor(input, lower, upper) {
          if (this.interpolationType) {
              return Interpolate.interpolationFactor(this.interpolationType, input, lower, upper);
          } else {
              return 0;
          }
      }
  }
  function createPropertyExpression(expression, propertySpec) {
      expression = createExpression(expression, propertySpec);
      if (expression.result === 'error') {
          return expression;
      }
      const parsed = expression.value.expression;
      const isFeatureConstant$1 = isFeatureConstant(parsed);
      if (!isFeatureConstant$1 && !supportsPropertyExpression(propertySpec)) {
          return error([new ParsingError('', 'data expressions not supported')]);
      }
      const isZoomConstant = isGlobalPropertyConstant(parsed, ['zoom']);
      if (!isZoomConstant && !supportsZoomExpression(propertySpec)) {
          return error([new ParsingError('', 'zoom expressions not supported')]);
      }
      const zoomCurve = findZoomCurve(parsed);
      if (!zoomCurve && !isZoomConstant) {
          return error([new ParsingError('', '"zoom" expression may only be used as input to a top-level "step" or "interpolate" expression.')]);
      } else if (zoomCurve instanceof ParsingError) {
          return error([zoomCurve]);
      } else if (zoomCurve instanceof Interpolate && !supportsInterpolation(propertySpec)) {
          return error([new ParsingError('', '"interpolate" expressions cannot be used with this property')]);
      }
      if (!zoomCurve) {
          return success(isFeatureConstant$1 ? new ZoomConstantExpression('constant', expression.value) : new ZoomConstantExpression('source', expression.value));
      }
      const interpolationType = zoomCurve instanceof Interpolate ? zoomCurve.interpolation : undefined;
      return success(isFeatureConstant$1 ? new ZoomDependentExpression('camera', expression.value, zoomCurve.labels, interpolationType) : new ZoomDependentExpression('composite', expression.value, zoomCurve.labels, interpolationType));
  }
  class StylePropertyFunction {
      constructor(parameters, specification) {
          this._parameters = parameters;
          this._specification = specification;
          extend(this, createFunction(this._parameters, this._specification));
      }
      static deserialize(serialized) {
          return new StylePropertyFunction(serialized._parameters, serialized._specification);
      }
      static serialize(input) {
          return {
              _parameters: input._parameters,
              _specification: input._specification
          };
      }
  }
  function normalizePropertyExpression(value, specification) {
      if (isFunction$1(value)) {
          return new StylePropertyFunction(value, specification);
      } else if (isExpression(value)) {
          const expression = createPropertyExpression(value, specification);
          if (expression.result === 'error') {
              throw new Error(expression.value.map(err => `${ err.key }: ${ err.message }`).join(', '));
          }
          return expression.value;
      } else {
          let constant = value;
          if (typeof value === 'string' && specification.type === 'color') {
              constant = Color.parse(value);
          }
          return {
              kind: 'constant',
              evaluate: () => constant
          };
      }
  }
  function findZoomCurve(expression) {
      let result = null;
      if (expression instanceof Let) {
          result = findZoomCurve(expression.result);
      } else if (expression instanceof Coalesce) {
          for (const arg of expression.args) {
              result = findZoomCurve(arg);
              if (result) {
                  break;
              }
          }
      } else if ((expression instanceof Step || expression instanceof Interpolate) && expression.input instanceof CompoundExpression && expression.input.name === 'zoom') {
          result = expression;
      }
      if (result instanceof ParsingError) {
          return result;
      }
      expression.eachChild(child => {
          const childResult = findZoomCurve(child);
          if (childResult instanceof ParsingError) {
              result = childResult;
          } else if (!result && childResult) {
              result = new ParsingError('', '"zoom" expression may only be used as input to a top-level "step" or "interpolate" expression.');
          } else if (result && childResult && result !== childResult) {
              result = new ParsingError('', 'Only one zoom-based "step" or "interpolate" subexpression may be used in an expression.');
          }
      });
      return result;
  }
  function getExpectedType(spec) {
      const types = {
          color: ColorType,
          string: StringType,
          number: NumberType,
          enum: StringType,
          boolean: BooleanType,
          formatted: FormattedType,
          resolvedImage: ResolvedImageType
      };
      if (spec.type === 'array') {
          return array(types[spec.value] || ValueType, spec.length);
      }
      return types[spec.type];
  }
  function getDefaultValue(spec) {
      if (spec.type === 'color' && isFunction$1(spec.default)) {
          return new Color(0, 0, 0, 0);
      } else if (spec.type === 'color') {
          return Color.parse(spec.default) || null;
      } else if (spec.default === undefined) {
          return null;
      } else {
          return spec.default;
      }
  }

  function convertLiteral(value) {
      return typeof value === 'object' ? [
          'literal',
          value
      ] : value;
  }
  function convertFunction(parameters, propertySpec) {
      let stops = parameters.stops;
      if (!stops) {
          return convertIdentityFunction(parameters, propertySpec);
      }
      const zoomAndFeatureDependent = stops && typeof stops[0][0] === 'object';
      const featureDependent = zoomAndFeatureDependent || parameters.property !== undefined;
      const zoomDependent = zoomAndFeatureDependent || !featureDependent;
      stops = stops.map(stop => {
          if (!featureDependent && propertySpec.tokens && typeof stop[1] === 'string') {
              return [
                  stop[0],
                  convertTokenString(stop[1])
              ];
          }
          return [
              stop[0],
              convertLiteral(stop[1])
          ];
      });
      if (zoomAndFeatureDependent) {
          return convertZoomAndPropertyFunction(parameters, propertySpec, stops);
      } else if (zoomDependent) {
          return convertZoomFunction(parameters, propertySpec, stops);
      } else {
          return convertPropertyFunction(parameters, propertySpec, stops);
      }
  }
  function convertIdentityFunction(parameters, propertySpec) {
      const get = [
          'get',
          parameters.property
      ];
      if (parameters.default === undefined) {
          return propertySpec.type === 'string' ? [
              'string',
              get
          ] : get;
      } else if (propertySpec.type === 'enum') {
          return [
              'match',
              get,
              Object.keys(propertySpec.values),
              get,
              parameters.default
          ];
      } else {
          const expression = [
              propertySpec.type === 'color' ? 'to-color' : propertySpec.type,
              get,
              convertLiteral(parameters.default)
          ];
          if (propertySpec.type === 'array') {
              expression.splice(1, 0, propertySpec.value, propertySpec.length || null);
          }
          return expression;
      }
  }
  function getInterpolateOperator(parameters) {
      switch (parameters.colorSpace) {
      case 'hcl':
          return 'interpolate-hcl';
      case 'lab':
          return 'interpolate-lab';
      default:
          return 'interpolate';
      }
  }
  function convertZoomAndPropertyFunction(parameters, propertySpec, stops) {
      const featureFunctionParameters = {};
      const featureFunctionStops = {};
      const zoomStops = [];
      for (let s = 0; s < stops.length; s++) {
          const stop = stops[s];
          const zoom = stop[0].zoom;
          if (featureFunctionParameters[zoom] === undefined) {
              featureFunctionParameters[zoom] = {
                  zoom,
                  type: parameters.type,
                  property: parameters.property,
                  default: parameters.default
              };
              featureFunctionStops[zoom] = [];
              zoomStops.push(zoom);
          }
          featureFunctionStops[zoom].push([
              stop[0].value,
              stop[1]
          ]);
      }
      const functionType = getFunctionType({}, propertySpec);
      if (functionType === 'exponential') {
          const expression = [
              getInterpolateOperator(parameters),
              ['linear'],
              ['zoom']
          ];
          for (const z of zoomStops) {
              const output = convertPropertyFunction(featureFunctionParameters[z], propertySpec, featureFunctionStops[z]);
              appendStopPair(expression, z, output, false);
          }
          return expression;
      } else {
          const expression = [
              'step',
              ['zoom']
          ];
          for (const z of zoomStops) {
              const output = convertPropertyFunction(featureFunctionParameters[z], propertySpec, featureFunctionStops[z]);
              appendStopPair(expression, z, output, true);
          }
          fixupDegenerateStepCurve(expression);
          return expression;
      }
  }
  function coalesce$1(a, b) {
      if (a !== undefined)
          return a;
      if (b !== undefined)
          return b;
  }
  function getFallback(parameters, propertySpec) {
      const defaultValue = convertLiteral(coalesce$1(parameters.default, propertySpec.default));
      if (defaultValue === undefined && propertySpec.type === 'resolvedImage') {
          return '';
      }
      return defaultValue;
  }
  function convertPropertyFunction(parameters, propertySpec, stops) {
      const type = getFunctionType(parameters, propertySpec);
      const get = [
          'get',
          parameters.property
      ];
      if (type === 'categorical' && typeof stops[0][0] === 'boolean') {
          const expression = ['case'];
          for (const stop of stops) {
              expression.push([
                  '==',
                  get,
                  stop[0]
              ], stop[1]);
          }
          expression.push(getFallback(parameters, propertySpec));
          return expression;
      } else if (type === 'categorical') {
          const expression = [
              'match',
              get
          ];
          for (const stop of stops) {
              appendStopPair(expression, stop[0], stop[1], false);
          }
          expression.push(getFallback(parameters, propertySpec));
          return expression;
      } else if (type === 'interval') {
          const expression = [
              'step',
              [
                  'number',
                  get
              ]
          ];
          for (const stop of stops) {
              appendStopPair(expression, stop[0], stop[1], true);
          }
          fixupDegenerateStepCurve(expression);
          return parameters.default === undefined ? expression : [
              'case',
              [
                  '==',
                  [
                      'typeof',
                      get
                  ],
                  'number'
              ],
              expression,
              convertLiteral(parameters.default)
          ];
      } else if (type === 'exponential') {
          const base = parameters.base !== undefined ? parameters.base : 1;
          const expression = [
              getInterpolateOperator(parameters),
              base === 1 ? ['linear'] : [
                  'exponential',
                  base
              ],
              [
                  'number',
                  get
              ]
          ];
          for (const stop of stops) {
              appendStopPair(expression, stop[0], stop[1], false);
          }
          return parameters.default === undefined ? expression : [
              'case',
              [
                  '==',
                  [
                      'typeof',
                      get
                  ],
                  'number'
              ],
              expression,
              convertLiteral(parameters.default)
          ];
      } else {
          throw new Error(`Unknown property function type ${ type }`);
      }
  }
  function convertZoomFunction(parameters, propertySpec, stops, input = ['zoom']) {
      const type = getFunctionType(parameters, propertySpec);
      let expression;
      let isStep = false;
      if (type === 'interval') {
          expression = [
              'step',
              input
          ];
          isStep = true;
      } else if (type === 'exponential') {
          const base = parameters.base !== undefined ? parameters.base : 1;
          expression = [
              getInterpolateOperator(parameters),
              base === 1 ? ['linear'] : [
                  'exponential',
                  base
              ],
              input
          ];
      } else {
          throw new Error(`Unknown zoom function type "${ type }"`);
      }
      for (const stop of stops) {
          appendStopPair(expression, stop[0], stop[1], isStep);
      }
      fixupDegenerateStepCurve(expression);
      return expression;
  }
  function fixupDegenerateStepCurve(expression) {
      if (expression[0] === 'step' && expression.length === 3) {
          expression.push(0);
          expression.push(expression[3]);
      }
  }
  function appendStopPair(curve, input, output, isStep) {
      if (curve.length > 3 && input === curve[curve.length - 2]) {
          return;
      }
      if (!(isStep && curve.length === 2)) {
          curve.push(input);
      }
      curve.push(output);
  }
  function getFunctionType(parameters, propertySpec) {
      if (parameters.type) {
          return parameters.type;
      } else {
          return propertySpec.expression.interpolated ? 'exponential' : 'interval';
      }
  }
  function convertTokenString(s) {
      const result = ['concat'];
      const re = /{([^{}]+)}/g;
      let pos = 0;
      for (let match = re.exec(s); match !== null; match = re.exec(s)) {
          const literal = s.slice(pos, re.lastIndex - match[0].length);
          pos = re.lastIndex;
          if (literal.length > 0)
              result.push(literal);
          result.push([
              'get',
              match[1]
          ]);
      }
      if (result.length === 1) {
          return s;
      }
      if (pos < s.length) {
          result.push(s.slice(pos));
      } else if (result.length === 2) {
          return [
              'to-string',
              result[1]
          ];
      }
      return result;
  }

  function isExpressionFilter(filter) {
      if (filter === true || filter === false) {
          return true;
      }
      if (!Array.isArray(filter) || filter.length === 0) {
          return false;
      }
      switch (filter[0]) {
      case 'has':
          return filter.length >= 2 && filter[1] !== '$id' && filter[1] !== '$type';
      case 'in':
          return filter.length >= 3 && (typeof filter[1] !== 'string' || Array.isArray(filter[2]));
      case '!in':
      case '!has':
      case 'none':
          return false;
      case '==':
      case '!=':
      case '>':
      case '>=':
      case '<':
      case '<=':
          return filter.length !== 3 || (Array.isArray(filter[1]) || Array.isArray(filter[2]));
      case 'any':
      case 'all':
          for (const f of filter.slice(1)) {
              if (!isExpressionFilter(f) && typeof f !== 'boolean') {
                  return false;
              }
          }
          return true;
      default:
          return true;
      }
  }
  const filterSpec = {
      'type': 'boolean',
      'default': false,
      'transition': false,
      'property-type': 'data-driven',
      'expression': {
          'interpolated': false,
          'parameters': [
              'zoom',
              'feature'
          ]
      }
  };
  function createFilter(filter) {
      if (filter === null || filter === undefined) {
          return {
              filter: () => true,
              needGeometry: false
          };
      }
      if (!isExpressionFilter(filter)) {
          filter = convertFilter(filter);
      }
      const compiled = createExpression(filter, filterSpec);
      if (compiled.result === 'error') {
          throw new Error(compiled.value.map(err => `${ err.key }: ${ err.message }`).join(', '));
      } else {
          const needGeometry = geometryNeeded(filter);
          return {
              filter: (globalProperties, feature, canonical) => compiled.value.evaluate(globalProperties, feature, {}, canonical),
              needGeometry
          };
      }
  }
  function compare(a, b) {
      return a < b ? -1 : a > b ? 1 : 0;
  }
  function geometryNeeded(filter) {
      if (!Array.isArray(filter))
          return false;
      if (filter[0] === 'within')
          return true;
      for (let index = 1; index < filter.length; index++) {
          if (geometryNeeded(filter[index]))
              return true;
      }
      return false;
  }
  function convertFilter(filter) {
      if (!filter)
          return true;
      const op = filter[0];
      if (filter.length <= 1)
          return op !== 'any';
      const converted = op === '==' ? convertComparisonOp(filter[1], filter[2], '==') : op === '!=' ? convertNegation(convertComparisonOp(filter[1], filter[2], '==')) : op === '<' || op === '>' || op === '<=' || op === '>=' ? convertComparisonOp(filter[1], filter[2], op) : op === 'any' ? convertDisjunctionOp(filter.slice(1)) : op === 'all' ? ['all'].concat(filter.slice(1).map(convertFilter)) : op === 'none' ? ['all'].concat(filter.slice(1).map(convertFilter).map(convertNegation)) : op === 'in' ? convertInOp(filter[1], filter.slice(2)) : op === '!in' ? convertNegation(convertInOp(filter[1], filter.slice(2))) : op === 'has' ? convertHasOp(filter[1]) : op === '!has' ? convertNegation(convertHasOp(filter[1])) : op === 'within' ? filter : true;
      return converted;
  }
  function convertComparisonOp(property, value, op) {
      switch (property) {
      case '$type':
          return [
              `filter-type-${ op }`,
              value
          ];
      case '$id':
          return [
              `filter-id-${ op }`,
              value
          ];
      default:
          return [
              `filter-${ op }`,
              property,
              value
          ];
      }
  }
  function convertDisjunctionOp(filters) {
      return ['any'].concat(filters.map(convertFilter));
  }
  function convertInOp(property, values) {
      if (values.length === 0) {
          return false;
      }
      switch (property) {
      case '$type':
          return [
              `filter-type-in`,
              [
                  'literal',
                  values
              ]
          ];
      case '$id':
          return [
              `filter-id-in`,
              [
                  'literal',
                  values
              ]
          ];
      default:
          if (values.length > 200 && !values.some(v => typeof v !== typeof values[0])) {
              return [
                  'filter-in-large',
                  property,
                  [
                      'literal',
                      values.sort(compare)
                  ]
              ];
          } else {
              return [
                  'filter-in-small',
                  property,
                  [
                      'literal',
                      values
                  ]
              ];
          }
      }
  }
  function convertHasOp(property) {
      switch (property) {
      case '$type':
          return true;
      case '$id':
          return [`filter-has-id`];
      default:
          return [
              `filter-has`,
              property
          ];
      }
  }
  function convertNegation(filter) {
      return [
          '!',
          filter
      ];
  }

  function convertFilter$1(filter) {
      return _convertFilter(filter, {});
  }
  function _convertFilter(filter, expectedTypes) {
      if (isExpressionFilter(filter)) {
          return filter;
      }
      if (!filter)
          return true;
      const op = filter[0];
      if (filter.length <= 1)
          return op !== 'any';
      let converted;
      if (op === '==' || op === '!=' || op === '<' || op === '>' || op === '<=' || op === '>=') {
          const [, property, value] = filter;
          converted = convertComparisonOp$1(property, value, op, expectedTypes);
      } else if (op === 'any') {
          const children = filter.slice(1).map(f => {
              const types = {};
              const child = _convertFilter(f, types);
              const typechecks = runtimeTypeChecks(types);
              return typechecks === true ? child : [
                  'case',
                  typechecks,
                  child,
                  false
              ];
          });
          return ['any'].concat(children);
      } else if (op === 'all') {
          const children = filter.slice(1).map(f => _convertFilter(f, expectedTypes));
          return children.length > 1 ? ['all'].concat(children) : [].concat(...children);
      } else if (op === 'none') {
          return [
              '!',
              _convertFilter(['any'].concat(filter.slice(1)), {})
          ];
      } else if (op === 'in') {
          converted = convertInOp$1(filter[1], filter.slice(2));
      } else if (op === '!in') {
          converted = convertInOp$1(filter[1], filter.slice(2), true);
      } else if (op === 'has') {
          converted = convertHasOp$1(filter[1]);
      } else if (op === '!has') {
          converted = [
              '!',
              convertHasOp$1(filter[1])
          ];
      } else {
          converted = true;
      }
      return converted;
  }
  function runtimeTypeChecks(expectedTypes) {
      const conditions = [];
      for (const property in expectedTypes) {
          const get = property === '$id' ? ['id'] : [
              'get',
              property
          ];
          conditions.push([
              '==',
              [
                  'typeof',
                  get
              ],
              expectedTypes[property]
          ]);
      }
      if (conditions.length === 0)
          return true;
      if (conditions.length === 1)
          return conditions[0];
      return ['all'].concat(conditions);
  }
  function convertComparisonOp$1(property, value, op, expectedTypes) {
      let get;
      if (property === '$type') {
          return [
              op,
              ['geometry-type'],
              value
          ];
      } else if (property === '$id') {
          get = ['id'];
      } else {
          get = [
              'get',
              property
          ];
      }
      if (expectedTypes && value !== null) {
          const type = typeof value;
          expectedTypes[property] = type;
      }
      if (op === '==' && property !== '$id' && value === null) {
          return [
              'all',
              [
                  'has',
                  property
              ],
              [
                  '==',
                  get,
                  null
              ]
          ];
      } else if (op === '!=' && property !== '$id' && value === null) {
          return [
              'any',
              [
                  '!',
                  [
                      'has',
                      property
                  ]
              ],
              [
                  '!=',
                  get,
                  null
              ]
          ];
      }
      return [
          op,
          get,
          value
      ];
  }
  function convertInOp$1(property, values, negate = false) {
      if (values.length === 0)
          return negate;
      let get;
      if (property === '$type') {
          get = ['geometry-type'];
      } else if (property === '$id') {
          get = ['id'];
      } else {
          get = [
              'get',
              property
          ];
      }
      let uniformTypes = true;
      const type = typeof values[0];
      for (const value of values) {
          if (typeof value !== type) {
              uniformTypes = false;
              break;
          }
      }
      if (uniformTypes && (type === 'string' || type === 'number')) {
          const uniqueValues = values.sort().filter((v, i) => i === 0 || values[i - 1] !== v);
          return [
              'match',
              get,
              uniqueValues,
              !negate,
              negate
          ];
      }
      return [negate ? 'all' : 'any'].concat(values.map(v => [
          negate ? '!=' : '==',
          get,
          v
      ]));
  }
  function convertHasOp$1(property) {
      if (property === '$type') {
          return true;
      } else if (property === '$id') {
          return [
              '!=',
              ['id'],
              null
          ];
      } else {
          return [
              'has',
              property
          ];
      }
  }

  function migrateToExpressions (style) {
      const converted = [];
      eachLayer(style, layer => {
          if (layer.filter) {
              layer.filter = convertFilter$1(layer.filter);
          }
      });
      eachProperty(style, {
          paint: true,
          layout: true
      }, ({path, value, reference, set}) => {
          if (isExpression(value))
              return;
          if (typeof value === 'object' && !Array.isArray(value)) {
              set(convertFunction(value, reference));
              converted.push(path.join('.'));
          } else if (reference.tokens && typeof value === 'string') {
              set(convertTokenString(value));
          }
      });
      return style;
  }

  function migrate (style) {
      let migrated = false;
      if (style.version === 7) {
          style = migrateToV8(style);
          migrated = true;
      }
      if (style.version === 8) {
          migrated = migrateToExpressions(style);
          migrated = true;
      }
      if (!migrated) {
          throw new Error('cannot migrate from', style.version);
      }
      return style;
  }

  function composite (style) {
      const styleIDs = [];
      const sourceIDs = [];
      const compositedSourceLayers = [];
      for (const id in style.sources) {
          const source = style.sources[id];
          if (source.type !== 'vector')
              continue;
          const match = /^mapbox:\/\/(.*)/.exec(source.url);
          if (!match)
              continue;
          styleIDs.push(id);
          sourceIDs.push(match[1]);
      }
      if (styleIDs.length < 2)
          return style;
      styleIDs.forEach(id => {
          delete style.sources[id];
      });
      const compositeID = sourceIDs.join(',');
      style.sources[compositeID] = {
          'type': 'vector',
          'url': `mapbox://${ compositeID }`
      };
      style.layers.forEach(layer => {
          if (styleIDs.indexOf(layer.source) >= 0) {
              layer.source = compositeID;
              if ('source-layer' in layer) {
                  if (compositedSourceLayers.indexOf(layer['source-layer']) >= 0) {
                      throw new Error('Conflicting source layer names');
                  } else {
                      compositedSourceLayers.push(layer['source-layer']);
                  }
              }
          }
      });
      return style;
  }

  var refProperties = [
      'type',
      'source',
      'source-layer',
      'minzoom',
      'maxzoom',
      'filter',
      'layout'
  ];

  function deref(layer, parent) {
      const result = {};
      for (const k in layer) {
          if (k !== 'ref') {
              result[k] = layer[k];
          }
      }
      refProperties.forEach(k => {
          if (k in parent) {
              result[k] = parent[k];
          }
      });
      return result;
  }
  function derefLayers(layers) {
      layers = layers.slice();
      const map = Object.create(null);
      for (let i = 0; i < layers.length; i++) {
          map[layers[i].id] = layers[i];
      }
      for (let i = 0; i < layers.length; i++) {
          if ('ref' in layers[i]) {
              layers[i] = deref(layers[i], map[layers[i].ref]);
          }
      }
      return layers;
  }

  function deepEqual(a, b) {
      if (Array.isArray(a)) {
          if (!Array.isArray(b) || a.length !== b.length)
              return false;
          for (let i = 0; i < a.length; i++) {
              if (!deepEqual(a[i], b[i]))
                  return false;
          }
          return true;
      }
      if (typeof a === 'object' && a !== null && b !== null) {
          if (!(typeof b === 'object'))
              return false;
          const keys = Object.keys(a);
          if (keys.length !== Object.keys(b).length)
              return false;
          for (const key in a) {
              if (!deepEqual(a[key], b[key]))
                  return false;
          }
          return true;
      }
      return a === b;
  }

  const operations = {
      setStyle: 'setStyle',
      addLayer: 'addLayer',
      removeLayer: 'removeLayer',
      setPaintProperty: 'setPaintProperty',
      setLayoutProperty: 'setLayoutProperty',
      setFilter: 'setFilter',
      addSource: 'addSource',
      removeSource: 'removeSource',
      setGeoJSONSourceData: 'setGeoJSONSourceData',
      setLayerZoomRange: 'setLayerZoomRange',
      setLayerProperty: 'setLayerProperty',
      setCenter: 'setCenter',
      setZoom: 'setZoom',
      setBearing: 'setBearing',
      setPitch: 'setPitch',
      setSprite: 'setSprite',
      setGlyphs: 'setGlyphs',
      setTransition: 'setTransition',
      setLight: 'setLight',
      setTerrain: 'setTerrain',
      setFog: 'setFog'
  };
  function addSource(sourceId, after, commands) {
      commands.push({
          command: operations.addSource,
          args: [
              sourceId,
              after[sourceId]
          ]
      });
  }
  function removeSource(sourceId, commands, sourcesRemoved) {
      commands.push({
          command: operations.removeSource,
          args: [sourceId]
      });
      sourcesRemoved[sourceId] = true;
  }
  function updateSource(sourceId, after, commands, sourcesRemoved) {
      removeSource(sourceId, commands, sourcesRemoved);
      addSource(sourceId, after, commands);
  }
  function canUpdateGeoJSON(before, after, sourceId) {
      let prop;
      for (prop in before[sourceId]) {
          if (!before[sourceId].hasOwnProperty(prop))
              continue;
          if (prop !== 'data' && !deepEqual(before[sourceId][prop], after[sourceId][prop])) {
              return false;
          }
      }
      for (prop in after[sourceId]) {
          if (!after[sourceId].hasOwnProperty(prop))
              continue;
          if (prop !== 'data' && !deepEqual(before[sourceId][prop], after[sourceId][prop])) {
              return false;
          }
      }
      return true;
  }
  function diffSources(before, after, commands, sourcesRemoved) {
      before = before || {};
      after = after || {};
      let sourceId;
      for (sourceId in before) {
          if (!before.hasOwnProperty(sourceId))
              continue;
          if (!after.hasOwnProperty(sourceId)) {
              removeSource(sourceId, commands, sourcesRemoved);
          }
      }
      for (sourceId in after) {
          if (!after.hasOwnProperty(sourceId))
              continue;
          if (!before.hasOwnProperty(sourceId)) {
              addSource(sourceId, after, commands);
          } else if (!deepEqual(before[sourceId], after[sourceId])) {
              if (before[sourceId].type === 'geojson' && after[sourceId].type === 'geojson' && canUpdateGeoJSON(before, after, sourceId)) {
                  commands.push({
                      command: operations.setGeoJSONSourceData,
                      args: [
                          sourceId,
                          after[sourceId].data
                      ]
                  });
              } else {
                  updateSource(sourceId, after, commands, sourcesRemoved);
              }
          }
      }
  }
  function diffLayerPropertyChanges(before, after, commands, layerId, klass, command) {
      before = before || {};
      after = after || {};
      let prop;
      for (prop in before) {
          if (!before.hasOwnProperty(prop))
              continue;
          if (!deepEqual(before[prop], after[prop])) {
              commands.push({
                  command,
                  args: [
                      layerId,
                      prop,
                      after[prop],
                      klass
                  ]
              });
          }
      }
      for (prop in after) {
          if (!after.hasOwnProperty(prop) || before.hasOwnProperty(prop))
              continue;
          if (!deepEqual(before[prop], after[prop])) {
              commands.push({
                  command,
                  args: [
                      layerId,
                      prop,
                      after[prop],
                      klass
                  ]
              });
          }
      }
  }
  function pluckId(layer) {
      return layer.id;
  }
  function indexById(group, layer) {
      group[layer.id] = layer;
      return group;
  }
  function diffLayers(before, after, commands) {
      before = before || [];
      after = after || [];
      const beforeOrder = before.map(pluckId);
      const afterOrder = after.map(pluckId);
      const beforeIndex = before.reduce(indexById, {});
      const afterIndex = after.reduce(indexById, {});
      const tracker = beforeOrder.slice();
      const clean = Object.create(null);
      let i, d, layerId, beforeLayer, afterLayer, insertBeforeLayerId, prop;
      for (i = 0, d = 0; i < beforeOrder.length; i++) {
          layerId = beforeOrder[i];
          if (!afterIndex.hasOwnProperty(layerId)) {
              commands.push({
                  command: operations.removeLayer,
                  args: [layerId]
              });
              tracker.splice(tracker.indexOf(layerId, d), 1);
          } else {
              d++;
          }
      }
      for (i = 0, d = 0; i < afterOrder.length; i++) {
          layerId = afterOrder[afterOrder.length - 1 - i];
          if (tracker[tracker.length - 1 - i] === layerId)
              continue;
          if (beforeIndex.hasOwnProperty(layerId)) {
              commands.push({
                  command: operations.removeLayer,
                  args: [layerId]
              });
              tracker.splice(tracker.lastIndexOf(layerId, tracker.length - d), 1);
          } else {
              d++;
          }
          insertBeforeLayerId = tracker[tracker.length - i];
          commands.push({
              command: operations.addLayer,
              args: [
                  afterIndex[layerId],
                  insertBeforeLayerId
              ]
          });
          tracker.splice(tracker.length - i, 0, layerId);
          clean[layerId] = true;
      }
      for (i = 0; i < afterOrder.length; i++) {
          layerId = afterOrder[i];
          beforeLayer = beforeIndex[layerId];
          afterLayer = afterIndex[layerId];
          if (clean[layerId] || deepEqual(beforeLayer, afterLayer))
              continue;
          if (!deepEqual(beforeLayer.source, afterLayer.source) || !deepEqual(beforeLayer['source-layer'], afterLayer['source-layer']) || !deepEqual(beforeLayer.type, afterLayer.type)) {
              commands.push({
                  command: operations.removeLayer,
                  args: [layerId]
              });
              insertBeforeLayerId = tracker[tracker.lastIndexOf(layerId) + 1];
              commands.push({
                  command: operations.addLayer,
                  args: [
                      afterLayer,
                      insertBeforeLayerId
                  ]
              });
              continue;
          }
          diffLayerPropertyChanges(beforeLayer.layout, afterLayer.layout, commands, layerId, null, operations.setLayoutProperty);
          diffLayerPropertyChanges(beforeLayer.paint, afterLayer.paint, commands, layerId, null, operations.setPaintProperty);
          if (!deepEqual(beforeLayer.filter, afterLayer.filter)) {
              commands.push({
                  command: operations.setFilter,
                  args: [
                      layerId,
                      afterLayer.filter
                  ]
              });
          }
          if (!deepEqual(beforeLayer.minzoom, afterLayer.minzoom) || !deepEqual(beforeLayer.maxzoom, afterLayer.maxzoom)) {
              commands.push({
                  command: operations.setLayerZoomRange,
                  args: [
                      layerId,
                      afterLayer.minzoom,
                      afterLayer.maxzoom
                  ]
              });
          }
          for (prop in beforeLayer) {
              if (!beforeLayer.hasOwnProperty(prop))
                  continue;
              if (prop === 'layout' || prop === 'paint' || prop === 'filter' || prop === 'metadata' || prop === 'minzoom' || prop === 'maxzoom')
                  continue;
              if (prop.indexOf('paint.') === 0) {
                  diffLayerPropertyChanges(beforeLayer[prop], afterLayer[prop], commands, layerId, prop.slice(6), operations.setPaintProperty);
              } else if (!deepEqual(beforeLayer[prop], afterLayer[prop])) {
                  commands.push({
                      command: operations.setLayerProperty,
                      args: [
                          layerId,
                          prop,
                          afterLayer[prop]
                      ]
                  });
              }
          }
          for (prop in afterLayer) {
              if (!afterLayer.hasOwnProperty(prop) || beforeLayer.hasOwnProperty(prop))
                  continue;
              if (prop === 'layout' || prop === 'paint' || prop === 'filter' || prop === 'metadata' || prop === 'minzoom' || prop === 'maxzoom')
                  continue;
              if (prop.indexOf('paint.') === 0) {
                  diffLayerPropertyChanges(beforeLayer[prop], afterLayer[prop], commands, layerId, prop.slice(6), operations.setPaintProperty);
              } else if (!deepEqual(beforeLayer[prop], afterLayer[prop])) {
                  commands.push({
                      command: operations.setLayerProperty,
                      args: [
                          layerId,
                          prop,
                          afterLayer[prop]
                      ]
                  });
              }
          }
      }
  }
  function diffStyles(before, after) {
      if (!before)
          return [{
                  command: operations.setStyle,
                  args: [after]
              }];
      let commands = [];
      try {
          if (!deepEqual(before.version, after.version)) {
              return [{
                      command: operations.setStyle,
                      args: [after]
                  }];
          }
          if (!deepEqual(before.center, after.center)) {
              commands.push({
                  command: operations.setCenter,
                  args: [after.center]
              });
          }
          if (!deepEqual(before.zoom, after.zoom)) {
              commands.push({
                  command: operations.setZoom,
                  args: [after.zoom]
              });
          }
          if (!deepEqual(before.bearing, after.bearing)) {
              commands.push({
                  command: operations.setBearing,
                  args: [after.bearing]
              });
          }
          if (!deepEqual(before.pitch, after.pitch)) {
              commands.push({
                  command: operations.setPitch,
                  args: [after.pitch]
              });
          }
          if (!deepEqual(before.sprite, after.sprite)) {
              commands.push({
                  command: operations.setSprite,
                  args: [after.sprite]
              });
          }
          if (!deepEqual(before.glyphs, after.glyphs)) {
              commands.push({
                  command: operations.setGlyphs,
                  args: [after.glyphs]
              });
          }
          if (!deepEqual(before.transition, after.transition)) {
              commands.push({
                  command: operations.setTransition,
                  args: [after.transition]
              });
          }
          if (!deepEqual(before.light, after.light)) {
              commands.push({
                  command: operations.setLight,
                  args: [after.light]
              });
          }
          if (!deepEqual(before.fog, after.fog)) {
              commands.push({
                  command: operations.setFog,
                  args: [after.fog]
              });
          }
          const sourcesRemoved = {};
          const removeOrAddSourceCommands = [];
          diffSources(before.sources, after.sources, removeOrAddSourceCommands, sourcesRemoved);
          const beforeLayers = [];
          if (before.layers) {
              before.layers.forEach(layer => {
                  if (sourcesRemoved[layer.source]) {
                      commands.push({
                          command: operations.removeLayer,
                          args: [layer.id]
                      });
                  } else {
                      beforeLayers.push(layer);
                  }
              });
          }
          let beforeTerrain = before.terrain;
          if (beforeTerrain) {
              if (sourcesRemoved[beforeTerrain.source]) {
                  commands.push({
                      command: operations.setTerrain,
                      args: [undefined]
                  });
                  beforeTerrain = undefined;
              }
          }
          commands = commands.concat(removeOrAddSourceCommands);
          if (!deepEqual(beforeTerrain, after.terrain)) {
              commands.push({
                  command: operations.setTerrain,
                  args: [after.terrain]
              });
          }
          diffLayers(beforeLayers, after.layers, commands);
      } catch (e) {
          console.warn('Unable to compute style diff:', e);
          commands = [{
                  command: operations.setStyle,
                  args: [after]
              }];
      }
      return commands;
  }

  class ValidationError {
      constructor(key, value, message, identifier) {
          this.message = (key ? `${ key }: ` : '') + message;
          if (identifier)
              this.identifier = identifier;
          if (value !== null && value !== undefined && value.__line__) {
              this.line = value.__line__;
          }
      }
  }

  class ParsingError$1 {
      constructor(error) {
          this.error = error;
          this.message = error.message;
          const match = error.message.match(/line (\d+)/);
          this.line = match ? parseInt(match[1], 10) : 0;
      }
  }

  function validateConstants(options) {
      const key = options.key;
      const constants = options.value;
      if (constants) {
          return [new ValidationError(key, constants, 'constants have been deprecated as of v8')];
      } else {
          return [];
      }
  }

  function unbundle(value) {
      if (value instanceof Number || value instanceof String || value instanceof Boolean) {
          return value.valueOf();
      } else {
          return value;
      }
  }
  function deepUnbundle(value) {
      if (Array.isArray(value)) {
          return value.map(deepUnbundle);
      } else if (value instanceof Object && !(value instanceof Number || value instanceof String || value instanceof Boolean)) {
          const unbundledValue = {};
          for (const key in value) {
              unbundledValue[key] = deepUnbundle(value[key]);
          }
          return unbundledValue;
      }
      return unbundle(value);
  }

  function validateObject(options) {
      const key = options.key;
      const object = options.value;
      const elementSpecs = options.valueSpec || {};
      const elementValidators = options.objectElementValidators || {};
      const style = options.style;
      const styleSpec = options.styleSpec;
      let errors = [];
      const type = getType(object);
      if (type !== 'object') {
          return [new ValidationError(key, object, `object expected, ${ type } found`)];
      }
      for (const objectKey in object) {
          const elementSpecKey = objectKey.split('.')[0];
          const elementSpec = elementSpecs[elementSpecKey] || elementSpecs['*'];
          let validateElement;
          if (elementValidators[elementSpecKey]) {
              validateElement = elementValidators[elementSpecKey];
          } else if (elementSpecs[elementSpecKey]) {
              validateElement = validate;
          } else if (elementValidators['*']) {
              validateElement = elementValidators['*'];
          } else if (elementSpecs['*']) {
              validateElement = validate;
          } else {
              errors.push(new ValidationError(key, object[objectKey], `unknown property "${ objectKey }"`));
              continue;
          }
          errors = errors.concat(validateElement({
              key: (key ? `${ key }.` : key) + objectKey,
              value: object[objectKey],
              valueSpec: elementSpec,
              style,
              styleSpec,
              object,
              objectKey
          }, object));
      }
      for (const elementSpecKey in elementSpecs) {
          if (elementValidators[elementSpecKey]) {
              continue;
          }
          if (elementSpecs[elementSpecKey].required && elementSpecs[elementSpecKey]['default'] === undefined && object[elementSpecKey] === undefined) {
              errors.push(new ValidationError(key, object, `missing required property "${ elementSpecKey }"`));
          }
      }
      return errors;
  }

  function validateArray(options) {
      const array = options.value;
      const arraySpec = options.valueSpec;
      const style = options.style;
      const styleSpec = options.styleSpec;
      const key = options.key;
      const validateArrayElement = options.arrayElementValidator || validate;
      if (getType(array) !== 'array') {
          return [new ValidationError(key, array, `array expected, ${ getType(array) } found`)];
      }
      if (arraySpec.length && array.length !== arraySpec.length) {
          return [new ValidationError(key, array, `array length ${ arraySpec.length } expected, length ${ array.length } found`)];
      }
      if (arraySpec['min-length'] && array.length < arraySpec['min-length']) {
          return [new ValidationError(key, array, `array length at least ${ arraySpec['min-length'] } expected, length ${ array.length } found`)];
      }
      let arrayElementSpec = {
          'type': arraySpec.value,
          'values': arraySpec.values,
          'minimum': arraySpec.minimum,
          'maximum': arraySpec.maximum
      };
      if (styleSpec.$version < 7) {
          arrayElementSpec.function = arraySpec.function;
      }
      if (getType(arraySpec.value) === 'object') {
          arrayElementSpec = arraySpec.value;
      }
      let errors = [];
      for (let i = 0; i < array.length; i++) {
          errors = errors.concat(validateArrayElement({
              array,
              arrayIndex: i,
              value: array[i],
              valueSpec: arrayElementSpec,
              style,
              styleSpec,
              key: `${ key }[${ i }]`
          }));
      }
      return errors;
  }

  function validateNumber(options) {
      const key = options.key;
      const value = options.value;
      const valueSpec = options.valueSpec;
      let type = getType(value);
      if (type === 'number' && value !== value) {
          type = 'NaN';
      }
      if (type !== 'number') {
          return [new ValidationError(key, value, `number expected, ${ type } found`)];
      }
      if ('minimum' in valueSpec) {
          let specMin = valueSpec.minimum;
          if (getType(valueSpec.minimum) === 'array') {
              const i = options.arrayIndex;
              specMin = valueSpec.minimum[i];
          }
          if (value < specMin) {
              return [new ValidationError(key, value, `${ value } is less than the minimum value ${ specMin }`)];
          }
      }
      if ('maximum' in valueSpec) {
          let specMax = valueSpec.maximum;
          if (getType(valueSpec.maximum) === 'array') {
              const i = options.arrayIndex;
              specMax = valueSpec.maximum[i];
          }
          if (value > specMax) {
              return [new ValidationError(key, value, `${ value } is greater than the maximum value ${ specMax }`)];
          }
      }
      return [];
  }

  function validateFunction(options) {
      const functionValueSpec = options.valueSpec;
      const functionType = unbundle(options.value.type);
      let stopKeyType;
      let stopDomainValues = {};
      let previousStopDomainValue;
      let previousStopDomainZoom;
      const isZoomFunction = functionType !== 'categorical' && options.value.property === undefined;
      const isPropertyFunction = !isZoomFunction;
      const isZoomAndPropertyFunction = getType(options.value.stops) === 'array' && getType(options.value.stops[0]) === 'array' && getType(options.value.stops[0][0]) === 'object';
      const errors = validateObject({
          key: options.key,
          value: options.value,
          valueSpec: options.styleSpec.function,
          style: options.style,
          styleSpec: options.styleSpec,
          objectElementValidators: {
              stops: validateFunctionStops,
              default: validateFunctionDefault
          }
      });
      if (functionType === 'identity' && isZoomFunction) {
          errors.push(new ValidationError(options.key, options.value, 'missing required property "property"'));
      }
      if (functionType !== 'identity' && !options.value.stops) {
          errors.push(new ValidationError(options.key, options.value, 'missing required property "stops"'));
      }
      if (functionType === 'exponential' && options.valueSpec.expression && !supportsInterpolation(options.valueSpec)) {
          errors.push(new ValidationError(options.key, options.value, 'exponential functions not supported'));
      }
      if (options.styleSpec.$version >= 8) {
          if (isPropertyFunction && !supportsPropertyExpression(options.valueSpec)) {
              errors.push(new ValidationError(options.key, options.value, 'property functions not supported'));
          } else if (isZoomFunction && !supportsZoomExpression(options.valueSpec)) {
              errors.push(new ValidationError(options.key, options.value, 'zoom functions not supported'));
          }
      }
      if ((functionType === 'categorical' || isZoomAndPropertyFunction) && options.value.property === undefined) {
          errors.push(new ValidationError(options.key, options.value, '"property" property is required'));
      }
      return errors;
      function validateFunctionStops(options) {
          if (functionType === 'identity') {
              return [new ValidationError(options.key, options.value, 'identity function may not have a "stops" property')];
          }
          let errors = [];
          const value = options.value;
          errors = errors.concat(validateArray({
              key: options.key,
              value,
              valueSpec: options.valueSpec,
              style: options.style,
              styleSpec: options.styleSpec,
              arrayElementValidator: validateFunctionStop
          }));
          if (getType(value) === 'array' && value.length === 0) {
              errors.push(new ValidationError(options.key, value, 'array must have at least one stop'));
          }
          return errors;
      }
      function validateFunctionStop(options) {
          let errors = [];
          const value = options.value;
          const key = options.key;
          if (getType(value) !== 'array') {
              return [new ValidationError(key, value, `array expected, ${ getType(value) } found`)];
          }
          if (value.length !== 2) {
              return [new ValidationError(key, value, `array length 2 expected, length ${ value.length } found`)];
          }
          if (isZoomAndPropertyFunction) {
              if (getType(value[0]) !== 'object') {
                  return [new ValidationError(key, value, `object expected, ${ getType(value[0]) } found`)];
              }
              if (value[0].zoom === undefined) {
                  return [new ValidationError(key, value, 'object stop key must have zoom')];
              }
              if (value[0].value === undefined) {
                  return [new ValidationError(key, value, 'object stop key must have value')];
              }
              if (previousStopDomainZoom && previousStopDomainZoom > unbundle(value[0].zoom)) {
                  return [new ValidationError(key, value[0].zoom, 'stop zoom values must appear in ascending order')];
              }
              if (unbundle(value[0].zoom) !== previousStopDomainZoom) {
                  previousStopDomainZoom = unbundle(value[0].zoom);
                  previousStopDomainValue = undefined;
                  stopDomainValues = {};
              }
              errors = errors.concat(validateObject({
                  key: `${ key }[0]`,
                  value: value[0],
                  valueSpec: { zoom: {} },
                  style: options.style,
                  styleSpec: options.styleSpec,
                  objectElementValidators: {
                      zoom: validateNumber,
                      value: validateStopDomainValue
                  }
              }));
          } else {
              errors = errors.concat(validateStopDomainValue({
                  key: `${ key }[0]`,
                  value: value[0],
                  valueSpec: {},
                  style: options.style,
                  styleSpec: options.styleSpec
              }, value));
          }
          if (isExpression(deepUnbundle(value[1]))) {
              return errors.concat([new ValidationError(`${ key }[1]`, value[1], 'expressions are not allowed in function stops.')]);
          }
          return errors.concat(validate({
              key: `${ key }[1]`,
              value: value[1],
              valueSpec: functionValueSpec,
              style: options.style,
              styleSpec: options.styleSpec
          }));
      }
      function validateStopDomainValue(options, stop) {
          const type = getType(options.value);
          const value = unbundle(options.value);
          const reportValue = options.value !== null ? options.value : stop;
          if (!stopKeyType) {
              stopKeyType = type;
          } else if (type !== stopKeyType) {
              return [new ValidationError(options.key, reportValue, `${ type } stop domain type must match previous stop domain type ${ stopKeyType }`)];
          }
          if (type !== 'number' && type !== 'string' && type !== 'boolean') {
              return [new ValidationError(options.key, reportValue, 'stop domain value must be a number, string, or boolean')];
          }
          if (type !== 'number' && functionType !== 'categorical') {
              let message = `number expected, ${ type } found`;
              if (supportsPropertyExpression(functionValueSpec) && functionType === undefined) {
                  message += '\nIf you intended to use a categorical function, specify `"type": "categorical"`.';
              }
              return [new ValidationError(options.key, reportValue, message)];
          }
          if (functionType === 'categorical' && type === 'number' && (!isFinite(value) || Math.floor(value) !== value)) {
              return [new ValidationError(options.key, reportValue, `integer expected, found ${ value }`)];
          }
          if (functionType !== 'categorical' && type === 'number' && previousStopDomainValue !== undefined && value < previousStopDomainValue) {
              return [new ValidationError(options.key, reportValue, 'stop domain values must appear in ascending order')];
          } else {
              previousStopDomainValue = value;
          }
          if (functionType === 'categorical' && value in stopDomainValues) {
              return [new ValidationError(options.key, reportValue, 'stop domain values must be unique')];
          } else {
              stopDomainValues[value] = true;
          }
          return [];
      }
      function validateFunctionDefault(options) {
          return validate({
              key: options.key,
              value: options.value,
              valueSpec: functionValueSpec,
              style: options.style,
              styleSpec: options.styleSpec
          });
      }
  }

  function validateExpression(options) {
      const expression = (options.expressionContext === 'property' ? createPropertyExpression : createExpression)(deepUnbundle(options.value), options.valueSpec);
      if (expression.result === 'error') {
          return expression.value.map(error => {
              return new ValidationError(`${ options.key }${ error.key }`, options.value, error.message);
          });
      }
      const expressionObj = expression.value.expression || expression.value._styleExpression.expression;
      if (options.expressionContext === 'property' && options.propertyKey === 'text-font' && !expressionObj.outputDefined()) {
          return [new ValidationError(options.key, options.value, `Invalid data expression for "${ options.propertyKey }". Output values must be contained as literals within the expression.`)];
      }
      if (options.expressionContext === 'property' && options.propertyType === 'layout' && !isStateConstant(expressionObj)) {
          return [new ValidationError(options.key, options.value, '"feature-state" data expressions are not supported with layout properties.')];
      }
      if (options.expressionContext === 'filter' && !isStateConstant(expressionObj)) {
          return [new ValidationError(options.key, options.value, '"feature-state" data expressions are not supported with filters.')];
      }
      if (options.expressionContext && options.expressionContext.indexOf('cluster') === 0) {
          if (!isGlobalPropertyConstant(expressionObj, [
                  'zoom',
                  'feature-state'
              ])) {
              return [new ValidationError(options.key, options.value, '"zoom" and "feature-state" expressions are not supported with cluster properties.')];
          }
          if (options.expressionContext === 'cluster-initial' && !isFeatureConstant(expressionObj)) {
              return [new ValidationError(options.key, options.value, 'Feature data expressions are not supported with initial expression part of cluster properties.')];
          }
      }
      return [];
  }

  function validateBoolean(options) {
      const value = options.value;
      const key = options.key;
      const type = getType(value);
      if (type !== 'boolean') {
          return [new ValidationError(key, value, `boolean expected, ${ type } found`)];
      }
      return [];
  }

  function validateColor(options) {
      const key = options.key;
      const value = options.value;
      const type = getType(value);
      if (type !== 'string') {
          return [new ValidationError(key, value, `color expected, ${ type } found`)];
      }
      if (csscolorparser.parseCSSColor(value) === null) {
          return [new ValidationError(key, value, `color expected, "${ value }" found`)];
      }
      return [];
  }

  function validateEnum(options) {
      const key = options.key;
      const value = options.value;
      const valueSpec = options.valueSpec;
      const errors = [];
      if (Array.isArray(valueSpec.values)) {
          if (valueSpec.values.indexOf(unbundle(value)) === -1) {
              errors.push(new ValidationError(key, value, `expected one of [${ valueSpec.values.join(', ') }], ${ JSON.stringify(value) } found`));
          }
      } else {
          if (Object.keys(valueSpec.values).indexOf(unbundle(value)) === -1) {
              errors.push(new ValidationError(key, value, `expected one of [${ Object.keys(valueSpec.values).join(', ') }], ${ JSON.stringify(value) } found`));
          }
      }
      return errors;
  }

  function validateFilter(options) {
      if (isExpressionFilter(deepUnbundle(options.value))) {
          return validateExpression(extend({}, options, {
              expressionContext: 'filter',
              valueSpec: { value: 'boolean' }
          }));
      } else {
          return validateNonExpressionFilter(options);
      }
  }
  function validateNonExpressionFilter(options) {
      const value = options.value;
      const key = options.key;
      if (getType(value) !== 'array') {
          return [new ValidationError(key, value, `array expected, ${ getType(value) } found`)];
      }
      const styleSpec = options.styleSpec;
      let type;
      let errors = [];
      if (value.length < 1) {
          return [new ValidationError(key, value, 'filter array must have at least 1 element')];
      }
      errors = errors.concat(validateEnum({
          key: `${ key }[0]`,
          value: value[0],
          valueSpec: styleSpec.filter_operator,
          style: options.style,
          styleSpec: options.styleSpec
      }));
      switch (unbundle(value[0])) {
      case '<':
      case '<=':
      case '>':
      case '>=':
          if (value.length >= 2 && unbundle(value[1]) === '$type') {
              errors.push(new ValidationError(key, value, `"$type" cannot be use with operator "${ value[0] }"`));
          }
      case '==':
      case '!=':
          if (value.length !== 3) {
              errors.push(new ValidationError(key, value, `filter array for operator "${ value[0] }" must have 3 elements`));
          }
      case 'in':
      case '!in':
          if (value.length >= 2) {
              type = getType(value[1]);
              if (type !== 'string') {
                  errors.push(new ValidationError(`${ key }[1]`, value[1], `string expected, ${ type } found`));
              }
          }
          for (let i = 2; i < value.length; i++) {
              type = getType(value[i]);
              if (unbundle(value[1]) === '$type') {
                  errors = errors.concat(validateEnum({
                      key: `${ key }[${ i }]`,
                      value: value[i],
                      valueSpec: styleSpec.geometry_type,
                      style: options.style,
                      styleSpec: options.styleSpec
                  }));
              } else if (type !== 'string' && type !== 'number' && type !== 'boolean') {
                  errors.push(new ValidationError(`${ key }[${ i }]`, value[i], `string, number, or boolean expected, ${ type } found`));
              }
          }
          break;
      case 'any':
      case 'all':
      case 'none':
          for (let i = 1; i < value.length; i++) {
              errors = errors.concat(validateNonExpressionFilter({
                  key: `${ key }[${ i }]`,
                  value: value[i],
                  style: options.style,
                  styleSpec: options.styleSpec
              }));
          }
          break;
      case 'has':
      case '!has':
          type = getType(value[1]);
          if (value.length !== 2) {
              errors.push(new ValidationError(key, value, `filter array for "${ value[0] }" operator must have 2 elements`));
          } else if (type !== 'string') {
              errors.push(new ValidationError(`${ key }[1]`, value[1], `string expected, ${ type } found`));
          }
          break;
      case 'within':
          type = getType(value[1]);
          if (value.length !== 2) {
              errors.push(new ValidationError(key, value, `filter array for "${ value[0] }" operator must have 2 elements`));
          } else if (type !== 'object') {
              errors.push(new ValidationError(`${ key }[1]`, value[1], `object expected, ${ type } found`));
          }
          break;
      }
      return errors;
  }

  function validateProperty(options, propertyType) {
      const key = options.key;
      const style = options.style;
      const styleSpec = options.styleSpec;
      const value = options.value;
      const propertyKey = options.objectKey;
      const layerSpec = styleSpec[`${ propertyType }_${ options.layerType }`];
      if (!layerSpec)
          return [];
      const transitionMatch = propertyKey.match(/^(.*)-transition$/);
      if (propertyType === 'paint' && transitionMatch && layerSpec[transitionMatch[1]] && layerSpec[transitionMatch[1]].transition) {
          return validate({
              key,
              value,
              valueSpec: styleSpec.transition,
              style,
              styleSpec
          });
      }
      const valueSpec = options.valueSpec || layerSpec[propertyKey];
      if (!valueSpec) {
          return [new ValidationError(key, value, `unknown property "${ propertyKey }"`)];
      }
      let tokenMatch;
      if (getType(value) === 'string' && supportsPropertyExpression(valueSpec) && !valueSpec.tokens && (tokenMatch = /^{([^}]+)}$/.exec(value))) {
          return [new ValidationError(key, value, `"${ propertyKey }" does not support interpolation syntax\n` + `Use an identity property function instead: \`{ "type": "identity", "property": ${ JSON.stringify(tokenMatch[1]) } }\`.`)];
      }
      const errors = [];
      if (options.layerType === 'symbol') {
          if (propertyKey === 'text-field' && style && !style.glyphs) {
              errors.push(new ValidationError(key, value, 'use of "text-field" requires a style "glyphs" property'));
          }
          if (propertyKey === 'text-font' && isFunction$1(deepUnbundle(value)) && unbundle(value.type) === 'identity') {
              errors.push(new ValidationError(key, value, '"text-font" does not support identity functions'));
          }
      }
      return errors.concat(validate({
          key: options.key,
          value,
          valueSpec,
          style,
          styleSpec,
          expressionContext: 'property',
          propertyType,
          propertyKey
      }));
  }

  function validatePaintProperty(options) {
      return validateProperty(options, 'paint');
  }

  function validateLayoutProperty(options) {
      return validateProperty(options, 'layout');
  }

  function validateLayer(options) {
      let errors = [];
      const layer = options.value;
      const key = options.key;
      const style = options.style;
      const styleSpec = options.styleSpec;
      if (!layer.type && !layer.ref) {
          errors.push(new ValidationError(key, layer, 'either "type" or "ref" is required'));
      }
      let type = unbundle(layer.type);
      const ref = unbundle(layer.ref);
      if (layer.id) {
          const layerId = unbundle(layer.id);
          for (let i = 0; i < options.arrayIndex; i++) {
              const otherLayer = style.layers[i];
              if (unbundle(otherLayer.id) === layerId) {
                  errors.push(new ValidationError(key, layer.id, `duplicate layer id "${ layer.id }", previously used at line ${ otherLayer.id.__line__ }`));
              }
          }
      }
      if ('ref' in layer) {
          [
              'type',
              'source',
              'source-layer',
              'filter',
              'layout'
          ].forEach(p => {
              if (p in layer) {
                  errors.push(new ValidationError(key, layer[p], `"${ p }" is prohibited for ref layers`));
              }
          });
          let parent;
          style.layers.forEach(layer => {
              if (unbundle(layer.id) === ref)
                  parent = layer;
          });
          if (!parent) {
              errors.push(new ValidationError(key, layer.ref, `ref layer "${ ref }" not found`));
          } else if (parent.ref) {
              errors.push(new ValidationError(key, layer.ref, 'ref cannot reference another ref layer'));
          } else {
              type = unbundle(parent.type);
          }
      } else if (!(type === 'background' || type === 'sky')) {
          if (!layer.source) {
              errors.push(new ValidationError(key, layer, 'missing required property "source"'));
          } else {
              const source = style.sources && style.sources[layer.source];
              const sourceType = source && unbundle(source.type);
              if (!source) {
                  errors.push(new ValidationError(key, layer.source, `source "${ layer.source }" not found`));
              } else if (sourceType === 'vector' && type === 'raster') {
                  errors.push(new ValidationError(key, layer.source, `layer "${ layer.id }" requires a raster source`));
              } else if (sourceType === 'raster' && type !== 'raster') {
                  errors.push(new ValidationError(key, layer.source, `layer "${ layer.id }" requires a vector source`));
              } else if (sourceType === 'vector' && !layer['source-layer']) {
                  errors.push(new ValidationError(key, layer, `layer "${ layer.id }" must specify a "source-layer"`));
              } else if (sourceType === 'raster-dem' && type !== 'hillshade') {
                  errors.push(new ValidationError(key, layer.source, 'raster-dem source can only be used with layer type \'hillshade\'.'));
              } else if (type === 'line' && layer.paint && layer.paint['line-gradient'] && (sourceType !== 'geojson' || !source.lineMetrics)) {
                  errors.push(new ValidationError(key, layer, `layer "${ layer.id }" specifies a line-gradient, which requires a GeoJSON source with \`lineMetrics\` enabled.`));
              }
          }
      }
      errors = errors.concat(validateObject({
          key,
          value: layer,
          valueSpec: styleSpec.layer,
          style: options.style,
          styleSpec: options.styleSpec,
          objectElementValidators: {
              '*'() {
                  return [];
              },
              type() {
                  return validate({
                      key: `${ key }.type`,
                      value: layer.type,
                      valueSpec: styleSpec.layer.type,
                      style: options.style,
                      styleSpec: options.styleSpec,
                      object: layer,
                      objectKey: 'type'
                  });
              },
              filter: validateFilter,
              layout(options) {
                  return validateObject({
                      layer,
                      key: options.key,
                      value: options.value,
                      style: options.style,
                      styleSpec: options.styleSpec,
                      objectElementValidators: {
                          '*'(options) {
                              return validateLayoutProperty(extend({ layerType: type }, options));
                          }
                      }
                  });
              },
              paint(options) {
                  return validateObject({
                      layer,
                      key: options.key,
                      value: options.value,
                      style: options.style,
                      styleSpec: options.styleSpec,
                      objectElementValidators: {
                          '*'(options) {
                              return validatePaintProperty(extend({ layerType: type }, options));
                          }
                      }
                  });
              }
          }
      }));
      return errors;
  }

  function validateString(options) {
      const value = options.value;
      const key = options.key;
      const type = getType(value);
      if (type !== 'string') {
          return [new ValidationError(key, value, `string expected, ${ type } found`)];
      }
      return [];
  }

  const objectElementValidators = { promoteId: validatePromoteId };
  function validateSource(options) {
      const value = options.value;
      const key = options.key;
      const styleSpec = options.styleSpec;
      const style = options.style;
      if (!value.type) {
          return [new ValidationError(key, value, '"type" is required')];
      }
      const type = unbundle(value.type);
      let errors;
      switch (type) {
      case 'vector':
      case 'raster':
      case 'raster-dem':
          errors = validateObject({
              key,
              value,
              valueSpec: styleSpec[`source_${ type.replace('-', '_') }`],
              style: options.style,
              styleSpec,
              objectElementValidators
          });
          return errors;
      case 'geojson':
          errors = validateObject({
              key,
              value,
              valueSpec: styleSpec.source_geojson,
              style,
              styleSpec,
              objectElementValidators
          });
          if (value.cluster) {
              for (const prop in value.clusterProperties) {
                  const [operator, mapExpr] = value.clusterProperties[prop];
                  const reduceExpr = typeof operator === 'string' ? [
                      operator,
                      ['accumulated'],
                      [
                          'get',
                          prop
                      ]
                  ] : operator;
                  errors.push(...validateExpression({
                      key: `${ key }.${ prop }.map`,
                      value: mapExpr,
                      expressionContext: 'cluster-map'
                  }));
                  errors.push(...validateExpression({
                      key: `${ key }.${ prop }.reduce`,
                      value: reduceExpr,
                      expressionContext: 'cluster-reduce'
                  }));
              }
          }
          return errors;
      case 'video':
          return validateObject({
              key,
              value,
              valueSpec: styleSpec.source_video,
              style,
              styleSpec
          });
      case 'image':
          return validateObject({
              key,
              value,
              valueSpec: styleSpec.source_image,
              style,
              styleSpec
          });
      case 'canvas':
          return [new ValidationError(key, null, `Please use runtime APIs to add canvas sources, rather than including them in stylesheets.`, 'source.canvas')];
      default:
          return validateEnum({
              key: `${ key }.type`,
              value: value.type,
              valueSpec: {
                  values: [
                      'vector',
                      'raster',
                      'raster-dem',
                      'geojson',
                      'video',
                      'image'
                  ]
              },
              style,
              styleSpec
          });
      }
  }
  function validatePromoteId({key, value}) {
      if (getType(value) === 'string') {
          return validateString({
              key,
              value
          });
      } else {
          const errors = [];
          for (const prop in value) {
              errors.push(...validateString({
                  key: `${ key }.${ prop }`,
                  value: value[prop]
              }));
          }
          return errors;
      }
  }

  function validateLight(options) {
      const light = options.value;
      const styleSpec = options.styleSpec;
      const lightSpec = styleSpec.light;
      const style = options.style;
      let errors = [];
      const rootType = getType(light);
      if (light === undefined) {
          return errors;
      } else if (rootType !== 'object') {
          errors = errors.concat([new ValidationError('light', light, `object expected, ${ rootType } found`)]);
          return errors;
      }
      for (const key in light) {
          const transitionMatch = key.match(/^(.*)-transition$/);
          if (transitionMatch && lightSpec[transitionMatch[1]] && lightSpec[transitionMatch[1]].transition) {
              errors = errors.concat(validate({
                  key,
                  value: light[key],
                  valueSpec: styleSpec.transition,
                  style,
                  styleSpec
              }));
          } else if (lightSpec[key]) {
              errors = errors.concat(validate({
                  key,
                  value: light[key],
                  valueSpec: lightSpec[key],
                  style,
                  styleSpec
              }));
          } else {
              errors = errors.concat([new ValidationError(key, light[key], `unknown property "${ key }"`)]);
          }
      }
      return errors;
  }

  function validateTerrain(options) {
      const terrain = options.value;
      const key = options.key;
      const style = options.style;
      const styleSpec = options.styleSpec;
      const terrainSpec = styleSpec.terrain;
      let errors = [];
      const rootType = getType(terrain);
      if (terrain === undefined) {
          return errors;
      } else if (rootType !== 'object') {
          errors = errors.concat([new ValidationError('terrain', terrain, `object expected, ${ rootType } found`)]);
          return errors;
      }
      for (const key in terrain) {
          const transitionMatch = key.match(/^(.*)-transition$/);
          if (transitionMatch && terrainSpec[transitionMatch[1]] && terrainSpec[transitionMatch[1]].transition) {
              errors = errors.concat(validate({
                  key,
                  value: terrain[key],
                  valueSpec: styleSpec.transition,
                  style,
                  styleSpec
              }));
          } else if (terrainSpec[key]) {
              errors = errors.concat(validate({
                  key,
                  value: terrain[key],
                  valueSpec: terrainSpec[key],
                  style,
                  styleSpec
              }));
          } else {
              errors = errors.concat([new ValidationError(key, terrain[key], `unknown property "${ key }"`)]);
          }
      }
      if (!terrain.source) {
          errors.push(new ValidationError(key, terrain, `terrain is missing required property "source"`));
      } else {
          const source = style.sources && style.sources[terrain.source];
          const sourceType = source && unbundle(source.type);
          if (!source) {
              errors.push(new ValidationError(key, terrain.source, `source "${ terrain.source }" not found`));
          } else if (sourceType !== 'raster-dem') {
              errors.push(new ValidationError(key, terrain.source, `terrain cannot be used with a source of type ${ sourceType }, it only be used with a "raster-dem" source type`));
          }
      }
      return errors;
  }

  function validateFog(options) {
      const fog = options.value;
      const style = options.style;
      const styleSpec = options.styleSpec;
      const fogSpec = styleSpec.fog;
      let errors = [];
      const rootType = getType(fog);
      if (fog === undefined) {
          return errors;
      } else if (rootType !== 'object') {
          errors = errors.concat([new ValidationError('fog', fog, `object expected, ${ rootType } found`)]);
          return errors;
      }
      if (fog.range && !isExpression(deepUnbundle(fog.range)) && fog.range[0] >= fog.range[1]) {
          errors = errors.concat([new ValidationError('fog', fog, 'fog.range[0] can\'t be greater than or equal to fog.range[1]')]);
      }
      for (const key in fog) {
          const transitionMatch = key.match(/^(.*)-transition$/);
          if (transitionMatch && fogSpec[transitionMatch[1]] && fogSpec[transitionMatch[1]].transition) {
              errors = errors.concat(validate({
                  key,
                  value: fog[key],
                  valueSpec: styleSpec.transition,
                  style,
                  styleSpec
              }));
          } else if (fogSpec[key]) {
              errors = errors.concat(validate({
                  key,
                  value: fog[key],
                  valueSpec: fogSpec[key],
                  style,
                  styleSpec
              }));
          } else {
              errors = errors.concat([new ValidationError(key, fog[key], `unknown property "${ key }"`)]);
          }
      }
      return errors;
  }

  function validateFormatted(options) {
      if (validateString(options).length === 0) {
          return [];
      }
      return validateExpression(options);
  }

  function validateImage(options) {
      if (validateString(options).length === 0) {
          return [];
      }
      return validateExpression(options);
  }

  const VALIDATORS = {
      '*'() {
          return [];
      },
      'array': validateArray,
      'boolean': validateBoolean,
      'number': validateNumber,
      'color': validateColor,
      'constants': validateConstants,
      'enum': validateEnum,
      'filter': validateFilter,
      'function': validateFunction,
      'layer': validateLayer,
      'object': validateObject,
      'source': validateSource,
      'light': validateLight,
      'terrain': validateTerrain,
      'fog': validateFog,
      'string': validateString,
      'formatted': validateFormatted,
      'resolvedImage': validateImage
  };
  function validate(options) {
      const value = options.value;
      const valueSpec = options.valueSpec;
      const styleSpec = options.styleSpec;
      if (valueSpec.expression && isFunction$1(unbundle(value))) {
          return validateFunction(options);
      } else if (valueSpec.expression && isExpression(deepUnbundle(value))) {
          return validateExpression(options);
      } else if (valueSpec.type && VALIDATORS[valueSpec.type]) {
          return VALIDATORS[valueSpec.type](options);
      } else {
          const valid = validateObject(extend({}, options, { valueSpec: valueSpec.type ? styleSpec[valueSpec.type] : valueSpec }));
          return valid;
      }
  }

  function validateGlyphsURL (options) {
      const value = options.value;
      const key = options.key;
      const errors = validateString(options);
      if (errors.length)
          return errors;
      if (value.indexOf('{fontstack}') === -1) {
          errors.push(new ValidationError(key, value, '"glyphs" url must include a "{fontstack}" token'));
      }
      if (value.indexOf('{range}') === -1) {
          errors.push(new ValidationError(key, value, '"glyphs" url must include a "{range}" token'));
      }
      return errors;
  }

  function validateStyleMin(style, styleSpec = v8) {
      let errors = [];
      errors = errors.concat(validate({
          key: '',
          value: style,
          valueSpec: styleSpec.$root,
          styleSpec,
          style,
          objectElementValidators: {
              glyphs: validateGlyphsURL,
              '*'() {
                  return [];
              }
          }
      }));
      if (style.constants) {
          errors = errors.concat(validateConstants({
              key: 'constants',
              value: style.constants,
              style,
              styleSpec
          }));
      }
      return sortErrors(errors);
  }
  validateStyleMin.source = wrapCleanErrors(validateSource);
  validateStyleMin.light = wrapCleanErrors(validateLight);
  validateStyleMin.terrain = wrapCleanErrors(validateTerrain);
  validateStyleMin.fog = wrapCleanErrors(validateFog);
  validateStyleMin.layer = wrapCleanErrors(validateLayer);
  validateStyleMin.filter = wrapCleanErrors(validateFilter);
  validateStyleMin.paintProperty = wrapCleanErrors(validatePaintProperty);
  validateStyleMin.layoutProperty = wrapCleanErrors(validateLayoutProperty);
  function sortErrors(errors) {
      return [].concat(errors).sort((a, b) => {
          return a.line - b.line;
      });
  }
  function wrapCleanErrors(inner) {
      return function (...args) {
          return sortErrors(inner.apply(this, args));
      };
  }

  /* parser generated by jison 0.4.15 */

  var jsonlint = createCommonjsModule(function (module, exports) {
  /*
    Returns a Parser object of the following structure:

    Parser: {
      yy: {}
    }

    Parser.prototype: {
      yy: {},
      trace: function(),
      symbols_: {associative list: name ==> number},
      terminals_: {associative list: number ==> name},
      productions_: [...],
      performAction: function anonymous(yytext, yyleng, yylineno, yy, yystate, $$, _$),
      table: [...],
      defaultActions: {...},
      parseError: function(str, hash),
      parse: function(input),

      lexer: {
          EOF: 1,
          parseError: function(str, hash),
          setInput: function(input),
          input: function(),
          unput: function(str),
          more: function(),
          less: function(n),
          pastInput: function(),
          upcomingInput: function(),
          showPosition: function(),
          test_match: function(regex_match_array, rule_index),
          next: function(),
          lex: function(),
          begin: function(condition),
          popState: function(),
          _currentRules: function(),
          topState: function(),
          pushState: function(condition),

          options: {
              ranges: boolean           (optional: true ==> token location info will include a .range[] member)
              flex: boolean             (optional: true ==> flex-like lexing behaviour where the rules are tested exhaustively to find the longest match)
              backtrack_lexer: boolean  (optional: true ==> lexer regexes are tested in order and for each matching regex the action code is invoked; the lexer terminates the scan when a token is returned by the action code)
          },

          performAction: function(yy, yy_, $avoiding_name_collisions, YY_START),
          rules: [...],
          conditions: {associative list: name ==> set},
      }
    }


    token location info (@$, _$, etc.): {
      first_line: n,
      last_line: n,
      first_column: n,
      last_column: n,
      range: [start_number, end_number]       (where the numbers are indexes into the input string, regular zero-based)
    }


    the parseError function receives a 'hash' object with these members for lexer and parser errors: {
      text:        (matched text)
      token:       (the produced terminal token, if any)
      line:        (yylineno)
    }
    while parser (grammar) errors will also provide these members, i.e. parser errors deliver a superset of attributes: {
      loc:         (yylloc)
      expected:    (string describing the set of expected tokens)
      recoverable: (boolean: TRUE when the parser has a error recovery rule available for this particular error)
    }
  */
  var parser = (function(){
  var o=function(k,v,o,l){for(o=o||{},l=k.length;l--;o[k[l]]=v);return o},$V0=[1,12],$V1=[1,13],$V2=[1,9],$V3=[1,10],$V4=[1,11],$V5=[1,14],$V6=[1,15],$V7=[14,18,22,24],$V8=[18,22],$V9=[22,24];
  var parser = {trace: function trace() { },
  yy: {},
  symbols_: {"error":2,"JSONString":3,"STRING":4,"JSONNumber":5,"NUMBER":6,"JSONNullLiteral":7,"NULL":8,"JSONBooleanLiteral":9,"TRUE":10,"FALSE":11,"JSONText":12,"JSONValue":13,"EOF":14,"JSONObject":15,"JSONArray":16,"{":17,"}":18,"JSONMemberList":19,"JSONMember":20,":":21,",":22,"[":23,"]":24,"JSONElementList":25,"$accept":0,"$end":1},
  terminals_: {2:"error",4:"STRING",6:"NUMBER",8:"NULL",10:"TRUE",11:"FALSE",14:"EOF",17:"{",18:"}",21:":",22:",",23:"[",24:"]"},
  productions_: [0,[3,1],[5,1],[7,1],[9,1],[9,1],[12,2],[13,1],[13,1],[13,1],[13,1],[13,1],[13,1],[15,2],[15,3],[20,3],[19,1],[19,3],[16,2],[16,3],[25,1],[25,3]],
  performAction: function anonymous(yytext, yyleng, yylineno, yy, yystate /* action[1] */, $$ /* vstack */, _$ /* lstack */) {
  /* this == yyval */

  var $0 = $$.length - 1;
  switch (yystate) {
  case 1:
   // replace escaped characters with actual character
            this.$ = new String(yytext.replace(/\\(\\|")/g, "$"+"1")
                       .replace(/\\n/g,'\n')
                       .replace(/\\r/g,'\r')
                       .replace(/\\t/g,'\t')
                       .replace(/\\v/g,'\v')
                       .replace(/\\f/g,'\f')
                       .replace(/\\b/g,'\b'));
            this.$.__line__ =  this._$.first_line;
          
  break;
  case 2:

              this.$ = new Number(yytext);
              this.$.__line__ =  this._$.first_line;
          
  break;
  case 3:

              this.$ = null;
          
  break;
  case 4:

              this.$ = new Boolean(true);
              this.$.__line__ = this._$.first_line;
          
  break;
  case 5:

              this.$ = new Boolean(false);
              this.$.__line__ = this._$.first_line;
          
  break;
  case 6:
  return this.$ = $$[$0-1];
  case 13:
  this.$ = {}; Object.defineProperty(this.$, '__line__', {
              value: this._$.first_line,
              enumerable: false
          });
  break;
  case 14: case 19:
  this.$ = $$[$0-1]; Object.defineProperty(this.$, '__line__', {
              value: this._$.first_line,
              enumerable: false
          });
  break;
  case 15:
  this.$ = [$$[$0-2], $$[$0]];
  break;
  case 16:
  this.$ = {}; this.$[$$[$0][0]] = $$[$0][1];
  break;
  case 17:
  this.$ = $$[$0-2]; $$[$0-2][$$[$0][0]] = $$[$0][1];
  break;
  case 18:
  this.$ = []; Object.defineProperty(this.$, '__line__', {
              value: this._$.first_line,
              enumerable: false
          });
  break;
  case 20:
  this.$ = [$$[$0]];
  break;
  case 21:
  this.$ = $$[$0-2]; $$[$0-2].push($$[$0]);
  break;
  }
  },
  table: [{3:5,4:$V0,5:6,6:$V1,7:3,8:$V2,9:4,10:$V3,11:$V4,12:1,13:2,15:7,16:8,17:$V5,23:$V6},{1:[3]},{14:[1,16]},o($V7,[2,7]),o($V7,[2,8]),o($V7,[2,9]),o($V7,[2,10]),o($V7,[2,11]),o($V7,[2,12]),o($V7,[2,3]),o($V7,[2,4]),o($V7,[2,5]),o([14,18,21,22,24],[2,1]),o($V7,[2,2]),{3:20,4:$V0,18:[1,17],19:18,20:19},{3:5,4:$V0,5:6,6:$V1,7:3,8:$V2,9:4,10:$V3,11:$V4,13:23,15:7,16:8,17:$V5,23:$V6,24:[1,21],25:22},{1:[2,6]},o($V7,[2,13]),{18:[1,24],22:[1,25]},o($V8,[2,16]),{21:[1,26]},o($V7,[2,18]),{22:[1,28],24:[1,27]},o($V9,[2,20]),o($V7,[2,14]),{3:20,4:$V0,20:29},{3:5,4:$V0,5:6,6:$V1,7:3,8:$V2,9:4,10:$V3,11:$V4,13:30,15:7,16:8,17:$V5,23:$V6},o($V7,[2,19]),{3:5,4:$V0,5:6,6:$V1,7:3,8:$V2,9:4,10:$V3,11:$V4,13:31,15:7,16:8,17:$V5,23:$V6},o($V8,[2,17]),o($V8,[2,15]),o($V9,[2,21])],
  defaultActions: {16:[2,6]},
  parseError: function parseError(str, hash) {
      if (hash.recoverable) {
          this.trace(str);
      } else {
          throw new Error(str);
      }
  },
  parse: function parse(input) {
      var self = this, stack = [0], vstack = [null], lstack = [], table = this.table, yytext = '', yylineno = 0, yyleng = 0, TERROR = 2, EOF = 1;
      var args = lstack.slice.call(arguments, 1);
      var lexer = Object.create(this.lexer);
      var sharedState = { yy: {} };
      for (var k in this.yy) {
          if (Object.prototype.hasOwnProperty.call(this.yy, k)) {
              sharedState.yy[k] = this.yy[k];
          }
      }
      lexer.setInput(input, sharedState.yy);
      sharedState.yy.lexer = lexer;
      sharedState.yy.parser = this;
      if (typeof lexer.yylloc == 'undefined') {
          lexer.yylloc = {};
      }
      var yyloc = lexer.yylloc;
      lstack.push(yyloc);
      var ranges = lexer.options && lexer.options.ranges;
      if (typeof sharedState.yy.parseError === 'function') {
          this.parseError = sharedState.yy.parseError;
      } else {
          this.parseError = Object.getPrototypeOf(this).parseError;
      }
      
          function lex() {
              var token;
              token = lexer.lex() || EOF;
              if (typeof token !== 'number') {
                  token = self.symbols_[token] || token;
              }
              return token;
          }
      var symbol, state, action, r, yyval = {}, p, len, newState, expected;
      while (true) {
          state = stack[stack.length - 1];
          if (this.defaultActions[state]) {
              action = this.defaultActions[state];
          } else {
              if (symbol === null || typeof symbol == 'undefined') {
                  symbol = lex();
              }
              action = table[state] && table[state][symbol];
          }
                      if (typeof action === 'undefined' || !action.length || !action[0]) {
                  var errStr = '';
                  expected = [];
                  for (p in table[state]) {
                      if (this.terminals_[p] && p > TERROR) {
                          expected.push('\'' + this.terminals_[p] + '\'');
                      }
                  }
                  if (lexer.showPosition) {
                      errStr = 'Parse error on line ' + (yylineno + 1) + ':\n' + lexer.showPosition() + '\nExpecting ' + expected.join(', ') + ', got \'' + (this.terminals_[symbol] || symbol) + '\'';
                  } else {
                      errStr = 'Parse error on line ' + (yylineno + 1) + ': Unexpected ' + (symbol == EOF ? 'end of input' : '\'' + (this.terminals_[symbol] || symbol) + '\'');
                  }
                  this.parseError(errStr, {
                      text: lexer.match,
                      token: this.terminals_[symbol] || symbol,
                      line: lexer.yylineno,
                      loc: yyloc,
                      expected: expected
                  });
              }
          if (action[0] instanceof Array && action.length > 1) {
              throw new Error('Parse Error: multiple actions possible at state: ' + state + ', token: ' + symbol);
          }
          switch (action[0]) {
          case 1:
              stack.push(symbol);
              vstack.push(lexer.yytext);
              lstack.push(lexer.yylloc);
              stack.push(action[1]);
              symbol = null;
              {
                  yyleng = lexer.yyleng;
                  yytext = lexer.yytext;
                  yylineno = lexer.yylineno;
                  yyloc = lexer.yylloc;
              }
              break;
          case 2:
              len = this.productions_[action[1]][1];
              yyval.$ = vstack[vstack.length - len];
              yyval._$ = {
                  first_line: lstack[lstack.length - (len || 1)].first_line,
                  last_line: lstack[lstack.length - 1].last_line,
                  first_column: lstack[lstack.length - (len || 1)].first_column,
                  last_column: lstack[lstack.length - 1].last_column
              };
              if (ranges) {
                  yyval._$.range = [
                      lstack[lstack.length - (len || 1)].range[0],
                      lstack[lstack.length - 1].range[1]
                  ];
              }
              r = this.performAction.apply(yyval, [
                  yytext,
                  yyleng,
                  yylineno,
                  sharedState.yy,
                  action[1],
                  vstack,
                  lstack
              ].concat(args));
              if (typeof r !== 'undefined') {
                  return r;
              }
              if (len) {
                  stack = stack.slice(0, -1 * len * 2);
                  vstack = vstack.slice(0, -1 * len);
                  lstack = lstack.slice(0, -1 * len);
              }
              stack.push(this.productions_[action[1]][0]);
              vstack.push(yyval.$);
              lstack.push(yyval._$);
              newState = table[stack[stack.length - 2]][stack[stack.length - 1]];
              stack.push(newState);
              break;
          case 3:
              return true;
          }
      }
      return true;
  }};
  /* generated by jison-lex 0.3.4 */
  var lexer = (function(){
  var lexer = ({

  EOF:1,

  parseError:function parseError(str, hash) {
          if (this.yy.parser) {
              this.yy.parser.parseError(str, hash);
          } else {
              throw new Error(str);
          }
      },

  // resets the lexer, sets new input
  setInput:function (input, yy) {
          this.yy = yy || this.yy || {};
          this._input = input;
          this._more = this._backtrack = this.done = false;
          this.yylineno = this.yyleng = 0;
          this.yytext = this.matched = this.match = '';
          this.conditionStack = ['INITIAL'];
          this.yylloc = {
              first_line: 1,
              first_column: 0,
              last_line: 1,
              last_column: 0
          };
          if (this.options.ranges) {
              this.yylloc.range = [0,0];
          }
          this.offset = 0;
          return this;
      },

  // consumes and returns one char from the input
  input:function () {
          var ch = this._input[0];
          this.yytext += ch;
          this.yyleng++;
          this.offset++;
          this.match += ch;
          this.matched += ch;
          var lines = ch.match(/(?:\r\n?|\n).*/g);
          if (lines) {
              this.yylineno++;
              this.yylloc.last_line++;
          } else {
              this.yylloc.last_column++;
          }
          if (this.options.ranges) {
              this.yylloc.range[1]++;
          }

          this._input = this._input.slice(1);
          return ch;
      },

  // unshifts one char (or a string) into the input
  unput:function (ch) {
          var len = ch.length;
          var lines = ch.split(/(?:\r\n?|\n)/g);

          this._input = ch + this._input;
          this.yytext = this.yytext.substr(0, this.yytext.length - len);
          //this.yyleng -= len;
          this.offset -= len;
          var oldLines = this.match.split(/(?:\r\n?|\n)/g);
          this.match = this.match.substr(0, this.match.length - 1);
          this.matched = this.matched.substr(0, this.matched.length - 1);

          if (lines.length - 1) {
              this.yylineno -= lines.length - 1;
          }
          var r = this.yylloc.range;

          this.yylloc = {
              first_line: this.yylloc.first_line,
              last_line: this.yylineno + 1,
              first_column: this.yylloc.first_column,
              last_column: lines ?
                  (lines.length === oldLines.length ? this.yylloc.first_column : 0)
                   + oldLines[oldLines.length - lines.length].length - lines[0].length :
                this.yylloc.first_column - len
          };

          if (this.options.ranges) {
              this.yylloc.range = [r[0], r[0] + this.yyleng - len];
          }
          this.yyleng = this.yytext.length;
          return this;
      },

  // When called from action, caches matched text and appends it on next action
  more:function () {
          this._more = true;
          return this;
      },

  // When called from action, signals the lexer that this rule fails to match the input, so the next matching rule (regex) should be tested instead.
  reject:function () {
          if (this.options.backtrack_lexer) {
              this._backtrack = true;
          } else {
              return this.parseError('Lexical error on line ' + (this.yylineno + 1) + '. You can only invoke reject() in the lexer when the lexer is of the backtracking persuasion (options.backtrack_lexer = true).\n' + this.showPosition(), {
                  text: "",
                  token: null,
                  line: this.yylineno
              });

          }
          return this;
      },

  // retain first n characters of the match
  less:function (n) {
          this.unput(this.match.slice(n));
      },

  // displays already matched input, i.e. for error messages
  pastInput:function () {
          var past = this.matched.substr(0, this.matched.length - this.match.length);
          return (past.length > 20 ? '...':'') + past.substr(-20).replace(/\n/g, "");
      },

  // displays upcoming input, i.e. for error messages
  upcomingInput:function () {
          var next = this.match;
          if (next.length < 20) {
              next += this._input.substr(0, 20-next.length);
          }
          return (next.substr(0,20) + (next.length > 20 ? '...' : '')).replace(/\n/g, "");
      },

  // displays the character position where the lexing error occurred, i.e. for error messages
  showPosition:function () {
          var pre = this.pastInput();
          var c = new Array(pre.length + 1).join("-");
          return pre + this.upcomingInput() + "\n" + c + "^";
      },

  // test the lexed token: return FALSE when not a match, otherwise return token
  test_match:function (match, indexed_rule) {
          var token,
              lines,
              backup;

          if (this.options.backtrack_lexer) {
              // save context
              backup = {
                  yylineno: this.yylineno,
                  yylloc: {
                      first_line: this.yylloc.first_line,
                      last_line: this.last_line,
                      first_column: this.yylloc.first_column,
                      last_column: this.yylloc.last_column
                  },
                  yytext: this.yytext,
                  match: this.match,
                  matches: this.matches,
                  matched: this.matched,
                  yyleng: this.yyleng,
                  offset: this.offset,
                  _more: this._more,
                  _input: this._input,
                  yy: this.yy,
                  conditionStack: this.conditionStack.slice(0),
                  done: this.done
              };
              if (this.options.ranges) {
                  backup.yylloc.range = this.yylloc.range.slice(0);
              }
          }

          lines = match[0].match(/(?:\r\n?|\n).*/g);
          if (lines) {
              this.yylineno += lines.length;
          }
          this.yylloc = {
              first_line: this.yylloc.last_line,
              last_line: this.yylineno + 1,
              first_column: this.yylloc.last_column,
              last_column: lines ?
                           lines[lines.length - 1].length - lines[lines.length - 1].match(/\r?\n?/)[0].length :
                           this.yylloc.last_column + match[0].length
          };
          this.yytext += match[0];
          this.match += match[0];
          this.matches = match;
          this.yyleng = this.yytext.length;
          if (this.options.ranges) {
              this.yylloc.range = [this.offset, this.offset += this.yyleng];
          }
          this._more = false;
          this._backtrack = false;
          this._input = this._input.slice(match[0].length);
          this.matched += match[0];
          token = this.performAction.call(this, this.yy, this, indexed_rule, this.conditionStack[this.conditionStack.length - 1]);
          if (this.done && this._input) {
              this.done = false;
          }
          if (token) {
              return token;
          } else if (this._backtrack) {
              // recover context
              for (var k in backup) {
                  this[k] = backup[k];
              }
              return false; // rule action called reject() implying the next rule should be tested instead.
          }
          return false;
      },

  // return next match in input
  next:function () {
          if (this.done) {
              return this.EOF;
          }
          if (!this._input) {
              this.done = true;
          }

          var token,
              match,
              tempMatch,
              index;
          if (!this._more) {
              this.yytext = '';
              this.match = '';
          }
          var rules = this._currentRules();
          for (var i = 0; i < rules.length; i++) {
              tempMatch = this._input.match(this.rules[rules[i]]);
              if (tempMatch && (!match || tempMatch[0].length > match[0].length)) {
                  match = tempMatch;
                  index = i;
                  if (this.options.backtrack_lexer) {
                      token = this.test_match(tempMatch, rules[i]);
                      if (token !== false) {
                          return token;
                      } else if (this._backtrack) {
                          match = false;
                          continue; // rule action called reject() implying a rule MISmatch.
                      } else {
                          // else: this is a lexer rule which consumes input without producing a token (e.g. whitespace)
                          return false;
                      }
                  } else if (!this.options.flex) {
                      break;
                  }
              }
          }
          if (match) {
              token = this.test_match(match, rules[index]);
              if (token !== false) {
                  return token;
              }
              // else: this is a lexer rule which consumes input without producing a token (e.g. whitespace)
              return false;
          }
          if (this._input === "") {
              return this.EOF;
          } else {
              return this.parseError('Lexical error on line ' + (this.yylineno + 1) + '. Unrecognized text.\n' + this.showPosition(), {
                  text: "",
                  token: null,
                  line: this.yylineno
              });
          }
      },

  // return next match that has a token
  lex:function lex() {
          var r = this.next();
          if (r) {
              return r;
          } else {
              return this.lex();
          }
      },

  // activates a new lexer condition state (pushes the new lexer condition state onto the condition stack)
  begin:function begin(condition) {
          this.conditionStack.push(condition);
      },

  // pop the previously active lexer condition state off the condition stack
  popState:function popState() {
          var n = this.conditionStack.length - 1;
          if (n > 0) {
              return this.conditionStack.pop();
          } else {
              return this.conditionStack[0];
          }
      },

  // produce the lexer rule set which is active for the currently active lexer condition state
  _currentRules:function _currentRules() {
          if (this.conditionStack.length && this.conditionStack[this.conditionStack.length - 1]) {
              return this.conditions[this.conditionStack[this.conditionStack.length - 1]].rules;
          } else {
              return this.conditions["INITIAL"].rules;
          }
      },

  // return the currently active lexer condition state; when an index argument is provided it produces the N-th previous condition state, if available
  topState:function topState(n) {
          n = this.conditionStack.length - 1 - Math.abs(n || 0);
          if (n >= 0) {
              return this.conditionStack[n];
          } else {
              return "INITIAL";
          }
      },

  // alias for begin(condition)
  pushState:function pushState(condition) {
          this.begin(condition);
      },

  // return the number of states currently on the stack
  stateStackSize:function stateStackSize() {
          return this.conditionStack.length;
      },
  options: {},
  performAction: function anonymous(yy,yy_,$avoiding_name_collisions,YY_START) {
  switch($avoiding_name_collisions) {
  case 0:/* skip whitespace */
  break;
  case 1:return 6
  case 2:yy_.yytext = yy_.yytext.substr(1,yy_.yyleng-2); return 4
  case 3:return 17
  case 4:return 18
  case 5:return 23
  case 6:return 24
  case 7:return 22
  case 8:return 21
  case 9:return 10
  case 10:return 11
  case 11:return 8
  case 12:return 14
  case 13:return 'INVALID'
  }
  },
  rules: [/^(?:\s+)/,/^(?:(-?([0-9]|[1-9][0-9]+))(\.[0-9]+)?([eE][-+]?[0-9]+)?\b)/,/^(?:"(?:\\[\\"bfnrt/]|\\u[a-fA-F0-9]{4}|[^\\\0-\x09\x0a-\x1f"])*")/,/^(?:\{)/,/^(?:\})/,/^(?:\[)/,/^(?:\])/,/^(?:,)/,/^(?::)/,/^(?:true\b)/,/^(?:false\b)/,/^(?:null\b)/,/^(?:$)/,/^(?:.)/],
  conditions: {"INITIAL":{"rules":[0,1,2,3,4,5,6,7,8,9,10,11,12,13],"inclusive":true}}
  });
  return lexer;
  })();
  parser.lexer = lexer;
  function Parser () {
    this.yy = {};
  }
  Parser.prototype = parser;parser.Parser = Parser;
  return new Parser;
  })();


  if (typeof commonjsRequire !== 'undefined' && 'object' !== 'undefined') {
  exports.parser = parser;
  exports.Parser = parser.Parser;
  exports.parse = function () { return parser.parse.apply(parser, arguments); };
  }
  });

  function readStyle(style) {
      if (style instanceof String || typeof style === 'string' || style instanceof Buffer) {
          try {
              return jsonlint.parse(style.toString());
          } catch (e) {
              throw new ParsingError$1(e);
          }
      }
      return style;
  }

  function validateStyle(style, styleSpec = v8) {
      let s = style;
      try {
          s = readStyle(s);
      } catch (e) {
          return [e];
      }
      return validateStyleMin(s, styleSpec);
  }

  const SUPPORTED_SPEC_VERSION = 8;
  const MAX_SOURCES_IN_STYLE = 15;
  function isValid(value, regex) {
      if (!value || getType(value) !== 'string')
          return true;
      return !!value.match(regex);
  }
  function getSourceCount(source) {
      if (source.url) {
          return source.url.split(',').length;
      } else {
          return 0;
      }
  }
  function getAllowedKeyErrors(obj, keys, path) {
      const allowed = new Set(keys);
      const errors = [];
      Object.keys(obj).forEach(k => {
          if (!allowed.has(k)) {
              const prop = path ? `${ path }.${ k }` : null;
              errors.push(new ValidationError(prop, obj[k], `Unsupported property "${ k }"`));
          }
      });
      return errors;
  }
  function getSourceErrors(source, i) {
      const errors = [];
      const sourceKeys = [
          'type',
          'url',
          'tileSize'
      ];
      errors.push(...getAllowedKeyErrors(source, sourceKeys, 'source'));
      const sourceUrlPattern = /^mapbox:\/\/([^/]*)$/;
      if (!isValid(source.url, sourceUrlPattern)) {
          errors.push(new ValidationError(`sources[${ i }]`, source.url, 'Source url must be a valid Mapbox tileset url'));
      }
      return errors;
  }
  function getSourcesErrors(sources) {
      const errors = [];
      let count = 0;
      Object.keys(sources).forEach((s, i) => {
          const sourceErrors = getSourceErrors(sources[s], i);
          if (!sourceErrors.length) {
              count = count + getSourceCount(sources[s]);
          }
          errors.push(...sourceErrors);
      });
      if (count > MAX_SOURCES_IN_STYLE) {
          errors.push(new ValidationError('sources', null, `Styles must contain ${ MAX_SOURCES_IN_STYLE } or fewer sources`));
      }
      return errors;
  }
  function getRootErrors(style, specKeys) {
      const errors = [];
      const optionalRootProperties = [
          'owner',
          'id',
          'cacheControl',
          'draft',
          'created',
          'modified',
          'visibility'
      ];
      const allowedKeyErrors = getAllowedKeyErrors(style, [
          ...specKeys,
          ...optionalRootProperties
      ]);
      errors.push(...allowedKeyErrors);
      if (style.version > SUPPORTED_SPEC_VERSION || style.version < SUPPORTED_SPEC_VERSION) {
          errors.push(new ValidationError('version', style.version, `Style version must be ${ SUPPORTED_SPEC_VERSION }`));
      }
      const glyphUrlPattern = /^mapbox:\/\/fonts\/([^/]*)\/{fontstack}\/{range}.pbf$/;
      if (!isValid(style.glyphs, glyphUrlPattern)) {
          errors.push(new ValidationError('glyphs', style.glyphs, 'Styles must reference glyphs hosted by Mapbox'));
      }
      const spriteUrlPattern = /^mapbox:\/\/sprites\/([^/]*)\/([^/]*)\/?([^/]*)?$/;
      if (!isValid(style.sprite, spriteUrlPattern)) {
          errors.push(new ValidationError('sprite', style.sprite, 'Styles must reference sprites hosted by Mapbox'));
      }
      const visibilityPattern = /^(public|private)$/;
      if (!isValid(style.visibility, visibilityPattern)) {
          errors.push(new ValidationError('visibility', style.visibility, 'Style visibility must be public or private'));
      }
      return errors;
  }
  function validateMapboxApiSupported(style) {
      let s = style;
      try {
          s = readStyle(s);
      } catch (e) {
          return [e];
      }
      let errors = validateStyleMin(s, v8).concat(getRootErrors(s, Object.keys(v8.$root)));
      if (s.sources) {
          errors = errors.concat(getSourcesErrors(s.sources));
      }
      return errors;
  }

  const expression$1 = {
      StyleExpression,
      isExpression,
      isExpressionFilter,
      createExpression,
      createPropertyExpression,
      normalizePropertyExpression,
      ZoomConstantExpression,
      ZoomDependentExpression,
      StylePropertyFunction
  };
  const styleFunction = {
      convertFunction,
      createFunction,
      isFunction: isFunction$1
  };
  const visit = {
      eachSource,
      eachLayer,
      eachProperty
  };
  validateStyle.parsed = validateStyle;
  validateStyle.latest = validateStyle;

  exports.Color = Color;
  exports.ParsingError = ParsingError$1;
  exports.ValidationError = ValidationError;
  exports.composite = composite;
  exports.convertFilter = convertFilter$1;
  exports.derefLayers = derefLayers;
  exports.diff = diffStyles;
  exports.expression = expression$1;
  exports.featureFilter = createFilter;
  exports.format = format;
  exports.function = styleFunction;
  exports.latest = v8;
  exports.migrate = migrate;
  exports.v8 = v8;
  exports.validate = validateStyle;
  exports.validateMapboxApiSupported = validateMapboxApiSupported;
  exports.visit = visit;

  Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=index.cjs.map
