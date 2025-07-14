import { MongoClient } from 'mongodb';
import { z } from 'zod';
import { convertJsonSchemaToMongoSchema } from '@thaitype/schema-mongo';
import { zodSchema } from '@thaitype/schema-mongo/adapters/zod';

/**
 * Example showing how to use the converted schemas with MongoDB collection validation
 * 
 * Note: This example requires a running MongoDB instance.
 * For testing, you can use mongodb-memory-server as shown in the integration tests.
 */

async function setupMongoValidation() {
  // Connect to MongoDB (adjust connection string as needed)
  const client = new MongoClient('mongodb://localhost:27017');
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
      _id: new (require('mongodb')).ObjectId(),
      email: 'john@example.com',
      name: 'John Doe',
      age: 30,
      createdAt: new Date().toISOString(),
      isActive: true
    });
    console.log('✅ Valid user document inserted successfully');
  } catch (error) {
    console.error('❌ Error inserting valid user:', (error as Error).message);
  }

  // Test invalid document (missing required field)
  try {
    await usersCollection.insertOne({
      _id: new (require('mongodb')).ObjectId(),
      // missing email and name
      age: 25,
      createdAt: new Date().toISOString()
    });
    console.log('❌ Invalid document was incorrectly accepted');
  } catch (error) {
    console.log('✅ Invalid user document correctly rejected:', (error as Error).message);
  }

  // Example 2: Product collection with manual JSON Schema
  const productSchema = {
    type: 'object',
    required: ['name', 'price', 'category'],
    properties: {
      _id: { type: 'string' },
      name: { type: 'string' },
      price: { type: 'number' },
      category: {
        type: 'object',
        required: ['id', 'name'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' }
        }
      },
      tags: {
        type: 'array',
        items: { type: 'string' }
      },
      inStock: { type: 'boolean' }
    }
  };

  const productMongoSchema = convertJsonSchemaToMongoSchema(productSchema);

  try {
    await db.createCollection('products', {
      validator: { $jsonSchema: productMongoSchema },
      validationAction: 'error'
    });
    console.log('✅ Products collection created with validation');
  } catch (error) {
    console.log('Collection may already exist, continuing...');
  }

  const productsCollection = db.collection('products');

  // Test valid product
  try {
    await productsCollection.insertOne({
      _id: new (require('mongodb')).ObjectId(),
      name: 'Laptop',
      price: 999.99,
      category: {
        id: 'electronics',
        name: 'Electronics'
      },
      tags: ['computer', 'portable'],
      inStock: true
    });
    console.log('✅ Valid product document inserted successfully');
  } catch (error) {
    console.error('❌ Error inserting valid product:', (error as Error).message);
  }

  // Test invalid product (missing required field)
  try {
    await productsCollection.insertOne({
      _id: new (require('mongodb')).ObjectId(),
      name: 'Invalid Item',
      // missing required price and category
      inStock: true
    });
    console.log('❌ Invalid product was incorrectly accepted');
  } catch (error) {
    console.log('✅ Invalid product document correctly rejected:', (error as Error).message);
  }

  // Example 3: ObjectId Validation
  console.log('\n=== ObjectId and Date Validation Example ===');

  // Define ObjectId validation function
  function zodObjectId(value: any): boolean {
    return typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);
  }

  const TaskSchema = z.object({
    _id: z.custom<string>(zodObjectId),
    title: z.string(),
    assigneeId: z.custom<string>(zodObjectId),
    createdAt: z.date(),
    dueDate: z.date().optional(),
    tags: z.array(z.custom<string>(zodObjectId)).optional(),
    status: z.enum(['todo', 'in_progress', 'done'])
  });

  // Using Zod adapter with custom types - super clean!
  const taskMongoSchema = zodSchema(TaskSchema, {
    customTypes: { zodObjectId: 'objectId' }
  }).toMongoSchema();

  try {
    await db.createCollection('tasks', {
      validator: { $jsonSchema: taskMongoSchema },
      validationAction: 'error'
    });
    console.log('✅ Tasks collection created with ObjectId validation');
  } catch (error) {
    console.log('Collection may already exist, continuing...');
  }

  const tasksCollection = db.collection('tasks');

  // Test with valid ObjectId (you'd use actual ObjectId objects in real code)
  try {
    await tasksCollection.insertOne({
      _id: new (require('mongodb')).ObjectId(),
      title: 'Complete project',
      assigneeId: new (require('mongodb')).ObjectId(),
      createdAt: new Date(),
      dueDate: new Date('2025-12-31'),
      tags: [new (require('mongodb')).ObjectId()],
      status: 'todo'
    });
    console.log('✅ Valid task with ObjectIds inserted successfully');
  } catch (error) {
    console.error('❌ Error inserting valid task:', (error as Error).message);
  }

  // Test with invalid ObjectId format
  try {
    await tasksCollection.insertOne({
      _id: 'invalid-objectid-format',  // Invalid ObjectId (should stay as string for test)
      title: 'Invalid task',
      assigneeId: new (require('mongodb')).ObjectId(),
      createdAt: new Date(),
      status: 'todo'
    } as any);
    console.log('❌ Invalid task was incorrectly accepted');
  } catch (error) {
    console.log('✅ Invalid ObjectId correctly rejected:', (error as Error).message);
  }

  // Close connection
  await client.close();
  console.log('🔌 MongoDB connection closed');
}

// Example usage
if (import.meta.main) {
  setupMongoValidation().catch(console.error);
}