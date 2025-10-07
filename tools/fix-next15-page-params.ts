// tools/fix-next15-page-params.ts
import path from 'node:path'
import fs from 'node:fs'
import {
  Project, Node, SyntaxKind, SourceFile, FunctionDeclaration,
  ParameterDeclaration, BindingElement, ArrowFunction, VariableStatement,
  IndentationText, NewLineKind, QuoteKind, PropertyAccessExpression, Identifier,
  ImportDeclaration
} from 'ts-morph'

type TargetKind = 'page' | 'layout'

const isWrite = process.argv.includes('--write')
const project = new Project({
  skipAddingFilesFromTsConfig: true,
  manipulationSettings: {
    indentationText: IndentationText.TwoSpaces,
    newLineKind: NewLineKind.LineFeed,
    quoteKind: QuoteKind.Single,
    usePrefixAndSuffixTextForRename: false,
  },
})

function routeLiteralFromFile(absFile: string, kind: TargetKind): string | null {
  // expect .../src/app/<segments>/(page|layout).tsx
  const parts = absFile.split(path.sep)
  const appIdx = parts.lastIndexOf('app')
  if (appIdx < 0) return null
  const tail = parts.slice(appIdx + 1) // after 'app'
  if (tail.length < 2) return null
  const fileName = tail[tail.length - 1]
  if (!fileName.startsWith(kind)) return null
  const segments = tail.slice(0, -1)
  return '/' + segments.join('/').replace(/\\/g, '/')
}

function getFirstParamDestructuredParams(fn: FunctionDeclaration | ArrowFunction): BindingElement | undefined {
  const first = fn.getParameters()[0]
  if (!first) return
  const nameNode = first.getNameNode()
  if (Node.isObjectBindingPattern(nameNode)) {
    return nameNode.getElements().find(el => el.getName() === 'params')
  }
}

function ensurePagePropsImport(sf: SourceFile) {
  // If there's already a named import PageProps from 'next', do nothing.
  const has = sf.getImportDeclarations().some((id: ImportDeclaration) =>
    id.getModuleSpecifierValue() === 'next' &&
    id.getNamedImports().some(n => n.getName() === 'PageProps')
  )
  if (has) return

  // Otherwise add it right after the last import or at top.
  const imports = sf.getImportDeclarations()
  const insertIndex = imports.length
  sf.insertImportDeclaration(insertIndex, {
    moduleSpecifier: 'next',
    namedImports: [{ name: 'PageProps' }],
  })
}

function rewriteSignatureToPageProps(
  sf: SourceFile,
  fn: FunctionDeclaration,
  routeLiteral: string
): boolean {
  const paramsBinding = getFirstParamDestructuredParams(fn)
  if (!paramsBinding) return false

  const firstParam = fn.getParameters()[0]
  if (!firstParam) return false

  // Replace the whole first parameter with "props: PageProps<'/route'>"
  firstParam.replaceWithText(`props: PageProps<'${routeLiteral}'>`)
  ensurePagePropsImport(sf)

  const body = fn.getBody()
  if (!body) return true

  // Create unique alias
  let alias = 'paramsResolved'
  const bodyText = body.getText()
  let i = 1
  while (bodyText.includes(alias)) alias = `paramsResolved_${i++}`

  // Insert "const alias = await props.params" after any "use server/client"
  const stmts = body.getStatements()
  let insertIndex = 0
  while (
    insertIndex < stmts.length &&
    Node.isExpressionStatement(stmts[insertIndex]) &&
    stmts[insertIndex].getExpression()?.getKind() === SyntaxKind.StringLiteral
  ) insertIndex++
  body.insertStatements(insertIndex, `const ${alias} = await props.params\n`)

  // params.foo -> alias.foo
  body.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).forEach((pa: PropertyAccessExpression) => {
    const expr = pa.getExpression()
    if (Node.isIdentifier(expr) && expr.getText() === 'params') {
      expr.replaceWithText(alias)
    }
  })

  // bare 'params' -> alias (rare)
  body.getDescendantsOfKind(SyntaxKind.Identifier).forEach((id: Identifier) => {
    if (id.getText() === 'params') {
      const parent = id.getParent()
      if (!Node.isPropertyAccessExpression(parent)) id.replaceWithText(alias)
    }
  })

  return true
}

function processFile(absFile: string, kind: TargetKind): boolean {
  const sf = project.createSourceFile(absFile, fs.readFileSync(absFile, 'utf8'), { overwrite: true })
  const routeLiteral = routeLiteralFromFile(absFile, kind)
  if (!routeLiteral) return false

  let changed = false
  const fns = sf.getFunctions().filter(fn => fn.isDefaultExport())
  for (const fn of fns) {
    const did = rewriteSignatureToPageProps(sf, fn, routeLiteral)
    changed = changed || did
  }
  if (changed && isWrite) sf.saveSync()
  return changed
}

async function main() {
  const { globby } = await import('globby')
  const patterns = [
    'src/app/**/page.ts',
    'src/app/**/page.tsx',
    'src/app/**/layout.ts',
    'src/app/**/layout.tsx',
  ]
  const files = await globby(patterns, { gitignore: true })
  if (files.length === 0) {
    console.log('No page/layout files found.')
    return
  }
  let any = false
  for (const f of files) {
    const kind: TargetKind = path.basename(f).startsWith('layout') ? 'layout' : 'page'
    const changed = processFile(path.resolve(f), kind)
    if (changed) {
      any = true
      console.log(isWrite ? `[WRITE] ${f}` : `[DRY] would change ${f}`)
    }
  }
  if (!any) {
    console.log('Nothing to change.')
  }
  if (!isWrite) console.log('\nRun with --write to apply changes.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
