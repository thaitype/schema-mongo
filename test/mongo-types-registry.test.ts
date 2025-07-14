import { test, expect } from 'vitest';
import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { zodToCompatibleJsonSchema } from '@thaitype/schema-mongo/adapters/zod';
import { convertJsonSchemaToMongoSchema, MongoTypeRegistry } from '@thaitype/schema-mongo';

// Custom ObjectId validator - clean pattern
const zodObjectId = z.custom<ObjectId | string>(value => ObjectId.isValid(value));

// Custom date validator
function zodStrictDate(value: any): boolean {
  return value instanceof Date && !isNaN(value.getTime());
}
const zodStrictDateType = z.custom<Date>(zodStrictDate);

test('supports custom ObjectId type with MongoTypeRegistry', () => {
  const mongoTypes = new MongoTypeRegistry()
    .add('objectId', {
      validate: zodObjectId,
      bsonType: 'objectId'
    });

  const schema = z.object({
    _id: zodObjectId,
    name: z.string()
  });
  
  const result = zodToCompatibleJsonSchema(schema, {
    mongoTypes
  });
  
  expect(result).toEqual({
    type: 'object',
    properties: {
      _id: { type: 'string', __mongoType: 'objectId' },
      name: { type: 'string' }
    },
    required: ['_id', 'name']
  });
});

test('supports custom date type with MongoTypeRegistry', () => {
  const mongoTypes = new MongoTypeRegistry()
    .add('strictDate', {
      validate: zodStrictDateType,
      bsonType: 'date'
    });

  const schema = z.object({
    id: z.string(),
    customDate: zodStrictDateType,
    autoDate: z.date()
  });
  
  const result = zodToCompatibleJsonSchema(schema, {
    mongoTypes
  });
  
  expect(result).toEqual({
    type: 'object',
    properties: {
      id: { type: 'string' },
      customDate: { type: 'string', __mongoType: 'date' },
      autoDate: { type: 'string', __mongoType: 'date' }
    },
    required: ['id', 'customDate', 'autoDate']
  });
});

test('supports multiple custom types in same registry', () => {
  const mongoTypes = new MongoTypeRegistry()
    .add('objectId', {
      validate: zodObjectId,
      bsonType: 'objectId'
    })
    .add('strictDate', {
      validate: zodStrictDateType,
      bsonType: 'date'
    });

  const schema = z.object({
    _id: zodObjectId,
    userId: zodObjectId,
    createdAt: zodStrictDateType,
    updatedAt: z.date(),
    name: z.string()
  });
  
  const result = zodToCompatibleJsonSchema(schema, {
    mongoTypes
  });
  
  expect(result).toEqual({
    type: 'object',
    properties: {
      _id: { type: 'string', __mongoType: 'objectId' },
      userId: { type: 'string', __mongoType: 'objectId' },
      createdAt: { type: 'string', __mongoType: 'date' },
      updatedAt: { type: 'string', __mongoType: 'date' },
      name: { type: 'string' }
    },
    required: ['_id', 'userId', 'createdAt', 'updatedAt', 'name']
  });
});

test('full pipeline: MongoTypeRegistry → MongoDB schema', () => {
  const mongoTypes = new MongoTypeRegistry()
    .add('objectId', {
      validate: zodObjectId,
      bsonType: 'objectId'
    })
    .add('strictDate', {
      validate: zodStrictDateType,
      bsonType: 'date'
    });

  const schema = z.object({
    _id: zodObjectId,
    createdAt: zodStrictDateType,
    autoDate: z.date(),
    name: z.string()
  });
  
  const jsonSchema = zodToCompatibleJsonSchema(schema, {
    mongoTypes
  });
  
  const mongoSchema = convertJsonSchemaToMongoSchema(jsonSchema);
  
  expect(mongoSchema).toEqual({
    bsonType: 'object',
    properties: {
      _id: { bsonType: 'objectId' },
      createdAt: { bsonType: 'date' },
      autoDate: { bsonType: 'date' },
      name: { bsonType: 'string' }
    },
    required: ['_id', 'createdAt', 'autoDate', 'name']
  });
});

test('works without custom types configuration (backward compatibility)', () => {
  const schema = z.object({
    id: z.string(),
    createdAt: z.date(),
    name: z.string()
  });
  
  // No custom types provided
  const result = zodToCompatibleJsonSchema(schema);
  
  expect(result).toEqual({
    type: 'object',
    properties: {
      id: { type: 'string' },
      createdAt: { type: 'string', __mongoType: 'date' },
      name: { type: 'string' }
    },
    required: ['id', 'createdAt', 'name']
  });
});

test('supports nested objects with custom types', () => {
  const mongoTypes = new MongoTypeRegistry()
    .add('objectId', {
      validate: zodObjectId,
      bsonType: 'objectId'
    });

  const schema = z.object({
    user: z.object({
      _id: zodObjectId,
      profile: z.object({
        parentId: zodObjectId,
        name: z.string()
      })
    })
  });
  
  const result = zodToCompatibleJsonSchema(schema, {
    mongoTypes
  });
  
  expect(result.properties!.user.properties!._id).toEqual({ type: 'string', __mongoType: 'objectId' });
  expect(result.properties!.user.properties!.profile.properties!.parentId).toEqual({ type: 'string', __mongoType: 'objectId' });
});

test('supports arrays with custom types', () => {
  const mongoTypes = new MongoTypeRegistry()
    .add('objectId', {
      validate: zodObjectId,
      bsonType: 'objectId'
    });

  const schema = z.object({
    items: z.array(z.object({
      _id: zodObjectId,
      name: z.string()
    }))
  });
  
  const result = zodToCompatibleJsonSchema(schema, {
    mongoTypes
  });
  
  expect(result.properties!.items.type).toBe('array');
  expect(result.properties!.items.items!.type).toBe('object');
  expect(result.properties!.items.items!.properties!._id).toEqual({ type: 'string', __mongoType: 'objectId' });
  expect(result.properties!.items.items!.properties!.name).toEqual({ type: 'string' });
});

test('supports custom MongoDB types beyond objectId and date', () => {
  function zodDecimal(value: any): boolean {
    return typeof value === 'string' && /^\d+\.\d+$/.test(value);
  }
  
  const zodDecimalType = z.custom<string>(zodDecimal);
  
  const mongoTypes = new MongoTypeRegistry()
    .add('decimal', {
      validate: zodDecimalType,
      bsonType: 'decimal'
    });

  const schema = z.object({
    price: zodDecimalType,
    currency: z.string()
  });
  
  const result = zodToCompatibleJsonSchema(schema, {
    mongoTypes
  });
  
  const mongoSchema = convertJsonSchemaToMongoSchema(result);
  
  expect(mongoSchema.properties.price).toEqual({ bsonType: 'decimal' });
});

test('MongoTypeRegistry class methods work correctly', () => {
  const registry = new MongoTypeRegistry();
  
  // Test add method
  registry.add('objectId', {
    validate: zodObjectId,
    bsonType: 'objectId'
  });
  
  // Test get method
  const objectIdType = registry.get('objectId');
  expect(objectIdType).toBeDefined();
  expect(objectIdType?.bsonType).toBe('objectId');
  
  // Test has method
  expect(registry.has('objectId')).toBe(true);
  expect(registry.has('nonexistent')).toBe(false);
  
  // Test size method
  expect(registry.size()).toBe(1);
  
  // Test findByValidator method
  const foundName = registry.findByValidator(zodObjectId);
  expect(foundName).toBe('objectId');
  
  // Test entries method
  const entries = registry.entries();
  expect(entries).toHaveLength(1);
  expect(entries[0][0]).toBe('objectId');
  
  // Test clear method
  registry.clear();
  expect(registry.size()).toBe(0);
});