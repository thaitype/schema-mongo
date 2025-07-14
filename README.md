# mongo-schema – Design Specification

## 1. Goal

The purpose of the `mongo-schema` package is to provide a **lightweight, dependency-free utility** for converting a standard [JSON Schema (Draft-04+)](https://json-schema.org/) into a MongoDB-compatible **\$jsonSchema** validator.

MongoDB's `$jsonSchema` uses a dialect that differs from pure JSON Schema by introducing the `bsonType` keyword and removing unsupported features. This package aims to handle that conversion cleanly and accurately.

## 2. Design Principles

* **Dependency-Free Core**: No third-party dependencies should be used for the core conversion function. It must rely only on native JavaScript/TypeScript.
* **Framework-Agnostic**: The package should be standalone and not rely on or include `monguard`, Zod, or any other library.
* **Composable and Testable**: Functions should be testable in isolation and suitable for integration in any toolchain.
* **Types First**: Fully typed using TypeScript, for maximum safety and IDE support.

## 3. Package Scope and Structure

This package exposes a single public function:

```ts
function convertJsonSchemaToMongoSchema(schema: Record<string, any>): Record<string, any>
```

### What it does:

* Converts `type` to `bsonType` recursively
* Strips unsupported JSON Schema keywords (e.g., `title`, `description`, `examples`, `$schema`, `default`)
* Recursively transforms nested schemas in `properties`, `items`, `allOf`, `anyOf`, `oneOf`, and `not`
* Preserves validation constraints like `minimum`, `pattern`, `enum`, etc.

### What it does *not* do:

* Infer types from runtime data
* Parse or validate Zod schemas directly (this must be done externally using Zod's `.toJSONSchema()`)

## 4. Example Usage with Zod v4

### Example Zod Schema

```ts
import { z } from 'zod';
import { convertJsonSchemaToMongoSchema } from 'mongo-schema';

const User = z.object({
  _id: z.string().regex(/^[0-9a-fA-F]{24}$/),
  email: z.string().email(),
  age: z.number().int().nonnegative().optional(),
});

const jsonSchema = User.toJSONSchema();
const mongoSchema = convertJsonSchemaToMongoSchema(jsonSchema);

console.log(JSON.stringify(mongoSchema, null, 2));
```

### Expected Output (Simplified)

```json
{
  "bsonType": "object",
  "properties": {
    "_id": { "bsonType": "string", "pattern": "^[0-9a-fA-F]{24}$" },
    "email": { "bsonType": "string", "format": "email" },
    "age": { "bsonType": "int", "minimum": 0 }
  }
}
```

## 5. Unit Test Example

Using `vitest` or `jest`:

```ts
test('converts string type to bsonType', () => {
  const input = {
    type: 'string',
    title: 'User ID'
  };
  const result = convertJsonSchemaToMongoSchema(input);
  expect(result).toEqual({ bsonType: 'string' });
});

test('removes unsupported keys', () => {
  const input = {
    type: 'object',
    title: 'Example',
    description: 'This will be removed',
    properties: { foo: { type: 'number' } }
  };
  const result = convertJsonSchemaToMongoSchema(input);
  expect(result).not.toHaveProperty('title');
  expect(result.properties.foo.bsonType).toBe('double');
});
```

## 6. Integration Test with mongodb-memory-server

### Setup

Install dev dependencies:

```bash
npm install --save-dev mongodb-memory-server mongodb zod
```

### Test

```ts
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import { z } from 'zod';
import { convertJsonSchemaToMongoSchema } from 'mongo-schema';

it('should enforce schema validation on insert (manual schema)', async () => {
  const schema = {
    type: 'object',
    required: ['email'],
    properties: {
      email: { type: 'string', format: 'email' },
      age: { type: 'integer', minimum: 0 }
    }
  };
  const mongoSchema = convertJsonSchemaToMongoSchema(schema);

  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  const client = new MongoClient(uri);
  await client.connect();

  const db = client.db('testdb');
  await db.createCollection('users', {
    validator: { $jsonSchema: mongoSchema },
    validationAction: 'error'
  });

  const users = db.collection('users');

  await expect(users.insertOne({ email: 'a@b.com', age: 25 })).resolves.toBeTruthy();
  await expect(users.insertOne({ email: 123 })).rejects.toThrow();

  await client.close();
  await mongod.stop();
});

it('should enforce schema validation on insert (zod schema)', async () => {
  const User = z.object({
    email: z.string().email(),
    age: z.number().int().nonnegative().optional()
  });

  const jsonSchema = User.toJSONSchema();
  const mongoSchema = convertJsonSchemaToMongoSchema(jsonSchema);

  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  const client = new MongoClient(uri);
  await client.connect();

  const db = client.db('testdb');
  await db.createCollection('zodusers', {
    validator: { $jsonSchema: mongoSchema },
    validationAction: 'error'
  });

  const users = db.collection('zodusers');

  await expect(users.insertOne({ email: 'test@example.com', age: 30 })).resolves.toBeTruthy();
  await expect(users.insertOne({ email: false })).rejects.toThrow();

  await client.close();
  await mongod.stop();
});
```

---

This spec ensures that `mongo-schema` is lightweight, standalone, and fully testable in both unit and integration contexts, while remaining compatible with modern validation workflows using Zod or plain JSON Schema.
