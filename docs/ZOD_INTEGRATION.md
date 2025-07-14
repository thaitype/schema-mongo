# Zod Integration Guide

This guide covers using `schema-mongo` with [Zod](https://zod.dev) schemas, including supported features, limitations, and best practices for MongoDB validation.

## 🎉 NEW: Date & ObjectId Support

**schema-mongo** now includes a Zod adapter that enables full support for `z.date()` fields and custom MongoDB types like ObjectId! Use the new fluent API `zodSchema()` for the cleanest experience, or the traditional `zodToCompatibleJsonSchema()` approach.

```typescript
import { zodSchema } from 'schema-mongo/adapters/zod';

// ObjectId validation function
function zodObjectId(value: any): boolean {
  return typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);
}

const schema = z.object({
  _id: z.custom<string>(zodObjectId),  // ✅ ObjectId support!
  createdAt: z.date()                  // ✅ Date support!
});

// ✨ NEW: Fluent API - one-liner to MongoDB schema
const mongoSchema = zodSchema(schema, {
  customTypes: { zodObjectId: 'objectId' }
}).toMongoSchema();

// Traditional approach (still supported)
const jsonSchema = zodSchema(schema, {
  customTypes: { zodObjectId: 'objectId' }
}).toJsonSchema();
```

## Table of Contents

- [Quick Start](#quick-start)
- [Custom Types Support](#custom-types-support)
- [Supported Zod Features](#supported-zod-features)
- [Limitations & Unsupported Features](#limitations--unsupported-features)
- [MongoDB-Specific Considerations](#mongodb-specific-considerations)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)
- [Examples](#examples)

## Quick Start

```typescript
import { z } from 'zod';
import { zodSchema } from 'schema-mongo/adapters/zod';

// 1. Define custom type validators (optional)
function zodObjectId(value: any): boolean {
  return typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);
}

// 2. Define your Zod schema with custom types
const UserSchema = z.object({
  _id: z.custom<string>(zodObjectId),   // ✅ ObjectId with validation!
  email: z.string(),
  createdAt: z.date(),                  // ✅ Built-in date support!
  age: z.number().int().min(0).optional()
});

// 3. ✨ NEW: Convert directly to MongoDB schema using fluent API
const mongoSchema = zodSchema(UserSchema, {
  customTypes: { zodObjectId: 'objectId' }
}).toMongoSchema();

// 4. Use with MongoDB collection validation
await db.createCollection('users', {
  validator: { $jsonSchema: mongoSchema }
});

// Alternative: Traditional approach (still supported)
import { zodToCompatibleJsonSchema } from 'schema-mongo/adapters/zod';
import { convertJsonSchemaToMongoSchema } from 'schema-mongo';

const jsonSchema = zodToCompatibleJsonSchema(UserSchema, {
  customTypes: { zodObjectId: 'objectId' }
});
const mongoSchemaTraditional = convertJsonSchemaToMongoSchema(jsonSchema);
```

## Custom Types Support

### ✅ ObjectId Support

MongoDB ObjectId fields are now fully supported using custom types configuration:

```typescript
import { z } from 'zod';
import { zodSchema } from 'schema-mongo/adapters/zod';

// 1. Define ObjectId validation function
function zodObjectId(value: any): boolean {
  return typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);
}

// 2. Use in schema
const UserSchema = z.object({
  _id: z.custom<string>(zodObjectId),        // Primary ObjectId
  parentId: z.custom<string>(zodObjectId).optional(), // Optional ObjectId
  tags: z.array(z.object({
    tagId: z.custom<string>(zodObjectId),    // ObjectId in arrays
    name: z.string()
  }))
});

// 3. ✨ Convert directly to MongoDB schema using fluent API
const mongoSchema = zodSchema(UserSchema, {
  customTypes: { zodObjectId: 'objectId' }
}).toMongoSchema();

// Results in proper MongoDB ObjectId validation:
// { _id: { bsonType: 'objectId' }, ... }

// Alternative: Get JSON schema first
const jsonSchema = zodSchema(UserSchema, {
  customTypes: { zodObjectId: 'objectId' }
}).toJsonSchema();
```

### ✅ Custom Date Types

Create stricter date validation beyond built-in `z.date()`:

```typescript
// Custom date validator
function zodStrictDate(value: any): boolean {
  return value instanceof Date && !isNaN(value.getTime());
}

const EventSchema = z.object({
  startDate: z.date(),                        // Built-in date → bsonType: 'date'
  endDate: z.custom<Date>(zodStrictDate),     // Custom date → bsonType: 'date'
  createdAt: z.date().optional()
});

// ✨ Convert directly to MongoDB schema
const mongoSchema = zodSchema(EventSchema, {
  customTypes: { zodStrictDate: 'date' }
}).toMongoSchema();

// Or get JSON schema first
const jsonSchema = zodSchema(EventSchema, {
  customTypes: { zodStrictDate: 'date' }
}).toJsonSchema();
```

### ✅ Extensible MongoDB Types

Support any MongoDB BSON type using the same pattern:

```typescript
// Custom decimal validator
function zodDecimal(value: any): boolean {
  return typeof value === 'string' && /^\d+\.\d+$/.test(value);
}

// Custom binary data validator
function zodBinary(value: any): boolean {
  return value instanceof Uint8Array;
}

const ProductSchema = z.object({
  price: z.custom<string>(zodDecimal),
  thumbnail: z.custom<Uint8Array>(zodBinary),
  metadata: z.record(z.unknown())
});

// ✨ Fluent API for multiple custom types
const mongoSchema = zodSchema(ProductSchema, {
  customTypes: {
    zodDecimal: 'decimal',
    zodBinary: 'binData'
  }
}).toMongoSchema();

// Results in:
// { price: { bsonType: 'decimal' }, thumbnail: { bsonType: 'binData' } }
```

### 🔧 Configuration API

Both `zodSchema()` and `zodToCompatibleJsonSchema()` accept an optional configuration object:

```typescript
interface ZodToMongoOptions {
  customTypes?: Record<string, 'date' | 'objectId' | string>;
}

// Function name → MongoDB BSON type mapping
const options: ZodToMongoOptions = {
  customTypes: {
    zodObjectId: 'objectId',    // Maps zodObjectId function to ObjectId
    zodStrictDate: 'date',      // Maps zodStrictDate function to Date
    zodDecimal: 'decimal',      // Maps zodDecimal function to Decimal128
    zodBinary: 'binData'        // Maps zodBinary function to BinData
  }
};
```

### 🔍 Function Detection

The adapter detects custom types by matching function names:

```typescript
// ✅ Good - Named function, detectable
function zodObjectId(value: any): boolean {
  return typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);
}

// ❌ Avoid - Anonymous function, not detectable
const schema = z.object({
  _id: z.custom<string>((value) => /^[0-9a-fA-F]{24}$/.test(value))
});

// ✅ Alternative - Assign to named variable
const objectIdValidator = (value: any): boolean => {
  return typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);
};
```

### 🔄 Backward Compatibility

Custom types are completely optional. Existing code continues to work:

```typescript
// Both approaches work without any changes
const schema = z.object({
  name: z.string(),
  createdAt: z.date()  // Built-in date support
});

// ✨ NEW: Fluent API
const mongoSchema = zodSchema(schema).toMongoSchema(); // No options needed
const jsonSchema = zodSchema(schema).toJsonSchema();   // No options needed

// Traditional approach (still supported)
const jsonSchemaTraditional = zodToCompatibleJsonSchema(schema); // No options needed
```

## Supported Zod Features

### ✅ Basic Types

All basic Zod types are fully supported:

```typescript
z.string()     // → { bsonType: "string" }
z.number()     // → { bsonType: "double" }
z.boolean()    // → { bsonType: "bool" }
z.array(T)     // → { bsonType: "array", items: T }
z.object({})   // → { bsonType: "object", properties: {} }
z.null()       // → { bsonType: "null" }
z.date()       // → { bsonType: "date" } ✅ Built-in support!

// Custom types with configuration ✅ NEW!
z.custom(zodObjectId)  // → { bsonType: "objectId" } (with customTypes config)
z.custom(zodDecimal)   // → { bsonType: "decimal" } (with customTypes config)
```

### ✅ Number Constraints

```typescript
z.number().int()           // → { bsonType: "int" }
z.number().min(0)          // → { minimum: 0 }
z.number().max(100)        // → { maximum: 100 }
z.number().int().min(1)    // → { bsonType: "int", minimum: 1 }
```

### ✅ String Constraints

```typescript
z.string().min(1)          // → { minLength: 1 }
z.string().max(255)        // → { maxLength: 255 }
z.string().length(10)      // → { minLength: 10, maxLength: 10 }
```

⚠️ **Note**: `z.string().email()`, `z.string().url()`, and other format validations are stripped (see [limitations](#format-validations)).

### ✅ Array Constraints

```typescript
z.array(z.string()).min(1)     // → { bsonType: "array", minItems: 1, items: { bsonType: "string" } }
z.array(z.string()).max(10)    // → { maxItems: 10 }
z.array(z.string()).length(5)  // → { minItems: 5, maxItems: 5 }
```

### ✅ Enums

```typescript
z.enum(['red', 'green', 'blue'])  // → { bsonType: "string", enum: ["red", "green", "blue"] }
z.literal('admin')                // → { bsonType: "string", const: "admin" }
```

### ✅ Optional and Default Values

```typescript
z.string().optional()          // Field not in required array
z.string().default('hello')    // → { bsonType: "string" } (default stripped)
z.boolean().default(true)      // → { bsonType: "bool" } (default stripped)
```

### ✅ Object Composition

```typescript
// Nested objects
const Address = z.object({
  street: z.string(),
  city: z.string()
});

const User = z.object({
  name: z.string(),
  address: Address  // Fully supported
});
```

### ✅ Union Types

```typescript
z.union([
  z.string(),
  z.number()
])
// → { anyOf: [{ bsonType: "string" }, { bsonType: "double" }] }

z.discriminatedUnion('type', [
  z.object({ type: z.literal('email'), value: z.string() }),
  z.object({ type: z.literal('phone'), value: z.string() })
])
// → Converts to anyOf with proper discrimination
```

## Limitations & Unsupported Features

### ✅ Date Support

**NEW**: Date fields are now fully supported using the Zod adapter!

```typescript
import { zodToCompatibleJsonSchema } from 'schema-mongo/adapters/zod';

const schema = z.object({
  createdAt: z.date(),           // → { bsonType: "date" }
  updatedAt: z.date().optional() // → { bsonType: "date" } (optional)
});

const jsonSchema = zodToCompatibleJsonSchema(schema);
const mongoSchema = convertJsonSchemaToMongoSchema(jsonSchema);
// Results in proper MongoDB date validation
```

### ✅ Custom Types (NEW!)

Custom types are now supported with configuration:

```typescript
// ✅ Supported with customTypes configuration
function zodObjectId(value: any): boolean {
  return typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);
}

z.custom<string>(zodObjectId)  // → { bsonType: "objectId" } with config

// ❌ Unsupported without configuration
z.custom((value) => someComplexValidation(value))  // → {} (permissive schema)
```

### ❌ Unsupported Zod Types

These Zod types **cannot** be converted and will fall back to permissive schemas:

```typescript
z.bigint()      // Use z.number() or z.string() instead  
z.symbol()      // Not representable in JSON
z.map()         // Use z.record() instead
z.set()         // Use z.array() with uniqueItems instead
z.transform()   // Transformations don't exist in JSON Schema
z.nan()         // Not meaningful in JSON Schema
z.void()        // Not meaningful in JSON Schema
```

**Workaround**: Use the `unrepresentable: "any"` option in `z.toJSONSchema()`:

```typescript
const jsonSchema = z.toJSONSchema(schema, { 
  unrepresentable: "any" 
});
// Unsupported types become {} (equivalent to unknown)
```

### ⚠️ Format Validations

Format validations are **stripped** during MongoDB conversion as MongoDB doesn't support the `format` keyword:

```typescript
// Zod schema
z.string().email()
z.string().url()
z.string().uuid()
z.string().regex(/^\d{5}$/)

// Becomes in MongoDB schema
{ bsonType: "string" }          // email format removed
{ bsonType: "string" }          // url format removed  
{ bsonType: "string" }          // uuid format removed
{ bsonType: "string", pattern: "^\\d{5}$" }  // regex preserved as pattern
```

**Alternative**: Use explicit `regex()` for pattern validation:

```typescript
// Instead of
z.string().email()

// Use
z.string().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
// → { bsonType: "string", pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$" }
```

### ⚠️ Complex Regex Patterns

Very complex regex patterns (especially those generated by Zod's built-in formats) may cause MongoDB validation errors:

```typescript
// This may cause issues
z.string().email()  // Generates very complex regex

// Better approach for MongoDB
z.string()  // Simple string validation
// Handle email validation in application code
```

### ⚠️ Refinements and Transforms

```typescript
z.string().refine(val => val.length > 0)  // Lost in conversion
z.string().transform(val => val.trim())   // Lost in conversion
```

**Alternative**: Use built-in constraints when possible:

```typescript
// Instead of refine
z.string().refine(val => val.length > 0)

// Use
z.string().min(1)
```

## MongoDB-Specific Considerations

### Keywords Stripped During Conversion

The following JSON Schema keywords are automatically removed as they're not supported by MongoDB's `$jsonSchema`:

- `format` - Use `pattern` instead
- `additionalProperties` - MongoDB handles this differently
- `title`, `description` - Metadata only
- `examples` - Metadata only
- `$schema` - Not needed for validation
- `default` - MongoDB doesn't use defaults in validation

### BSON Type Mapping

| Zod Type | JSON Schema | MongoDB bsonType |
|----------|-------------|------------------|
| `z.string()` | `{ type: "string" }` | `{ bsonType: "string" }` |
| `z.number()` | `{ type: "number" }` | `{ bsonType: "double" }` |
| `z.number().int()` | `{ type: "integer" }` | `{ bsonType: "int" }` |
| `z.boolean()` | `{ type: "boolean" }` | `{ bsonType: "bool" }` |
| `z.array()` | `{ type: "array" }` | `{ bsonType: "array" }` |
| `z.object()` | `{ type: "object" }` | `{ bsonType: "object" }` |
| `z.date()` | `{ type: "string", __mongoType: "date" }` | `{ bsonType: "date" }` |
| `z.custom(zodObjectId)*` | `{ type: "string", __mongoType: "objectId" }` | `{ bsonType: "objectId" }` |

*Requires `customTypes` configuration

## Best Practices

### 1. Use the Fluent API for Best DX

```typescript
import { zodSchema } from 'schema-mongo/adapters/zod';

// ObjectId validator
function zodObjectId(value: any): boolean {
  return typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);
}

// ✅ BEST - Use fluent API for cleanest code
const UserSchema = z.object({
  _id: z.custom<string>(zodObjectId),  // Proper ObjectId validation
  email: z.string(),
  createdAt: z.date(),                 // Properly converted to MongoDB date
  age: z.number().int().min(0).optional()
});

// One-liner to MongoDB schema
const mongoSchema = zodSchema(UserSchema, {
  customTypes: { zodObjectId: 'objectId' }
}).toMongoSchema();

// ✅ Good - Traditional approach for more control
import { zodToCompatibleJsonSchema } from 'schema-mongo/adapters/zod';
import { convertJsonSchemaToMongoSchema } from 'schema-mongo';

const jsonSchema = zodToCompatibleJsonSchema(UserSchema, {
  customTypes: { zodObjectId: 'objectId' }
});
const mongoSchemaTraditional = convertJsonSchemaToMongoSchema(jsonSchema);

// ❌ Avoid - Using native z.toJSONSchema() with dates or custom types
const jsonSchema = z.toJSONSchema(UserSchema); // Will fail with z.date() or custom types
```

### 2. Use Named Functions for Custom Types

```typescript
// ✅ Good - Named function, easily detectable
function zodObjectId(value: any): boolean {
  return typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);
}

function zodDecimal(value: any): boolean {
  return typeof value === 'string' && /^\d+\.\d+$/.test(value);
}

const ProductSchema = z.object({
  _id: z.custom<string>(zodObjectId),
  price: z.custom<string>(zodDecimal)
});

// ❌ Avoid - Anonymous functions not detectable
const ProductSchema = z.object({
  _id: z.custom<string>((v) => /^[0-9a-fA-F]{24}$/.test(v)),  // Won't work
  price: z.custom<string>((v) => /^\d+\.\d+$/.test(v))        // Won't work
});
```

### 3. Keep Schemas Simple

```typescript
// ✅ Good - MongoDB compatible with ObjectId
function zodObjectId(value: any): boolean {
  return typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);
}

const UserSchema = z.object({
  _id: z.custom<string>(zodObjectId),  // Proper ObjectId
  email: z.string(),                   // Simple validation
  createdAt: z.date(),                 // Built-in date support
  age: z.number().int().min(0).optional()
});

// ❌ Avoid - Complex validations that get stripped
const UserSchema = z.object({
  id: z.string().uuid(),           // Format stripped
  email: z.string().email(),       // Complex regex may cause issues
  profile: z.record(z.unknown())   // Better to use explicit object
});
```

### 4. Prefer Custom Types for MongoDB-Specific Validation

```typescript
// ✅ Best - Custom ObjectId type with proper MongoDB validation
function zodObjectId(value: any): boolean {
  return typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);
}
const _id = z.custom<string>(zodObjectId);  // → { bsonType: "objectId" }

// ✅ Good - Pattern preserved but still string type
const _id = z.string().regex(/^[0-9a-fA-F]{24}$/);  // → { bsonType: "string", pattern: "..." }

// ❌ Avoid - Format stripped
const EmailSchema = z.string().email();

// ✅ Better - Simple validation + app-level checks
const EmailSchema = z.string();  // Validate format in application
```

### 5. Handle Optional Fields Correctly

```typescript
// ✅ Good - Clear optionality
const UserSchema = z.object({
  name: z.string(),                    // Required
  email: z.string().optional(),       // Optional
  age: z.number().int().optional(),   // Optional
  isActive: z.boolean()                // Required (even with default)
});
```

### 6. Test Your Schemas

Always test the full pipeline with actual MongoDB validation:

```typescript
import { MongoMemoryServer } from 'mongodb-memory-server';

async function testSchema(zodSchema: z.ZodSchema, validDoc: any, invalidDoc: any) {
  const jsonSchema = zodToCompatibleJsonSchema(zodSchema);
  const mongoSchema = convertJsonSchemaToMongoSchema(jsonSchema);
  
  // Test with real MongoDB
  const mongod = await MongoMemoryServer.create();
  const client = new MongoClient(mongod.getUri());
  await client.connect();
  
  const db = client.db('test');
  await db.createCollection('test', {
    validator: { $jsonSchema: mongoSchema }
  });
  
  const collection = db.collection('test');
  
  // Should succeed
  await collection.insertOne(validDoc);
  
  // Should fail
  try {
    await collection.insertOne(invalidDoc);
    throw new Error('Invalid document was accepted');
  } catch (error) {
    console.log('✅ Validation working correctly');
  }
  
  await client.close();
  await mongod.stop();
}
```

## Troubleshooting

### Custom Type Detection Issues

**Problem**: Custom types not being detected or converted properly

**Solutions**:
1. Ensure you're using named functions:
   ```typescript
   // ✅ Good - Named function
   function zodObjectId(value: any): boolean {
     return typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);
   }
   
   // ❌ Bad - Anonymous function
   z.custom((value) => /^[0-9a-fA-F]{24}$/.test(value))
   ```

2. Check your customTypes configuration:
   ```typescript
   const jsonSchema = zodToCompatibleJsonSchema(schema, {
     customTypes: { 
       zodObjectId: 'objectId'  // Function name must match exactly
     }
   });
   ```

3. Debug the detection:
   ```typescript
   // Add logging to see if custom types are detected
   console.log('JSON Schema:', JSON.stringify(jsonSchema, null, 2));
   // Look for __mongoType properties
   ```

### ObjectId Validation Errors

**Problem**: MongoDB rejects ObjectId values unexpectedly

**Solutions**:
1. Ensure you're using proper BSON ObjectId objects:
   ```typescript
   import { ObjectId } from 'mongodb';
   
   // ✅ Good - BSON ObjectId
   const doc = { _id: new ObjectId() };
   
   // ❌ Bad - String that looks like ObjectId
   const doc = { _id: '507f1f77bcf86cd799439011' };
   ```

2. Check ObjectId format validation:
   ```typescript
   function zodObjectId(value: any): boolean {
     // Make sure this matches MongoDB's ObjectId format exactly
     return typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);
   }
   ```

### Schema Validation Errors

**Problem**: Document fails validation unexpectedly

**Solutions**:
1. Check if format validations were stripped:
   ```typescript
   // Before conversion
   console.log(JSON.stringify(jsonSchema, null, 2));
   // After conversion  
   console.log(JSON.stringify(mongoSchema, null, 2));
   ```

2. Test with simpler schema first:
   ```typescript
   // Start simple
   const SimpleSchema = z.object({
     name: z.string()
   });
   ```

3. Check MongoDB error details:
   ```typescript
   try {
     await collection.insertOne(doc);
   } catch (error) {
     console.log('MongoDB validation error:', error.errInfo);
   }
   ```

### Complex Regex Issues

**Problem**: Pattern validation fails in MongoDB

**Solution**: Simplify regex patterns or remove format validations:

```typescript
// ❌ Complex pattern that may fail
z.string().email()

// ✅ Simpler approach
z.string()  // Validate email format in application layer
```

### Performance Issues

**Problem**: Complex schemas cause slow validation

**Solutions**:
1. Reduce nesting depth
2. Simplify union types
3. Remove unnecessary validations
4. Consider validating in application layer for complex rules

## Examples

### Complete User Management Example with ObjectId

```typescript
import { z } from 'zod';
import { zodToCompatibleJsonSchema } from 'schema-mongo/adapters/zod';
import { convertJsonSchemaToMongoSchema } from 'schema-mongo';
import { MongoClient, ObjectId } from 'mongodb';

// Define custom ObjectId validator
function zodObjectId(value: any): boolean {
  return typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);
}

// Define schemas with ObjectId and Date support
const UserSchema = z.object({
  _id: z.custom<string>(zodObjectId),           // MongoDB ObjectId
  email: z.string(),
  profile: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    age: z.number().int().min(18).max(120).optional(),
    preferences: z.object({
      newsletter: z.boolean().default(false),
      theme: z.enum(['light', 'dark']).default('light')
    }),
    avatarId: z.custom<string>(zodObjectId).optional()  // Optional ObjectId
  }),
  roles: z.array(z.enum(['admin', 'user', 'moderator'])).min(1),
  createdAt: z.date(),                          // MongoDB Date
  lastLogin: z.date().optional(),               // Optional Date
  teamIds: z.array(z.custom<string>(zodObjectId)).optional()  // Array of ObjectIds
});

// Convert to MongoDB schema with custom types
const jsonSchema = zodToCompatibleJsonSchema(UserSchema, {
  customTypes: { zodObjectId: 'objectId' }
});
const mongoSchema = convertJsonSchemaToMongoSchema(jsonSchema);

// Setup MongoDB validation
async function setupUserCollection(db: Db) {
  await db.createCollection('users', {
    validator: { $jsonSchema: mongoSchema },
    validationAction: 'error',
    validationLevel: 'strict'
  });
}

// Usage with proper BSON types
const validUser = {
  _id: new ObjectId(),                          // BSON ObjectId
  email: 'john@example.com',
  profile: {
    firstName: 'John',
    lastName: 'Doe',
    age: 30,
    preferences: {
      newsletter: true,
      theme: 'dark' as const
    },
    avatarId: new ObjectId()                    // BSON ObjectId
  },
  roles: ['user' as const],
  createdAt: new Date(),                        // BSON Date
  lastLogin: new Date(),                        // BSON Date
  teamIds: [new ObjectId(), new ObjectId()]     // Array of BSON ObjectIds
};

// This will pass validation ✅
await users.insertOne(validUser);
```

### Mixed Custom Types Example

```typescript
// Define multiple custom validators
function zodObjectId(value: any): boolean {
  return typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);
}

function zodDecimal(value: any): boolean {
  return typeof value === 'string' && /^\d+\.\d+$/.test(value);
}

const ProductSchema = z.object({
  _id: z.custom<string>(zodObjectId),
  categoryId: z.custom<string>(zodObjectId),
  name: z.string(),
  price: z.custom<string>(zodDecimal),          // Decimal128 for precise currency
  createdAt: z.date(),
  tags: z.array(z.object({
    tagId: z.custom<string>(zodObjectId),
    name: z.string()
  }))
});

const jsonSchema = zodToCompatibleJsonSchema(ProductSchema, {
  customTypes: {
    zodObjectId: 'objectId',
    zodDecimal: 'decimal'
  }
});

// Results in proper MongoDB types:
// _id: { bsonType: 'objectId' }
// categoryId: { bsonType: 'objectId' }
// price: { bsonType: 'decimal' }
// createdAt: { bsonType: 'date' }
// tags.items.properties.tagId: { bsonType: 'objectId' }
```

### Integration Testing with ObjectId & Dates

```typescript
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, ObjectId } from 'mongodb';

async function testObjectIdSchema() {
  // 1. Define schema with ObjectId and Date
  function zodObjectId(value: any): boolean {
    return typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);
  }

  const UserSchema = z.object({
    _id: z.custom<string>(zodObjectId),
    name: z.string(),
    createdAt: z.date(),
    parentId: z.custom<string>(zodObjectId).optional()
  });

  // 2. Convert with custom types configuration
  const jsonSchema = zodToCompatibleJsonSchema(UserSchema, {
    customTypes: { zodObjectId: 'objectId' }
  });
  const mongoSchema = convertJsonSchemaToMongoSchema(jsonSchema);

  // 3. Test with real MongoDB
  const mongod = await MongoMemoryServer.create();
  const client = new MongoClient(mongod.getUri());
  await client.connect();
  
  const db = client.db('test');
  await db.createCollection('users', {
    validator: { $jsonSchema: mongoSchema },
    validationAction: 'error'
  });
  
  const collection = db.collection('users');

  // 4. Valid document with proper BSON types - should succeed
  const validUser = {
    _id: new ObjectId(),        // BSON ObjectId
    name: 'John Doe',
    createdAt: new Date(),      // BSON Date
    parentId: new ObjectId()    // BSON ObjectId
  };
  
  await collection.insertOne(validUser);  // ✅ Success

  // 5. Invalid document - should fail
  try {
    await collection.insertOne({
      _id: 'invalid-id',        // Invalid ObjectId format
      name: 'Jane Doe',
      createdAt: new Date()
    });
  } catch (error) {
    console.log('✅ Validation correctly rejected invalid ObjectId');
  }

  // 6. Invalid date - should fail  
  try {
    await collection.insertOne({
      _id: new ObjectId(),
      name: 'Bob Smith',
      createdAt: 'invalid-date' // String instead of Date
    });
  } catch (error) {
    console.log('✅ Validation correctly rejected invalid Date');
  }

  await client.close();
  await mongod.stop();
}
```

### Union Types Example

```typescript
const NotificationSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('email'),
    recipient: z.string(),
    subject: z.string(),
    body: z.string()
  }),
  z.object({
    type: z.literal('sms'),
    phoneNumber: z.string(),
    message: z.string().max(160)
  }),
  z.object({
    type: z.literal('push'),
    deviceId: z.string(),
    title: z.string(),
    body: z.string(),
    badge: z.number().int().min(0).optional()
  })
]);

const jsonSchema = z.toJSONSchema(NotificationSchema);
const mongoSchema = convertJsonSchemaToMongoSchema(jsonSchema);

// Results in anyOf structure that MongoDB can validate
console.log(JSON.stringify(mongoSchema, null, 2));
```

This documentation should help you effectively use Zod with schema-mongo while understanding the limitations and best practices for MongoDB validation.