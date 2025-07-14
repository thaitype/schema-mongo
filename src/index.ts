// Type definitions
interface JsonSchema {
  type?: string | string[];
  bsonType?: string | string[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  allOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  not?: JsonSchema;
  required?: string[];
  minimum?: number;
  maximum?: number;
  pattern?: string;
  enum?: any[];
  format?: string;
  // Unsupported keywords that should be stripped
  title?: string;
  description?: string;
  examples?: any[];
  $schema?: string;
  default?: any;
  [key: string]: any;
}

interface MongoSchema {
  bsonType?: string | string[];
  properties?: Record<string, MongoSchema>;
  items?: MongoSchema;
  allOf?: MongoSchema[];
  anyOf?: MongoSchema[];
  oneOf?: MongoSchema[];
  not?: MongoSchema;
  required?: string[];
  minimum?: number;
  maximum?: number;
  pattern?: string;
  enum?: any[];
  format?: string;
  [key: string]: any;
}

// Map JSON Schema types to MongoDB bsonTypes
const TYPE_MAPPING: Record<string, string> = {
  string: 'string',
  number: 'double',
  integer: 'int',
  boolean: 'bool',
  array: 'array',
  object: 'object',
  null: 'null'
};

// Keywords to strip from JSON Schema when converting to MongoDB schema
const UNSUPPORTED_KEYWORDS = new Set([
  'title',
  'description',
  'examples',
  '$schema',
  'default',
  'format', // MongoDB $jsonSchema doesn't support format validation
  'additionalProperties' // Can cause issues with complex patterns
]);

/**
 * Converts a JSON Schema to a MongoDB-compatible $jsonSchema validator
 * @param schema - The JSON Schema object to convert
 * @returns MongoDB-compatible schema object
 */
export function convertJsonSchemaToMongoSchema(schema: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  
  // Convert type to bsonType
  if (schema.type) {
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
        typeof item === 'object' && item !== null 
          ? convertJsonSchemaToMongoSchema(item) 
          : item
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