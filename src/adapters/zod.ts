import { z } from 'zod';
import { convertJsonSchemaToMongoSchema } from '../index';

/**
 * Extended JSON Schema that includes MongoDB-specific metadata
 */
interface ExtendedJsonSchema {
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
export interface ZodToMongoOptions {
  customTypes?: Record<string, 'date' | 'objectId' | string>;
}

/**
 * Result object from zodSchema function that provides fluent API methods
 */
export interface ZodSchemaResult {
  /**
   * Returns the extended JSON Schema with MongoDB type hints
   */
  toJsonSchema(): ExtendedJsonSchema;
  
  /**
   * Returns the MongoDB-compatible schema by converting the JSON Schema
   */
  toMongoSchema(): Record<string, any>;
}

/**
 * Converts a Zod schema to a JSON Schema with MongoDB-compatible extensions.
 * Handles unsupported Zod types like z.date() by converting them to strings
 * with special metadata that can be processed by convertJsonSchemaToMongoSchema.
 * Also supports custom MongoDB types through configuration.
 * 
 * @param zodSchema - The Zod schema to convert
 * @param options - Configuration options for custom type mapping
 * @returns Extended JSON Schema with MongoDB type hints
 */
export function zodToCompatibleJsonSchema(
  zodSchema: z.ZodTypeAny, 
  options?: ZodToMongoOptions
): ExtendedJsonSchema {
  return processZodType(zodSchema, options?.customTypes);
}

/**
 * Creates a fluent API for converting Zod schemas to JSON Schema or MongoDB schema.
 * Provides a more convenient interface with .toJsonSchema() and .toMongoSchema() methods.
 * 
 * @param zodSchema - The Zod schema to convert
 * @param options - Configuration options for custom type mapping
 * @returns Fluent API object with toJsonSchema() and toMongoSchema() methods
 */
export function zodSchema(
  zodSchema: z.ZodTypeAny, 
  options?: ZodToMongoOptions
): ZodSchemaResult {
  return {
    toJsonSchema(): ExtendedJsonSchema {
      return zodToCompatibleJsonSchema(zodSchema, options);
    },
    
    toMongoSchema(): Record<string, any> {
      const jsonSchema = zodToCompatibleJsonSchema(zodSchema, options);
      return convertJsonSchemaToMongoSchema(jsonSchema);
    }
  };
}

/**
 * Recursively processes Zod types and converts them to extended JSON Schema
 */
function processZodType(zodType: z.ZodTypeAny, customTypes?: Record<string, string>): ExtendedJsonSchema {
  const def = zodType._def || (zodType as any).def;
  const zodType_ = def?.type;
  
  // Handle ZodDate - convert to string with date metadata
  if (zodType_ === 'date') {
    return {
      type: 'string',
      __mongoType: 'date'
    };
  }
  
  // Handle ZodCustom - check for configured custom types
  if (zodType_ === 'custom' && customTypes) {
    const customTypeName = findCustomTypeName(zodType, customTypes);
    if (customTypeName) {
      return {
        type: 'string',
        __mongoType: customTypes[customTypeName]
      };
    }
  }
  
  // Handle ZodString
  if (zodType_ === 'string') {
    const result: ExtendedJsonSchema = { type: 'string' };
    
    // Add string constraints
    if (def.checks) {
      for (const check of def.checks) {
        const checkAny = check as any;
        switch (checkAny.kind) {
          case 'min':
            result.minLength = checkAny.value;
            break;
          case 'max':
            result.maxLength = checkAny.value;
            break;
          case 'length':
            result.minLength = checkAny.value;
            result.maxLength = checkAny.value;
            break;
          case 'regex':
            result.pattern = checkAny.regex?.source;
            break;
        }
      }
    }
    
    return result;
  }
  
  // Handle ZodNumber
  if (zodType_ === 'number') {
    const result: ExtendedJsonSchema = { type: 'number' };
    
    // Check if it's an integer and handle constraints
    if (def.checks && def.checks.length > 0) {
      for (const check of def.checks) {
        const checkAny = check as any;
        // Check for integer type
        if (checkAny.kind === 'int') {
          result.type = 'integer';
        }
        // Handle min/max from check properties
        if (checkAny.kind === 'min' && checkAny.value !== undefined && checkAny.value > -9007199254740991) {
          result.minimum = checkAny.value;
        }
        if (checkAny.kind === 'max' && checkAny.value !== undefined && checkAny.value < 9007199254740991) {
          result.maximum = checkAny.value;
        }
      }
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
    const result: ExtendedJsonSchema = {
      type: 'array',
      items: processZodType(defAny.type || defAny.element, customTypes)
    };
    
    // Add array constraints from checks array
    if (defAny.checks) {
      for (const check of defAny.checks) {
        const checkAny = check as any;
        switch (checkAny.kind) {
          case 'min':
            result.minItems = checkAny.value;
            break;
          case 'max':
            result.maxItems = checkAny.value;
            break;
          case 'length':
            result.minItems = checkAny.value;
            result.maxItems = checkAny.value;
            break;
        }
      }
    }
    
    return result;
  }
  
  // Handle ZodObject
  if (zodType_ === 'object') {
    const defAny = def as any;
    const properties: Record<string, ExtendedJsonSchema> = {};
    const required: string[] = [];
    
    const shape = defAny.shape || {};
    for (const [key, value] of Object.entries(shape)) {
      properties[key] = processZodType(value as z.ZodTypeAny, customTypes);
      
      // Check if field is required (not optional)
      // In Zod v4, we need to check the def structure differently
      const fieldDef = (value as any)._def || (value as any).def;
      if (!fieldDef || fieldDef.typeName !== 'ZodOptional') {
        required.push(key);
      }
    }
    
    const result: ExtendedJsonSchema = {
      type: 'object',
      properties
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
      enum: Object.values(defAny.values || defAny.entries || [])
    };
  }
  
  // Handle ZodLiteral
  if (zodType_ === 'literal') {
    const defAny = def as any;
    const value = defAny.value;
    return {
      type: typeof value,
      const: value
    };
  }
  
  // Handle ZodUnion
  if (zodType_ === 'union') {
    const defAny = def as any;
    return {
      anyOf: (defAny.options || []).map((option: z.ZodTypeAny) => processZodType(option, customTypes))
    };
  }
  
  // Handle ZodIntersection
  if (zodType_ === 'intersection') {
    const defAny = def as any;
    return {
      allOf: [processZodType(defAny.left, customTypes), processZodType(defAny.right, customTypes)]
    };
  }
  
  // Handle ZodOptional
  if (zodType_ === 'optional') {
    const defAny = def as any;
    return processZodType(defAny.innerType, customTypes);
  }
  
  // Handle ZodDefault
  if (zodType_ === 'default') {
    const defAny = def as any;
    const result = processZodType(defAny.innerType, customTypes);
    // Note: We don't include default values as they get stripped by MongoDB converter
    return result;
  }
  
  // Handle ZodNullable
  if (zodType_ === 'nullable') {
    const defAny = def as any;
    const innerSchema = processZodType(defAny.innerType, customTypes);
    return {
      anyOf: [
        innerSchema,
        { type: 'null' }
      ]
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
 * Attempts to find a custom type name by matching the Zod custom function
 * against the configured custom types.
 */
function findCustomTypeName(zodType: z.ZodTypeAny, customTypes: Record<string, string>): string | undefined {
  const def = zodType._def || (zodType as any).def;
  const defAny = def as any;
  
  // Strategy 1: Check the function name (Zod v4 stores the function in def.fn)
  if (defAny.fn && typeof defAny.fn === 'function') {
    const functionName = defAny.fn.name;
    if (functionName && customTypes[functionName]) {
      return functionName;
    }
  }
  
  // Strategy 2: Check for a custom property on the zodType
  const customTypeName = (zodType as any).__customTypeName;
  if (customTypeName && customTypes[customTypeName]) {
    return customTypeName;
  }
  
  // Strategy 3: Match function toString() - works for testing
  if (defAny.fn && typeof defAny.fn === 'function') {
    const funcString = defAny.fn.toString();
    for (const typeName of Object.keys(customTypes)) {
      if (funcString.includes(typeName)) {
        return typeName;
      }
    }
  }
  
  // Strategy 4: Check legacy def.check for older Zod versions
  if (defAny.check && typeof defAny.check === 'function') {
    const functionName = defAny.check.name;
    if (functionName && customTypes[functionName]) {
      return functionName;
    }
  }
  
  return undefined;
}