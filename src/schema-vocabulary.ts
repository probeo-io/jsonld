import { SCHEMA_VOCABULARY_TYPES } from './schema-vocabulary-data.js';

const knownTypes = new Set(SCHEMA_VOCABULARY_TYPES.map(type => type.toLowerCase()));

/** Preserve the validator's case-insensitive matching; accept canonical Schema.org IRIs. */
export function schemaTypeName(type: string): string {
  return type.replace(/^(?:https?:\/\/schema\.org\/|schema:)/i, '');
}

export function isKnownSchemaType(type: string): boolean {
  return knownTypes.has(schemaTypeName(type).toLowerCase());
}
