# Styling

*This documents the currently implemented style format. It could be improved, open an issue.*

The stylesheet describes three things:

1) what data to draw
2) what order to draw it in
3) how to style the data when drawing it

The stylesheet follows the renderer implementation very closely.
It provides the basic building blocks out of which more complex styles can be built.

Here's a basic stylesheet that draws blue water, red roads, and a grey background:

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

### Buckets

`buckets` is an object of buckets and their names.
A bucket is a selection of data, and instructions on how to process it into a renderable format.

Buckets have the following properties:

#### Selecting data

- `datasource`: the name of the datasource to include data from
- `layer`: the name of the layer to include features from (optional)
- `field`: the name of the field to match values against (optional)
- `value`: the values to match. A single value or an array of values. (optional)
- `feature_type`: only include features of a certain type. One of "line", "fill", "point"

#### Setting the format

- `type`: one of `line`, `fill`, `point`, `text`

Each of these has its own options:

##### Line

- `cap`: one of "round", "butt", "square"
- `join`: one of "round", "butt", "bevel"

##### Point

This is a bit weird. Todo change how this is specified

- `marker`: `true` if you want to make markers from a line
- `spacing`: if marker=true, then this is the minimum distance in pixels between markers

##### Text

- `text_field`: the name of the field to take the text from
- `font`: a comma separated string of font names: `"Open Sans, Jomolhari, Siyam Rupali, Alef, Arial Unicode MS"`
- `fontSize`: number
- `path`: "horizontal" if you want the text to be horizontal, "curve" if you want it to follow a path and rotate with the map.


### Structure

`structure` is a bottom-up list of layers in the order they should be drawn. Each layer is an object with these properties:

- `name`: the name by which styles will refer to the layer

and one of:
- `bucket`: the bucket containing the data for the layer
- `layers`: which is an array of layers. This is used to group layers into a single layer.

There is one magic bucket, `background` that is an area that covers the entire screen.

### Constants

These are just named values. You can refer to named values in styles .

### Classes

`classes` is an array of classes. A class is an object with a name and an object of styles.
The name of the class can later be used to toggle the styles on and off.
`default` is a magic class name that is always enabled.

Values of all properties can also be the name of a constant defined earlier.

- `color` can be in multiple formats: hex `"#ff0000"` or an rgba array `[1.0, 0.0, 0.0, 1.0]`
- `stroke` a color
- `image` the name of an image found in the sprite: `"park"`
- `width` the width of a line in pixels, can also be a function. `5` or `["exponential", 8, 1.0, 0.21, 4]`
- `opacity` a number from 0 to 1, can also be a function
- `translate`: an array of two values in pixels: `[4, 5]` the values can also be functions
- `antialias`: *boolean`*, default is `true`

Some values should change with the zoom level. These are represented with functions.

// TODO document functions


Some properties are only supported by some types:

#### Line
`color`, `width`, `image`, `translate`, `opacity`, `antialias`

#### Fill
`color`, `image`, `stroke`, `translate`, `opacity`, `antialias`
`stroke` can be a color for the 1px outline normally used for antialiasing

#### Point
`color`, `image`, `stroke`

#### Text
`color`, `translate`, `opacity`
`stroke` is the color of the halo

### Multiple styles

TODO documentation

### Transitions

TODO documentation
