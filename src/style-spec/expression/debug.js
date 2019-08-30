import { createExpression } from './index.js';

const spec = {
      "type": "array",
      "value": "string",
      "default": [
        "Open Sans Regular",
        "Arial Unicode MS Regular"
      ],
      "doc": "Font stack to use for displaying text.",
      "requires": [
        "text-field"
      ],
      "expression": {
        "interpolated": false,
        "parameters": [
          "zoom",
          "feature"
        ]
      },
      "property-type": "data-driven"
    };

const font = [
          "step",
          ["zoom"],
          ["literal", ["DIN Offc Pro Regular", "Arial Unicode MS Regular"]],
          8,
          [
            "step",
            ["get", "symbolrank"],
            ["literal", ["DIN Offc Pro Medium", "Arial Unicode MS Regular"]],
            11,
            ["literal", ["DIN Offc Pro Regular", "Arial Unicode MS Regular"]]
          ],
          10,
          [
            "step",
            ["get", "symbolrank"],
            ["literal", ["DIN Offc Pro Medium", "Arial Unicode MS Regular"]],
            12,
            ["literal", ["DIN Offc Pro Regular", "Arial Unicode MS Regular"]]
          ],
          11,
          [
            "step",
            ["get", "symbolrank"],
            ["literal", ["DIN Offc Pro Medium", "Arial Unicode MS Regular"]],
            13,
            ["literal", ["DIN Offc Pro Regular", "Arial Unicode MS Regular"]]
          ],
          12,
          [
            "step",
            ["get", "symbolrank"],
            ["literal", ["DIN Offc Pro Medium", "Arial Unicode MS Regular"]],
            15,
            ["literal", ["DIN Offc Pro Regular", "Arial Unicode MS Regular"]]
          ],
          13,
          ["literal", ["DIN Offc Pro Medium", "Arial Unicode MS Regular"]]
        ];


const s = createExpression(font, spec);
console.log(s.value.expression.possibleOutputs());
