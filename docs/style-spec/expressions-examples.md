# Practical examples of expressions


## Language fallbacks

### Single language labels

Assigning a text field for an English-language style: 

*NOTES:* 

- Currently, the name fields in our VTs include fallbacks to other languages, but we are planning to remove the VT fallbacks so fields only have values if we have data for that name in that language.
- In this example, `name_latin` is a field that includes the local language name for a feature *only if* the local language is a Latin language.

```
{
	"text-field": {
		"expression": [
			["case",
				["has", ["properties"], "name_latin"], ["string", ["get", ["properties"], "name_latin"]],
				["has", ["properties"], "name_en"], ["string", ["get", ["properties"], "name_en"]],
				["string", ["get", ["properties"], "name"]] 
		]
	}
}
```

### Multi language labels

Assigning a text fields for an English-language plus local language style:

Example output values:

- `Happy Garden` (local language is English)
- `Glücklich Garten` (local language is a non-English Latin language, e.g. German)
- `Happy Garden \N 快乐花园` (local language is non-Latin, e.g. Chinese, English value exists)
- `快乐花园` (local language is non-Latin, e.g. Chinese, and English value doesn't exist)

*NOTE:* 

we have not yet determined the strategy we'll take for multi-lingual labels in our data and styles, but this example demonstrates the type of logic that would be required.

```
{
	"text-field": {
		"expression": [
			"concat",
			["case",
				["has", ["properties"], "name_latin"], ["string", ["get", ["properties"], "name_latin"]],
				["has", ["properties"], "name_en"], ["string", ["get", ["properties"], "name_en"]],
				["string", ["get", ["properties"], "name"]] 
			],
			["case",
				["&&"
					["!", ["has", ["properties"], "name_latin"]], 
					["has", ["properties"], "name_en"]
				],
				["concat", "\n ", ["string", ["get", ["properties"], "name"]]],
				""

			]
		]
	}
}
```

## Highway shields

Icon assignment based on shield design and reference number length.

Example output value: 
`us-interstate-3`

```
{
	"icon-image": {
		"expression" : [
				"concat",
				["string", ["get", ["properties"], "shield"]],
				"-",
				["case",
					["==", ["length", ["string", ["get", ["properties"], "ref"]]], 1],
					["2"]
					["string", ["length", ["string", ["get", ["properties"], "ref"]]]]
		]
	}
}
```

## Mountain peak labels

Mountain peak label displays name and elevation if elevation value exists, otherwise just name. 

```
{
	"text-field": {
		"expression": [
			"concat",
			["string", ["get", ["properties"], "name_en"]],
			["case",
				["has", ["properties"], "elevation_m"],
				["concat", "\n ", ["string",["get", ["properties"], "elevation_m"]]],
				""
			]
		]
	}
}
```

## Landuse polygon colors

```
{
	"fill-color": {
		"expression": [
			"curve", "linear", ["zoom"],
				15.5, 
				["match", ["get", ["properties"], "class"], 
					"park", "hsl(100, 58%, 76%)",
					"school", "hsl(50, 47%, 81%)",
					"hospital", "hsl(340, 37%, 87%)",
					"hsl(35, 12%, 89%)"
				],
				16,
				["match", ["get", ["properties"], "class"], 
					"park", "hsl(100, 58%, 76%)",
					"school", "hsl(50, 63%, 84%)",
					"hospital", "hsl(340, 63%, 89%)",
					"hsl(35, 12%, 89%)"
				],
		]
	}
}
```

## City labels: case study across multiple properties

At low zoom levels, city labels are often displayed on basemaps with text and a locator dot. The labels are often different sizes (depending on size of city), with text offset in different directions for optimal placement, and national capitals indicated by a dot with a border:

![screen shot 2017-06-14 at 7 35 15 pm](https://user-images.githubusercontent.com/5607844/27159403-bd37c7a6-513a-11e7-9bfb-f3fa0047fe5e.png)

At higher zoom levels, city labels are usually *just* text: 

![screen shot 2017-06-14 at 7 37 08 pm](https://user-images.githubusercontent.com/5607844/27159404-bd3b39fe-513a-11e7-811d-7b15f830a97b.png)

To create the style above using Mapbox Streets Source vector tiles requires:

Expressions for the following style properties:

- `icon-image`
- `text-size`
- `text-justify`
- `text-anchor`
- `text-offset`

Based on the following data properties:

- `scalerank`: size/prominence of city
- `capital`: capital city status, where `capital:2` is a national capital
- `ldir`: pre-determined optimum label direction

```
{
	"icon-image": {
		"expression": [
			"curve", ["step"], ["number", ["get", ["properties"], "scalerank"]],
			0,
			["case", 
				["==", ["number", ["get", ["properties"], "capital"]], 2],
				"capital-city-dot-large",
				"city-dot-large" 
			],
			3,
			["case", 
				["==", ["number", ["get", ["properties"], "capital"]], 2],
				"capital-city-dot-medium",
				"city-dot-medium" 
			],	
			6,
			["case", 
				["==", ["number", ["get", ["properties"], "capital"]], 2],
				"capital-city-dot-small",
				"city-dot-small" 
			]
		]	
	}
}
```
```
{
	"text-size": {
		"expression": [
			"curve", ["exponential", 0.85], ["zoom"],
				4,
				["curve", ["step"], ["number", ["get", ["properties"], "scalerank"]],
					0, 12,
					3, 9,
					6, 6
				],
				14,
				22
		]
	}
}
```
```
{
	"text-justify": {
		"expression": [
			"curve", "step", ["zoom"],
				7, 
				["match", ["string", ["get", ["properties"], "ldir"]],
					"N", "center",
					"NE", "left",
					"E", "left",
					"SE", "left",
					"S", "center",
					"SW", "right",
					"W", "right",
					"NW", "right",
					"center"
				],
				8,
				"center"
		]
	}
}
```
```
{
	"text-anchor": {
		"expression": [
			"curve", "step", ["zoom"],
				7, 
				["match", ["get", ["properties"], "ldir"],
					"N", "bottom",
					"NE", "bottom-left",
					"E", "left",
					"SE", "top-left",
					"S", "top",
					"SW", "top-right",
					"W", "right",
					"NW", "bottom-right",
					"bottom"
				],
				8,
				"center"
		]
	}
}
```
```
	"text-offset": {
		"expression": [
			"curve", "step", ["zoom"],
				7, 
				["curve", ["step"], ["number", ["get", ["properties"], "scalerank"]],
					0,
					["match", ["get", ["properties"], "ldir"],
						"N", [0, -0.3],
						"NE", [0.2, -0.1],
						"E", [0.4, 0],
						"SE", [0.2, 0.1],
						"S", [0, 0.3],
						"SW",[-0.2, 0.1],
						"W", [-0.4, 0],
						"NW", [-0.2, -0.1],
						[0, -0.3]
					],
					3,
					["match", ["get", ["properties"], "ldir"],
						"N", [0, -0.25],
						"NE", [0.18, -0.08],
						"E", [0.35, 0],
						"SE", [0.18, 0.08],
						"S", [0, 0.25],
						"SW",[-0.18, 0.08],
						"W", [-0.35, 0],
						"NW", [-0.18, -0.08],
						[0, -0.25]
					],
					6,
					["match", ["get", ["properties"], "ldir"],
						"N", [0, -0.2],
						"NE", [0.15, -0.06],
						"E", [0.3, 0],
						"SE", [0.15, 0.06],
						"S", [0, 0.2],
						"SW",[-0.15, 0.06],
						"W", [-0.3, 0],
						"NW", [-0.15, -0.06],
						[0, -0.2]
					]
				]	
				8,
				[0,0]
		]	
	}
}
```		