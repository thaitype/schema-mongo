import type { StandardSchemaV1 } from '@standard-schema/spec';

/**
 * Information about a custom type for MongoDB schema generation
 */
export interface MongoTypeInfo<S extends StandardSchemaV1 = StandardSchemaV1> {
  /** The validator schema that implements StandardSchemaV1 */
  schema: S;
  /** The corresponding MongoDB BSON type */
  bsonType: 'string' | 'objectId' | 'date' | 'binary' | 'decimal' | 'int' | 'long' | 'double' | 'boolean' | 'null' | (string & {}); // Allow any string for future extensions
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
 * import { MongoTypeRegistry } from 'schema-mongo';
 *
 * const zodObjectId = z.custom<ObjectId | string>(value => ObjectId.isValid(value));
 *
 * const mongoTypes = new MongoTypeRegistry()
 *   .register('objectId', {
 *     schema: zodObjectId,
 *     bsonType: 'objectId'
 *   })
 *   .register('date', {
 *     schema: z.date(),
 *     bsonType: 'date'
 *   });
 * ```
 */
export class MongoTypeRegistry<TypeInfo extends Record<string, StandardSchemaV1> = {}> {
  private _types = new Map<string, MongoTypeInfo>();

  /**
   * Add a custom type to the registry
   *
   * @param name - Unique name for the custom type
   * @param typeInfo - Type information including validator and bsonType
   * @returns This registry instance for method chaining
   */
  register<TName extends string, TSchema extends StandardSchemaV1>(name: TName, typeInfo: MongoTypeInfo<TSchema>) {
    this._types.set(name, typeInfo);
    return this as unknown as MongoTypeRegistry<TypeInfo & Record<TName, TSchema>>;
  }

  /**
   * Get a custom type by name with full type safety
   *
   * @param name - Name of the custom type
   * @returns Type information if found, undefined otherwise
   */
  get<TName extends keyof TypeInfo>(name: TName) {
    // Cast to allow user to provide specific S type for full type-safety
    return this._types.get(name as string) as unknown as TypeInfo[TName];
  }

  /**
   * Get all registered mongo types as entries
   *
   * @returns Array of [name, typeInfo] tuples
   */
  entries(): [string, MongoTypeInfo][] {
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
   * Get the number of registered mongo types
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
   * Clear all registered mongo types
   */
  clear(): void {
    this._types.clear();
  }
}
