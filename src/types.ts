import type { MongoTypeRegistry } from "./registry/MongoTypeRegistry.js";

/**
 * Extended JSON Schema that includes MongoDB-specific metadata
 */
export interface ExtendedJsonSchema {
  type?: string | string[];
  properties?: Record<string, ExtendedJsonSchema>;
  items?: ExtendedJsonSchema;
  allOf?: ExtendedJsonSchema[];
  anyOf?: ExtendedJsonSchema[];
  oneOf?: ExtendedJsonSchema[];
  not?: ExtendedJsonSchema;
  __mongoType?: 'date' | 'objectId' | string; // MongoDB-specific type hints
  [key: string]: any;
}

/**
 * Configuration options for custom MongoDB type mapping
 */
export interface SchemaMongoOptions {
  mongoTypes?: MongoTypeRegistry;
}


/**
 * Result object from schema function that provides fluent API methods
 */
export interface SchemaResult {
  /**
   * Returns the extended JSON Schema with MongoDB type hints
   */
  toJsonSchema(): ExtendedJsonSchema;

  /**
   * Returns the MongoDB-compatible schema by converting the JSON Schema
   */
  toMongoSchema(): Record<string, any>;
}