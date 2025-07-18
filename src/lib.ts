// Map JSON Schema types to MongoDB bsonTypes
const TYPE_MAPPING: Record<string, string> = {
  string: 'string',
  number: 'double',
  integer: 'int',
  boolean: 'bool',
  array: 'array',
  object: 'object',
  null: 'null',
};

// Keywords to strip from JSON Schema when converting to MongoDB schema
const UNSUPPORTED_KEYWORDS = new Set([
  'title',
  'description',
  'examples',
  '$schema',
  'default',
  'format', // MongoDB $jsonSchema doesn't support format validation
  'additionalProperties', // Can cause issues with complex patterns
  '__mongoType', // Our custom metadata, processed separately
]);

/**
 * Converts a JSON Schema to a MongoDB-compatible $jsonSchema validator.
 * Supports extended JSON Schemas with __mongoType metadata for special types like dates.
 * @param schema - The JSON Schema object to convert
 * @returns MongoDB-compatible schema object
 */
export function convertJsonSchemaToMongoSchema(schema: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};

  // Handle special MongoDB types first
  if (schema.__mongoType) {
    switch (schema.__mongoType) {
      case 'date':
        result.bsonType = 'date';
        break;
      case 'objectId':
        result.bsonType = 'objectId';
        break;
      default:
        // For extensibility, allow any string as MongoDB type
        if (typeof schema.__mongoType === 'string') {
          result.bsonType = schema.__mongoType;
        } else {
          console.warn(`Unknown __mongoType: ${schema.__mongoType}`);
        }
    }
  }

  // Convert type to bsonType (skip if we already set bsonType from __mongoType)
  if (schema.type && !result.bsonType) {
    if (Array.isArray(schema.type)) {
      result.bsonType = schema.type.map(type => TYPE_MAPPING[type] || type);
    } else {
      result.bsonType = TYPE_MAPPING[schema.type] || schema.type;
    }
  }

  // Copy all other properties except unsupported keywords
  for (const [key, value] of Object.entries(schema)) {
    if (key === 'type' || UNSUPPORTED_KEYWORDS.has(key)) {
      continue;
    }

    // Handle nested schemas recursively
    if (key === 'properties' && typeof value === 'object' && value !== null) {
      result.properties = {};
      for (const [propKey, propValue] of Object.entries(value)) {
        if (typeof propValue === 'object' && propValue !== null) {
          result.properties[propKey] = convertJsonSchemaToMongoSchema(propValue);
        }
      }
    } else if (key === 'items' && typeof value === 'object' && value !== null) {
      result.items = convertJsonSchemaToMongoSchema(value);
    } else if (['allOf', 'anyOf', 'oneOf'].includes(key) && Array.isArray(value)) {
      result[key] = value.map(item =>
        typeof item === 'object' && item !== null ? convertJsonSchemaToMongoSchema(item) : item
      );
    } else if (key === 'not' && typeof value === 'object' && value !== null) {
      result.not = convertJsonSchemaToMongoSchema(value);
    } else {
      // Copy other valid properties as-is
      result[key] = value;
    }
  }

  return result;
}
