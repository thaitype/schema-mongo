# Zod Adapter Guide

This guide covers using the Zod adapter with `schema-mongo` for converting Zod schemas to MongoDB validation schemas.

## Overview

The Zod adapter (`zodSchema`) is the first implementation of schema-mongo's extensible adapter architecture. It provides seamless conversion from Zod schemas to MongoDB-compatible validation schemas with support for custom MongoDB types.

## Quick Start

```typescript
import { z } from 'zod';
import { zodSchema } from 'schema-mongo/adapters/zod';

// Define custom ObjectId validator
function zodObjectId(value: any): boolean {
  return typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);
}

// Create Zod schema
const UserSchema = z.object({
  _id: z.custom<string>(zodObjectId),
  name: z.string(),
  email: z.string(),
  createdAt: z.date(),
  isActive: z.boolean()
});

// Convert to MongoDB schema
const mongoSchema = zodSchema(UserSchema, {
  customTypes: { zodObjectId: 'objectId' }
}).toMongoSchema();

// Use with MongoDB
await db.createCollection('users', {
  validator: { $jsonSchema: mongoSchema }
});
```

## Supported Zod Types

### Basic Types

| Zod Type | MongoDB Schema |
|----------|----------------|
| `z.string()` | `{ bsonType: "string" }` |
| `z.number()` | `{ bsonType: "double" }` |
| `z.number().int()` | `{ bsonType: "int" }` |
| `z.boolean()` | `{ bsonType: "bool" }` |
| `z.date()` | `{ bsonType: "date" }` |
| `z.array(T)` | `{ bsonType: "array", items: T }` |
| `z.object({})` | `{ bsonType: "object", properties: {} }` |
| `z.null()` | `{ bsonType: "null" }` |

### Advanced Types

```typescript
// Enums
z.enum(['red', 'green', 'blue'])  
// → { bsonType: "string", enum: ["red", "green", "blue"] }

// Literals
z.literal('admin')                
// → { bsonType: "string", const: "admin" }

// Optional fields
z.string().optional()             
// → Field not included in required array

// Union types
z.union([z.string(), z.number()]) 
// → { anyOf: [{ bsonType: "string" }, { bsonType: "double" }] }

// Nested objects
z.object({
  profile: z.object({
    name: z.string(),
    age: z.number().int()
  })
});
```

## Custom Types System

The Zod adapter includes a powerful custom type system for MongoDB-specific types.

### ObjectId Support

```typescript
// Define ObjectId validator
function zodObjectId(value: any): boolean {
  return typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);
}

const schema = z.object({
  _id: z.custom<string>(zodObjectId),
  parentId: z.custom<string>(zodObjectId).optional(),
  tags: z.array(z.object({
    tagId: z.custom<string>(zodObjectId),
    name: z.string()
  }))
});

const mongoSchema = zodSchema(schema, {
  customTypes: { zodObjectId: 'objectId' }
}).toMongoSchema();

// Results in proper MongoDB ObjectId validation:
// _id: { bsonType: 'objectId' }
// parentId: { bsonType: 'objectId' }
// tags.items.properties.tagId: { bsonType: 'objectId' }
```

### Multiple Custom Types

```typescript
function zodObjectId(value: any): boolean {
  return typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);
}

function zodDecimal(value: any): boolean {
  return typeof value === 'string' && /^\d+\.\d+$/.test(value);
}

function zodBinary(value: any): boolean {
  return value instanceof Uint8Array;
}

const ProductSchema = z.object({
  _id: z.custom<string>(zodObjectId),
  price: z.custom<string>(zodDecimal),
  thumbnail: z.custom<Uint8Array>(zodBinary),
  createdAt: z.date()
});

const mongoSchema = zodSchema(ProductSchema, {
  customTypes: {
    zodObjectId: 'objectId',
    zodDecimal: 'decimal',
    zodBinary: 'binData'
  }
}).toMongoSchema();

// Results in:
// _id: { bsonType: 'objectId' }
// price: { bsonType: 'decimal' }
// thumbnail: { bsonType: 'binData' }
// createdAt: { bsonType: 'date' }
```

### Supported MongoDB Types

The custom type system supports any valid MongoDB BSON type:

- `objectId` - MongoDB ObjectId
- `date` - MongoDB Date  
- `decimal` - MongoDB Decimal128
- `binData` - MongoDB Binary Data
- `long` - MongoDB Long
- `timestamp` - MongoDB Timestamp
- `regex` - MongoDB Regular Expression
- Any other valid BSON type

## Fluent API

The Zod adapter provides a fluent API for clean, readable code:

### `.toJsonSchema()`

Returns the intermediate JSON Schema with MongoDB type hints:

```typescript
const jsonSchema = zodSchema(UserSchema, {
  customTypes: { zodObjectId: 'objectId' }
}).toJsonSchema();

// Returns JSON Schema with __mongoType metadata
// {
//   type: 'object',
//   properties: {
//     _id: { type: 'string', __mongoType: 'objectId' },
//     createdAt: { type: 'string', __mongoType: 'date' }
//   }
// }
```

### `.toMongoSchema()`

Returns the final MongoDB-compatible schema:

```typescript
const mongoSchema = zodSchema(UserSchema, {
  customTypes: { zodObjectId: 'objectId' }
}).toMongoSchema();

// Returns MongoDB schema
// {
//   bsonType: 'object',
//   properties: {
//     _id: { bsonType: 'objectId' },
//     createdAt: { bsonType: 'date' }
//   }
// }
```

## Configuration

### ZodToMongoOptions

```typescript
interface ZodToMongoOptions {
  customTypes?: Record<string, string>;
}
```

The `customTypes` option maps custom validator function names to MongoDB BSON types:

```typescript
const options: ZodToMongoOptions = {
  customTypes: {
    zodObjectId: 'objectId',    // Function name → MongoDB type
    zodDecimal: 'decimal',
    zodBinary: 'binData'
  }
};
```

### Function Detection

Custom types are detected by matching function names. Use named functions for best results:

```typescript
// ✅ Good - Named function, detectable
function zodObjectId(value: any): boolean {
  return typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);
}

// ✅ Also works - Named variable
const objectIdValidator = function zodObjectId(value: any): boolean {
  return typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);
};

// ❌ Won't work - Anonymous function
z.custom((value) => /^[0-9a-fA-F]{24}$/.test(value))
```

## Examples

### User Management Schema

```typescript
function zodObjectId(value: any): boolean {
  return typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);
}

const UserSchema = z.object({
  _id: z.custom<string>(zodObjectId),
  email: z.string(),
  profile: z.object({
    firstName: z.string(),
    lastName: z.string(),
    age: z.number().int().optional(),
    avatarId: z.custom<string>(zodObjectId).optional()
  }),
  roles: z.array(z.enum(['admin', 'user', 'moderator'])),
  createdAt: z.date(),
  lastLogin: z.date().optional(),
  teamIds: z.array(z.custom<string>(zodObjectId)).optional()
});

const mongoSchema = zodSchema(UserSchema, {
  customTypes: { zodObjectId: 'objectId' }
}).toMongoSchema();
```

### E-commerce Product Schema

```typescript
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
  price: z.custom<string>(zodDecimal),
  inventory: z.object({
    quantity: z.number().int(),
    reservations: z.array(z.object({
      orderId: z.custom<string>(zodObjectId),
      quantity: z.number().int(),
      expiresAt: z.date()
    }))
  }),
  createdAt: z.date(),
  updatedAt: z.date()
});

const mongoSchema = zodSchema(ProductSchema, {
  customTypes: {
    zodObjectId: 'objectId',
    zodDecimal: 'decimal'
  }
}).toMongoSchema();
```

### Integration with MongoDB

```typescript
import { MongoClient, ObjectId } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';

async function setupCollection() {
  // Setup MongoDB
  const mongod = await MongoMemoryServer.create();
  const client = new MongoClient(mongod.getUri());
  await client.connect();
  
  const db = client.db('ecommerce');
  
  // Create collection with validation
  await db.createCollection('products', {
    validator: { $jsonSchema: mongoSchema },
    validationAction: 'error',
    validationLevel: 'strict'
  });
  
  const products = db.collection('products');
  
  // Valid document with proper BSON types
  const validProduct = {
    _id: new ObjectId(),
    categoryId: new ObjectId(),
    name: 'Laptop',
    price: '999.99', // String for Decimal128
    inventory: {
      quantity: 10,
      reservations: []
    },
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  await products.insertOne(validProduct); // ✅ Success
  
  // Invalid document will be rejected
  try {
    await products.insertOne({
      _id: 'invalid-id', // Invalid ObjectId format
      name: 'Invalid Product'
    });
  } catch (error) {
    console.log('✅ Validation correctly rejected invalid document');
  }
  
  await client.close();
  await mongod.stop();
}
```

## Limitations

### Type Conversion Focus

The Zod adapter focuses on **type conversion**, not validation constraints:

```typescript
// ✅ Type conversion - Supported
z.string()           // → { bsonType: "string" }
z.number().int()     // → { bsonType: "int" }
z.array(z.string())  // → { bsonType: "array", items: { bsonType: "string" } }

// ❌ Validation constraints - Not supported
z.string().min(5)    // Constraint ignored
z.number().max(100)  // Constraint ignored
z.array().length(3)  // Constraint ignored
```

### Validation Strategy

Use Zod for application-level validation and schema-mongo for MongoDB schema setup:

```typescript
// 1. Application validation with Zod
const validatedData = UserSchema.parse(inputData);

// 2. MongoDB schema setup with schema-mongo
const mongoSchema = zodSchema(UserSchema, {
  customTypes: { zodObjectId: 'objectId' }
}).toMongoSchema();

await db.createCollection('users', {
  validator: { $jsonSchema: mongoSchema }
});

// 3. Insert validated data
await db.collection('users').insertOne(validatedData);
```

## Best Practices

### 1. Use Named Functions for Custom Types

```typescript
// ✅ Best practice
function zodObjectId(value: any): boolean {
  return typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);
}

// ❌ Avoid
const validator = (value: any) => /^[0-9a-fA-F]{24}$/.test(value);
```

### 2. Group Custom Type Definitions

```typescript
// Custom type validators
function zodObjectId(value: any): boolean {
  return typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);
}

function zodDecimal(value: any): boolean {
  return typeof value === 'string' && /^\d+\.\d+$/.test(value);
}

// Reusable configuration
const mongoTypeConfig = {
  zodObjectId: 'objectId',
  zodDecimal: 'decimal'
} as const;

// Use across schemas
const userSchema = zodSchema(UserSchema, { customTypes: mongoTypeConfig });
const productSchema = zodSchema(ProductSchema, { customTypes: mongoTypeConfig });
```

### 3. Test with Real MongoDB

```typescript
import { MongoMemoryServer } from 'mongodb-memory-server';

async function testSchema(zodSchema: z.ZodSchema, testData: any) {
  const mongoSchema = zodSchema(zodSchema, {
    customTypes: { zodObjectId: 'objectId' }
  }).toMongoSchema();
  
  // Test with real MongoDB
  const mongod = await MongoMemoryServer.create();
  const client = new MongoClient(mongod.getUri());
  await client.connect();
  
  const db = client.db('test');
  await db.createCollection('test', {
    validator: { $jsonSchema: mongoSchema }
  });
  
  // Verify schema works
  await db.collection('test').insertOne(testData);
  
  await client.close();
  await mongod.stop();
}
```

### 4. Keep Schemas Simple

```typescript
// ✅ Good - Clean, focused schema
const UserSchema = z.object({
  _id: z.custom<string>(zodObjectId),
  name: z.string(),
  email: z.string(),
  createdAt: z.date(),
  isActive: z.boolean()
});

// ❌ Avoid - Complex constraints that get stripped
const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1).max(100),
  age: z.number().int().min(0).max(120)
});
```

## Troubleshooting

### Custom Type Not Detected

**Problem**: Custom type not being converted to MongoDB type

**Solution**: Ensure you're using named functions and correct configuration:

```typescript
// ✅ Correct
function zodObjectId(value: any): boolean {
  return typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);
}

const schema = z.object({
  _id: z.custom<string>(zodObjectId)
});

const mongoSchema = zodSchema(schema, {
  customTypes: { zodObjectId: 'objectId' } // Function name must match exactly
}).toMongoSchema();
```

### MongoDB Validation Errors

**Problem**: Documents fail MongoDB validation unexpectedly

**Solutions**:

1. **Check BSON types**: Ensure you're using proper MongoDB BSON types:
   ```typescript
   // ✅ Good - BSON ObjectId
   const doc = { _id: new ObjectId() };
   
   // ❌ Bad - String that looks like ObjectId
   const doc = { _id: '507f1f77bcf86cd799439011' };
   ```

2. **Verify schema conversion**: Check the generated MongoDB schema:
   ```typescript
   const mongoSchema = zodSchema(schema, { customTypes }).toMongoSchema();
   console.log(JSON.stringify(mongoSchema, null, 2));
   ```

3. **Test step by step**: Verify each conversion step:
   ```typescript
   const jsonSchema = zodSchema(schema, { customTypes }).toJsonSchema();
   console.log('JSON Schema:', jsonSchema);
   
   const mongoSchema = zodSchema(schema, { customTypes }).toMongoSchema();
   console.log('MongoDB Schema:', mongoSchema);
   ```

This adapter provides a clean, type-safe way to convert Zod schemas to MongoDB validation schemas while maintaining the flexibility of schema-mongo's extensible architecture.