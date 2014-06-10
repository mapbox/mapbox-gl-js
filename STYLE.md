# gl-style-spec

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT",
"SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in
this document are to be interpreted as described in [RFC 2119](https://www.ietf.org/rfc/rfc2119.txt).

## 1. Purpose

This specification attempts to create a standard for styling vector data across multiple clients.

## 2. File Format

Style files must be valid [JSON](http://www.json.org/).

## 3. Internal Structure

Styles must have a `version` property equal to the current specification
version as a **string**.

Styles must have a `buckets` property as an **object** with mappings from
names to bucket properties.

Styles must have a `layers` property as an **array**.

### Buckets

Each bucket must have property **filter** that defines its filter from the
dataset.
