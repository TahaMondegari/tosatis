// Codemod: wrap user-facing Persian strings in tr().  node scripts/i18n-wrap.cjs <i18nModuleAbsPath(no ext)> <files...>
// Templates `..${a}..` become tr('..{0}..', a). Skips data-like uses (comparisons, regexes, keys, types, digit maps).
const ts = require('../web/node_modules/typescript');
const fs = require('fs');
const path = require('path');
const FA = /[؀-ۿ]/;
const SKIP_CALLS = new Set(['includes', 'test', 'startsWith', 'endsWith', 'replace', 'replaceAll', 'split', 'match', 'indexOf', 'has', 'get', 'set', 'delete', 'getItem', 'setItem', 'tr', 'RegExp', 'prepare', 'exec', 'push']);
const [mod, ...files] = process.argv.slice(2);

function skip(n) {
  const p = n.parent;
  if (!p) return true;
  if (/^[\s۰-۹٠-٩٫،]+$/.test(n.text ?? '')) return true;
  if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isLiteralTypeNode(p) || ts.isCaseClause(p)) return true;
  if ((ts.isPropertyAssignment(p) || ts.isPropertySignature(p) || ts.isEnumMember(p)) && p.name === n) return true;
  if (ts.isElementAccessExpression(p) && p.argumentExpression === n) return true;
  if (ts.isBinaryExpression(p) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken].includes(p.operatorToken.kind)) return true;
  if ((ts.isCallExpression(p) || ts.isNewExpression(p)) && p.expression !== n) {
    const callee = p.expression;
    const name = ts.isPropertyAccessExpression(callee) ? callee.name.text : ts.isIdentifier(callee) ? callee.text : '';
    if (SKIP_CALLS.has(name)) return true;
  }
  return false;
}

const lit = (s) => JSON.stringify(s);

function transform(file) {
  const src = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  let changed = 0;

  // Render a node's source with replacements applied to its descendants.
  function render(n) {
    const rep = replacement(n);
    if (rep != null) { changed++; return rep; }
    const kids = n.getChildren(sf).filter((k) => !ts.isJSDoc(k) && k.kind !== ts.SyntaxKind.JSDocComment);
    if (!kids.length) return n.getText(sf);
    let out = '', pos = n.getStart(sf);
    for (const k of kids) {
      const ks = k.getStart(sf);
      out += src.slice(pos, ks) + render(k);
      pos = k.end;
    }
    return out + src.slice(pos, n.end);
  }

  function replacement(n) {
    if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && FA.test(n.text) && !skip(n)) {
      const call = `tr(${lit(n.text)})`;
      return n.parent && ts.isJsxAttribute(n.parent) ? `{${call}}` : call;
    }
    if (ts.isJsxText(n) && FA.test(n.text) && n.text.trim()) {
      const raw = n.text;
      const lead = /^[ \t]+\S/.test(raw) && !/^\s*\n/.test(raw) ? "{' '}" : '';
      const trail = /\S[ \t]+$/.test(raw) && !/\n\s*$/.test(raw) ? "{' '}" : '';
      return `${lead}{tr(${lit(raw.trim().replace(/\s+/g, ' '))})}${trail}`;
    }
    if (ts.isTemplateExpression(n) && FA.test(n.getText(sf)) && !skip(n)) {
      let s = n.head.text;
      const args = [];
      n.templateSpans.forEach((sp, i) => { s += `{${i}}` + sp.literal.text; args.push(render(sp.expression)); });
      if (!FA.test(s)) return null;
      return `tr(${lit(s)}${args.map((a) => `, ${a}`).join('')})`;
    }
    return null;
  }

  let out = render(sf);
  if (!changed) return 0;
  // Leading trivia before the first statement is kept by render(sf) via getStart → prepend header comments
  out = src.slice(0, sf.getStart(sf)) + out;
  let rel = path.relative(path.dirname(file), mod).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = './' + rel;
  if (!/import\s*\{[^}]*\btr\b[^}]*\}\s*from/.test(out)) {
    const ext = file.includes(`${path.sep}server${path.sep}`) || file.includes('/server/') ? '.ts' : '';
    const imp = `import { tr } from '${rel}${ext}';\n`;
    const m = out.match(/^(?:(?:\/\/.*|\/\*[\s\S]*?\*\/)\s*\n)*(?:import[\s\S]*?;\s*\n)*/);
    const at = m ? m[0].length : 0;
    out = out.slice(0, at) + imp + out.slice(at);
  }
  fs.writeFileSync(file, out);
  return changed;
}

let total = 0;
for (const f of files) { const c = transform(path.resolve(f)); if (c) console.log(c.toString().padStart(4), f); total += c; }
console.log('wrapped', total);
