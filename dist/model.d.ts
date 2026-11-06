import { PROPERTY_DEFINITIONS } from './schema-model-data.js';
export declare function ancestors(type: string): ReadonlySet<string>;
export declare const isA: (actual: string, expected: string) => boolean;
export declare function propertyDefinition(name: string): typeof PROPERTY_DEFINITIONS[string] | undefined;
export declare function enumerationTypes(value: string): readonly string[];
//# sourceMappingURL=model.d.ts.map