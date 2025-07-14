# Zod Adapter Guide

This guide covers using the Zod adapter with `schema-mongo` for converting Zod schemas to MongoDB validation schemas using the modern MongoTypeRegistry approach.

## Overview

The Zod adapter (`zodSchema`) provides seamless conversion from Zod schemas to MongoDB-compatible validation schemas with type-safe custom type support through the MongoTypeRegistry system, leveraging StandardSchemaV1 compliance.

## Quick Start

```typescript
import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { MongoTypeRegistry } from 'schema-mongo';
import { zodSchema } from 'schema-mongo/adapters/zod';

// Define custom ObjectId type with clean syntax
const zodObjectId = z.custom<ObjectId | string>(value => ObjectId.isValid(value));

// Create type-safe MongoTypeRegistry
const mongoTypes = new MongoTypeRegistry()
  .register('objectId', {
    schema: zodObjectId,
    bsonType: 'objectId'
  });

// Create Zod schema
const UserSchema = z.object({
  _id: zodObjectId,
  name: z.string(),
  email: z.string(),
  createdAt: z.date(),
  isActive: z.boolean()
});

// Convert to MongoDB schema
const mongoSchema = zodSchema(UserSchema, { mongoTypes }).toMongoSchema();

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

## MongoTypeRegistry System

The modern MongoTypeRegistry provides type-safe, StandardSchemaV1-compliant custom type handling.

### ObjectId Support

```typescript
import { ObjectId } from 'mongodb';
import { MongoTypeRegistry } from 'schema-mongo';

// Clean, modern ObjectId validation
const zodObjectId = z.custom<ObjectId | string>(value => ObjectId.isValid(value));

// Type-safe registry
const mongoTypes = new MongoTypeRegistry()
  .register('objectId', {
    schema: zodObjectId,
    bsonType: 'objectId'
  });

const schema = z.object({
  _id: zodObjectId,
  parentId: zodObjectId.optional(),
  tags: z.array(z.object({
    tagId: zodObjectId,
    name: z.string()
  }))
});

const mongoSchema = zodSchema(schema, { mongoTypes }).toMongoSchema();

// Results in proper MongoDB ObjectId validation:
// _id: { bsonType: 'objectId' }
// parentId: { bsonType: 'objectId' }
// tags.items.properties.tagId: { bsonType: 'objectId' }
```

### Multiple Custom Types

```typescript
// Define custom validators with clean syntax
const zodObjectId = z.custom<ObjectId | string>(value => ObjectId.isValid(value));
const zodDecimal = z.custom<string>(value => /^\d+\.\d+$/.test(value));
const zodBinary = z.custom<Uint8Array>(value => value instanceof Uint8Array);

// Type-safe registry with method chaining
const mongoTypes = new MongoTypeRegistry()
  .register('objectId', {
    schema: zodObjectId,
    bsonType: 'objectId'
  })
  .register('decimal', {
    schema: zodDecimal,
    bsonType: 'decimal'
  })
  .register('binData', {
    schema: zodBinary,
    bsonType: 'binData'
  });

const ProductSchema = z.object({
  _id: zodObjectId,
  price: zodDecimal,
  thumbnail: zodBinary,
  createdAt: z.date()
});

const mongoSchema = zodSchema(ProductSchema, { mongoTypes }).toMongoSchema();

// Results in:
// _id: { bsonType: 'objectId' }
// price: { bsonType: 'decimal' }
// thumbnail: { bsonType: 'binData' }
// createdAt: { bsonType: 'date' }
```

### Supported MongoDB Types

The MongoTypeRegistry supports any valid MongoDB BSON type:

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
const jsonSchema = zodSchema(UserSchema, { mongoTypes }).toJsonSchema();

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
const mongoSchema = zodSchema(UserSchema, { mongoTypes }).toMongoSchema();

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
  mongoTypes?: MongoTypeRegistry | Record<string, string>; // Modern + Legacy support
}
```

The `mongoTypes` option accepts a MongoTypeRegistry for type-safe configuration:

```typescript
const mongoTypes = new MongoTypeRegistry()
  .register('objectId', {
    schema: zodObjectId,
    bsonType: 'objectId'
  })
  .register('decimal', {
    schema: zodDecimal, 
    bsonType: 'decimal'
  });

const options: ZodToMongoOptions = { mongoTypes };
```

### Registry Benefits

The MongoTypeRegistry approach provides:

✅ **Type Safety**: Full TypeScript inference with StandardSchemaV1 compliance  
✅ **Clean Syntax**: Arrow functions work perfectly - no function naming required  
✅ **Object Identity**: Uses `===` comparison instead of fragile function name matching  
✅ **Method Chaining**: Fluent API with `.register().register()` pattern  
✅ **Standards Compliant**: Built on StandardSchemaV1 for future compatibility  

```typescript
// ✅ Modern approach - Clean and type-safe
const zodObjectId = z.custom<ObjectId | string>(value => ObjectId.isValid(value));
const mongoTypes = new MongoTypeRegistry()
  .register('objectId', { schema: zodObjectId, bsonType: 'objectId' });
```

## Complete Example

### User Management with Full Workflow

```typescript
import { z } from 'zod';
import { MongoClient, ObjectId } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoTypeRegistry } from 'schema-mongo';
import { zodSchema } from 'schema-mongo/adapters/zod';

async function userManagementExample() {
  // 1. Define custom types
  const zodObjectId = z.custom<ObjectId | string>(value => ObjectId.isValid(value));
  
  const mongoTypes = new MongoTypeRegistry()
    .register('objectId', {
      schema: zodObjectId,
      bsonType: 'objectId'
    });

  // 2. Create comprehensive user schema
  const UserSchema = z.object({
    _id: zodObjectId,
    email: z.string(),
    profile: z.object({
      firstName: z.string(),
      lastName: z.string(),
      age: z.number().int().optional(),
      avatarId: zodObjectId.optional()
    }),
    roles: z.array(z.enum(['admin', 'user', 'moderator'])),
    createdAt: z.date(),
    lastLogin: z.date().optional(),
    teamIds: z.array(zodObjectId).optional()
  });

  // 3. Convert to MongoDB schema
  const mongoSchema = zodSchema(UserSchema, { mongoTypes }).toMongoSchema();

  // 4. Setup MongoDB with validation
  const mongod = await MongoMemoryServer.create();
  const client = new MongoClient(mongod.getUri());
  await client.connect();
  
  const db = client.db('userdb');
  await db.createCollection('users', {
    validator: { $jsonSchema: mongoSchema },
    validationAction: 'error',
    validationLevel: 'strict'
  });
  
  const users = db.collection('users');

  // 5. Insert valid data
  const validUser = {
    _id: new ObjectId(),
    email: 'john@example.com',
    profile: {
      firstName: 'John',
      lastName: 'Doe',
      age: 30,
      avatarId: new ObjectId()
    },
    roles: ['user'],
    createdAt: new Date(),
    lastLogin: new Date(),
    teamIds: [new ObjectId(), new ObjectId()]
  };

  await users.insertOne(validUser); // ✅ Success
  
  // 6. Test validation
  try {
    await users.insertOne({
      _id: 'invalid-objectid', // Invalid format
      email: 'test@example.com'
    } as any);
  } catch (error) {
    console.log('✅ Validation correctly rejected invalid document');
  }
  
  await client.close();
  await mongod.stop();
}
```

### E-commerce Product Schema

```typescript
// Define custom types
const zodObjectId = z.custom<ObjectId | string>(value => ObjectId.isValid(value));
const zodDecimal = z.custom<string>(value => /^\d+\.\d+$/.test(value));

const mongoTypes = new MongoTypeRegistry()
  .register('objectId', {
    schema: zodObjectId,
    bsonType: 'objectId'
  })
  .register('decimal', {
    schema: zodDecimal,
    bsonType: 'decimal'
  });

const ProductSchema = z.object({
  _id: zodObjectId,
  categoryId: zodObjectId,
  name: z.string(),
  price: zodDecimal,
  inventory: z.object({
    quantity: z.number().int(),
    reservations: z.array(z.object({
      orderId: zodObjectId,
      quantity: z.number().int(),
      expiresAt: z.date()
    }))
  }),
  createdAt: z.date(),
  updatedAt: z.date()
});

const mongoSchema = zodSchema(ProductSchema, { mongoTypes }).toMongoSchema();
```

## Best Practices

### 1. Reuse MongoTypeRegistry

```typescript
// Create once, use everywhere
const mongoTypes = new MongoTypeRegistry()
  .register('objectId', {
    schema: z.custom<ObjectId | string>(value => ObjectId.isValid(value)),
    bsonType: 'objectId'
  })
  .register('decimal', {
    schema: z.custom<string>(value => /^\d+\.\d+$/.test(value)),
    bsonType: 'decimal'
  });

// Use across schemas
const userSchema = zodSchema(UserSchema, { mongoTypes: mongoTypes });
const productSchema = zodSchema(ProductSchema, { mongoTypes: mongoTypes });
```

### 2. Test with Real MongoDB

```typescript
import { MongoMemoryServer } from 'mongodb-memory-server';

async function testSchema(schema: z.ZodSchema, testData: any) {
  const mongoSchema = zodSchema(schema, { mongoTypes }).toMongoSchema();
  
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

### 3. Keep Schemas Simple

```typescript
// ✅ Good - Clean, focused schema
const UserSchema = z.object({
  _id: zodObjectId,
  name: z.string(),
  email: z.string(),
  createdAt: z.date(),
  isActive: z.boolean()
});

// ❌ Avoid - Complex constraints that get stripped anyway
const UserSchema = z.object({
  email: z.string().email().min(5).max(100),
  name: z.string().min(1).max(50),
  age: z.number().int().min(0).max(120)
});
```

## Limitations

### Type Conversion Focus

The Zod adapter focuses on **type conversion**, not validation constraints:

```typescript
// ✅ Type conversion - Supported
z.string()           // → { bsonType: "string" }
z.number().int()     // → { bsonType: "int" }
z.array(z.string())  // → { bsonType: "array", items: { bsonType: "string" } }

// ❌ Validation constraints - Not supported in MongoDB schema
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
const mongoSchema = zodSchema(UserSchema, { mongoTypes }).toMongoSchema();

await db.createCollection('users', {
  validator: { $jsonSchema: mongoSchema }
});

// 3. Insert validated data
await db.collection('users').insertOne(validatedData);
```

## Troubleshooting

### Custom Type Not Detected

**Problem**: Custom type not being converted to MongoDB type

**Solution**: Ensure you're using MongoTypeRegistry correctly:

```typescript
// ✅ Correct
const zodObjectId = z.custom<ObjectId | string>(value => ObjectId.isValid(value));

const mongoTypes = new MongoTypeRegistry()
  .register('objectId', {
    schema: zodObjectId,  // Same instance used in schema
    bsonType: 'objectId'
  });

const schema = z.object({
  _id: zodObjectId  // Same instance as registered
});

const mongoSchema = zodSchema(schema, { mongoTypes }).toMongoSchema();
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
   const mongoSchema = zodSchema(schema, { mongoTypes }).toMongoSchema();
   console.log(JSON.stringify(mongoSchema, null, 2));
   ```

3. **Test step by step**: Verify each conversion step:
   ```typescript
   const jsonSchema = zodSchema(schema, { mongoTypes }).toJsonSchema();
   console.log('JSON Schema:', jsonSchema);
   
   const mongoSchema = zodSchema(schema, { mongoTypes }).toMongoSchema();
   console.log('MongoDB Schema:', mongoSchema);
   ```

The modern MongoTypeRegistry approach provides a clean, type-safe way to convert Zod schemas to MongoDB validation schemas while maintaining excellent developer experience and StandardSchemaV1 compliance.