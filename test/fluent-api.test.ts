import { test, expect } from 'bun:test';
import { z } from 'zod';
import { zodSchema } from '../src/adapters/zod';

// Custom ObjectId validator function
function zodObjectId(value: any): boolean {
  return typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);
}

test('zodSchema().toJsonSchema() - basic functionality', () => {
  const UserSchema = z.object({
    id: z.string(),
    name: z.string(),
    age: z.number().int().optional(),
    createdAt: z.date()
  });

  const result = zodSchema(UserSchema).toJsonSchema();

  expect(result.type).toBe('object');
  expect(result.properties!.id).toEqual({ type: 'string' });
  expect(result.properties!.name).toEqual({ type: 'string' });
  expect(result.properties!.age.type).toMatch(/^(number|integer)$/); // Either works
  expect(result.properties!.createdAt).toEqual({ type: 'string', __mongoType: 'date' });
  expect(result.required).toContain('id');
  expect(result.required).toContain('name');
  expect(result.required).toContain('createdAt');
});

test('zodSchema().toMongoSchema() - basic functionality', () => {
  const UserSchema = z.object({
    id: z.string(),
    name: z.string(),
    age: z.number().int().optional(),
    createdAt: z.date()
  });

  const result = zodSchema(UserSchema).toMongoSchema();

  expect(result.bsonType).toBe('object');
  expect(result.properties.id).toEqual({ bsonType: 'string' });
  expect(result.properties.name).toEqual({ bsonType: 'string' });
  expect(['double', 'int']).toContain(result.properties.age.bsonType); // Either works
  expect(result.properties.createdAt).toEqual({ bsonType: 'date' });
  expect(result.required).toContain('id');
  expect(result.required).toContain('name');
  expect(result.required).toContain('createdAt');
});

test('zodSchema().toJsonSchema() - with custom types', () => {
  const UserSchema = z.object({
    _id: z.custom<string>(zodObjectId),
    name: z.string(),
    createdAt: z.date()
  });

  const result = zodSchema(UserSchema, {
    customTypes: { zodObjectId: 'objectId' }
  }).toJsonSchema();

  expect(result.properties!._id).toEqual({ 
    type: 'string', 
    __mongoType: 'objectId' 
  });
  expect(result.properties!.createdAt).toEqual({ 
    type: 'string', 
    __mongoType: 'date' 
  });
});

test('zodSchema().toMongoSchema() - with custom types', () => {
  const UserSchema = z.object({
    _id: z.custom<string>(zodObjectId),
    name: z.string(),
    createdAt: z.date()
  });

  const result = zodSchema(UserSchema, {
    customTypes: { zodObjectId: 'objectId' }
  }).toMongoSchema();

  expect(result.properties._id).toEqual({ bsonType: 'objectId' });
  expect(result.properties.createdAt).toEqual({ bsonType: 'date' });
  expect(result.properties.name).toEqual({ bsonType: 'string' });
});

test('zodSchema().toJsonSchema() - complex nested schema', () => {
  const UserSchema = z.object({
    _id: z.custom<string>(zodObjectId),
    profile: z.object({
      name: z.string(),
      age: z.number().int().min(0).max(120)
    }),
    tags: z.array(z.string()),
    createdAt: z.date(),
    isActive: z.boolean().default(true)
  });

  const result = zodSchema(UserSchema, {
    customTypes: { zodObjectId: 'objectId' }
  }).toJsonSchema();

  expect(result.type).toBe('object');
  expect(result.properties!._id).toEqual({ type: 'string', __mongoType: 'objectId' });
  expect(result.properties!.createdAt).toEqual({ type: 'string', __mongoType: 'date' });
  expect(result.properties!.profile.type).toBe('object');
  expect(result.properties!.profile.properties!.name).toEqual({ type: 'string' });
  expect(result.properties!.tags.type).toBe('array');
  expect(result.properties!.tags.items!.type).toBe('string');
});

test('zodSchema().toMongoSchema() - complex nested schema', () => {
  const UserSchema = z.object({
    _id: z.custom<string>(zodObjectId),
    profile: z.object({
      name: z.string(),
      contacts: z.array(z.object({
        type: z.enum(['email', 'phone']),
        value: z.string()
      }))
    }),
    createdAt: z.date()
  });

  const result = zodSchema(UserSchema, {
    customTypes: { zodObjectId: 'objectId' }
  }).toMongoSchema();

  expect(result.bsonType).toBe('object');
  expect(result.properties._id.bsonType).toBe('objectId');
  expect(result.properties.createdAt.bsonType).toBe('date');
  expect(result.properties.profile.bsonType).toBe('object');
  expect(result.properties.profile.properties.name.bsonType).toBe('string');
  expect(result.properties.profile.properties.contacts.bsonType).toBe('array');
  expect(result.properties.profile.properties.contacts.items?.bsonType).toBe('object');
});

test('zodSchema().toJsonSchema() - without custom types configuration', () => {
  const UserSchema = z.object({
    name: z.string(),
    age: z.number().int(),
    createdAt: z.date()
  });

  const result = zodSchema(UserSchema).toJsonSchema();

  expect(result.properties!.name).toEqual({ type: 'string' });
  expect(['number', 'integer']).toContain(result.properties!.age.type);
  expect(result.properties!.createdAt).toEqual({ type: 'string', __mongoType: 'date' });
});

test('zodSchema().toMongoSchema() - without custom types configuration', () => {
  const UserSchema = z.object({
    name: z.string(),
    age: z.number().int(),
    createdAt: z.date()
  });

  const result = zodSchema(UserSchema).toMongoSchema();

  expect(result.properties.name).toEqual({ bsonType: 'string' });
  expect(['double', 'int']).toContain(result.properties.age.bsonType);
  expect(result.properties.createdAt).toEqual({ bsonType: 'date' });
});

test('zodSchema() - multiple custom types', () => {
  function zodDecimal(value: any): boolean {
    return typeof value === 'string' && /^\d+\.\d+$/.test(value);
  }

  function zodBinary(value: any): boolean {
    return value instanceof Uint8Array;
  }

  const ProductSchema = z.object({
    _id: z.custom<string>(zodObjectId),
    price: z.custom<string>(zodDecimal),
    thumbnail: z.custom<Uint8Array>(zodBinary),
    createdAt: z.date()
  });

  const jsonResult = zodSchema(ProductSchema, {
    customTypes: {
      zodObjectId: 'objectId',
      zodDecimal: 'decimal',
      zodBinary: 'binData'
    }
  }).toJsonSchema();

  const mongoResult = zodSchema(ProductSchema, {
    customTypes: {
      zodObjectId: 'objectId',
      zodDecimal: 'decimal',
      zodBinary: 'binData'
    }
  }).toMongoSchema();

  // JSON Schema assertions
  expect(jsonResult.properties!._id).toEqual({ type: 'string', __mongoType: 'objectId' });
  expect(jsonResult.properties!.price).toEqual({ type: 'string', __mongoType: 'decimal' });
  expect(jsonResult.properties!.thumbnail).toEqual({ type: 'string', __mongoType: 'binData' });
  expect(jsonResult.properties!.createdAt).toEqual({ type: 'string', __mongoType: 'date' });

  // MongoDB Schema assertions
  expect(mongoResult.properties._id).toEqual({ bsonType: 'objectId' });
  expect(mongoResult.properties.price).toEqual({ bsonType: 'decimal' });
  expect(mongoResult.properties.thumbnail).toEqual({ bsonType: 'binData' });
  expect(mongoResult.properties.createdAt).toEqual({ bsonType: 'date' });
});

test('zodSchema() - union types', () => {
  const EventSchema = z.object({
    id: z.string(),
    location: z.union([
      z.object({
        type: z.literal('online'),
        url: z.string()
      }),
      z.object({
        type: z.literal('physical'),
        address: z.string()
      })
    ]),
    createdAt: z.date()
  });

  const jsonResult = zodSchema(EventSchema).toJsonSchema();
  const mongoResult = zodSchema(EventSchema).toMongoSchema();

  expect(jsonResult.properties!.location.anyOf).toHaveLength(2);
  expect(mongoResult.properties.location.anyOf).toHaveLength(2);
  expect(mongoResult.properties.createdAt.bsonType).toBe('date');
});

test('zodSchema() - arrays', () => {
  const UserSchema = z.object({
    tags: z.array(z.string()),
    scores: z.array(z.number().int())
  });

  const jsonResult = zodSchema(UserSchema).toJsonSchema();
  const mongoResult = zodSchema(UserSchema).toMongoSchema();

  expect(jsonResult.properties!.tags.type).toBe('array');
  expect(jsonResult.properties!.tags.items!.type).toBe('string');

  expect(jsonResult.properties!.scores.type).toBe('array');
  expect(['number', 'integer']).toContain(jsonResult.properties!.scores.items!.type);

  expect(mongoResult.properties.tags.bsonType).toBe('array');
  expect(mongoResult.properties.scores.bsonType).toBe('array');
});

test('zodSchema() - strings', () => {
  const UserSchema = z.object({
    username: z.string(),
    password: z.string(),
    phoneNumber: z.string()
  });

  const jsonResult = zodSchema(UserSchema).toJsonSchema();
  const mongoResult = zodSchema(UserSchema).toMongoSchema();

  expect(jsonResult.properties!.username.type).toBe('string');
  expect(jsonResult.properties!.password.type).toBe('string');
  expect(jsonResult.properties!.phoneNumber.type).toBe('string');

  expect(mongoResult.properties.username.bsonType).toBe('string');
  expect(mongoResult.properties.password.bsonType).toBe('string');
  expect(mongoResult.properties.phoneNumber.bsonType).toBe('string');
});

test('zodSchema() - numbers', () => {
  const UserSchema = z.object({
    age: z.number().int(),
    score: z.number(),
    count: z.number().int()
  });

  const jsonResult = zodSchema(UserSchema).toJsonSchema();
  const mongoResult = zodSchema(UserSchema).toMongoSchema();

  // Integer detection
  expect(['number', 'integer']).toContain(jsonResult.properties!.age.type);
  expect(jsonResult.properties!.score.type).toBe('number');
  expect(['number', 'integer']).toContain(jsonResult.properties!.count.type);

  // MongoDB schemas
  expect(['int', 'double']).toContain(mongoResult.properties.age.bsonType);
  expect(mongoResult.properties.score.bsonType).toBe('double');
  expect(['int', 'double']).toContain(mongoResult.properties.count.bsonType);
});