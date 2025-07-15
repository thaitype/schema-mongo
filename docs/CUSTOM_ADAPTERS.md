# Custom Adapter Development Guide

This guide covers how to create custom adapters for `schema-mongo` that convert validation schemas from different libraries into MongoDB-compatible validation schemas.

## Overview

The `schema-mongo` adapter system allows you to convert schemas from any validation library into MongoDB `$jsonSchema` format. The system works by:

1. **Converting** library-specific schemas to extended JSON Schema format
2. **Adding metadata** via `__mongoType` properties for MongoDB-specific types
3. **Processing** the extended JSON Schema through `convertJsonSchemaToMongoSchema()`

## Architecture

### Core Components

```typescript
import type { ExtendedJsonSchema, SchemaMongoOptions, SchemaResult } from 'schema-mongo';
```

### Metadata System

The `__mongoType` property is the key to MongoDB type conversion:

```typescript
// JSON Schema with MongoDB metadata
{
  type: 'string',
  __mongoType: 'objectId'  // Converts to { bsonType: 'objectId' }
}

// After convertJsonSchemaToMongoSchema()
{
  bsonType: 'objectId'
}
```

## Standard Schema Support

### What is Standard Schema?

[Standard Schema](https://standardschema.dev/) is a specification that provides a common interface for TypeScript validation libraries. Libraries that implement StandardSchemaV1 gain:

- **Type Safety**: Full TypeScript inference and type checking
- **Interoperability**: Can be used interchangeably across different libraries
- **Registry Support**: Type-safe access through `MongoTypeRegistry.get()` method

### Supported Libraries

Libraries with Standard Schema v1 support include:
- **Zod** (v3.24.0+) - Full support with type safety
- **Valibot** (v1.0+) - Full support with type safety  
- **ArkType** (v2.0+) - Full support with type safety
- **Effect Schema** (v3.13.0+) - Full support with type safety
- **Arri Schema** (v0.71.0+) - Full support with type safety
- And many more (see [standardschema.dev](https://standardschema.dev/))

### Type Safety Comparison

```typescript
// Standard Schema Compliant (e.g., Valibot, Zod)
const mongoTypes = new MongoTypeRegistry()
  .register('objectId', {
    schema: v.custom<ObjectId>(ObjectId.isValid), // Full type inference
    bsonType: 'objectId'
  });

const schema = v.object({
  _id: mongoTypes.get('objectId') // ✅ Type-safe: returns ObjectId schema
});

// Non-Standard Schema (e.g., Joi)
const mongoTypes = new Map([
  ['objectId', 'objectId'] // ❌ String-based mapping only
]);

const schema = Joi.object({
  _id: Joi.custom(...) // ❌ No type safety from registry
});
```

## Implementation Patterns

### Pattern 1: Standard Schema Compliant (Recommended)

For libraries that support Standard Schema v1:

```typescript
import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { ExtendedJsonSchema, SchemaMongoOptions, SchemaResult } from 'schema-mongo';
import { convertJsonSchemaToMongoSchema } from 'schema-mongo';

export function librarySchema<T extends StandardSchemaV1>(
  schema: T, 
  options?: SchemaMongoOptions
): SchemaResult {
  return {
    toJsonSchema(): ExtendedJsonSchema {
      return processLibraryType(schema, options?.mongoTypes);
    },
    
    toMongoSchema(): Record<string, any> {
      const jsonSchema = this.toJsonSchema();
      return convertJsonSchemaToMongoSchema(jsonSchema);
    }
  };
}
```

### Pattern 2: Non-Standard Schema

For libraries without Standard Schema support:

```typescript
import type { ExtendedJsonSchema, SchemaResult } from 'schema-mongo';
import { convertJsonSchemaToMongoSchema } from 'schema-mongo';

interface LibraryToMongoOptions {
  customTypes?: Record<string, string>; // String-based mapping
}

export function librarySchema(schema: LibrarySchema, options?: LibraryToMongoOptions): SchemaResult {
  return {
    toJsonSchema(): ExtendedJsonSchema {
      return processLibraryType(schema, options?.customTypes);
    },
    
    toMongoSchema(): Record<string, any> {
      const jsonSchema = this.toJsonSchema();
      return convertJsonSchemaToMongoSchema(jsonSchema);
    }
  };
}
```

### Pattern 3: Direct JSON Schema Enhancement

For direct JSON Schema manipulation:

```typescript
import type { ExtendedJsonSchema } from 'schema-mongo';

export function enhanceJsonSchema(
  schema: Record<string, any>,
  customTypes: Record<string, string> = {}
): ExtendedJsonSchema {
  // Add __mongoType metadata directly to JSON Schema
  return addMongoMetadata(schema, customTypes);
}
```

## Best Practices

### 1. Choose the Right Pattern

**Use Standard Schema Compliant Pattern when:**
- Your validation library supports Standard Schema v1
- You need full type safety and TypeScript inference
- You want maximum integration with MongoTypeRegistry
- You're building modern, type-safe applications

**Use Non-Standard Schema Pattern when:**
- Your validation library doesn't support Standard Schema
- You're working with legacy JavaScript codebases
- You need basic MongoDB integration without full type safety

**Use Plain JSON Schema Pattern when:**
- You're working directly with JSON Schema
- You need simple, lightweight MongoDB type enhancement
- You want automatic field name pattern detection

### 2. Handle Custom Types Properly

```typescript
// ✅ Good: Standard Schema with object identity
const mongoTypes = new MongoTypeRegistry()
  .register('objectId', {
    schema: customValidator, // Same instance used everywhere
    bsonType: 'objectId'
  });

// ❌ Bad: String-based matching (fragile)
const customTypes = {
  'ObjectIdValidator': 'objectId' // Function name matching
};
```

### 3. Test with Real MongoDB

```typescript
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';

async function testAdapter() {
  // Create schema using your adapter
  const mongoSchema = yourAdapter(schema, options).toMongoSchema();
  
  // Test with real MongoDB
  const mongod = await MongoMemoryServer.create();
  const client = new MongoClient(mongod.getUri());
  await client.connect();
  
  const db = client.db('test');
  await db.createCollection('test', {
    validator: { $jsonSchema: mongoSchema }
  });
  
  // Test data insertion
  const collection = db.collection('test');
  await collection.insertOne(testDocument);
  
  await client.close();
  await mongod.stop();
}
```

### 4. Error Handling

```typescript
function processType(schema: any, mongoTypes?: MongoTypeRegistry): ExtendedJsonSchema {
  try {
    // Attempt conversion
    return convertSchema(schema, mongoTypes);
  } catch (error) {
    // Fallback for unknown types
    console.warn(`Unknown schema type, falling back to string: ${error.message}`);
    return { type: 'string' };
  }
}
```

### 5. Recursive Processing

```typescript
function processType(schema: any, mongoTypes?: MongoTypeRegistry): ExtendedJsonSchema {
  // Handle composition schemas recursively
  if (schema.allOf) {
    return {
      allOf: schema.allOf.map((subSchema: any) => processType(subSchema, mongoTypes))
    };
  }
  
  if (schema.properties) {
    const properties: Record<string, ExtendedJsonSchema> = {};
    Object.entries(schema.properties).forEach(([key, value]) => {
      properties[key] = processType(value as any, mongoTypes);
    });
    return { type: 'object', properties };
  }
  
  // Handle base types...
}
```

## Conclusion

The `schema-mongo` adapter system provides flexible integration with any validation library through three distinct patterns:

1. **Standard Schema Compliant** - Maximum type safety and modern API
2. **Non-Standard Schema** - Basic integration for legacy libraries  
3. **Plain JSON Schema** - Direct enhancement for simple use cases

Choose the pattern that best fits your validation library's capabilities and your project's type safety requirements. The Standard Schema compliant approach is recommended for new projects, while the other patterns provide migration paths for existing codebases.