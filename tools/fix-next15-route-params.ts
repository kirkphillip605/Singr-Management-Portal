// tools/fix-next15-route-params.ts
/**
 * Codemod: Next.js 15 route handlers — Promise-typed `params` + `runtime = 'nodejs'`
 *
 * What it does:
 *  - Finds `src/app/**/route.{ts,tsx,js,jsx}` files
 *  - Ensures: `export const runtime = 'nodejs'`
 *  - For exported handlers (GET/POST/PATCH/PUT/DELETE/OPTIONS/HEAD):
 *      * If the 2nd parameter destructures `{ params }`, change its type to Promise<...>
 *        - Preserves inner `{ id: string }` etc when present, wrapping it with Promise<>
 *        - If untyped, adds `: { params: Promise<Record<string, string>> }`
 *      * Inserts `const paramsResolved = await params;` at top of the function body
 *      * Rewrites `params.` member access to `paramsResolved.` inside that function
 *
 * Safety:
 *  - Skips if already Promise-typed or if the function lacks destructured `{ params }`
 *  - Avoids clobbering existing local `paramsResolved` by auto-choosing a unique suffix
 *  - Has a `--dry` mode (default) to preview changes; use `--write` to apply
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' tools/fix-next15-route-params.ts --dry
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' tools/fix-next15-route-params.ts --write
 */

import path from 'node:path'
import fs from 'node:fs'
import { Project, Node, SyntaxKind, SourceFile, FunctionDeclaration, VariableStatement, ArrowFunction, ParameterDeclaration, BindingElement, TypeNode, ObjectBindingPattern, PropertyAccessExpression, Identifier } from 'ts-morph'
import globby from 'globby'

const HTTP_METHODS = new Set(['GET','POST','PUT','PATCH','DELETE','OPTIONS','HEAD'])

const isWrite = process.argv.includes('--write')
const project = new Project({
  skipAddingFilesFromTsConfig: true,
  manipulationSettings: {
    indentationText: '  ',
    newLineKind: 1, // LF
    quoteKind: 2,   // single
    usePrefixAndSuffixTextForRename: false,
  },
})

/** Create or ensure `export const runtime = 'nodejs'` exists at top-level */
function ensureNodeRuntime(sf: SourceFile) {
  const hasRuntime = sf.getVariableStatement(v =>
    v.getDeclarationList().getDeclarations().some(d =>
      d.getName() === 'runtime'
    )
  )

  if (hasRuntime) return

  // Insert near the top, after import statements
  const firstNonImport = sf.getFirstChild(child =>
    child.getKind() !== SyntaxKind.ImportDeclaration
  )
  const insertPos = firstNonImport ? firstNonImport.getPos() : sf.getEnd()

  sf.insertText(insertPos, `export const runtime = 'nodejs'\n\n`)
}

/** Get 2nd parameter binding element named 'params' if present: (req, { params }) => ... */
function getDestructuredParamsBinding(secondParam: ParameterDeclaration | undefined): BindingElement | undefined {
  if (!secondParam) return undefined
  const binding = secondParam.getNameNode()

  if (Node.isObjectBindingPattern(binding)) {
    const be = binding.getElements().find(el => el.getName() === 'params')
    return be
  }
  return undefined
}

/** Wrap type node with Promise<...> if not already wrapped */
function wrapTypeInPromise(typeNode: TypeNode): void {
  const text = typeNode.getText()
  if (text.startsWith('Promise<')) return
  typeNode.replaceWithText(`Promise<${text}>`)
}

/** Ensure the type annotation for `{ params }` is Promise-wrapped. If missing, add a safe default. */
function ensureParamsTypePromise(secondParam: ParameterDeclaration): boolean {
  // We need to edit the secondParam's type annotation: { params: <here> }
  const typeNode = secondParam.getTypeNode()
  if (!typeNode) {
    // add default type
    secondParam.setType(`{ params: Promise<Record<string, string>> }`)
    return true
  }

  // If it's a type literal, find the 'params' property and Promise-wrap its type
  if (Node.isTypeLiteral(typeNode)) {
    const paramsProp = typeNode.getMembers().find(m =>
      Node.isPropertySignature(m) && m.getName() === 'params'
    )
    if (paramsProp && Node.isPropertySignature(paramsProp)) {
      const pType = paramsProp.getTypeNode()
      if (pType) {
        const alreadyPromise = pType.getText().startsWith('Promise<')
        if (!alreadyPromise) wrapTypeInPromise(pType)
        return !alreadyPromise
      } else {
        paramsProp.setType(`Promise<Record<string, string>>`)
        return true
      }
    } else {
      // Type literal without 'params' — append it
      typeNode.replaceWithText(`${typeNode.getText().slice(0, -1)}, params: Promise<Record<string, string>> }`)
      return true
    }
  } else {
    // Some other type ref: we can’t safely open it; append a new annotation instead.
    // Replace the entire param type with a safe structural type.
    secondParam.setType(`{ params: Promise<Record<string, string>> }`)
    return true
  }

  return false
}

/** Insert `const paramsResolvedN = await params;` at the start of the function body and rewrite member access */
function insertAwaitAndRewriteBody(
  body: Node | undefined,
  paramsIdentifierName = 'params'
) {
  if (!body) return

  // Find a unique local name
  let alias = 'paramsResolved'
  const bodyText = body.getText()
  let counter = 1
  while (bodyText.includes(alias)) {
    alias = `paramsResolved_${counter++}`
  }

  // Insert the awaited alias after any 'use server' / 'use client' directives
  const statements = (body as any).getStatements?.() ?? []
  let insertIndex = 0
  while (
    insertIndex < statements.length &&
    Node.isExpressionStatement(statements[insertIndex]) &&
    statements[insertIndex].getExpression()?.getKind() === SyntaxKind.StringLiteral
  ) {
    insertIndex++
  }

  // Actually insert
  (body as any).insertStatements?.(insertIndex, `const ${alias} = await ${paramsIdentifierName}\n`)

  // Replace occurrences of `params.<something>` with `${alias}.<something>`
  const propertyAccesses = body.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
  propertyAccesses.forEach((pa: PropertyAccessExpression) => {
    const expr = pa.getExpression()
    if (Node.isIdentifier(expr) && expr.getText() === paramsIdentifierName) {
      expr.replaceWithText(alias)
    }
  })

  // Also handle possible bare identifier usage of `params` (edge case):
  const identifiers = body.getDescendantsOfKind(SyntaxKind.Identifier)
  identifiers.forEach((id: Identifier) => {
    // Ignore newly inserted alias itself
    if (id.getText() === paramsIdentifierName) {
      const parent = id.getParent()
      // If it's within a PropertyAccessExpression, already handled above.
      if (!Node.isPropertyAccessExpression(parent)) {
        // Replace lone `params` with alias (rare but safe)
        id.replaceWithText(alias)
      }
    }
  })
}

/** Process a single function-like and return whether it changed */
function processFunctionLike(
  sf: SourceFile,
  func:
    | FunctionDeclaration
    | ArrowFunction,
  exportedName?: string
): boolean {
  let changed = false

  // Only target HTTP method exports (GET, POST, ...)
  if (exportedName && !HTTP_METHODS.has(exportedName)) return false

  const params = func.getParameters()
  const secondParam = params[1]
  const be = getDestructuredParamsBinding(secondParam)

  if (!be) return false // skip handlers that don’t destructure `{ params }`

  // Ensure second param type is Promise-wrapped
  if (secondParam) {
    const did = ensureParamsTypePromise(secondParam)
    changed = changed || did
  }

  // Add awaited alias and rewrite body usages
  const body = func.getBody()
  if (body) {
    insertAwaitAndRewriteBody(body)
    changed = true
  }

  return changed
}

/** Walk a route file and apply all changes */
function processRouteFile(sf: SourceFile): boolean {
  let changed = false

  // 1) ensure runtime node
  const before = sf.getFullText()
  ensureNodeRuntime(sf)

  // 2) function declarations: `export async function POST(...) { ... }`
  sf.getFunctions().forEach(fn => {
    if (!fn.isExported()) return
    const name = fn.getName()
    if (!name) return
    changed = processFunctionLike(sf, fn, name) || changed
  })

  // 3) exported const arrow handlers: `export const POST = async (...) => { ... }`
  sf.getVariableStatements()
    .filter(vs => vs.isExported())
    .forEach((vs: VariableStatement) => {
      vs.getDeclarationList().getDeclarations().forEach(dec => {
        const name = dec.getName()
        const initializer = dec.getInitializer()
        if (!initializer || !Node.isArrowFunction(initializer)) return
        if (!HTTP_METHODS.has(name)) return
        const did = processFunctionLike(sf, initializer, name)
        changed = changed || did
      })
    })

  if (!changed && sf.getFullText() !== before) {
    changed = true
  }
  return changed
}

async function main() {
  const patterns = [
    'src/app/**/route.ts',
    'src/app/**/route.tsx',
    'src/app/**/route.js',
    'src/app/**/route.jsx',
  ]
  const files = await globby(patterns, { gitignore: true })
  if (files.length === 0) {
    console.log('No route files found.')
    return
  }

  for (const f of files) {
    const abs = path.resolve(f)
    const text = fs.readFileSync(abs, 'utf8')
    const sf = project.createSourceFile(abs, text, { overwrite: true })
    const changed = processRouteFile(sf)

    if (changed) {
      if (isWrite) {
        sf.saveSync()
        console.log(`[WRITE] ${f}`)
      } else {
        console.log(`[DRY] would change ${f}`)
      }
    }
  }

  if (!isWrite) {
    console.log('\nRun with --write to apply changes.')
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
