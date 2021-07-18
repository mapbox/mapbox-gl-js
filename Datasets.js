Datasets
On this page
The dataset object
List datasets
Create a dataset
Retrieve a dataset
Update a dataset
Delete a dataset
The feature object
List features
Insert or update a feature
Retrieve a feature
Delete a feature
Datasets API errors
Datasets API restrictions and limits
The Mapbox Datasets API supports reading, creating, updating, and removing features from a dataset.

Using the Datasets API involves interacting with two types of objects: datasets and features. Datasets contain one or more collections of GeoJSON features. When you edit a dataset object, you change the name and description properties of the dataset itself. When you edit a feature object, you edit the contents of the dataset, such as the coordinates or properties of a feature.

To serve your geographic data at scale, you can convert your dataset into a tileset using the Uploads API.

The dataset object
The dataset object contains information pertinent to a specific dataset. Each dataset object contains the following properties:

Property	Description
owner	The username of the dataset owner.
id	The ID for an existing dataset.
created	A timestamp indicating when the dataset was created.
modified	A timestamp indicating when the dataset was last modified.
bounds	The extent of features in the dataset in the format [west, south, east, north].
features	The number of features in the dataset.
size	The size of the dataset in bytes.
name
(optional)	The name of the dataset.
description
(optional)	A description of the dataset.
Example dataset object
{
  "owner": "{username}",
  "id": "{dataset_id}",
  "created": "{timestamp}",
  "modified": "{timestamp}",
  "bounds": [-10, -10, 10, 10],
  "features": 100,
  "size": 409600,
  "name": "{name}",
  "description": "{description}"
}
List datasets
GET
/datasets/v1/{username}
datasets:listtoken scope
List all the datasets that belong to a particular account. This endpoint supports pagination.

Required parameter	Description
username	The username of the account for which to list datasets.
You can further refine the results from this endpoint with the following optional parameters:

Optional parameters	Description
limit	The maximum number of datasets to return.
sortby	Sort the results by modified or created dates. modified sorts by the most recently updated dataset, while created sorts by the oldest dataset first.
start	The ID of the dataset after which to start the listing. The dataset ID is found in the Link header of a response. See the pagination section for details.
Example request: List datasets
$ curl "https://api.mapbox.com/datasets/v1/quantomphantom573?access_token=YOUR MAPBOX ACCESS TOKEN
This endpoint requires a token with datasets:list scope.
"
Response: List datasets
The response to a request to this endpoint is a list of datasets.

Example response: List datasets
[
  {
    "owner": "{username}",
    "id": "{dataset_id}",
    "created": "{timestamp}",
    "modified": "{timestamp}",
    "bounds": [-10, -10, 10, 10],
    "features": 100,
    "size": 409600,
    "name": "{name}",
    "description": "{description}"
  },
  {
    "owner": "{username}",
    "id": "{dataset_id}",
    "created": "{timestamp}",
    "modified": "{timestamp}",
    "bounds": [-10, -10, 10, 10],
    "features": 100,
    "size": 409600,
    "name": "{name}",
    "description": "{description}"
  }
]
Supported libraries: List datasets
Mapbox wrapper libraries help you integrate Mapbox APIs into your existing application. The following SDKs support this endpoint:

Mapbox Python CLI
Mapbox JavaScript SDK
See the SDK documentation for details and examples of how to use the relevant methods to query this endpoint.

Create a dataset
POST
/datasets/v1/{username}
datasets:writetoken scope
Create a new, empty dataset.

Required parameter	Description
username	The username of the account to which the new dataset belongs.
Example request: Create a dataset
$ curl -X POST "https://api.mapbox.com/datasets/v1/quantomphantom573?access_token=YOUR MAPBOX ACCESS TOKEN
This endpoint requires a token with datasets:write scope.
" \
  -d @request.json \
  --header "Content-Type:application/json
Example request body: Create a dataset
{
  "name": "foo",
  "description": "bar"
}
Response: Create a dataset
The response to a successful request to this endpoint will be a new, empty dataset.

Example response: Create a dataset
{
  "owner": "{username}",
  "id": "{dataset_id}",
  "created": "{timestamp}",
  "modified": "{timestamp}",
  "bounds": [-10, -10, 10, 10],
  "features": 100,
  "size": 409600,
  "name": "foo",
  "description": "bar"
}
Supported libraries: Create a dataset
Mapbox wrapper libraries help you integrate Mapbox APIs into your existing application. The following SDKs support this endpoint:

Mapbox Python CLI
Mapbox JavaScript SDK
See the SDK documentation for details and examples of how to use the relevant methods to query this endpoint.

Retrieve a dataset
GET
/datasets/v1/{username}/{dataset_id}
datasets:readtoken scope
Retrieve information about a single existing dataset.

Required parameters	Description
username	The username of the account to which the dataset belongs.
dataset_id	The ID of the dataset to be retrieved.
Example request: Retrieve a dataset
$ curl "https://api.mapbox.com/datasets/v1/quantomphantom573/{dataset_id}?access_token=pk.eyJ1IjoicXVhbnRvbXBoYW50b201NzMiLCJhIjoiY2p2eTZkMWpxMDhmZzQzcDFrbjRobXY2YiJ9.cJqSyyaC5iXcDT1O4ztrQQ"
Response: Retrieve a dataset
The response to a successful request to this endpoint will be the requested dataset.

Example response: Retrieve a dataset
{
  "owner": "{username}",
  "id": "{dataset_id}",
  "created": "{timestamp}",
  "modified": "{timestamp}",
  "bounds": [-10, -10, 10, 10],
  "features": 100,
  "size": 409600,
  "name": "{name}",
  "description": "{description}"
}
Supported libraries: Retrieve a dataset
Mapbox wrapper libraries help you integrate Mapbox APIs into your existing application. The following SDKs support this endpoint:

Mapbox Python CLI
Mapbox JavaScript SDK
See the SDK documentation for details and examples of how to use the relevant methods to query this endpoint.

Update a dataset
PATCH
/datasets/v1/{username}/{dataset_id}
datasets:writetoken scope
Update the properties of a specific dataset. The request body must be valid JSON. This endpoint is used to change the name and description of the dataset object. To add features to a dataset or edit existing dataset features, use the Insert or update a feature endpoint.

Required parameters	Description
username	The username of the account to which the dataset belongs.
dataset_id	The ID of the dataset to be updated.
Example request: Update a dataset
$ curl -X PATCH "https://api.mapbox.com/datasets/v1/quantomphantom573/{dataset_id}?access_token=YOUR MAPBOX ACCESS TOKEN
This endpoint requires a token with datasets:write scope.
" \
  -H "Content-Type: application/json" \
  -d @data.json
Example request body: Update a dataset
{
  "name": "foo",
  "description": "bar"
}
Response: Update a dataset
The response to a successful request to this endpoint will be the updated dataset.

Example response: Update a dataset
{
  "owner": "{username}",
  "id": "{dataset_id}",
  "created": "{timestamp}",
  "modified": "{timestamp}",
  "bounds": [-10, -10, 10, 10],
  "features": 100,
  "size": 409600,
  "name": "foo",
  "description": "bar"
}
Supported libraries: Update a dataset
Mapbox wrapper libraries help you integrate Mapbox APIs into your existing application. The following SDKs support this endpoint:

Mapbox Python CLI
Mapbox JavaScript SDK
See the SDK documentation for details and examples of how to use the relevant methods to query this endpoint.

Delete a dataset
DELETE
/datasets/v1/{username}/{dataset_id}
datasets:writetoken scope
Delete a specific dataset. All the features contained in the dataset will be deleted too.

Required parameters	Description
username	The username of the account to which the dataset belongs.
dataset_id	The ID of the dataset to be deleted.
Example request: Delete a dataset
$ curl -X DELETE "https://api.mapbox.com/datasets/v1/quantomphantom573/{dataset_id}?access_token=YOUR MAPBOX ACCESS TOKEN
This endpoint requires a token with datasets:write scope.
"
Response: Delete a dataset
HTTP 204 No Content
Supported libraries: Delete a dataset
Mapbox wrapper libraries help you integrate Mapbox APIs into your existing application. The following SDKs support this endpoint:

Mapbox Python CLI
Mapbox JavaScript SDK
See the SDK documentation for details and examples of how to use the relevant methods to query this endpoint.

The feature object
A feature is a GeoJSON Feature object representing a feature in the dataset. GeometryCollections and null geometries are not supported. For a full list of GeoJSON Feature properties, see the GeoJSON specification.

Example feature object
{
  "id": "{feature_id}",
  "type": "Feature",
  "properties": {
    "prop0": "value0"
  },
  "geometry": {
    "coordinates": [102, 0.5],
    "type": "Point"
  }
}
List features
GET
/datasets/v1/{username}/{dataset_id}/features
datasets:readtoken scope
List all the features in a dataset.

This endpoint supports pagination so that you can list many features.

Required parameters	Description
username	The username of the account to which the dataset belongs.
dataset_id	The ID of the dataset for which to retrieve features.
You can further refine the results from this endpoint with the following optional parameters:

Optional parameters	Description
limit	The maximum number of features to return, from 1 to 100. The default is 10.
start	The ID of the feature after which to start the listing. The feature ID is found in the Link header of a response. See the pagination section for details.
Example request: List features
$ curl "https://api.mapbox.com/datasets/v1/quantomphantom573/{dataset_id}/features?access_token=pk.eyJ1IjoicXVhbnRvbXBoYW50b201NzMiLCJhIjoiY2p2eTZkMWpxMDhmZzQzcDFrbjRobXY2YiJ9.cJqSyyaC5iXcDT1O4ztrQQ"

# Limit results to 50 features

$ curl "https://api.mapbox.com/datasets/v1/quantomphantom573/{dataset_id}/features?limit=50&access_token=pk.eyJ1IjoicXVhbnRvbXBoYW50b201NzMiLCJhIjoiY2p2eTZkMWpxMDhmZzQzcDFrbjRobXY2YiJ9.cJqSyyaC5iXcDT1O4ztrQQ"

# Use pagination to start the listing after the feature with ID f6d9

$ curl "https://api.mapbox.com/datasets/v1/quantomphantom573/{dataset_id}/features?start=f6d9&access_token=pk.eyJ1IjoicXVhbnRvbXBoYW50b201NzMiLCJhIjoiY2p2eTZkMWpxMDhmZzQzcDFrbjRobXY2YiJ9.cJqSyyaC5iXcDT1O4ztrQQ"
Response: List features
The response body will be a GeoJSON FeatureCollection.

Example response: List features
{
  "type": "FeatureCollection",
  "features": [
    {
      "id": "{feature_id}",
      "type": "Feature",
      "properties": {
        "prop0": "value0"
      },
      "geometry": {
        "coordinates": [ 102,0.5 ],
        "type": "Point"
      }
    },
    {
      "id": "{feature_id}",
      "type": "Feature",
      "properties": {
        "prop0": "value0"
      },
      "geometry": {
        "coordinates": [
          [ 102, 0 ],
          [ 103, 1 ],
          [ 104, 0 ],
          [ 105, 1 ]
        ],
        "type": "LineString"
      }
    }
  ]
}
Supported libraries: List features
Mapbox wrapper libraries help you integrate Mapbox APIs into your existing application. The following SDKs support this endpoint:

Mapbox Python CLI
Mapbox JavaScript SDK
See the SDK documentation for details and examples of how to use the relevant methods to query this endpoint.

Insert or update a feature
PUT
/datasets/v1/{username}/{dataset_id}/features/{feature_id}
datasets:writetoken scope
Insert or update a feature in a specified dataset:

Insert: If a feature with the given feature_id does not already exist, a new feature will be created.
Update: If a feature with the given feature_id already exists, it will be replaced.
If you are inserting a feature into a dataset, you must add the feature as the body of the PUT request. This should be one individual GeoJSON feature, not a GeoJSON FeatureCollection. If the GeoJSON feature has a top-level id property, it must match the feature_id you use in the URL endpoint.

Required parameters	Description
username	The username of the account to which the dataset belongs.
dataset_id	The ID of the dataset for which to insert or update features.
feature_id	The ID of the feature to be inserted or updated.
Example request: Insert or update a feature
$ curl "https://api.mapbox.com/datasets/v1/quantomphantom573/{dataset_id}/features/{feature_id}?access_token=YOUR MAPBOX ACCESS TOKEN
This endpoint requires a token with datasets:write scope.
" \
  -X PUT \
  -H "Content-Type: application/json" \
  -d @file.geojson
Example request body: Insert or update a feature
{
  "id": "{feature_id}",
  "type": "Feature",
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [ 100, 0 ],
        [ 101, 0 ],
        [ 101, 1 ],
        [ 100, 1 ],
        [ 100, 0 ]
      ]
    ]
  },
  "properties": {
    "prop0": "value0"
  }
}
Response: Insert or update a feature
The response to a successful request to this endpoint will be the new or updated feature object.

Example response: Insert or update a feature
{
  "id": "{feature_id}",
  "type": "Feature",
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [ 100, 0 ],
        [ 101, 0 ],
        [ 101, 1 ],
        [ 100, 1 ],
        [ 100, 0 ]
      ]
    ]
  },
  "properties": {
    "prop0": "value0"
  }
}
Supported libraries: Insert or update a feature
Mapbox wrapper libraries help you integrate Mapbox APIs into your existing application. The following SDKs support this endpoint:

Mapbox Python CLI
Mapbox JavaScript SDK
See the SDK documentation for details and examples of how to use the relevant methods to query this endpoint.

Retrieve a feature
GET
/datasets/v1/{username}/{dataset_id}/features/{feature_id}
datasets:readtoken scope
Retrieve a specific feature from a dataset.

Required parameters	Description
username	The username of the account to which the dataset belongs.
dataset_id	The ID of the dataset from which to retrieve a feature.
feature_id	The ID of the feature to be retrieved.
Example request: Retrieve a feature
$ curl "https://api.mapbox.com/datasets/v1/quantomphantom573/{dataset_id}/features/{feature_id}?access_token=pk.eyJ1IjoicXVhbnRvbXBoYW50b201NzMiLCJhIjoiY2p2eTZkMWpxMDhmZzQzcDFrbjRobXY2YiJ9.cJqSyyaC5iXcDT1O4ztrQQ"
Response: Retrieve a feature
The response to a successful request to this endpoint is the requested feature object.

Example response: Retrieve a feature
{
  "id": "{feature_id}",
  "type": "Feature",
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [ 100, 0 ],
        [ 101, 0 ],
        [ 101, 1 ],
        [ 100, 1 ],
        [ 100, 0 ]
      ]
    ]
  },
  "properties": {
    "prop0": "value0"
  }
}
Supported libraries: Retrieve a feature
Mapbox wrapper libraries help you integrate Mapbox APIs into your existing application. The following SDKs support this endpoint:

Mapbox Python CLI
Mapbox JavaScript SDK
See the SDK documentation for details and examples of how to use the relevant methods to query this endpoint.

Delete a feature
DELETE
/datasets/v1/{username}/{dataset_id}/features/{feature_id}
datasets:writetoken scope
Remove a specific feature from a dataset.

Required parameters	Description
username	The username of the account to which the dataset belongs.
dataset_id	The ID of the dataset from which to delete a feature.
feature_id	The ID of the feature to be deleted.
Example request: Delete a feature
$ curl -X DELETE "https://api.mapbox.com/datasets/v1/quantomphantom573/{dataset_id}/features/{feature_id}?access_token=YOUR MAPBOX ACCESS TOKEN
This endpoint requires a token with datasets:write scope.
"
Response: Delete a feature
HTTP 204 No Content
Supported libraries: Delete a feature
Mapbox wrapper libraries help you integrate Mapbox APIs into your existing application. The following SDKs support this endpoint:

Mapbox Python CLI
Mapbox JavaScript SDK
See the SDK documentation for details and examples of how to use the relevant methods to query this endpoint.

Datasets API errors
Response body message	HTTP status code	Description
Unauthorized	401	Check the access token you used in the query.
No such user	404	Check the username you used in the query.
Not found	404	The access token used in the query needs the datasets:list scope.
Invalid start key	422	Check the start key used in the query.
No dataset	422	Check the dataset ID used in the query (or, if you are retrieving a feature, check the feature ID).
Datasets API restrictions and limits
The Dataset API is limited on a per dataset basis.
The default read rate limit is 480 reads per minute. If you require a higher rate limit, contact us.
The default write rate limit is 40 writes per minute. If you require a higher rate limit, contact us.
If you exceed the rate limit, you will receive an HTTP 429 Too Many Requests response. For information on rate limit headers, see the Rate limit headers section.
Dataset names are limited to 60 characters, and dataset descriptions are limited to 300 characters.
Each feature cannot exceed 1023 KB compressed. Features are compressed server-side using geobuf.
