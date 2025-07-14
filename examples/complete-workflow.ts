import { z } from 'zod';
import { MongoClient, ObjectId } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoTypeRegistry } from 'schema-mongo';
import { zodSchema } from 'schema-mongo/adapters/zod';

/**
 * Complete workflow example: Custom types → Schema → MongoDB validation → Data insertion
 * 
 * This example demonstrates the full flow from declaring custom types using the 
 * clean MongoTypeRegistry pattern to successfully inserting validated data into MongoDB.
 */

async function completeWorkflow() {
  console.log('🚀 Complete Workflow: Custom Types → MongoDB Validation');

  // 1. Declare custom types using clean pattern
  console.log('\n1️⃣ Declaring custom ObjectId type...');
  const zodObjectId = z.custom<ObjectId | string>(value => 
    ObjectId.isValid(value as string | ObjectId)
  );
  
  // 2. Create type-safe MongoTypeRegistry
  console.log('2️⃣ Creating MongoTypeRegistry...');
  const mongoTypes = new MongoTypeRegistry()
    .register('objectId', {
      schema: zodObjectId,
      bsonType: 'objectId'
    });

  // 3. Define Zod schema with custom types
  console.log('3️⃣ Defining Zod schema with custom types...');
  const UserSchema = z.object({
    _id: zodObjectId,
    name: z.string().min(2),
    email: z.string().email(),
    age: z.number().int().min(0).max(120),
    createdAt: z.date(),
    isActive: z.boolean().default(true),
    tags: z.array(z.string()).optional()
  });

  // 4. Convert to MongoDB schema
  console.log('4️⃣ Converting to MongoDB schema...');
  const mongoSchema = zodSchema(UserSchema, { mongoTypes }).toMongoSchema();
  console.log('Generated MongoDB schema:', JSON.stringify(mongoSchema, null, 2));

  // 5. Setup MongoDB (using in-memory for demo)
  console.log('\n5️⃣ Setting up MongoDB connection...');
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('demo');

  // 6. Create collection with validation
  console.log('6️⃣ Creating collection with schema validation...');
  await db.createCollection('users', {
    validator: { $jsonSchema: mongoSchema },
    validationAction: 'error',
    validationLevel: 'strict'
  });
  
  const usersCollection = db.collection('users');

  // 7. Insert valid data - should succeed
  console.log('\n7️⃣ Testing data insertion...');
  try {
    const validUser = {
      _id: new ObjectId(),
      name: 'John Doe',
      email: 'john@example.com',
      age: 30,
      createdAt: new Date(),
      isActive: true,
      tags: ['developer', 'typescript']
    };

    const result = await usersCollection.insertOne(validUser);
    console.log('✅ Valid user inserted successfully:', result.insertedId);
  } catch (error) {
    console.error('❌ Failed to insert valid user:', (error as Error).message);
  }

  // 8. Test validation - invalid data should fail
  console.log('\n8️⃣ Testing validation with invalid data...');
  try {
    const invalidUser = {
      _id: 'invalid-objectid-format', // Invalid ObjectId
      name: 'X', // Too short (min 2 chars)
      email: 'invalid-email', // Invalid email format
      age: -5, // Invalid age (negative)
      createdAt: new Date(),
      isActive: true
    };

    await usersCollection.insertOne(invalidUser as any);
    console.log('❌ Invalid user was incorrectly accepted');
  } catch (error) {
    console.log('✅ Invalid user correctly rejected:', (error as Error).message.split('.')[0]);
  }

  // 9. Clean up
  console.log('\n9️⃣ Cleaning up...');
  await client.close();
  await mongod.stop();
  
  console.log('\n🎉 Complete workflow finished successfully!');
  console.log('📋 Summary:');
  console.log('   • Custom ObjectId type declared with clean syntax');
  console.log('   • MongoTypeRegistry configured with type safety');
  console.log('   • Zod schema converted to MongoDB validation schema');
  console.log('   • MongoDB collection created with validation');
  console.log('   • Valid data inserted successfully');
  console.log('   • Invalid data correctly rejected');
}

// Run the complete workflow
completeWorkflow().catch(console.error);