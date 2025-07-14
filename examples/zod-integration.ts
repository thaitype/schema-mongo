import { z } from 'zod';
import { convertJsonSchemaToMongoSchema } from '../src/index';

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

// Convert Zod schema to JSON Schema, then to MongoDB schema
const userJsonSchema = z.toJSONSchema(UserZodSchema);
const userMongoSchema = convertJsonSchemaToMongoSchema(userJsonSchema);

console.log('Zod Schema → JSON Schema → MongoDB Schema:');
console.log(JSON.stringify(userMongoSchema, null, 2));

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

const companyJsonSchema = z.toJSONSchema(CompanySchema);
const companyMongoSchema = convertJsonSchemaToMongoSchema(companyJsonSchema);

console.log('Complex nested schema:');
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

const eventJsonSchema = z.toJSONSchema(EventSchema);
const eventMongoSchema = convertJsonSchemaToMongoSchema(eventJsonSchema);

console.log('Union types schema:');
console.log(JSON.stringify(eventMongoSchema, null, 2));