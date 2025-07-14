import { MongoClient, ObjectId } from 'mongodb';
import { z } from 'zod';
import { zodSchema } from '@thaitype/schema-mongo/adapters/zod';

/**
 * Example showing how to use the converted schemas with MongoDB collection validation
 * 
 * Note: This example requires a running MongoDB instance.
 * For testing, you can use mongodb-memory-server as shown in the integration tests.
 */

async function setupMongoValidation() {
  // Connect to MongoDB (adjust connection string as needed)
  const client = new MongoClient('mongodb://root:example@localhost:27017');
  await client.connect();

  const db = client.db('schema-mongo-example');

  // Example 1: User collection with Zod schema
  const UserSchema = z.object({
    _id: z.string(),
    email: z.string(),
    name: z.string(),
    age: z.number().int().optional(),
    createdAt: z.string(),
    isActive: z.boolean().default(true)
  });

  // Using Zod adapter for cleaner code
  const userMongoSchema = zodSchema(UserSchema).toMongoSchema();

  // Create collection with validation
  try {
    await db.createCollection('users', {
      validator: { $jsonSchema: userMongoSchema },
      validationAction: 'error',
      validationLevel: 'strict'
    });

    console.log('✅ Users collection created with validation');
  } catch (error) {
    console.log('Collection may already exist, continuing...');
  }

  const usersCollection = db.collection('users');

  // Test valid document
  try {
    await usersCollection.insertOne({
      _id: new ObjectId(),
      email: 'john@example.com',
      name: 'John Doe',
      age: 30,
      createdAt: new Date().toISOString(),
      isActive: true
    });
    console.log('✅ Valid user document inserted successfully');
  } catch (error) {
    console.error('❌ Error inserting valid user:', (JSON.stringify(error, null, 2)));
  }

  // Test invalid document (missing required field)
  try {
    await usersCollection.insertOne({
      _id: new ObjectId(),
      // missing email and name
      age: 25,
      createdAt: new Date().toISOString()
    });
    console.log('❌ Invalid document was incorrectly accepted');
  } catch (error) {
    console.log('✅ Invalid user document correctly rejected:', (error as Error).message);
  }

  // Close connection
  await client.close();
  console.log('🔌 MongoDB connection closed');
}


setupMongoValidation().catch(console.error);
