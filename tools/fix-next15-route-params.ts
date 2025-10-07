// tools/fix-next15-route-params.ts
import path from 'node:path'
import fs from 'node:fs'
import {
  Project, Node, SyntaxKind, SourceFile, FunctionDeclaration,
  VariableStatement, ArrowFunction, ParameterDeclaration,
  BindingElement, TypeNode, PropertyAccessExpression, Identifier, IndentationText, NewLineKind, QuoteKind
} from 'ts-morph'

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

function ensureNodeRuntime(sf: SourceFile) {
  const hasRuntime = sf.getVariableStatement(v =>
    v.getDeclarationList().getDeclarations().some(d => d.getName() === 'runtime')
  )
  if (hasRuntime) return

  // insert after imports
  const imports = sf.getImportDeclarations()
  const insertPos = imports.length > 0 ? imports[imports.length - 1].getEnd() : 0
  sf.insertText(insertPos, `\nexport const runtime = 'nodejs'\n\n`)
}

function getDestructuredParamsBinding(secondParam: ParameterDeclaration | undefined): BindingElement | undefined {
  if (!secondParam) return undefined
  const nameNode = secondParam.getNameNode()
  if (Node.isObjectBindingPattern(nameNode)) {
    return nameNode.getElements().find(el => el.getName() === 'params')
  }
  return undefined
}

function wrapTypeInPromise(typeNode: TypeNode): void {
  const text = typeNode.getText()
  if (text.startsWith('Promise<')) return
  typeNode.replaceWithText(`Promise<${text}>`)
}

function ensureParamsTypePromise(secondParam: ParameterDeclaration): boolean {
  const typeNode = secondParam.getTypeNode()
  if (!typeNode) {
    secondParam.setType(`{ params: Promise<Record<string, string>> }`)
    return true
  }

  if (Node.isTypeLiteral(typeNode)) {
    const paramsProp = typeNode.getMembers().find(m => Node.isPropertySignature(m) && m.getName() === 'params')
    if (paramsProp && Node.isPropertySignature(paramsProp)) {
      const pType = paramsProp.getTypeNode()
      if (pType) {
        if (!pType.getText().startsWith('Promise<')) {
          wrapTypeInPromise(pType)
          return true
        }
        return false
      } else {
        paramsProp.setType(`Promise<Record<string, string>>`)
        return true
      }
    } else {
      const existing = typeNode.getText()
      const withoutBrace = existing.endsWith('}') ? existing.slice(0, -1) : existing
      typeNode.replaceWithText(`${withoutBrace}, params: Promise<Record<string, string>> }`)
      return true
    }
  } else {
    secondParam.setType(`{ params: Promise<Record<string, string>> }`)
    return true
  }
}

function insertAwaitAndRewriteBody(body: Node | undefined, paramsIdentifierName = 'params') {
  if (!body) return

  // unique alias
  let alias = 'paramsResolved'
  const bodyText = body.getText()
  let i = 1
  while (bodyText.includes(alias)) {
    alias = `paramsResolved_${i++}`
  }

  // insert after any "use server"/"use client"
  const statements = (body as any).getStatements?.() ?? []
  let insertIndex = 0
  while (
    insertIndex < statements.length &&
    Node.isExpressionStatement(statements[insertIndex]) &&
    statements[insertIndex].getExpression()?.getKind() === SyntaxKind.StringLiteral
  ) {
    insertIndex++
  }
  (body as any).insertStatements?.(insertIndex, `const ${alias} = await ${paramsIdentifierName}\n`)

  // params.foo -> paramsResolved.foo
  const propertyAccesses = body.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
  propertyAccesses.forEach((pa: PropertyAccessExpression) => {
    const expr = pa.getExpression()
    if (Node.isIdentifier(expr) && expr.getText() === paramsIdentifierName) {
      expr.replaceWithText(alias)
    }
  })

  // bare "params" -> alias (rare)
  const identifiers = body.getDescendantsOfKind(SyntaxKind.Identifier)
  identifiers.forEach((id: Identifier) => {
    if (id.getText() === paramsIdentifierName) {
      const parent = id.getParent()
      if (!Node.isPropertyAccessExpression(parent)) {
        id.replaceWithText(alias)
      }
    }
  })
}

function processFunctionLike(
  _sf: SourceFile,
  func: FunctionDeclaration | ArrowFunction,
  exportedName?: string
): boolean {
  let changed = false
  if (exportedName && !HTTP_METHODS.has(exportedName)) return false

  const params = func.getParameters()
  const secondParam = params[1]
  const be = getDestructuredParamsBinding(secondParam)
  if (!be) return false

  if (secondParam) {
    const did = ensureParamsTypePromise(secondParam)
    changed = changed || did
  }

  const body = func.getBody()
  if (body) {
    insertAwaitAndRewriteBody(body)
    changed = true
  }
  return changed
}

function processRouteFile(sf: SourceFile): boolean {
  let changed = false
  const before = sf.getFullText()

  ensureNodeRuntime(sf)

  sf.getFunctions().forEach(fn => {
    if (!fn.isExported()) return
    const name = fn.getName()
    if (!name) return
    changed = processFunctionLike(sf, fn, name) || changed
  })

  sf.getVariableStatements()
    .filter(vs => vs.isExported())
    .forEach((vs: VariableStatement) => {
      vs.getDeclarationList().getDeclarations().forEach(dec => {
        const name = dec.getName()
        const init = dec.getInitializer()
        if (!init || !Node.isArrowFunction(init)) return
        if (!HTTP_METHODS.has(name)) return
        const did = processFunctionLike(sf, init, name)
        changed = changed || did
      })
    })

  if (!changed && sf.getFullText() !== before) changed = true
  return changed
}

async function main() {
  // ESM-only globby; load it dynamically so ts-node CJS works
  const { globby } = await import('globby')

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
