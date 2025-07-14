# schema-mongo

[![CI](https://github.com/thaitype/schema-mongo/actions/workflows/main.yml/badge.svg)](https://github.com/thaitype/schema-mongo/actions/workflows/main.yml) [![codecov](https://codecov.io/gh/thaitype/schema-mongo/graph/badge.svg?token=B7MCHM57BH)](https://codecov.io/gh/thaitype/schema-mongo) [![NPM Version](https://img.shields.io/npm/v/schema-mongo) ](https://www.npmjs.com/package/schema-mongo)[![npm downloads](https://img.shields.io/npm/dt/schema-mongo)](https://www.npmjs.com/schema-mongo) 

> Convert validation schemas to MongoDB format with custom type support

A framework-agnostic library for converting validation schemas to MongoDB-compatible `$jsonSchema` format. Features a clean adapter architecture with robust custom type support for MongoDB-specific types like ObjectId and Date.

## Features

- **🏗️ Framework-Agnostic Core**: JSON Schema → MongoDB conversion engine
- **🔌 Adapter Architecture**: Currently supports Zod (v4) (extensible to other validators)
- **🎯 Custom Types**: ObjectId, Date, Decimal, Binary, and extensible type system
- **✨ Fluent API**: Clean, intuitive interface for common workflows
- **🛡️ Type-Safe**: Full TypeScript support with comprehensive type definitions

## Quick Start

```typescript
import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { MongoTypeRegistry } from 'schema-mongo';
import { zodSchema } from 'schema-mongo/adapters/zod';

// Define ObjectId validator with clean syntax
const zodObjectId = z.custom<ObjectId | string>(value => ObjectId.isValid(value));

// Create type-safe MongoTypeRegistry
const mongoTypes = new MongoTypeRegistry()
  .register('objectId', {
    schema: zodObjectId,
    bsonType: 'objectId'
  });

// Create Zod schema with custom types
const UserSchema = z.object({
  _id: zodObjectId,
  name: z.string(),
  email: z.string(),
  createdAt: z.date(),
  isActive: z.boolean()
});

// Convert to MongoDB schema (one-liner!)
const mongoSchema = zodSchema(UserSchema, { mongoTypes }).toMongoSchema();

// Use with MongoDB collection validation
await db.createCollection('users', {
  validator: { $jsonSchema: mongoSchema }
});
```

## Architecture

The library uses a three-layer architecture for maximum flexibility:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Validators    │───▶│     Adapters     │───▶│   Core Engine   │
│  (Zod, etc.)    │    │  (zodSchema)     │    │ (JSON→MongoDB)  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Core Function (Framework-Agnostic)
```typescript
import { convertJsonSchemaToMongoSchema } from 'schema-mongo';

const mongoSchema = convertJsonSchemaToMongoSchema(jsonSchema);
```

### Zod Adapter (Current Implementation)
```typescript
import { zodSchema } from 'schema-mongo/adapters/zod';

const mongoSchema = zodSchema(zodSchema).toMongoSchema();
```

## Supported Validators

- ✅ **Zod**: Full support via `zodSchema()` adapter with custom types
- 🔄 **Others**: Extensible architecture ready for additional validators

## Type Conversion

| Zod Type | JSON Schema | MongoDB Schema |
|----------|-------------|----------------|
| `z.string()` | `{ type: "string" }` | `{ bsonType: "string" }` |
| `z.number()` | `{ type: "number" }` | `{ bsonType: "double" }` |
| `z.number().int()` | `{ type: "integer" }` | `{ bsonType: "int" }` |
| `z.boolean()` | `{ type: "boolean" }` | `{ bsonType: "bool" }` |
| `z.date()` | `{ type: "string", __mongoType: "date" }` | `{ bsonType: "date" }` |
| `z.array(T)` | `{ type: "array", items: T }` | `{ bsonType: "array", items: T }` |
| `z.object({})` | `{ type: "object", properties: {} }` | `{ bsonType: "object", properties: {} }` |

## Custom Types

The library features a type-safe MongoTypeRegistry system leveraging StandardSchemaV1 for MongoDB-specific types:

### ObjectId Support
```typescript
import { ObjectId } from 'mongodb';
import { MongoTypeRegistry } from 'schema-mongo';

// Clean, modern ObjectId validation
const zodObjectId = z.custom<ObjectId | string>(value => ObjectId.isValid(value));

const mongoTypes = new MongoTypeRegistry()
  .register('objectId', {
    schema: zodObjectId,
    bsonType: 'objectId'
  });

const schema = z.object({
  _id: zodObjectId,
  userId: zodObjectId
});

const mongoSchema = zodSchema(schema, { mongoTypes }).toMongoSchema();
// Results in: { _id: { bsonType: 'objectId' }, userId: { bsonType: 'objectId' } }
```

### Multiple Custom Types
```typescript
// Define custom validators
const zodObjectId = z.custom<ObjectId | string>(value => ObjectId.isValid(value));
const zodDecimal = z.custom<string>(value => /^\d+\.\d+$/.test(value));

// Type-safe registry with method chaining
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
  price: zodDecimal,
  createdAt: z.date()
});

const mongoSchema = zodSchema(ProductSchema, { mongoTypes }).toMongoSchema();
```

### Supported MongoDB Types
- `objectId` - MongoDB ObjectId
- `date` - MongoDB Date
- `decimal` - MongoDB Decimal128
- `binData` - MongoDB Binary Data
- Any valid MongoDB BSON type

## API Reference

### `zodSchema(schema, options?)`

Converts a Zod schema to MongoDB format using the fluent API.

**Parameters:**
- `schema: z.ZodTypeAny` - The Zod schema to convert
- `options?: ZodToMongoOptions` - Configuration options

**Returns:** `ZodSchemaResult` with fluent methods

#### Options
```typescript
interface ZodToMongoOptions {
  mongoTypes?: MongoTypeRegistry | Record<string, string>; // New: MongoTypeRegistry support
}
```

#### Fluent Methods
```typescript
interface ZodSchemaResult {
  toJsonSchema(): ExtendedJsonSchema;  // Get JSON Schema with MongoDB metadata
  toMongoSchema(): Record<string, any>; // Get MongoDB-compatible schema
}
```

### `convertJsonSchemaToMongoSchema(schema)`

Core conversion function (framework-agnostic).

**Parameters:**
- `schema: Record<string, any>` - JSON Schema to convert

**Returns:** `Record<string, any>` - MongoDB-compatible schema

## Examples

### Basic Usage
```typescript
const UserSchema = z.object({
  name: z.string(),
  age: z.number().int(),
  isActive: z.boolean()
});

const mongoSchema = zodSchema(UserSchema).toMongoSchema();
```

### With MongoDB Validation
```typescript
import { MongoClient } from 'mongodb';

const client = new MongoClient('mongodb://localhost:27017');
await client.connect();

const db = client.db('myapp');

// Create collection with validation
await db.createCollection('users', {
  validator: { $jsonSchema: mongoSchema },
  validationAction: 'error'
});

// Now inserts will be validated against the schema
const users = db.collection('users');
await users.insertOne({
  _id: new ObjectId(),
  name: 'John Doe',
  age: 30,
  isActive: true
});
```

### Complex Nested Schema
```typescript
const AddressSchema = z.object({
  street: z.string(),
  city: z.string(),
  zipCode: z.string()
});

// Define custom types once
const zodObjectId = z.custom<ObjectId | string>(value => ObjectId.isValid(value));
const mongoTypes = new MongoTypeRegistry()
  .register('objectId', { schema: zodObjectId, bsonType: 'objectId' });

const UserSchema = z.object({
  _id: zodObjectId,
  profile: z.object({
    name: z.string(),
    address: AddressSchema
  }),
  contacts: z.array(z.object({
    type: z.enum(['email', 'phone']),
    value: z.string()
  })),
  createdAt: z.date()
});

const mongoSchema = zodSchema(UserSchema, { mongoTypes }).toMongoSchema();
```

## Limitations

### Validation vs. Conversion
This library focuses on **type conversion**, not validation constraints:

✅ **Supported**: Type mapping (`z.string()` → `bsonType: "string"`)  
❌ **Not Supported**: Validation constraints (`z.string().min(5)`, `z.number().max(100)`)

For validation constraints, use Zod directly in your application layer:

```typescript
// Use Zod for application validation
const result = UserSchema.parse(userData);

// Use schema-mongo for MongoDB schema setup
const mongoSchema = zodSchema(UserSchema).toMongoSchema();
```

### MongoTypeRegistry Benefits
The modern MongoTypeRegistry approach provides:

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

## Contributing

The library is designed for extensibility. To add support for new validators:

1. Create an adapter in `src/adapters/`
2. Implement the conversion logic to JSON Schema
3. Use the core `convertJsonSchemaToMongoSchema()` function
4. Add fluent API methods for consistency


## License

MIT License © 2025
Created by [@thaitype](https://github.com/thaitype)

## Alternatives
- https://github.com/marcesengel/zod-to-mongodb-schema

## Related

- [Zod](https://zod.dev) - TypeScript validation library
- [MongoDB JSON Schema](https://docs.mongodb.com/manual/reference/operator/query/jsonSchema/) - MongoDB validation documentation
- [JSON Schema](https://json-schema.org) - JSON Schema specification