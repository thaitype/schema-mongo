import type { StandardSchemaV1 } from '@standard-schema/spec';

/**
 * Information about a custom type for MongoDB schema generation
 */
export interface MongoTypeInfo<S extends StandardSchemaV1 = StandardSchemaV1> {
  /** The validator schema that implements StandardSchemaV1 */
  schema: S;
  /** The corresponding MongoDB BSON type */
  bsonType: string;
  // Future extensions: doc, format, transformer, etc.
}

/**
 * Type-safe registry for custom MongoDB types using StandardSchemaV1
 *
 * This registry stores custom type validators and their corresponding MongoDB BSON types.
 * It leverages StandardSchemaV1 for type safety and runtime validation.
 *
 * @example
 * ```typescript
 * import { z } from 'zod';
 * import { MongoTypeRegistry } from '@thaitype/schema-mongo';
 *
 * const zodObjectId = z.custom<ObjectId | string>(value => ObjectId.isValid(value));
 *
 * const mongoTypes = new MongoTypeRegistry()
 *   .add('objectId', {
 *     validate: zodObjectId,
 *     bsonType: 'objectId'
 *   })
 *   .add('date', {
 *     validate: z.date(),
 *     bsonType: 'date'
 *   });
 * ```
 */
export class MongoTypeRegistry<T extends MongoTypeInfo = MongoTypeInfo> {
  private _types = new Map<string, T>();

  /**
   * Add a custom type to the registry
   *
   * @param name - Unique name for the custom type
   * @param typeInfo - Type information including validator and bsonType
   * @returns This registry instance for method chaining
   */
  register(name: string, typeInfo: T): this {
    this._types.set(name, typeInfo);
    return this;
  }

  /**
   * Get a custom type by name with full type safety
   *
   * @param name - Name of the custom type
   * @returns Type information if found, undefined otherwise
   */
  get<S extends StandardSchemaV1 = StandardSchemaV1>(name: string): MongoTypeInfo<S> {
    // Cast to allow user to provide specific S type for full type-safety
    return this._types.get(name) as unknown as MongoTypeInfo<S>;
  }

  /**
   * Get all registered custom types as entries
   *
   * @returns Array of [name, typeInfo] tuples
   */
  entries(): [string, T][] {
    return Array.from(this._types.entries());
  }

  /**
   * Check if a custom type is registered
   *
   * @param name - Name of the custom type
   * @returns True if the type is registered
   */
  has(name: string): boolean {
    return this._types.has(name);
  }

  /**
   * Get the number of registered custom types
   *
   * @returns Number of registered types
   */
  size(): number {
    return this._types.size;
  }

  /**
   * Find a custom type by its validator schema using object identity
   *
   * @param validator - The validator schema to find
   * @returns The name of the custom type if found, undefined otherwise
   */
  findByValidator(validator: StandardSchemaV1): string | undefined {
    for (const [name, typeInfo] of this._types.entries()) {
      if (typeInfo.schema === validator) {
        return name;
      }
    }
    return undefined;
  }

  /**
   * Clear all registered custom types
   */
  clear(): void {
    this._types.clear();
  }
}
