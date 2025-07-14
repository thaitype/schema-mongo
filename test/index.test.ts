import { test, expect } from 'vitest';
import { convertJsonSchemaToMongoSchema } from '@thaitype/schema-mongo';

test('converts basic string type to bsonType', () => {
  const input = {
    type: 'string'
  };
  const result = convertJsonSchemaToMongoSchema(input);
  expect(result).toEqual({ bsonType: 'string' });
});

test('converts basic number type to double bsonType', () => {
  const input = {
    type: 'number'
  };
  const result = convertJsonSchemaToMongoSchema(input);
  expect(result).toEqual({ bsonType: 'double' });
});

test('converts basic integer type to int bsonType', () => {
  const input = {
    type: 'integer'
  };
  const result = convertJsonSchemaToMongoSchema(input);
  expect(result).toEqual({ bsonType: 'int' });
});

test('converts basic boolean type to bool bsonType', () => {
  const input = {
    type: 'boolean'
  };
  const result = convertJsonSchemaToMongoSchema(input);
  expect(result).toEqual({ bsonType: 'bool' });
});

test('converts basic array type to array bsonType', () => {
  const input = {
    type: 'array'
  };
  const result = convertJsonSchemaToMongoSchema(input);
  expect(result).toEqual({ bsonType: 'array' });
});

test('converts basic object type to object bsonType', () => {
  const input = {
    type: 'object'
  };
  const result = convertJsonSchemaToMongoSchema(input);
  expect(result).toEqual({ bsonType: 'object' });
});

test('removes unsupported keywords', () => {
  const input = {
    type: 'string',
    title: 'User ID',
    description: 'This will be removed',
    examples: ['example'],
    $schema: 'http://json-schema.org/draft-04/schema#',
    default: 'defaultValue',
    format: 'email',
    additionalProperties: false
  };
  const result = convertJsonSchemaToMongoSchema(input);
  expect(result).toEqual({ bsonType: 'string' });
  expect(result).not.toHaveProperty('title');
  expect(result).not.toHaveProperty('description');
  expect(result).not.toHaveProperty('examples');
  expect(result).not.toHaveProperty('$schema');
  expect(result).not.toHaveProperty('default');
  expect(result).not.toHaveProperty('format');
  expect(result).not.toHaveProperty('additionalProperties');
});

test('preserves validation constraints', () => {
  const input = {
    type: 'string',
    pattern: '^[0-9]+$',
    minimum: 0,
    maximum: 100,
    enum: ['a', 'b', 'c']
  };
  const result = convertJsonSchemaToMongoSchema(input);
  expect(result).toEqual({
    bsonType: 'string',
    pattern: '^[0-9]+$',
    minimum: 0,
    maximum: 100,
    enum: ['a', 'b', 'c']
  });
});

test('handles array types for multiple types', () => {
  const input = {
    type: ['string', 'null']
  };
  const result = convertJsonSchemaToMongoSchema(input);
  expect(result).toEqual({ bsonType: ['string', 'null'] });
});

test('converts nested object properties recursively', () => {
  const input = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      age: { type: 'integer', minimum: 0 },
      email: { type: 'string', format: 'email' }
    }
  };
  const result = convertJsonSchemaToMongoSchema(input);
  expect(result).toEqual({
    bsonType: 'object',
    properties: {
      name: { bsonType: 'string' },
      age: { bsonType: 'int', minimum: 0 },
      email: { bsonType: 'string' } // format stripped
    }
  });
});

test('converts array items recursively', () => {
  const input = {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        value: { type: 'number' }
      }
    }
  };
  const result = convertJsonSchemaToMongoSchema(input);
  expect(result).toEqual({
    bsonType: 'array',
    items: {
      bsonType: 'object',
      properties: {
        id: { bsonType: 'string' },
        value: { bsonType: 'double' }
      }
    }
  });
});

test('handles allOf composition', () => {
  const input = {
    allOf: [
      { type: 'object', properties: { name: { type: 'string' } } },
      { type: 'object', properties: { age: { type: 'integer' } } }
    ]
  };
  const result = convertJsonSchemaToMongoSchema(input);
  expect(result).toEqual({
    allOf: [
      { bsonType: 'object', properties: { name: { bsonType: 'string' } } },
      { bsonType: 'object', properties: { age: { bsonType: 'int' } } }
    ]
  });
});

test('handles anyOf composition', () => {
  const input = {
    anyOf: [
      { type: 'string' },
      { type: 'number' }
    ]
  };
  const result = convertJsonSchemaToMongoSchema(input);
  expect(result).toEqual({
    anyOf: [
      { bsonType: 'string' },
      { bsonType: 'double' }
    ]
  });
});

test('handles oneOf composition', () => {
  const input = {
    oneOf: [
      { type: 'string', format: 'email' },
      { type: 'string', format: 'uri' }
    ]
  };
  const result = convertJsonSchemaToMongoSchema(input);
  expect(result).toEqual({
    oneOf: [
      { bsonType: 'string' }, // format stripped
      { bsonType: 'string' }  // format stripped
    ]
  });
});

test('handles not constraint', () => {
  const input = {
    not: {
      type: 'string',
      enum: ['forbidden']
    }
  };
  const result = convertJsonSchemaToMongoSchema(input);
  expect(result).toEqual({
    not: {
      bsonType: 'string',
      enum: ['forbidden']
    }
  });
});

test('complex nested schema from README example', () => {
  const input = {
    type: 'object',
    required: ['_id', 'email'],
    properties: {
      _id: { 
        type: 'string', 
        pattern: '^[0-9a-fA-F]{24}$',
        title: 'Object ID'
      },
      email: { 
        type: 'string', 
        format: 'email',
        description: 'User email address'
      },
      age: { 
        type: 'integer', 
        minimum: 0,
        default: 18
      }
    }
  };
  const result = convertJsonSchemaToMongoSchema(input);
  expect(result).toEqual({
    bsonType: 'object',
    required: ['_id', 'email'],
    properties: {
      _id: { bsonType: 'string', pattern: '^[0-9a-fA-F]{24}$' },
      email: { bsonType: 'string' }, // format stripped
      age: { bsonType: 'int', minimum: 0 } // default stripped
    }
  });
});