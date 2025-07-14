import { test, expect } from 'vitest';
import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { zodToCompatibleJsonSchema } from 'schema-mongo/adapters/zod';
import { convertJsonSchemaToMongoSchema } from 'schema-mongo';

// Mock ObjectId validation for testing
const mockObjectIdValidation = (value: any): boolean => {
  if (typeof value === 'string') {
    return /^[0-9a-fA-F]{24}$/.test(value);
  }
  return false;
};

// Create a custom ObjectId type with a recognizable name - cleaner pattern with named function
const zodObjectId = z.custom<ObjectId | string>(function zodObjectId(value) {
  return ObjectId.isValid(value);
});

// Create a custom date type with a recognizable name  
function zodStrictDate(value: any): boolean {
  return value instanceof Date && !isNaN(value.getTime());
}

test('supports custom ObjectId type with configuration', () => {
  const zodObjectIdType = zodObjectId;
  
  const schema = z.object({
    _id: zodObjectIdType,
    name: z.string()
  });
  
  const result = zodToCompatibleJsonSchema(schema, {
    mongoTypes: { zodObjectId: 'objectId' }
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

test('supports custom date type with configuration', () => {
  const zodStrictDateType = z.custom<Date>(zodStrictDate);
  
  const schema = z.object({
    id: z.string(),
    customDate: zodStrictDateType,
    autoDate: z.date()
  });
  
  const result = zodToCompatibleJsonSchema(schema, {
    mongoTypes: { zodStrictDate: 'date' }
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

test('supports multiple custom types in same schema', () => {
  const zodObjectIdType = zodObjectId;
  const zodStrictDateType = z.custom<Date>(zodStrictDate);
  
  const schema = z.object({
    _id: zodObjectIdType,
    userId: zodObjectIdType,
    createdAt: zodStrictDateType,
    updatedAt: z.date(),
    name: z.string()
  });
  
  const result = zodToCompatibleJsonSchema(schema, {
    mongoTypes: { 
      zodObjectId: 'objectId',
      zodStrictDate: 'date'
    }
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

test('full pipeline: custom types → MongoDB schema', () => {
  const zodObjectIdType = zodObjectId;
  const zodStrictDateType = z.custom<Date>(zodStrictDate);
  
  const schema = z.object({
    _id: zodObjectIdType,
    createdAt: zodStrictDateType,
    autoDate: z.date(),
    name: z.string()
  });
  
  const jsonSchema = zodToCompatibleJsonSchema(schema, {
    mongoTypes: { 
      zodObjectId: 'objectId',
      zodStrictDate: 'date'
    }
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

test('ignores custom types not in configuration', () => {
  const zodObjectIdType = zodObjectId;
  const zodUnknownType = z.custom<string>((value) => typeof value === 'string');
  
  const schema = z.object({
    _id: zodObjectIdType,      // Configured
    unknown: zodUnknownType,   // Not configured
    name: z.string()
  });
  
  const result = zodToCompatibleJsonSchema(schema, {
    mongoTypes: { zodObjectId: 'objectId' }
  });
  
  expect(result.properties?._id).toEqual({ type: 'string', __mongoType: 'objectId' });
  expect(result.properties?.unknown).toEqual({}); // Falls back to permissive schema
  expect(result.properties?.name).toEqual({ type: 'string' });
});

test('supports nested objects with custom types', () => {
  const zodObjectIdType = zodObjectId;
  
  const schema = z.object({
    user: z.object({
      _id: zodObjectIdType,
      profile: z.object({
        parentId: zodObjectIdType,
        name: z.string()
      })
    })
  });
  
  const result = zodToCompatibleJsonSchema(schema, {
    mongoTypes: { zodObjectId: 'objectId' }
  });
  
  expect(result.properties!.user.properties!._id).toEqual({ type: 'string', __mongoType: 'objectId' });
  expect(result.properties!.user.properties!.profile.properties!.parentId).toEqual({ type: 'string', __mongoType: 'objectId' });
});

test('supports arrays with custom types', () => {
  const zodObjectIdType = zodObjectId;
  
  const schema = z.object({
    items: z.array(z.object({
      _id: zodObjectIdType,
      name: z.string()
    }))
  });
  
  const result = zodToCompatibleJsonSchema(schema, {
    mongoTypes: { zodObjectId: 'objectId' }
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
  
  const schema = z.object({
    price: zodDecimalType,
    currency: z.string()
  });
  
  const result = zodToCompatibleJsonSchema(schema, {
    mongoTypes: { zodDecimal: 'decimal' }
  });
  
  const mongoSchema = convertJsonSchemaToMongoSchema(result);
  
  expect(mongoSchema.properties.price).toEqual({ bsonType: 'decimal' });
});