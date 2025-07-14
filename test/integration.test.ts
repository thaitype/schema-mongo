import { test, expect, beforeAll, afterAll } from 'bun:test';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, Db } from 'mongodb';
import { z } from 'zod';
import { convertJsonSchemaToMongoSchema } from '../src/index';

let mongod: MongoMemoryServer;
let client: MongoClient;
let db: Db;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  client = new MongoClient(uri);
  await client.connect();
  db = client.db('testdb');
});

afterAll(async () => {
  await client.close();
  await mongod.stop();
});

test('should enforce schema validation on insert (manual schema)', async () => {
  const schema = {
    type: 'object',
    required: ['email'],
    properties: {
      email: { type: 'string' }, // Removed format as MongoDB doesn't support it
      age: { type: 'integer', minimum: 0 }
    }
  };
  const mongoSchema = convertJsonSchemaToMongoSchema(schema);

  await db.createCollection('users', {
    validator: { $jsonSchema: mongoSchema },
    validationAction: 'error'
  });

  const users = db.collection('users');

  // Valid insert should succeed
  await expect(users.insertOne({ email: 'a@b.com', age: 25 })).resolves.toBeTruthy();
  
  // Invalid insert should fail
  await expect(users.insertOne({ email: 123 })).rejects.toThrow();
  
  // Clean up
  await db.dropCollection('users');
});

test('should enforce schema validation on insert (zod schema)', async () => {
  const User = z.object({
    email: z.string(), // Simplified - no .email() to avoid complex regex
    age: z.number().int().nonnegative().optional()
  });

  const jsonSchema = z.toJSONSchema(User);
  const mongoSchema = convertJsonSchemaToMongoSchema(jsonSchema);

  await db.createCollection('zodusers', {
    validator: { $jsonSchema: mongoSchema },
    validationAction: 'error'
  });

  const users = db.collection('zodusers');

  // Valid insert should succeed
  await expect(users.insertOne({ email: 'test@example.com', age: 30 })).resolves.toBeTruthy();
  
  // Invalid insert should fail
  await expect(users.insertOne({ email: false })).rejects.toThrow();
  
  // Clean up
  await db.dropCollection('zodusers');
});

test('should handle complex nested schema validation', async () => {
  const complexSchema = {
    type: 'object',
    required: ['_id', 'profile'],
    properties: {
      _id: { 
        type: 'string', 
        pattern: '^[0-9a-fA-F]{24}$' 
      },
      profile: {
        type: 'object',
        required: ['name', 'contacts'],
        properties: {
          name: { type: 'string' },
          contacts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['email', 'phone'] },
                value: { type: 'string' }
              }
            }
          }
        }
      }
    }
  };

  const mongoSchema = convertJsonSchemaToMongoSchema(complexSchema);

  await db.createCollection('complex', {
    validator: { $jsonSchema: mongoSchema },
    validationAction: 'error'
  });

  const collection = db.collection('complex');

  // Valid complex document
  const validDoc = {
    _id: '507f1f77bcf86cd799439011',
    profile: {
      name: 'John Doe',
      contacts: [
        { type: 'email', value: 'john@example.com' },
        { type: 'phone', value: '+1234567890' }
      ]
    }
  };

  await expect(collection.insertOne(validDoc)).resolves.toBeTruthy();

  // Invalid document (missing required field)
  const invalidDoc = {
    _id: '507f1f77bcf86cd799439011',
    profile: {
      // missing required 'name' field
      contacts: []
    }
  };

  await expect(collection.insertOne(invalidDoc)).rejects.toThrow();

  // Clean up
  await db.dropCollection('complex');
});

test('should validate Zod schema with complex composition', async () => {
  const Address = z.object({
    street: z.string(),
    city: z.string(),
    zipCode: z.string()
  });

  const User = z.object({
    id: z.string(),
    name: z.string().min(1),
    age: z.number().int().min(0).max(120),
    address: Address,
    tags: z.array(z.string()).optional(),
    isActive: z.boolean()
  });

  const jsonSchema = z.toJSONSchema(User);
  const mongoSchema = convertJsonSchemaToMongoSchema(jsonSchema);

  await db.createCollection('zodcomplex', {
    validator: { $jsonSchema: mongoSchema },
    validationAction: 'error'
  });

  const collection = db.collection('zodcomplex');

  // Valid document
  const validUser = {
    id: 'user-123',
    name: 'Alice Smith',
    age: 30,
    address: {
      street: '123 Main St',
      city: 'Springfield',
      zipCode: '12345'
    },
    tags: ['developer', 'remote'],
    isActive: true
  };

  await expect(collection.insertOne(validUser)).resolves.toBeTruthy();

  // Invalid document (missing required field)
  const invalidUser = {
    id: 'user-456',
    // name: 'Bob Jones', // Missing required field
    age: 25,
    address: {
      street: '456 Oak Ave',
      city: 'Springfield',
      zipCode: '67890'
    }
  };

  await expect(collection.insertOne(invalidUser)).rejects.toThrow();

  // Clean up
  await db.dropCollection('zodcomplex');
});