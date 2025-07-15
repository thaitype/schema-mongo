/**
 * Main entry point for the library
 *
 * Export all the functions from the library
 */

export * from './lib.js';
export * from './types.js';

/**
 * Export `zod` modules with module name `zod`
 */
export * as zod from './adapters/zod.js';

/**
 * Export MongoTypeRegistry for type-safe custom type handling
 */
export { MongoTypeRegistry, type MongoTypeInfo } from './registry/MongoTypeRegistry.js';
