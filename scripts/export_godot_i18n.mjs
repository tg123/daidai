/**
 * Export all registered i18n locale dictionaries to godot/assets/i18n.json.
 *
 * Uses the installed TypeScript compiler API to parse src/i18n/*.ts files and
 * extract the exact string values that registerLocale() would receive at
 * runtime — escape sequences, emoji, and Unicode content are all resolved
 * correctly by the TS parser.
 *
 * Usage:  node scripts/export_godot_i18n.mjs
 */

import { createRequire } from 'module';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

const LOCALE_DIR = join(ROOT, 'src', 'i18n');
const OUT_DIR = join(ROOT, 'godot', 'assets');
const OUT_FILE = join(OUT_DIR, 'i18n.json');

/** Ordered list matching LocaleCode in src/i18n/index.ts */
const LOCALE_NAMES = [
    'zh-cn',
    'zh-tw',
    'en-us',
    'ja-jp',
    'ko-kr',
    'es-es',
    'fr-fr',
    'it-it',
    'de-de',
    'pt-br',
    'pl-pl',
    'ru-ru',
    'th-th',
];

/**
 * Parse one locale TS file and return { localeCode, dict }.
 * Looks for:  registerLocale(<StringLiteral>, <ObjectLiteralExpression>)
 * Keys may be StringLiterals or Identifiers; values must be StringLiterals.
 *
 * @param {string} filePath
 * @returns {{ localeCode: string, dict: Record<string,string> } | null}
 */
function extractLocale(filePath) {
    const source = readFileSync(filePath, 'utf-8');
    const sf = ts.createSourceFile(
        filePath,
        source,
        ts.ScriptTarget.ES2022,
        /* setParentNodes */ true,
        ts.ScriptKind.TS,
    );

    let localeCode = null;
    let dict = null;

    /** Depth-first visitor */
    function visit(node) {
        if (
            ts.isCallExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === 'registerLocale' &&
            node.arguments.length === 2 &&
            ts.isStringLiteral(node.arguments[0]) &&
            ts.isObjectLiteralExpression(node.arguments[1])
        ) {
            localeCode = node.arguments[0].text;
            const obj = node.arguments[1];
            dict = {};
            for (const prop of obj.properties) {
                if (!ts.isPropertyAssignment(prop)) continue;
                // Value must be a plain string literal
                if (!ts.isStringLiteral(prop.initializer)) continue;
                const val = prop.initializer.text; // already unescaped by TS
                // Key: quoted string or bare identifier
                let key;
                if (ts.isStringLiteral(prop.name)) {
                    key = prop.name.text;
                } else if (ts.isIdentifier(prop.name)) {
                    key = prop.name.text;
                } else {
                    continue;
                }
                dict[key] = val;
            }
            // Stop searching once we found the call
            return;
        }
        ts.forEachChild(node, visit);
    }

    visit(sf);
    return localeCode && dict ? { localeCode, dict } : null;
}

// ── Main ────────────────────────────────────────────────────────────────────

mkdirSync(OUT_DIR, { recursive: true });

const result = {};
let totalKeys = 0;
const errors = [];

for (const name of LOCALE_NAMES) {
    const filePath = join(LOCALE_DIR, name + '.ts');
    let parsed;
    try {
        parsed = extractLocale(filePath);
    } catch (err) {
        errors.push(`${name}: ${err.message}`);
        continue;
    }

    if (!parsed) {
        errors.push(`${name}: registerLocale() call not found in ${filePath}`);
        continue;
    }

    const { localeCode, dict } = parsed;
    const keyCount = Object.keys(dict).length;

    if (localeCode !== name) {
        // Warn but still use the code declared in the file
        console.warn(`  [warn] file name "${name}" doesn't match registered code "${localeCode}"`);
    }

    result[localeCode] = dict;
    totalKeys += keyCount;
    console.log(`  [ok]  ${localeCode}  (${keyCount} keys)`);
}

if (errors.length > 0) {
    console.error('\nErrors:');
    for (const e of errors) console.error('  ' + e);
    process.exit(1);
}

writeFileSync(OUT_FILE, JSON.stringify(result, null, 2) + '\n', 'utf-8');

console.log(
    `\nWritten → ${OUT_FILE}` + `\n  ${Object.keys(result).length} locales, ${totalKeys} total key-value pairs`,
);
