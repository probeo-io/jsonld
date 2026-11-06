import { readFileSync, readdirSync } from 'node:fs';
import ts from 'typescript';
import { expect, it } from 'vitest';

it('keeps every compiled runtime module local and free of DOM or IO entry points', () => {
  const directory = new URL('../dist/', import.meta.url);
  for (const file of readdirSync(directory).filter(file => file.endsWith('.js'))) {
    const source = ts.createSourceFile(file, readFileSync(new URL(file, directory), 'utf8'), ts.ScriptTarget.Latest, true);
    const visit = (node: ts.Node): void => {
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) expect(node.moduleSpecifier.text, file).toMatch(/^\.\//);
      if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
        const expression = node.expression;
        if (ts.isIdentifier(expression)) expect(['require','fetch','XMLHttpRequest','DOMParser','Worker'], file).not.toContain(expression.text);
        expect(expression.kind, file).not.toBe(ts.SyntaxKind.ImportKeyword);
      }
      if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) expect(['window','document','process','globalThis'], file).not.toContain(node.expression.text);
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
});
