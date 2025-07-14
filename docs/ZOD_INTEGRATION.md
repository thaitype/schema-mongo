# Zod Integration Guide

This guide covers using `schema-mongo` with [Zod](https://zod.dev) schemas, including supported features, limitations, and best practices for MongoDB validation.

## Table of Contents

- [Quick Start](#quick-start)
- [Supported Zod Features](#supported-zod-features)
- [Limitations & Unsupported Features](#limitations--unsupported-features)
- [MongoDB-Specific Considerations](#mongodb-specific-considerations)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)
- [Examples](#examples)

## Quick Start

```typescript
import { z } from 'zod';
import { convertJsonSchemaToMongoSchema } from 'schema-mongo';

// 1. Define your Zod schema
const UserSchema = z.object({
  id: z.string(),
  email: z.string(),
  age: z.number().int().min(0).optional()
});

// 2. Convert to JSON Schema, then to MongoDB schema
const jsonSchema = z.toJSONSchema(UserSchema);
const mongoSchema = convertJsonSchemaToMongoSchema(jsonSchema);

// 3. Use with MongoDB collection validation
await db.createCollection('users', {
  validator: { $jsonSchema: mongoSchema }
});
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

### ❌ Unsupported Zod Types

These Zod types **cannot** be converted to JSON Schema and will throw an error:

```typescript
z.date()        // Use z.string() for ISO date strings instead
z.bigint()      // Use z.number() or z.string() instead  
z.symbol()      // Not representable in JSON
z.map()         // Use z.record() instead
z.set()         // Use z.array() with uniqueItems instead
z.transform()   // Transformations don't exist in JSON Schema
z.custom()      // Custom validations not supported
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

## Best Practices

### 1. Keep Schemas Simple

```typescript
// ✅ Good - MongoDB compatible
const UserSchema = z.object({
  id: z.string(),
  email: z.string(),  // Simple validation
  age: z.number().int().min(0).optional()
});

// ❌ Avoid - Complex validations that get stripped
const UserSchema = z.object({
  id: z.string().uuid(),           // Format stripped
  email: z.string().email(),       // Complex regex may cause issues
  profile: z.record(z.unknown())   // Better to use explicit object
});
```

### 2. Use Explicit Patterns Instead of Formats

```typescript
// ✅ Good - Pattern preserved
const ObjectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/);

// ❌ Avoid - Format stripped
const EmailSchema = z.string().email();

// ✅ Better - Simple validation + app-level checks
const EmailSchema = z.string();  // Validate format in application
```

### 3. Handle Optional Fields Correctly

```typescript
// ✅ Good - Clear optionality
const UserSchema = z.object({
  name: z.string(),                    // Required
  email: z.string().optional(),       // Optional
  age: z.number().int().optional(),   // Optional
  isActive: z.boolean()                // Required (even with default)
});
```

### 4. Test Your Schemas

Always test the full pipeline with actual MongoDB validation:

```typescript
import { MongoMemoryServer } from 'mongodb-memory-server';

async function testSchema(zodSchema: z.ZodSchema, validDoc: any, invalidDoc: any) {
  const jsonSchema = z.toJSONSchema(zodSchema);
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

### Complete User Management Example

```typescript
import { z } from 'zod';
import { convertJsonSchemaToMongoSchema } from 'schema-mongo';
import { MongoClient } from 'mongodb';

// Define schemas
const UserSchema = z.object({
  _id: z.string(),
  email: z.string(),
  profile: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    age: z.number().int().min(18).max(120).optional(),
    preferences: z.object({
      newsletter: z.boolean().default(false),
      theme: z.enum(['light', 'dark']).default('light')
    })
  }),
  roles: z.array(z.enum(['admin', 'user', 'moderator'])).min(1),
  createdAt: z.string(),  // ISO date string
  lastLogin: z.string().optional()
});

// Convert to MongoDB schema
const jsonSchema = z.toJSONSchema(UserSchema);
const mongoSchema = convertJsonSchemaToMongoSchema(jsonSchema);

// Setup MongoDB validation
async function setupUserCollection(db: Db) {
  await db.createCollection('users', {
    validator: { $jsonSchema: mongoSchema },
    validationAction: 'error',
    validationLevel: 'strict'
  });
}

// Usage
const validUser = {
  _id: 'user_123',
  email: 'john@example.com',
  profile: {
    firstName: 'John',
    lastName: 'Doe',
    age: 30,
    preferences: {
      newsletter: true,
      theme: 'dark' as const
    }
  },
  roles: ['user' as const],
  createdAt: new Date().toISOString()
};

// This will pass validation ✅
await users.insertOne(validUser);
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