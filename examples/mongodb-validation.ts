import { MongoClient } from 'mongodb';
import { z } from 'zod';
import { convertJsonSchemaToMongoSchema } from '../src/index';

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
    name: z.string().min(1),
    age: z.number().int().min(0).max(120).optional(),
    createdAt: z.string(),
    isActive: z.boolean().default(true)
  });

  const userJsonSchema = z.toJSONSchema(UserSchema);
  const userMongoSchema = convertJsonSchemaToMongoSchema(userJsonSchema);

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
      _id: 'user-123',
      email: 'john@example.com',
      name: 'John Doe',
      age: 30,
      createdAt: new Date().toISOString(),
      isActive: true
    });
    console.log('✅ Valid user document inserted successfully');
  } catch (error) {
    console.error('❌ Error inserting valid user:', error.message);
  }

  // Test invalid document (missing required field)
  try {
    await usersCollection.insertOne({
      _id: 'user-456',
      // missing email and name
      age: 25,
      createdAt: new Date().toISOString()
    });
    console.log('❌ Invalid document was incorrectly accepted');
  } catch (error) {
    console.log('✅ Invalid user document correctly rejected:', error.message);
  }

  // Example 2: Product collection with manual JSON Schema
  const productSchema = {
    type: 'object',
    required: ['name', 'price', 'category'],
    properties: {
      _id: { type: 'string' },
      name: { type: 'string', minLength: 1 },
      price: { type: 'number', minimum: 0 },
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
      _id: 'prod-123',
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
    console.error('❌ Error inserting valid product:', error.message);
  }

  // Test invalid product (negative price)
  try {
    await productsCollection.insertOne({
      _id: 'prod-456',
      name: 'Invalid Item',
      price: -10, // Invalid: negative price
      category: {
        id: 'test',
        name: 'Test'
      }
    });
    console.log('❌ Invalid product was incorrectly accepted');
  } catch (error) {
    console.log('✅ Invalid product document correctly rejected:', error.message);
  }

  // Close connection
  await client.close();
  console.log('🔌 MongoDB connection closed');
}

// Example usage
if (import.meta.main) {
  setupMongoValidation().catch(console.error);
}