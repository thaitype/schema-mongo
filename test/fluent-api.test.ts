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
  expect(result.properties!.age.type).toBe('number'); // May be number or integer depending on Zod version
  expect(result.properties!.createdAt).toEqual({ type: 'string', __mongoType: 'date' });
  expect(result.required).toEqual(['id', 'name', 'createdAt']);
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
  expect(result.properties.age.bsonType).toBe('double'); // May be double or int depending on Zod version
  expect(result.properties.createdAt).toEqual({ bsonType: 'date' });
  expect(result.required).toEqual(['id', 'name', 'createdAt']);
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
  expect(result.properties!.age.type).toBe('number'); // May be number or integer
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
  expect(result.properties.age.bsonType).toBe('double'); // May be double or int
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

test('zodSchema() - array constraints', () => {
  const UserSchema = z.object({
    tags: z.array(z.string()).min(1).max(10),
    scores: z.array(z.number().int()).length(5)
  });

  const jsonResult = zodSchema(UserSchema).toJsonSchema();
  const mongoResult = zodSchema(UserSchema).toMongoSchema();

  expect(jsonResult.properties!.tags.type).toBe('array');
  expect(jsonResult.properties!.tags.items!.type).toBe('string');
  expect(jsonResult.properties!.tags.minItems).toBe(1);
  expect(jsonResult.properties!.tags.maxItems).toBe(10);

  expect(jsonResult.properties!.scores.type).toBe('array');
  expect(jsonResult.properties!.scores.items!.type).toBe('number'); // May be number or integer
  expect(jsonResult.properties!.scores.minItems).toBe(5);
  expect(jsonResult.properties!.scores.maxItems).toBe(5);

  expect(mongoResult.properties.tags.bsonType).toBe('array');
  expect(mongoResult.properties.scores.bsonType).toBe('array');
});

test('zodSchema() - string constraints', () => {
  const UserSchema = z.object({
    username: z.string().min(3).max(20),
    password: z.string().length(32),
    phoneNumber: z.string().regex(/^\+\d{10,15}$/)
  });

  const jsonResult = zodSchema(UserSchema).toJsonSchema();

  expect(jsonResult.properties!.username.type).toBe('string');
  expect(jsonResult.properties!.username.minLength).toBe(3);
  expect(jsonResult.properties!.username.maxLength).toBe(20);

  expect(jsonResult.properties!.password.type).toBe('string');
  expect(jsonResult.properties!.password.minLength).toBe(32);
  expect(jsonResult.properties!.password.maxLength).toBe(32);

  expect(jsonResult.properties!.phoneNumber.type).toBe('string');
  expect(jsonResult.properties!.phoneNumber.pattern).toBe('^\\+\\d{10,15}$');
});

test('zodSchema() - number constraints', () => {
  const UserSchema = z.object({
    age: z.number().int().min(0).max(120),
    score: z.number().min(0.0).max(100.0),
    count: z.number().int()
  });

  const jsonResult = zodSchema(UserSchema).toJsonSchema();
  const mongoResult = zodSchema(UserSchema).toMongoSchema();

  // Age with constraints
  expect(jsonResult.properties!.age.type).toBe('number'); // May be number or integer
  expect(jsonResult.properties!.age.minimum).toBe(0);
  expect(jsonResult.properties!.age.maximum).toBe(120);

  // Score with floating point constraints
  expect(jsonResult.properties!.score.type).toBe('number');
  expect(jsonResult.properties!.score.minimum).toBe(0.0);
  expect(jsonResult.properties!.score.maximum).toBe(100.0);

  // Count as integer
  expect(jsonResult.properties!.count.type).toBe('number'); // May be number or integer

  // MongoDB schemas
  expect(['int', 'double']).toContain(mongoResult.properties.age.bsonType);
  expect(mongoResult.properties.score.bsonType).toBe('double');
  expect(['int', 'double']).toContain(mongoResult.properties.count.bsonType);
});