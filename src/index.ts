/**
 * Main entry point for the library
 *
 * Export all the functions from the library
 */

export * from './lib.js';

/**
 * Export `zod` modules with module name `zod`
 */
export * as zod from './adapters/zod.js';

/**
 * Export CustomTypeRegistry for type-safe custom type handling
 */
export { CustomTypeRegistry, type CustomTypeInfo } from './registry/CustomTypeRegistry.js';
