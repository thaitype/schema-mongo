import { z } from 'zod';
import { convertJsonSchemaToMongoSchema } from '../src/index';
import { zodSchema } from '../src/adapters/zod';

console.log('=== Zod Integration Example ===');

// Example 1: Simple Zod schema
const UserZodSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().min(1),
  age: z.number().int().min(0).max(120).optional(),
  isActive: z.boolean().default(true),
  tags: z.array(z.string()).optional()
});

// NEW: Convert Zod schema directly to MongoDB schema using fluent API
const userMongoSchema = zodSchema(UserZodSchema).toMongoSchema();

console.log('Zod Schema → MongoDB Schema (using fluent API):');
console.log(JSON.stringify(userMongoSchema, null, 2));

// ALTERNATIVE: Traditional approach (still works)
console.log('\n--- Traditional approach (still supported) ---');
const userJsonSchema = z.toJSONSchema(UserZodSchema);
const userMongoSchemaTraditional = convertJsonSchemaToMongoSchema(userJsonSchema);
console.log('Traditional:', JSON.stringify(userMongoSchemaTraditional, null, 2));

// Example 2: Complex nested Zod schema
console.log('\n=== Complex Nested Zod Example ===');

const AddressSchema = z.object({
  street: z.string(),
  city: z.string(),
  state: z.string(),
  zipCode: z.string(),
  country: z.string().default('US')
});

const ContactSchema = z.object({
  type: z.enum(['email', 'phone', 'fax']),
  value: z.string(),
  isPrimary: z.boolean().default(false)
});

const CompanySchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  website: z.string().url().optional(),
  address: AddressSchema,
  contacts: z.array(ContactSchema).min(1),
  employees: z.number().int().min(1),
  founded: z.number().int().min(1800).max(new Date().getFullYear()),
  tags: z.array(z.string()).default([])
});

// Using fluent API for cleaner code
const companyMongoSchema = zodSchema(CompanySchema).toMongoSchema();

console.log('Complex nested schema (using fluent API):');
console.log(JSON.stringify(companyMongoSchema, null, 2));

// Example 3: Union types and optionals
console.log('\n=== Union Types Example ===');

const EventSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  startDate: z.string(),
  endDate: z.string().optional(),
  location: z.union([
    z.object({
      type: z.literal('online'),
      url: z.string().url()
    }),
    z.object({
      type: z.literal('physical'),
      address: AddressSchema
    })
  ]),
  attendees: z.array(z.string()).default([]),
  isPublic: z.boolean().default(true)
});

// Fluent API makes complex schemas more readable
const eventMongoSchema = zodSchema(EventSchema).toMongoSchema();

console.log('Union types schema (using fluent API):');
console.log(JSON.stringify(eventMongoSchema, null, 2));

// Example 4: ObjectId and Custom Types Example
console.log('\n=== NEW: ObjectId and Custom Types Example ===');

// Define ObjectId validation function
function zodObjectId(value: any): boolean {
  return typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);
}

const ProductSchema = z.object({
  _id: z.custom<string>(zodObjectId),           // ObjectId
  categoryId: z.custom<string>(zodObjectId),    // Another ObjectId
  name: z.string(),
  price: z.number().min(0),
  createdAt: z.date(),                          // Built-in date
  tags: z.array(z.object({
    tagId: z.custom<string>(zodObjectId),       // ObjectId in arrays
    name: z.string()
  })).optional()
});

// Convert with custom types configuration
const productMongoSchema = zodSchema(ProductSchema, {
  customTypes: { zodObjectId: 'objectId' }
}).toMongoSchema();

console.log('Schema with ObjectId and Date types:');
console.log(JSON.stringify(productMongoSchema, null, 2));