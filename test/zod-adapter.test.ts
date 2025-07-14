import { test, expect } from 'vitest';
import { z } from 'zod';
import { zodToCompatibleJsonSchema } from '../src/adapters/zod';
import { convertJsonSchemaToMongoSchema } from '../src/lib';

test('converts z.date() to string with __mongoType metadata', () => {
  const schema = z.date();
  const result = zodToCompatibleJsonSchema(schema);
  
  expect(result).toEqual({
    type: 'string',
    __mongoType: 'date'
  });
});

test('converts object with date field', () => {
  const schema = z.object({
    id: z.string(),
    createdAt: z.date(),
    name: z.string()
  });
  
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

test('converts optional date field', () => {
  const schema = z.object({
    name: z.string(),
    updatedAt: z.date().optional()
  });
  
  const result = zodToCompatibleJsonSchema(schema);
  
  expect(result).toEqual({
    type: 'object',
    properties: {
      name: { type: 'string' },
      updatedAt: { type: 'string', __mongoType: 'date' }
    },
    required: ['name']
  });
});

test('converts nested object with dates', () => {
  const schema = z.object({
    user: z.object({
      name: z.string(),
      birthday: z.date()
    }),
    post: z.object({
      title: z.string(),
      publishedAt: z.date(),
      updatedAt: z.date().optional()
    })
  });
  
  const result = zodToCompatibleJsonSchema(schema);
  
  expect(result.properties!.user.properties!.birthday).toEqual({
    type: 'string',
    __mongoType: 'date'
  });
  expect(result.properties!.post.properties!.publishedAt).toEqual({
    type: 'string',
    __mongoType: 'date'
  });
  expect(result.properties!.post.properties!.updatedAt).toEqual({
    type: 'string',
    __mongoType: 'date'
  });
});

test('converts array of objects with dates', () => {
  const schema = z.array(z.object({
    id: z.string(),
    timestamp: z.date()
  }));
  
  const result = zodToCompatibleJsonSchema(schema);
  
  expect(result).toEqual({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        timestamp: { type: 'string', __mongoType: 'date' }
      },
      required: ['id', 'timestamp']
    }
  });
});

test('full pipeline: Zod with dates → JSON Schema → MongoDB Schema', () => {
  const zodSchema = z.object({
    _id: z.string(),
    email: z.string(),
    createdAt: z.date(),
    lastLogin: z.date().optional(),
    profile: z.object({
      name: z.string(),
      birthday: z.date()
    })
  });
  
  // Step 1: Zod → Compatible JSON Schema
  const jsonSchema = zodToCompatibleJsonSchema(zodSchema);
  
  // Step 2: JSON Schema → MongoDB Schema
  const mongoSchema = convertJsonSchemaToMongoSchema(jsonSchema);
  
  expect(mongoSchema).toEqual({
    bsonType: 'object',
    properties: {
      _id: { bsonType: 'string' },
      email: { bsonType: 'string' },
      createdAt: { bsonType: 'date' },
      lastLogin: { bsonType: 'date' },
      profile: {
        bsonType: 'object',
        properties: {
          name: { bsonType: 'string' },
          birthday: { bsonType: 'date' }
        },
        required: ['name', 'birthday']
      }
    },
    required: ['_id', 'email', 'createdAt', 'profile']
  });
});

test('preserves other Zod types with dates', () => {
  const zodSchema = z.object({
    id: z.string(),
    count: z.number().int(),
    tags: z.array(z.string()),
    createdAt: z.date(),
    status: z.literal('active')
  });
  
  const jsonSchema = zodToCompatibleJsonSchema(zodSchema);
  const mongoSchema = convertJsonSchemaToMongoSchema(jsonSchema);
  
  expect(mongoSchema.bsonType).toBe('object');
  expect(mongoSchema.properties.id).toEqual({ bsonType: 'string' });
  expect(['int', 'double']).toContain(mongoSchema.properties.count.bsonType);
  expect(mongoSchema.properties.tags).toEqual({ 
    bsonType: 'array',
    items: { bsonType: 'string' }
  });
  expect(mongoSchema.properties.createdAt).toEqual({ bsonType: 'date' });
  expect(mongoSchema.properties.status).toEqual({ bsonType: 'string', const: 'active' });
  expect(mongoSchema.required).toContain('id');
  expect(mongoSchema.required).toContain('count');
  expect(mongoSchema.required).toContain('tags');
  expect(mongoSchema.required).toContain('createdAt');
  expect(mongoSchema.required).toContain('status');
});

test('handles union with date', () => {
  const zodSchema = z.union([
    z.object({
      type: z.literal('timestamp'),
      value: z.date()
    }),
    z.object({
      type: z.literal('string'),
      value: z.string()
    })
  ]);
  
  const jsonSchema = zodToCompatibleJsonSchema(zodSchema);
  const mongoSchema = convertJsonSchemaToMongoSchema(jsonSchema);
  
  expect(mongoSchema.anyOf[0].properties.value).toEqual({
    bsonType: 'date'
  });
  expect(mongoSchema.anyOf[1].properties.value).toEqual({
    bsonType: 'string'
  });
});

test('handles regular Zod types without dates', () => {
  const zodSchema = z.object({
    name: z.string(),
    age: z.number().int(),
    isActive: z.boolean()
  });
  
  const jsonSchema = zodToCompatibleJsonSchema(zodSchema);
  const mongoSchema = convertJsonSchemaToMongoSchema(jsonSchema);
  
  expect(mongoSchema.bsonType).toBe('object');
  expect(mongoSchema.properties.name).toEqual({ bsonType: 'string' });
  expect(['int', 'double']).toContain(mongoSchema.properties.age.bsonType);
  expect(mongoSchema.properties.isActive).toEqual({ bsonType: 'bool' });
  expect(mongoSchema.required).toEqual(['name', 'age', 'isActive']);
});