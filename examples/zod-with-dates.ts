import { z } from 'zod';
import { zodToCompatibleJsonSchema } from '../src/adapters/zod';
import { convertJsonSchemaToMongoSchema } from '../src/index';
import { zodSchema } from '../src/adapters/zod';

console.log('=== Zod Date Support Example ===');

// Example 1: Simple date field
const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.date(),        // Will become MongoDB date type
  lastLogin: z.date().optional()
});

console.log('1. Simple date schema (using fluent API):');
// NEW: One-liner conversion to MongoDB schema
const userMongoSchema = zodSchema(UserSchema).toMongoSchema();

console.log('MongoDB Schema:');
console.log(JSON.stringify(userMongoSchema, null, 2));

// For educational purposes - showing the intermediate JSON schema
console.log('\nJSON Schema (with metadata) - for reference:');
const userJsonSchema = zodSchema(UserSchema).toJsonSchema();
console.log(JSON.stringify(userJsonSchema, null, 2));

// Example 2: Complex nested schema with dates
console.log('\n=== Complex Nested Example ===');

const EventSchema = z.object({
  _id: z.string(),
  title: z.string(),
  schedule: z.object({
    startDate: z.date(),
    endDate: z.date(),
    timezone: z.string()
  }),
  attendees: z.array(z.object({
    userId: z.string(),
    joinedAt: z.date(),
    role: z.literal('organizer').or(z.literal('participant'))
  })),
  createdAt: z.date(),
  updatedAt: z.date().optional()
});

// Using fluent API for cleaner conversion
const eventMongoSchema = zodSchema(EventSchema).toMongoSchema();

console.log('Complex nested schema with dates (using fluent API):');
console.log(JSON.stringify(eventMongoSchema, null, 2));

// Example 3: Date in union types
console.log('\n=== Union with Dates Example ===');

const LogEntrySchema = z.union([
  z.object({
    type: z.literal('user_action'),
    userId: z.string(),
    action: z.string(),
    timestamp: z.date()
  }),
  z.object({
    type: z.literal('system_event'),
    service: z.string(),
    event: z.string(),
    occurredAt: z.date()
  })
]);

// Fluent API works perfectly with complex union types
const logMongoSchema = zodSchema(LogEntrySchema).toMongoSchema();

console.log('Union with dates (using fluent API):');
console.log(JSON.stringify(logMongoSchema, null, 2));

// Example 4: ObjectId + Date Custom Types (NEW)
console.log('\n=== NEW: ObjectId + Date Custom Types Example ===');

// Define ObjectId validation function
function zodObjectId(value: any): boolean {
  return typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);
}

// Define custom strict date validator
function zodStrictDate(value: any): boolean {
  return value instanceof Date && !isNaN(value.getTime());
}

const UserProfileSchema = z.object({
  _id: z.custom<string>(zodObjectId),           // ObjectId
  userId: z.custom<string>(zodObjectId),        // Another ObjectId
  createdAt: z.date(),                          // Built-in date
  lastModified: z.custom<Date>(zodStrictDate),  // Custom date validation
  preferences: z.object({
    accountCreated: z.date(),
    lastLoginAt: z.date().optional()
  }),
  teamIds: z.array(z.custom<string>(zodObjectId)).optional() // Array of ObjectIds
});

// Convert with both ObjectId and custom date types
const userProfileMongoSchema = zodSchema(UserProfileSchema, {
  customTypes: { 
    zodObjectId: 'objectId',
    zodStrictDate: 'date'
  }
}).toMongoSchema();

console.log('Schema with ObjectId and mixed Date types:');
console.log(JSON.stringify(userProfileMongoSchema, null, 2));

// Example 5: Usage with MongoDB (commented out - requires MongoDB connection)
/*
import { MongoClient } from 'mongodb';

async function setupWithMongoDB() {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  
  const db = client.db('example');
  
  // Create collection with date validation - NOW EVEN SIMPLER!
  await db.createCollection('events', {
    validator: { $jsonSchema: zodSchema(EventSchema).toMongoSchema() },
    validationAction: 'error'
  });
  
  const events = db.collection('events');
  
  // Insert document with actual Date objects
  await events.insertOne({
    _id: 'event-123',
    title: 'Team Meeting',
    schedule: {
      startDate: new Date('2025-01-15T10:00:00Z'),  // BSON Date
      endDate: new Date('2025-01-15T11:00:00Z'),    // BSON Date
      timezone: 'UTC'
    },
    attendees: [{
      userId: 'user-123',
      joinedAt: new Date(),                         // BSON Date
      role: 'organizer'
    }],
    createdAt: new Date(),                          // BSON Date
    updatedAt: new Date()                           // BSON Date
  });
  
  console.log('✅ Document with dates inserted successfully');
  
  await client.close();
}
*/