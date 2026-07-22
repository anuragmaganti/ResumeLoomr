import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SOURCE_DIRECTORIES = ['src', 'api', 'server', 'tests', 'scripts'];
const STANDALONE_SOURCE_FILES = [
  'eslint.config.js',
  'vite.config.js',
  'public/sync-worker.js',
];
const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.mjs']);
const RESOLVABLE_EXTENSIONS = ['.js', '.jsx', '.mjs', '.json', '.css'];
const ENTRYPOINTS = [
  'src/main.jsx',
  'api/import-resume.js',
  'api/sync-session.js',
  'api/sync-workspace.js',
  'public/sync-worker.js',
];
const SERVER_ENTRYPOINTS = ENTRYPOINTS.filter((path) => path.startsWith('api/'));

function toRepositoryPath(path) {
  return relative(ROOT, path).replaceAll('\\', '/');
}

function walkSourceFiles(directory) {
  const files = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...walkSourceFiles(path));
    } else if (SOURCE_EXTENSIONS.has(extname(entry.name))) {
      files.push(path);
    }
  }

  return files;
}

function extractImportSpecifiers(source) {
  const specifiers = new Set();
  const staticImportPattern = /\b(?:import|export)\s+(?:(?:[\w*$\s{},]+)\s+from\s+)?(['"])([^'"]+)\1/g;
  const dynamicImportPattern = /\bimport\s*\(\s*(['"])([^'"]+)\1\s*\)/g;
  const requirePattern = /\brequire\s*\(\s*(['"])([^'"]+)\1\s*\)/g;

  for (const pattern of [staticImportPattern, dynamicImportPattern, requirePattern]) {
    for (const match of source.matchAll(pattern)) {
      specifiers.add(match[2]);
    }
  }

  return [...specifiers];
}

function resolveRelativeImport(importerPath, specifier) {
  const cleanSpecifier = specifier.split(/[?#]/, 1)[0];
  const basePath = resolve(dirname(importerPath), cleanSpecifier);
  const candidates = [
    basePath,
    ...RESOLVABLE_EXTENSIONS.map((extension) => `${basePath}${extension}`),
    ...RESOLVABLE_EXTENSIONS.map((extension) => resolve(basePath, `index${extension}`)),
  ];

  return candidates.find((candidate) => (
    existsSync(candidate) && statSync(candidate).isFile()
  ));
}

function collectReachable(graph, entrypoint) {
  const reachable = new Set();
  const pending = [entrypoint];

  while (pending.length > 0) {
    const current = pending.pop();

    if (reachable.has(current)) {
      continue;
    }

    reachable.add(current);
    for (const dependency of graph.get(current) ?? []) {
      pending.push(dependency);
    }
  }

  return reachable;
}

function findCycles(graph) {
  const state = new Map();
  const cycles = new Set();

  function visit(module, stack) {
    state.set(module, 'visiting');
    stack.push(module);

    for (const dependency of graph.get(module) ?? []) {
      if (!graph.has(dependency)) {
        continue;
      }

      if (state.get(dependency) === 'visiting') {
        const cycleStart = stack.indexOf(dependency);
        cycles.add([...stack.slice(cycleStart), dependency].join(' -> '));
      } else if (!state.has(dependency)) {
        visit(dependency, stack);
      }
    }

    stack.pop();
    state.set(module, 'visited');
  }

  for (const module of graph.keys()) {
    if (!state.has(module)) {
      visit(module, []);
    }
  }

  return [...cycles];
}

const errors = [];
const sourceFiles = [
  ...SOURCE_DIRECTORIES.flatMap((directory) => (
    walkSourceFiles(resolve(ROOT, directory))
  )),
  ...STANDALONE_SOURCE_FILES.map((path) => resolve(ROOT, path)),
];
const graph = new Map();
let relativeImportCount = 0;

for (const sourceFile of sourceFiles) {
  const module = toRepositoryPath(sourceFile);
  const dependencies = new Set();
  const source = readFileSync(sourceFile, 'utf8');

  for (const specifier of extractImportSpecifiers(source)) {
    if (!specifier.startsWith('.')) {
      continue;
    }

    relativeImportCount += 1;
    const resolvedImport = resolveRelativeImport(sourceFile, specifier);

    if (!resolvedImport) {
      errors.push(`${module}: unresolved relative import ${specifier}`);
      continue;
    }

    const dependency = toRepositoryPath(resolvedImport);
    if (dependency.startsWith('../')) {
      errors.push(`${module}: relative import escapes the repository (${specifier})`);
      continue;
    }

    if (SOURCE_EXTENSIONS.has(extname(resolvedImport))) {
      dependencies.add(dependency);
    }
  }

  graph.set(module, dependencies);
}

for (const entrypoint of ENTRYPOINTS) {
  if (!existsSync(resolve(ROOT, entrypoint))) {
    errors.push(`missing deployment entrypoint: ${entrypoint}`);
  }
}

for (const cycle of findCycles(graph)) {
  errors.push(`circular dependency: ${cycle}`);
}

const clientReachable = collectReachable(graph, 'src/main.jsx');
for (const module of clientReachable) {
  if (module.startsWith('api/') || module.startsWith('server/')) {
    errors.push(`client entrypoint reaches server-only module: ${module}`);
  }
}

for (const entrypoint of SERVER_ENTRYPOINTS) {
  for (const module of collectReachable(graph, entrypoint)) {
    if (
      module === 'src/App.jsx'
      || module === 'src/main.jsx'
      || module.startsWith('src/components/')
      || module.startsWith('src/hooks/')
    ) {
      errors.push(`${entrypoint} reaches browser UI module: ${module}`);
    }
  }
}

if (errors.length > 0) {
  console.error('Architecture verification failed:\n');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    `Architecture verified: ${sourceFiles.length} modules, `
    + `${relativeImportCount} relative imports, no cycles or runtime-boundary violations.`,
  );
}
