# Styling

*This documents the currently implemented style format. It could be improved, open an issue.*

The stylesheet describes three things:

- **what data to draw**
- **what order to draw it in**
- **how to style the data when drawing it**

The stylesheet follows the renderer implementation very closely. It provides the basic building blocks out of which more complex styles can be built. Here's a basic stylesheet that draws blue water, red roads, and a grey background:

```json
{
    "buckets": {
        "water": {
            "datasource": "mapbox streets",
            "type": "fill",
            "layer": "water"
        },
        "road_large": {
            "datasource": "mapbox streets",
            "layer": "road", "field": "class", "value": ["motorway", "main"],
            "type": "line", "cap": "round"
        }
    },
    "structure": [
    {
        "name": "land",
        "bucket": "background"
    },
    {
        "name": "water",
        "bucket": "water"
    },
    {
        "name": "road_large",
        "bucket": "road_large"
    }],
    "constants": {
        "veryblue": "#0000ff",
        "verygrey": "#cccccc"
    },
    "classes": [
    {
        "name": "default",
        "layers": {
            "land": {
                "color": "verygrey"
            },
            "water": {
                "color": "veryblue"
            },
            "road_large": {
                "color": "#ff0000",
                "width": 5
            }
        }
    }]
}
```

![rendered](https://f.cloud.github.com/assets/1421652/2045049/0e54b9d6-89f3-11e3-9087-3cf57ed1ded9.jpg)

## Buckets

`buckets` is an object of buckets and their names. A bucket is a selection of data, and instructions on how to process it into a renderable format. Buckets have the following properties:

#### Selecting data

- `source`: the name of the source to the bucket will draw data from
- `layer`: the name of the layer to include features from *(optional)*
- `field`: the name of the field to match values against *(optional)*
- `value`: the values to match. A single value or an array of values. *(optional)*
- `feature_type`: only include features of a certain type. One of `line`, `fill`, `point` *(optional)*

#### Setting the format

- `type`: one of `line`, `fill`, `point`, `text`

Each of these has its own options:

##### Line

- `cap`: one of `round`, `butt`, `square`
- `join`: one of `round`, `butt`, `bevel`
- `roundLimit`: number from 0 to 1

##### Point

- `spacing`: a number. If set, it will interpolate along the lines to create points separated by that number of pixels.
- `size`: object with x and y values (`{"x": 12, "y": 12}`)

##### Text

- `text_field`: the name of the field to take the text from
- `font`: a comma separated string of font names: `"Open Sans, Jomolhari, Siyam Rupali, Alef, Arial Unicode MS"`
- `fontSize`: the default font size and the maximum font size that can be used by the layer
- `path`: `horizontal` if you want the text to be horizontal, `curve` if you want it to follow a path and rotate with the map.
- `padding`: number of pixels to pad the text to avoid label collisions
- `textMinDistance`: the minimum number of pixels along the line between labels
- `maxAngleDelta`: the maximum angle (in radians) between two characters a label is allowed to have.
- `alwaysVisible`: if set to true, the label is not checked for collisions

## Structure

`structure` is a bottom-up list of layers in the order they should be drawn. Each layer is an object with these properties:

- `name`: the name by which styles will refer to the layer

and one of:

- `bucket`: the bucket containing the data for the layer
- `layers`: which is an array of layers. This is used to group layers into a single layer. A layer group can be used to uniformly control the opacity of overlapping layers.

There is one magic bucket, `background` that is an area that covers the entire screen. The background bucket is not specified in the buckets object, but is included in the structure.

### Constants

These are just named values. You can refer to named values in styles. They can be used for colors, functions, transitions, or other constants.

### Classes

`classes` is an array of classes. A class is an object with a name and an object of styles. The name of the class can be used to toggle the styles on and off. `default` is a magic class name that is enabled by default.

Values of all properties can also be the name of a constant defined earlier.

- `color`: can be in multiple formats:
  - named color: `"blue"`
  - hex: `"#ff0000"`
  - rgb/rgba: `"rgba(255,255,255,0.5)"`
  - hsl/hsla: `"hsla(120,100%,25%,0.5)"`
  - an rgba array: `[1.0, 0.0, 0.0, 1.0]`
- `stroke`: a color
- `image`: the name of an image found in the sprite: `"park-18"`
- `width`: the width of a line in pixels, can also be a function. `5` or `["exponential", 8, 1.0, 0.21, 4]`
- `opacity` a number from 0 to 1, can also be a function
- `translate`: an array of two values in pixels: `[4, 5]`, which can also be functions
- `dasharray`: an array of two values in pixels: `[2, 1]`, which can also be functions
- `antialias`: *boolean*, default is `true`
- `alignment`: if set to `"map"` pois will rotate with the map instead of staying aligned with the screen
- // TODO: `enabled`
- If no image is provided or found in the sprite for `point` layer, a **dot** will be drawn, which have the following properties:
  - `radius`: number of pixels or a function, default is 4
  - `blur`: number of pixels or a function to blur the edge of the dot, default is 1.5

Some properties are only supported by some types:

#### Line
`color`, `width`, `image`, `translate`, `dasharray`, `opacity`, `antialias`, `blur`

#### Fill
`color`, `image`, `stroke`, `translate`, `opacity`, `antialias`
`stroke` can be a color for the 1px outline normally used for antialiasing

#### Point
`color`, `image`, (`radius`, `blur` if no image provided)

#### Text
`color`, `translate`, `opacity`
`stroke` is the color of the halo
`strokeWidth` is the radius of the halo

### Functions
Functions are used to change values according to zoom level. There are four types of functions:

#### Linear function
`["linear", z_base, val, slope, min, max]`
- `z_base`: zoom level to start the function
- `val`: initial value
- `slope`: rate of change per zoom level (linear)
- `min`: minimum value
- `max`: maximum value

#### Exponential function
`["exponential", z_base, val, slope, min, max]`
- `z_base`: zoom level to start the function
- `val`: initial value
- `slope`: rate of change per zoom level (exponential)
- `min`: minimum value
- `max`: maximum value

#### Min function
`["min", z]`
- `z`: the minimum zoom level

#### Stops function
`["stops", z0 (, z1, z2, etc)]`
// TODO


### Multiple styles

TODO documentation


### Transitions

TODO documentation
