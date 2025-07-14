import { test, expect, beforeAll, afterAll } from 'bun:test';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, Db, ObjectId } from 'mongodb';
import { z } from 'zod';
import { convertJsonSchemaToMongoSchema } from '../src/index';
import { zodToCompatibleJsonSchema } from '../src/adapters/zod';

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
        __mongoType: 'objectId' 
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
    _id: new ObjectId('507f1f77bcf86cd799439011'),
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
    _id: new ObjectId('507f1f77bcf86cd799439012'),
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

test('full pipeline: Zod dates → MongoDB validation with actual Date objects', async () => {
  // 1. Define ObjectId validator for proper MongoDB ObjectId type
  function zodObjectId(value: any): boolean {
    return typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);
  }

  // 2. Complex Zod schema with various date scenarios
  const EventSchema = z.object({
    _id: z.custom<string>(zodObjectId),
    title: z.string(),
    startDate: z.date(),           // Required date
    endDate: z.date().optional(),  // Optional date
    schedule: z.object({
      createdAt: z.date(),
      timezone: z.string(),
      reminders: z.array(z.object({
        triggerAt: z.date(),
        message: z.string(),
        sent: z.boolean().optional()
      })).optional()
    }),
    metadata: z.object({
      lastUpdated: z.date(),
      version: z.number().int()
    }).optional()
  });

  // 3. Full conversion pipeline with custom types
  const jsonSchema = zodToCompatibleJsonSchema(EventSchema, {
    customTypes: { zodObjectId: 'objectId' }
  });
  const mongoSchema = convertJsonSchemaToMongoSchema(jsonSchema);

  // Verify the schema has proper date and ObjectId types
  expect(mongoSchema.properties._id.bsonType).toBe('objectId');
  expect(mongoSchema.properties.startDate.bsonType).toBe('date');
  expect(mongoSchema.properties.endDate.bsonType).toBe('date');
  expect(mongoSchema.properties.schedule.properties.createdAt.bsonType).toBe('date');

  // 4. MongoDB collection with validation
  await db.createCollection('events', {
    validator: { $jsonSchema: mongoSchema },
    validationAction: 'error',
    validationLevel: 'strict'
  });

  const collection = db.collection('events');

  // 5. Test with actual BSON Date objects - should succeed
  const validEvent = {
    _id: new ObjectId(),                          // ObjectId matching schema
    title: 'Test Event',
    startDate: new Date('2025-01-15T10:00:00Z'),  // BSON Date
    endDate: new Date('2025-01-15T12:00:00Z'),    // BSON Date
    schedule: {
      createdAt: new Date(),                       // BSON Date
      timezone: 'UTC',
      reminders: [{
        triggerAt: new Date('2025-01-15T09:00:00Z'), // BSON Date
        message: 'Event starts in 1 hour',
        sent: false
      }]
    },
    metadata: {
      lastUpdated: new Date(),                     // BSON Date
      version: 1
    }
  };

  await expect(collection.insertOne(validEvent)).resolves.toBeTruthy();

  // 6. Test with minimal required fields (optional dates omitted) - should succeed
  const minimalEvent = {
    _id: new ObjectId(),                          // ObjectId matching schema
    title: 'Minimal Event',
    startDate: new Date('2025-02-01T14:00:00Z'),
    schedule: {
      createdAt: new Date(),
      timezone: 'EST'
    }
  };

  await expect(collection.insertOne(minimalEvent)).resolves.toBeTruthy();

  // 7. Test validation failures - string instead of Date should fail
  const invalidEventWithString = {
    _id: new ObjectId(),                          // ObjectId matching schema
    title: 'Invalid Event',
    startDate: '2025-01-15T10:00:00Z',  // String instead of Date
    schedule: {
      createdAt: new Date(),
      timezone: 'UTC'
    }
  };

  await expect(collection.insertOne(invalidEventWithString)).rejects.toThrow();

  // 8. Test missing required date field should fail
  const invalidEventMissingDate = {
    _id: new ObjectId(),                          // ObjectId matching schema
    title: 'Missing Date Event',
    // startDate missing (required)
    schedule: {
      createdAt: new Date(),
      timezone: 'UTC'
    }
  };

  await expect(collection.insertOne(invalidEventMissingDate)).rejects.toThrow();

  // 9. Test nested date validation - invalid nested date should fail
  const invalidNestedDate = {
    _id: new ObjectId(),                          // ObjectId matching schema
    title: 'Invalid Nested Date',
    startDate: new Date(),
    schedule: {
      createdAt: 'not-a-date',  // Invalid: string instead of Date
      timezone: 'UTC'
    }
  };

  await expect(collection.insertOne(invalidNestedDate)).rejects.toThrow();

  // 10. Test array with invalid date should fail
  const invalidArrayDate = {
    _id: new ObjectId(),                          // ObjectId matching schema
    title: 'Invalid Array Date',
    startDate: new Date(),
    schedule: {
      createdAt: new Date(),
      timezone: 'UTC',
      reminders: [{
        triggerAt: 'invalid-date',  // Invalid: string instead of Date
        message: 'Test reminder'
      }]
    }
  };

  await expect(collection.insertOne(invalidArrayDate)).rejects.toThrow();

  // Clean up
  await db.dropCollection('events');
});

test('full pipeline: ObjectId + Date custom types → MongoDB validation', async () => {
  // 1. Define custom validators for MongoDB types
  function zodObjectId(value: any): boolean {
    return typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);
  }

  function zodStrictDate(value: any): boolean {
    return value instanceof Date && !isNaN(value.getTime());
  }

  // 2. Create Zod schema with custom types
  const UserSchema = z.object({
    _id: z.custom<string>(zodObjectId),           // ObjectId validation
    parentId: z.custom<string>(zodObjectId).optional(), // Optional ObjectId
    profile: z.object({
      userId: z.custom<string>(zodObjectId),      // Nested ObjectId
      createdAt: z.custom<Date>(zodStrictDate),   // Custom date validation
      updatedAt: z.date(),                        // Built-in date
      preferences: z.object({
        lastLoginAt: z.date().optional(),         // Optional built-in date
        accountCreated: z.custom<Date>(zodStrictDate), // Nested custom date
      })
    }),
    tags: z.array(z.object({
      tagId: z.custom<string>(zodObjectId),       // Array with ObjectId
      assignedAt: z.date()                        // Array with date
    })).optional(),
    metadata: z.object({
      createdBy: z.custom<string>(zodObjectId),
      timestamp: z.date()
    }).optional()
  });

  // 3. Convert using custom types configuration
  const jsonSchema = zodToCompatibleJsonSchema(UserSchema, {
    customTypes: {
      zodObjectId: 'objectId',
      zodStrictDate: 'date'
    }
  });
  
  const mongoSchema = convertJsonSchemaToMongoSchema(jsonSchema);

  // 4. Verify the schema has proper MongoDB types
  expect(mongoSchema.properties._id.bsonType).toBe('objectId');
  expect(mongoSchema.properties.parentId.bsonType).toBe('objectId');
  expect(mongoSchema.properties.profile.properties.userId.bsonType).toBe('objectId');
  expect(mongoSchema.properties.profile.properties.createdAt.bsonType).toBe('date');
  expect(mongoSchema.properties.profile.properties.updatedAt.bsonType).toBe('date');
  expect(mongoSchema.properties.tags.items.properties.tagId.bsonType).toBe('objectId');
  expect(mongoSchema.properties.tags.items.properties.assignedAt.bsonType).toBe('date');

  // 5. Create MongoDB collection with strict validation
  await db.createCollection('objectid_users', {
    validator: { $jsonSchema: mongoSchema },
    validationAction: 'error',
    validationLevel: 'strict'
  });

  const collection = db.collection('objectid_users');

  // Import ObjectId from MongoDB driver for proper BSON ObjectId objects
  const { ObjectId } = require('mongodb');

  // 6. Test with valid MongoDB ObjectIds and Dates - should succeed
  const validUser = {
    _id: new ObjectId(),                         // BSON ObjectId
    parentId: new ObjectId(),                    // BSON ObjectId
    profile: {
      userId: new ObjectId(),                    // BSON ObjectId
      createdAt: new Date('2024-01-01T00:00:00Z'), // BSON Date
      updatedAt: new Date(),                     // BSON Date
      preferences: {
        lastLoginAt: new Date('2024-12-01T10:00:00Z'), // BSON Date
        accountCreated: new Date('2024-01-01T00:00:00Z') // BSON Date
      }
    },
    tags: [{
      tagId: new ObjectId(),                     // BSON ObjectId in array
      assignedAt: new Date()                     // BSON Date in array
    }],
    metadata: {
      createdBy: new ObjectId(),                 // BSON ObjectId
      timestamp: new Date()                      // BSON Date
    }
  };

  await expect(collection.insertOne(validUser)).resolves.toBeTruthy();

  // 7. Test with minimal required fields only - should succeed
  const minimalUser = {
    _id: new ObjectId(),
    profile: {
      userId: new ObjectId(),
      createdAt: new Date(),
      updatedAt: new Date(),
      preferences: {
        accountCreated: new Date()
      }
    }
  };

  await expect(collection.insertOne(minimalUser)).resolves.toBeTruthy();

  // 8. Test validation failures - invalid ObjectId format should fail
  const invalidObjectIdUser = {
    _id: 'invalid-objectid',                    // Invalid: not 24 hex chars
    profile: {
      userId: new ObjectId(),
      createdAt: new Date(),
      updatedAt: new Date(),
      preferences: {
        accountCreated: new Date()
      }
    }
  };

  await expect(collection.insertOne(invalidObjectIdUser as any)).rejects.toThrow(); // Keep as any since this is intentionally invalid

  // 9. Test with string instead of Date should fail
  const invalidDateUser = {
    _id: new ObjectId(),
    profile: {
      userId: new ObjectId(),
      createdAt: '2024-01-01T00:00:00Z',        // Invalid: string instead of Date
      updatedAt: new Date(),
      preferences: {
        accountCreated: new Date()
      }
    }
  };

  await expect(collection.insertOne(invalidDateUser)).rejects.toThrow();

  // 10. Test nested ObjectId validation failure
  const invalidNestedObjectIdUser = {
    _id: new ObjectId(),
    profile: {
      userId: 'invalid-nested-objectid',        // Invalid: not proper ObjectId
      createdAt: new Date(),
      updatedAt: new Date(),
      preferences: {
        accountCreated: new Date()
      }
    }
  };

  await expect(collection.insertOne(invalidNestedObjectIdUser)).rejects.toThrow();

  // 11. Test array validation - invalid ObjectId in array should fail
  const invalidArrayObjectIdUser = {
    _id: new ObjectId(),
    profile: {
      userId: new ObjectId(),
      createdAt: new Date(),
      updatedAt: new Date(),
      preferences: {
        accountCreated: new Date()
      }
    },
    tags: [{
      tagId: 'invalid-array-objectid',          // Invalid: not proper ObjectId
      assignedAt: new Date()
    }]
  };

  await expect(collection.insertOne(invalidArrayObjectIdUser)).rejects.toThrow();

  // 12. Test array validation - invalid Date in array should fail
  const invalidArrayDateUser = {
    _id: new ObjectId(),
    profile: {
      userId: new ObjectId(),
      createdAt: new Date(),
      updatedAt: new Date(),
      preferences: {
        accountCreated: new Date()
      }
    },
    tags: [{
      tagId: new ObjectId(),
      assignedAt: 'invalid-array-date'          // Invalid: string instead of Date
    }]
  };

  await expect(collection.insertOne(invalidArrayDateUser)).rejects.toThrow();

  // 13. Test missing required nested ObjectId field should fail
  const missingNestedObjectIdUser = {
    _id: new ObjectId(),
    profile: {
      // userId missing (required ObjectId)
      createdAt: new Date(),
      updatedAt: new Date(),
      preferences: {
        accountCreated: new Date()
      }
    }
  };

  await expect(collection.insertOne(missingNestedObjectIdUser)).rejects.toThrow();

  // Clean up
  await db.dropCollection('objectid_users');
});