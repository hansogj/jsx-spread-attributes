import * as vscode from "vscode";

import generate from "@babel/generator";
import * as parser from "@babel/parser";
import traverse from "@babel/traverse";
import * as t from "@babel/types";

const channel = vscode.window.createOutputChannel("concise-arrow");

const SUPPORTED_LANGS = [
  "javascript",
  "typescript",
  "javascriptreact",
  "typescriptreact",
] as const;

type SupportedLang = (typeof SUPPORTED_LANGS)[number];
const isSupported = (id: string): id is SupportedLang =>
  (SUPPORTED_LANGS as readonly string[]).includes(id);

const KIND_REMOVE = vscode.CodeActionKind.Refactor.append(
  "conciseArrow.removeBraces"
);
const KIND_ADD = vscode.CodeActionKind.Refactor.append(
  "conciseArrow.addBraces"
);

const TITLE_REMOVE = "Remove braces from arrow function";
const TITLE_ADD = "Add braces to arrow function";

interface ArrowMatch {
  node: t.ArrowFunctionExpression;
  range: vscode.Range;
  depth: number;
}

function nodeRange(
  node: t.Node,
  doc: vscode.TextDocument
): vscode.Range | null {
  const start = (node as { start?: number }).start;
  const end = (node as { end?: number }).end;
  if (typeof start === "number" && typeof end === "number") {
    return new vscode.Range(doc.positionAt(start), doc.positionAt(end));
  }
  if (node.loc) {
    return new vscode.Range(
      new vscode.Position(node.loc.start.line - 1, node.loc.start.column),
      new vscode.Position(node.loc.end.line - 1, node.loc.end.column)
    );
  }
  return null;
}

function canRemoveBraces(node: t.ArrowFunctionExpression): boolean {
  if (!t.isBlockStatement(node.body) || node.body.body.length !== 1) {
    return false;
  }
  const [stmt] = node.body.body;
  return (
    t.isExpressionStatement(stmt) ||
    (t.isReturnStatement(stmt) && stmt.argument !== null)
  );
}

function canAddBraces(node: t.ArrowFunctionExpression): boolean {
  return !t.isBlockStatement(node.body);
}

function cloneArrowShape(
  src: t.ArrowFunctionExpression,
  body: t.ArrowFunctionExpression["body"]
): t.ArrowFunctionExpression {
  const next = t.arrowFunctionExpression(src.params, body, src.async);
  next.returnType = src.returnType;
  next.typeParameters = src.typeParameters;
  next.generator = src.generator;
  return next;
}

function removeBraces(
  node: t.ArrowFunctionExpression
): t.ArrowFunctionExpression {
  const stmt = (node.body as t.BlockStatement).body[0];
  const expr = t.isReturnStatement(stmt)
    ? stmt.argument!
    : (stmt as t.ExpressionStatement).expression;
  return cloneArrowShape(node, expr);
}

function addBraces(
  node: t.ArrowFunctionExpression
): t.ArrowFunctionExpression {
  const block = t.blockStatement([
    t.returnStatement(node.body as t.Expression),
  ]);
  return cloneArrowShape(node, block);
}

function parse(doc: vscode.TextDocument): t.File | null {
  const isTs =
    doc.languageId === "typescript" || doc.languageId === "typescriptreact";
  try {
    return parser.parse(doc.getText(), {
      sourceType: "module",
      ranges: true,
      plugins: ["jsx", isTs ? "typescript" : ["flow", { all: true }]],
    });
  } catch {
    return null;
  }
}

function findArrow(
  ast: t.File,
  doc: vscode.TextDocument,
  selection: vscode.Range
): ArrowMatch | null {
  let best: ArrowMatch | null = null;
  let depth = 0;

  traverse(ast, {
    enter() {
      depth++;
    },
    exit() {
      depth--;
    },
    ArrowFunctionExpression: (path) => {
      const range = nodeRange(path.node, doc);
      if (!range || !range.intersection(selection)) {
        return;
      }
      if (!canRemoveBraces(path.node) && !canAddBraces(path.node)) {
        return;
      }
      if (!best || depth > best.depth) {
        best = { node: path.node, range, depth };
      }
    },
  });

  return best;
}

function buildAction(
  doc: vscode.TextDocument,
  range: vscode.Range,
  next: t.ArrowFunctionExpression,
  title: string,
  kind: vscode.CodeActionKind
): vscode.CodeAction {
  const action = new vscode.CodeAction(title, kind);
  action.edit = new vscode.WorkspaceEdit();
  action.edit.replace(doc.uri, range, generate(next).code);
  return action;
}

export class ConciseArrowProvider implements vscode.CodeActionProvider {
  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection
  ): vscode.CodeAction[] {
    if (!isSupported(document.languageId)) {
      return [];
    }

    const ast = parse(document);
    if (!ast) {
      return [];
    }

    const match = findArrow(ast, document, range);
    if (!match) {
      return [];
    }

    channel.appendLine(
      `match at depth ${match.depth} (${document.languageId})`
    );

    const actions: vscode.CodeAction[] = [];
    if (canRemoveBraces(match.node)) {
      actions.push(
        buildAction(
          document,
          match.range,
          removeBraces(match.node),
          TITLE_REMOVE,
          KIND_REMOVE
        )
      );
    }
    if (canAddBraces(match.node)) {
      actions.push(
        buildAction(
          document,
          match.range,
          addBraces(match.node),
          TITLE_ADD,
          KIND_ADD
        )
      );
    }
    return actions;
  }
}

function runCommand(
  provider: ConciseArrowProvider,
  kind: vscode.CodeActionKind,
  emptyMessage: string
): () => void {
  return () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }
    const actions = provider.provideCodeActions(
      editor.document,
      editor.selection
    );
    const action = actions.find((a) => a.kind?.value === kind.value);
    if (action?.edit) {
      vscode.workspace.applyEdit(action.edit);
    } else {
      vscode.window.showInformationMessage(emptyMessage);
    }
  };
}

export function activate(context: vscode.ExtensionContext): void {
  channel.appendLine("concise-arrow activated");

  const provider = new ConciseArrowProvider();
  const selectors: vscode.DocumentFilter[] = SUPPORTED_LANGS.flatMap(
    (language) => [
      { scheme: "file", language },
      { scheme: "untitled", language },
    ]
  );

  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(selectors, provider, {
      providedCodeActionKinds: [KIND_REMOVE, KIND_ADD],
    }),
    vscode.commands.registerCommand(
      "concise-arrow.removeBracesCommand",
      runCommand(
        provider,
        KIND_REMOVE,
        "No arrow function with a single-statement body at cursor."
      )
    ),
    vscode.commands.registerCommand(
      "concise-arrow.addBracesCommand",
      runCommand(
        provider,
        KIND_ADD,
        "No concise-body arrow function at cursor."
      )
    )
  );
}

export function deactivate(): void {
  channel.dispose();
}
