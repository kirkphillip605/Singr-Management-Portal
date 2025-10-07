// tools/fix-next15-page-params.ts
import path from 'node:path'
import fs from 'node:fs'
import {
  Project, Node, SyntaxKind, SourceFile, FunctionDeclaration,
  ParameterDeclaration, BindingElement, ArrowFunction, VariableStatement,
  IndentationText, NewLineKind, QuoteKind, PropertyAccessExpression, Identifier
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
  const appIdx = absFile.split(path.sep).lastIndexOf('app')
  if (appIdx < 0) return null
  const parts = absFile.split(path.sep).slice(appIdx + 1) // after 'app'
  if (parts.length < 2) return null
  const fileName = parts[parts.length - 1]
  if (!fileName.startsWith(kind)) return null
  const segments = parts.slice(0, -1)
  return '/' + segments.join('/').replace(/\\/g, '/')
}

function hasDefaultExportFunc(sf: SourceFile) {
  return !!sf.getFunctions().find(f => f.isDefaultExport()) ||
         !!sf.getVariableStatements().find(v =>
            v.isExported() &&
            v.getDeclarationList().getDeclarations().some(d =>
              d.hasExportKeyword() && d.getName() === 'default'
            )
          )
}

function getDefaultExport(
  sf: SourceFile
): { kind: 'func'|'arrow', node: FunctionDeclaration | ArrowFunction } | null {
  const f = sf.getFunctions().find(fn => fn.isDefaultExport())
  if (f) return { kind: 'func', node: f }
  // Also look for: export default const X = (props) => {}
  const esmDefault = sf.getExportAssignments().find(ea => ea.isExportEquals() === false)
  if (esmDefault) {
    // Not rewriting export default <expr>; too many shapes — skip
    return null
  }
  // Common pattern: export default function Page(...) { ... }
  return null
}

function getFirstParamDestructuredParams(fn: FunctionDeclaration | ArrowFunction): BindingElement | undefined {
  const first = fn.getParameters()[0]
  if (!first) return
  const nameNode = first.getNameNode()
  if (Node.isObjectBindingPattern(nameNode)) {
    return nameNode.getElements().find(el => el.getName() === 'params')
  }
}

function rewriteSignatureToPageProps(
  sf: SourceFile,
  fn: FunctionDeclaration,
  routeLiteral: string
): boolean {
  const paramsBinding = getFirstParamDestructuredParams(fn)
  if (!paramsBinding) return false

  // Make the parameter a single 'props: PageProps<"/route">'
  const firstParam = fn.getParameters()[0]
  firstParam.setName('props')
  firstParam.setType(`PageProps<'${routeLiteral}'>`)

  // Insert an awaited alias and rewrite params usages
  const body = fn.getBody()
  if (!body) return true

  // unique alias
  let alias = 'paramsResolved'
  const bodyText = body.getText()
  let i = 1
  while (bodyText.includes(alias)) alias = `paramsResolved_${i++}`

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

  // Ensure import for PageProps (it’s global in types, but some users prefer explicit)
  // Not strictly required; Next exposes PageProps globally. We'll skip adding imports.

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
  if (!isWrite) console.log('\nRun with --write to apply changes.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
