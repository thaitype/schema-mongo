import { convertJsonSchemaToMongoSchema } from '../src/index';

// Example 1: Basic JSON Schema conversion
console.log('=== Basic JSON Schema Example ===');

const userSchema = {
  type: 'object',
  required: ['email', 'name'],
  properties: {
    _id: { 
      type: 'string', 
      pattern: '^[0-9a-fA-F]{24}$' 
    },
    email: { 
      type: 'string'
    },
    name: { 
      type: 'string'
    },
    age: { 
      type: 'integer'
    },
    tags: {
      type: 'array',
      items: { type: 'string' }
    }
  },
  additionalProperties: false // Note: additionalProperties is stripped in MongoDB conversion
};

const mongoUserSchema = convertJsonSchemaToMongoSchema(userSchema);

console.log('Original JSON Schema:');
console.log(JSON.stringify(userSchema, null, 2));

console.log('\nConverted MongoDB Schema:');
console.log(JSON.stringify(mongoUserSchema, null, 2));

// Example 2: Nested object schema
console.log('\n=== Nested Object Example ===');

const productSchema = {
  type: 'object',
  required: ['name', 'price', 'category'],
  properties: {
    name: { type: 'string' },
    price: { 
      type: 'number'
    },
    category: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        parentId: { type: 'string' }
      },
      required: ['id', 'name']
    },
    variants: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          size: { type: 'string', enum: ['S', 'M', 'L', 'XL'] },
          color: { type: 'string' },
          stock: { type: 'integer' }
        }
      }
    }
  }
};

const mongoProductSchema = convertJsonSchemaToMongoSchema(productSchema);

console.log('Nested Schema:');
console.log(JSON.stringify(mongoProductSchema, null, 2));

// Example 3: Schema composition (allOf, anyOf, oneOf)
console.log('\n=== Schema Composition Example ===');

const compositionSchema = {
  allOf: [
    {
      type: 'object',
      properties: {
        type: { type: 'string' }
      }
    },
    {
      anyOf: [
        {
          properties: {
            email: { type: 'string' }
          }
        },
        {
          properties: {
            phone: { type: 'string' }
          }
        }
      ]
    }
  ]
};

const mongoCompositionSchema = convertJsonSchemaToMongoSchema(compositionSchema);

console.log('Composition Schema:');
console.log(JSON.stringify(mongoCompositionSchema, null, 2));