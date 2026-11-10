import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSync } from 'rolldown/utils';

const methods = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options']);
const normalize = route => route.replace(/\{[^}]*\}/g, '{}');
function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach(child => walk(child, visit)); return; }
  visit(node);
  for (const value of Object.values(node)) if (value && typeof value === 'object') walk(value, visit);
}

// Nested functions have their own parameters/this. Leave their calls to the
// fallback UNKNOWN pass rather than resolving them with the enclosing method.
function walkLocal(node, visit) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach(child => walkLocal(child, visit)); return; }
  visit(node);
  if (['FunctionExpression', 'ArrowFunctionExpression', 'FunctionDeclaration', 'ClassDeclaration', 'ClassExpression'].includes(node.type)) return;
  for (const value of Object.values(node)) if (value && typeof value === 'object') walkLocal(value, visit);
}

function bindingNames(pattern) {
  if (!pattern) return [];
  if (pattern.type === 'Identifier') return [pattern.name];
  if (pattern.type === 'AssignmentPattern') return bindingNames(pattern.left);
  if (pattern.type === 'RestElement') return bindingNames(pattern.argument);
  if (pattern.type === 'ArrayPattern') return pattern.elements.flatMap(bindingNames);
  if (pattern.type === 'ObjectPattern') return pattern.properties.flatMap(property =>
    bindingNames(property.type === 'RestElement' ? property.argument : property.value));
  return [];
}

// Resolve only explicit syntax. An unsupported endpoint expression is UNKNOWN,
// never guessed from a nearby literal or silently omitted.
function strings(node, bindings, parameters, seen = new Set()) {
  if (!node) return null;
  if (node.type === 'Literal' && typeof node.value === 'string') return [node.value];
  if (node.type === 'Identifier') {
    if (seen.has(node.name)) return null;
    if (bindings.has(node.name)) return strings(bindings.get(node.name), bindings, parameters, new Set([...seen, node.name]));
    return parameters.has(node.name) ? ['{}'] : null;
  }
  if (node.type === 'ConditionalExpression') {
    const a = strings(node.consequent, bindings, parameters, seen), b = strings(node.alternate, bindings, parameters, seen);
    return a && b ? [...a, ...b] : null;
  }
  if (node.type === 'TemplateLiteral') {
    let values = [node.quasis[0].value.cooked];
    for (let i = 0; i < node.expressions.length; i++) {
      const expression = node.expressions[i];
      const variants = values.every(value => value.includes('?')) ? ['{}'] : strings(expression, bindings, parameters, seen);
      if (!variants) return null;
      values = values.flatMap(value => variants.map(part => value + part + node.quasis[i + 1].value.cooked));
    }
    return values;
  }
  if (node.type === 'BinaryExpression' && node.operator === '+') {
    const a = strings(node.left, bindings, parameters, seen), b = strings(node.right, bindings, parameters, seen);
    return a && b ? a.flatMap(left => b.map(right => left + right)) : null;
  }
  if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' &&
    node.callee.object.type === 'ThisExpression' && node.callee.property.name === 'buildQuery') return ['', '?{}'];
  if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'encodeURIComponent' && node.arguments.length === 1) {
    return strings(node.arguments[0], bindings, parameters, seen);
  }
  return null;
}

export function extractApiRoutes(file, source) {
  const parsed = parseSync(file, source);
  if (parsed.errors.length) throw new Error(`Cannot parse ${file}`);
  const routes = [], unknown = [], handled = new Set();
  walk(parsed.program, node => {
    if (node.type !== 'MethodDefinition' || !node.value?.body) return;
    const bindings = new Map(), parameters = new Set(node.value.params.flatMap(bindingNames)), ambiguous = new Set();
    const declare = (name, initializer) => {
      if (bindings.has(name) || parameters.has(name)) ambiguous.add(name);
      bindings.set(name, initializer);
    };
    walkLocal(node.value.body, child => {
      if (child.type === 'VariableDeclarator') {
        for (const name of bindingNames(child.id)) declare(name, child.id.type === 'Identifier' ? child.init : null);
      }
      if (child.type === 'CatchClause') for (const name of bindingNames(child.param)) declare(name, null);
      if (child.type === 'FunctionDeclaration' || child.type === 'ClassDeclaration') {
        if (child.id) declare(child.id.name, null);
      }
      if (child.type === 'AssignmentExpression' && child.left.type === 'Identifier') bindings.set(child.left.name, null);
    });
    // Conservatively reject repeated/shadowed names instead of flattening scopes
    // and allowing an inner declaration to overwrite an outer endpoint.
    for (const name of ambiguous) bindings.set(name, null);
    walkLocal(node.value.body, child => {
      const callee = child.type === 'CallExpression' ? child.callee : null;
      if (callee?.type !== 'MemberExpression' || callee.object.type !== 'ThisExpression') return;
      const method = callee.computed ? callee.property.value : callee.property.name;
      if (!methods.has(method)) return;
      handled.add(child);
      const base = { file, clientMethod: node.key.name, method: method.toUpperCase(), line: source.slice(0, child.start).split('\n').length };
      const values = strings(child.arguments[0], bindings, parameters);
      if (!values || values.some(value => !value.startsWith('/api/'))) { unknown.push(base); return; }
      const paths = [...new Set(values.map(value => normalize(value.split('?')[0])))];
      for (const route of paths) routes.push({ ...base, path: route });
    });
  });
  walk(parsed.program, child => {
    const callee = child.type === 'CallExpression' ? child.callee : null;
    if (callee?.type !== 'MemberExpression' || callee.object.type !== 'ThisExpression' || handled.has(child)) return;
    const method = callee.computed ? callee.property.value : callee.property.name;
    if (methods.has(method) || (callee.computed && typeof method !== 'string')) {
      unknown.push({ file, method: typeof method === 'string' ? method.toUpperCase() : 'UNKNOWN', line: source.slice(0, child.start).split('\n').length });
    }
  });
  return { routes, unknown };
}

export function checkApiRoutes(root) {
  const spec = JSON.parse(readFileSync(path.join(root, 'specs/openapi.json'), 'utf8'));
  const exceptions = JSON.parse(readFileSync(path.join(root, 'specs/api-route-exceptions.json'), 'utf8'));
  const results = readdirSync(path.join(root, 'src/api')).filter(name => name.endsWith('.ts')).map(name =>
    extractApiRoutes('src/api/' + name, readFileSync(path.join(root, 'src/api', name), 'utf8')));
  const routes = results.flatMap(result => result.routes), unknown = results.flatMap(result => result.unknown);
  return validateRouteMatrix(routes, unknown, spec, exceptions);
}

export function validateRouteMatrix(routes, unknown, spec, exceptions) {
  const documented = new Set(Object.entries(spec.paths).flatMap(([route, item]) =>
    [...methods].filter(method => item[method]).map(method => method.toUpperCase() + ' ' + normalize(route))));
  const used = new Set(), mismatches = [];
  for (const route of routes) {
    if (documented.has(route.method + ' ' + route.path)) continue;
    const index = exceptions.findIndex(entry => entry.file === route.file && entry.clientMethod === route.clientMethod &&
      entry.method === route.method && normalize(entry.path) === route.path);
    if (index < 0 || !exceptions[index].reason || !exceptions[index].source || !exceptions[index].checkedAt) mismatches.push(route);
    else used.add(index);
  }
  const staleExceptions = exceptions.filter((_, i) => !used.has(i));
  return { routes, unknown, mismatches, staleExceptions, exceptionCount: used.size,
    ok: !unknown.length && !mismatches.length && !staleExceptions.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = checkApiRoutes(fileURLToPath(new URL('..', import.meta.url)));
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}
