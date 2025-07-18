import { z } from 'zod';
import { convertJsonSchemaToMongoSchema } from '../lib.js';
import { MongoTypeRegistry, type MongoTypeInfo } from '../registry/MongoTypeRegistry.js';
import type { ExtendedJsonSchema, SchemaMongoOptions, SchemaResult } from 'src/types.js';

/**
 * Converts a Zod schema to a JSON Schema with MongoDB-compatible extensions.
 * Handles unsupported Zod types like z.date() by converting them to strings
 * with special metadata that can be processed by convertJsonSchemaToMongoSchema.
 * Also supports custom MongoDB types through MongoTypeRegistry.
 *
 * @param zodSchema - The Zod schema to convert
 * @param options - Configuration options for custom type mapping
 * @returns Extended JSON Schema with MongoDB type hints
 */
export function zodToCompatibleJsonSchema(zodSchema: z.ZodTypeAny, options?: SchemaMongoOptions): ExtendedJsonSchema {
  return processZodType(zodSchema, options?.mongoTypes);
}

/**
 * Creates a fluent API for converting Zod schemas to JSON Schema or MongoDB schema.
 * Provides a more convenient interface with .toJsonSchema() and .toMongoSchema() methods.
 *
 * @param zodSchema - The Zod schema to convert
 * @param options - Configuration options for custom type mapping
 * @returns Fluent API object with toJsonSchema() and toMongoSchema() methods
 */
export function zodSchema(zodSchema: z.ZodTypeAny, options?: SchemaMongoOptions): SchemaResult {
  return {
    toJsonSchema(): ExtendedJsonSchema {
      return zodToCompatibleJsonSchema(zodSchema, options);
    },

    toMongoSchema(): Record<string, any> {
      const jsonSchema = zodToCompatibleJsonSchema(zodSchema, options);
      return convertJsonSchemaToMongoSchema(jsonSchema);
    },
  };
}

/**
 * Recursively processes Zod types and converts them to extended JSON Schema
 */
function processZodType(zodType: z.ZodTypeAny, mongoTypes?: MongoTypeRegistry): ExtendedJsonSchema {
  const def = zodType._def || (zodType as any).def;
  const zodType_ = def?.type;

  // Handle ZodDate - convert to string with date metadata
  if (zodType_ === 'date') {
    return {
      type: 'string',
      __mongoType: 'date',
    };
  }

  // Handle ZodCustom - check for configured mongo types
  if (zodType_ === 'custom' && mongoTypes) {
    const customTypeName = findCustomTypeName(zodType, mongoTypes);
    if (customTypeName) {
      const bsonType = getBsonType(customTypeName, mongoTypes);
      if (bsonType) {
        return {
          type: 'string',
          __mongoType: bsonType,
        };
      }
    }
  }

  // Handle ZodString
  if (zodType_ === 'string') {
    return { type: 'string' };
  }

  // Handle ZodNumber
  if (zodType_ === 'number') {
    const result: ExtendedJsonSchema = { type: 'number' };

    // Check if it's an integer - support both Zod v3 and v4 approaches
    let isInteger = false;

    // Method 1: Check the isInt property directly (Zod v4)
    if ((zodType as any).isInt === true) {
      isInteger = true;
    }

    // Method 2: Check in the checks array (Zod v3/v4)
    if (!isInteger && def.checks && def.checks.length > 0) {
      for (const check of def.checks) {
        const checkAny = check as any;
        const checkDef = checkAny._def || checkAny.def;
        if (
          checkAny.kind === 'int' || // Zod v3
          (checkDef && checkDef.check === 'number_format' && checkDef.format === 'safeint')
        ) {
          // Zod v4
          isInteger = true;
          break;
        }
      }
    }

    if (isInteger) {
      result.type = 'integer';
    }

    return result;
  }

  // Handle ZodBoolean
  if (zodType_ === 'boolean') {
    return { type: 'boolean' };
  }

  // Handle ZodArray
  if (zodType_ === 'array') {
    const defAny = def as any;
    return {
      type: 'array',
      items: processZodType(defAny.element, mongoTypes),
    };
  }

  // Handle ZodObject
  if (zodType_ === 'object') {
    const defAny = def as any;
    const properties: Record<string, ExtendedJsonSchema> = {};
    const required: string[] = [];

    const shape = defAny.shape || {};
    for (const [key, value] of Object.entries(shape)) {
      properties[key] = processZodType(value as z.ZodTypeAny, mongoTypes);

      // Check if field is required (not optional)
      // In Zod v4, we need to check the def structure more carefully
      const fieldDef = (value as any)._def || (value as any).def;
      const isOptional =
        fieldDef &&
        (fieldDef.typeName === 'ZodOptional' ||
          fieldDef.type === 'optional' ||
          // Handle nested optional structures
          (fieldDef.innerType && fieldDef.innerType._def && fieldDef.innerType._def.typeName === 'ZodOptional'));

      if (!isOptional) {
        required.push(key);
      }
    }

    const result: ExtendedJsonSchema = {
      type: 'object',
      properties,
    };

    if (required.length > 0) {
      result.required = required;
    }

    return result;
  }

  // Handle ZodEnum
  if (zodType_ === 'enum') {
    const defAny = def as any;
    return {
      type: 'string',
      enum: Object.values(defAny.values || defAny.entries || []),
    };
  }

  // Handle ZodLiteral
  if (zodType_ === 'literal') {
    const defAny = def as any;
    // In Zod v4, literal values are stored in the values array
    const value = defAny.value || (defAny.values && defAny.values[0]);
    return {
      type: typeof value,
      const: value,
    };
  }

  // Handle ZodUnion
  if (zodType_ === 'union') {
    const defAny = def as any;
    return {
      anyOf: (defAny.options || []).map((option: z.ZodTypeAny) => processZodType(option, mongoTypes)),
    };
  }

  // Handle ZodIntersection
  if (zodType_ === 'intersection') {
    const defAny = def as any;
    return {
      allOf: [processZodType(defAny.left, mongoTypes), processZodType(defAny.right, mongoTypes)],
    };
  }

  // Handle ZodOptional
  if (zodType_ === 'optional') {
    const defAny = def as any;
    return processZodType(defAny.innerType, mongoTypes);
  }

  // Handle ZodDefault
  if (zodType_ === 'default') {
    const defAny = def as any;
    const result = processZodType(defAny.innerType, mongoTypes);
    // Note: We don't include default values as they get stripped by MongoDB converter
    return result;
  }

  // Handle ZodNullable
  if (zodType_ === 'nullable') {
    const defAny = def as any;
    const innerSchema = processZodType(defAny.innerType, mongoTypes);
    return {
      anyOf: [innerSchema, { type: 'null' }],
    };
  }

  // Handle ZodNull
  if (zodType_ === 'null') {
    return { type: 'null' };
  }

  // Fallback for unsupported types - use native Zod conversion with error handling
  try {
    return z.toJSONSchema(zodType) as ExtendedJsonSchema;
  } catch (error) {
    // For truly unsupported types, return a permissive schema
    console.warn(`Unsupported Zod type: ${zodType_}. Converting to permissive schema.`);
    return {};
  }
}

/**
 * Attempts to find a custom type name by matching the Zod custom validator
 * against the configured mongo types using object identity
 */
function findCustomTypeName(zodType: z.ZodTypeAny, mongoTypes: MongoTypeRegistry): string | undefined {
  return mongoTypes.findByValidator(zodType);
}

/**
 * Get the BSON type for a custom type name
 */
function getBsonType(typeName: string, mongoTypes: MongoTypeRegistry): string | undefined {
  const typeInfo = (mongoTypes as { get: (name: string) => MongoTypeInfo }).get(typeName);
  return typeInfo?.bsonType;
}
