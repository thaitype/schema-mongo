# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Testing
- `bun test` - Run all tests using Bun's built-in test runner

### Development
- Uses Bun as the runtime and package manager
- TypeScript configuration is strict with modern ESNext features enabled
- No build step required - the project uses `"type": "module"` with Bun's native TypeScript support

## Architecture

This is a lightweight, dependency-free TypeScript package that converts JSON Schema to MongoDB's `$jsonSchema` format.

### Core Purpose
The main export is a single conversion function:
```ts
function convertJsonSchemaToMongoSchema(schema: Record<string, any>): Record<string, any>
```

### Key Design Principles
- **Dependency-Free Core**: No third-party dependencies for the conversion logic
- **Framework-Agnostic**: Standalone utility that works with any JSON Schema source
- **Types First**: Fully typed TypeScript implementation

### Conversion Logic
- Converts `type` to `bsonType` recursively
- Strips unsupported JSON Schema keywords (`title`, `description`, `examples`, `$schema`, `default`)
- Recursively transforms nested schemas in `properties`, `items`, `allOf`, `anyOf`, `oneOf`, and `not`
- Preserves validation constraints like `minimum`, `pattern`, `enum`

### Project Structure
- `src/index.ts` - Main conversion function (currently placeholder)
- `test/` - Test files using Bun's test runner
- Examples and integration tests should use `mongodb-memory-server` and `zod` for validation

### Integration Patterns
The package is designed to work with:
- Plain JSON Schema objects
- Zod schemas via `schema.toJSONSchema()`
- MongoDB collection validators using `{ validator: { $jsonSchema: mongoSchema } }`