// Lists every Persian string literal / JSX text / template in the given TS(X) files.
// Usage: node scripts/i18n-extract.cjs <files...>  → prints JSON {file: [{kind, text}]}
const ts = require('../web/node_modules/typescript');
const fs = require('fs');
const FA = /[؀-ۿ]/;

function scan(file) {
  const src = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out = [];
  const visit = (n) => {
    if (ts.isImportDeclaration(n) || ts.isRegularExpressionLiteral(n)) return;
    if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && FA.test(n.text)) out.push({ kind: 'str', text: n.text, pos: n.getStart() });
    else if (ts.isJsxText(n) && FA.test(n.text) && n.text.trim()) out.push({ kind: 'jsx', text: n.text.trim(), pos: n.getStart() });
    else if (ts.isTemplateExpression(n) && FA.test(n.getText())) {
      let s = n.head.text; n.templateSpans.forEach((sp, i) => { s += `{${i}}` + sp.literal.text; });
      out.push({ kind: 'tpl', text: s, pos: n.getStart() });
      n.templateSpans.forEach((sp) => visit(sp.expression));
      return;
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}
const res = {};
for (const f of process.argv.slice(2)) res[f] = scan(f);
const all = new Set(Object.values(res).flat().map((x) => x.text));
console.error('files', Object.keys(res).length, 'occurrences', Object.values(res).flat().length, 'unique', all.size);
process.stdout.write(JSON.stringify([...all], null, 0));
