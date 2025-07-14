import { z } from 'zod';
import { zodToCompatibleJsonSchema } from '../src/adapters/zod';
import { convertJsonSchemaToMongoSchema } from '../src/index';

console.log('=== Zod Date Support Example ===');

// Example 1: Simple date field
const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.date(),        // Will become MongoDB date type
  lastLogin: z.date().optional()
});

console.log('1. Simple date schema:');
const userJsonSchema = zodToCompatibleJsonSchema(UserSchema);
const userMongoSchema = convertJsonSchemaToMongoSchema(userJsonSchema);

console.log('JSON Schema (with metadata):');
console.log(JSON.stringify(userJsonSchema, null, 2));

console.log('\nMongoDB Schema:');
console.log(JSON.stringify(userMongoSchema, null, 2));

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

const eventJsonSchema = zodToCompatibleJsonSchema(EventSchema);
const eventMongoSchema = convertJsonSchemaToMongoSchema(eventJsonSchema);

console.log('Complex nested schema with dates:');
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

const logJsonSchema = zodToCompatibleJsonSchema(LogEntrySchema);
const logMongoSchema = convertJsonSchemaToMongoSchema(logJsonSchema);

console.log('Union with dates:');
console.log(JSON.stringify(logMongoSchema, null, 2));

// Example 4: Usage with MongoDB (commented out - requires MongoDB connection)
/*
import { MongoClient } from 'mongodb';

async function setupWithMongoDB() {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  
  const db = client.db('example');
  
  // Create collection with date validation
  await db.createCollection('events', {
    validator: { $jsonSchema: eventMongoSchema },
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