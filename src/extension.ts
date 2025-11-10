import * as vscode from "vscode";

import generate from "@babel/generator";
import * as parser from "@babel/parser";
import traverse from "@babel/traverse";
import * as t from "@babel/types";

// Output channel for diagnostic logging (temporary; useful when debugging why
// the refactor doesn't appear). Users can open the Output panel and select
// "jsx-spread-attributes" to see logs.
const outputChannel = vscode.window.createOutputChannel(
  "jsx-spread-attributes"
);

const CODE_ACTION_TITLES = {
  toSpread: "Convert Attributes to Spread Object",
  fromSpread: "Convert Spread to Attributes",
};
const REFACTOR_KINDS = {
  toSpread: vscode.CodeActionKind.Refactor.append("jsx.convertAttrToSpread"),
  fromSpread: vscode.CodeActionKind.Refactor.append("jsx.convertSpreadToAttr"),
};

/**
 * Parses the JSX tag's attributes into a single spread object expression.
 * @param jsxElement The Babel AST node for the JSX opening element.
 * @returns The rewritten element as a string.
 */
function rewriteSpreadToAttributes(jsxElement: t.JSXOpeningElement): string {
  const componentName = generate(jsxElement.name).code;
  const spreadAttributes = jsxElement.attributes.filter((attr) =>
    t.isJSXSpreadAttribute(attr)
  ) as t.JSXSpreadAttribute[];

  if (spreadAttributes.length === 0) {
    return generate(jsxElement).code;
  }

  const attribute = spreadAttributes[0];
  if (!t.isObjectExpression(attribute.argument)) {
    return generate(jsxElement).code;
  }

  const properties = attribute.argument.properties;
  const attributes: (t.JSXAttribute | t.JSXSpreadAttribute)[] = [];

  for (const prop of properties) {
    if (t.isObjectProperty(prop)) {
      let name: string;
      if (t.isIdentifier(prop.key)) {
        name = prop.key.name;
      } else if (t.isStringLiteral(prop.key)) {
        name = prop.key.value;
      } else {
        // Skip properties with complex keys
        continue;
      }

      if (t.isExpression(prop.value)) {
        const value = prop.value;
        if (t.isIdentifier(value) && value.name === name) {
          // For shorthand properties like { x } -> x
          attributes.push(t.jsxAttribute(t.jsxIdentifier(name), null));
        } else if (t.isBooleanLiteral(value) && value.value === true) {
          // For boolean true -> attribute with no value
          attributes.push(t.jsxAttribute(t.jsxIdentifier(name), null));
        } else if (t.isStringLiteral(value)) {
          // For string literals -> attribute="value"
          attributes.push(
            t.jsxAttribute(t.jsxIdentifier(name), t.stringLiteral(value.value))
          );
        } else {
          // For other expressions -> attribute={expression}
          attributes.push(
            t.jsxAttribute(
              t.jsxIdentifier(name),
              t.jsxExpressionContainer(value)
            )
          );
        }
      }
    }
  }

  const newJsxElement = t.jsxOpeningElement(
    jsxElement.name,
    attributes,
    jsxElement.selfClosing
  );

  return generate(newJsxElement).code;
}

function rewriteAttributesToSpread(jsxElement: t.JSXOpeningElement): string {
  const componentName = generate(jsxElement.name).code;
  const attributes = jsxElement.attributes;

  try {
    outputChannel.appendLine(
      `Converting attributes for ${componentName} (${attributes.length} attributes)`
    );
  } catch (e) {
    // ignore logging errors
  }

  // 1. Collect all properties and existing spread objects
  const regularProperties: t.ObjectProperty[] = [];
  const existingSpreadObjects: t.Expression[] = [];

  for (const attr of attributes) {
    if (t.isJSXAttribute(attr)) {
      // Get the attribute name, handling both simple identifiers and namespaced names
      const attrName = t.isJSXIdentifier(attr.name)
        ? attr.name.name
        : generate(attr.name).code;

      let value: t.Expression;

      if (attr.value === null) {
        // Handle attributes with no value (e.g., <Comp disabled />)
        // These implicitly mean attrName={true}
        value = t.booleanLiteral(true);
      } else if (t.isStringLiteral(attr.value)) {
        // Handle string literals (e.g., attr="value")
        value = t.stringLiteral(attr.value.value);
      } else if (t.isJSXExpressionContainer(attr.value)) {
        // Handle expression containers (e.g., attr={value})
        if (t.isJSXEmptyExpression(attr.value.expression)) {
          // Empty expression container is not valid, skip or handle error
          continue;
        }
        value = attr.value.expression;
      } else {
        // Should not happen for standard JSX, but as fallback
        continue;
      }

      // Create property key based on whether the attribute name contains special characters
      const propertyKey = attrName.includes("-")
        ? t.stringLiteral(attrName) // Use string literal for names with hyphens
        : t.identifier(attrName); // Use identifier for simple names

      const property = t.objectProperty(propertyKey, value);
      regularProperties.push(property);
    } else if (t.isJSXSpreadAttribute(attr)) {
      // For spread attributes, extract the object expression if possible
      if (t.isObjectExpression(attr.argument)) {
        // If it's an object literal, merge its properties
        regularProperties.push(
          ...(attr.argument.properties as t.ObjectProperty[])
        );
      } else {
        // If it's not a direct object literal, keep it as a spread element
        existingSpreadObjects.push(attr.argument);
      }
    }
  }

  // 2. Create the spread object with regular properties first
  const properties: (t.ObjectProperty | t.SpreadElement)[] = regularProperties;

  try {
    outputChannel.appendLine(
      `Converted ${regularProperties.length} regular properties and ${existingSpreadObjects.length} spread objects`
    );
  } catch (e) {
    // ignore logging errors
  }

  // 3. Add any existing spread expressions that weren't object literals
  properties.push(...existingSpreadObjects.map((obj) => t.spreadElement(obj)));

  // Only create spread if we have properties
  if (properties.length === 0) {
    try {
      outputChannel.appendLine(
        `No properties to spread, returning original element`
      );
    } catch (e) {
      // ignore logging errors
    }
    return generate(jsxElement).code;
  }

  // 4. Create the new spread object expression
  const spreadObject = t.objectExpression(properties);
  const spreadAttribute = t.jsxSpreadAttribute(spreadObject);

  // 3. Create a new JSX opening element with only the new spread attribute
  const newOpeningElement = t.jsxOpeningElement(
    jsxElement.name,
    [spreadAttribute],
    jsxElement.selfClosing
  );

  // 4. Generate code for the new element structure
  // We only need the opening tag part, as we replace the entire tag content
  const generated = generate(
    newOpeningElement,
    {
      /* options */
    },
    ""
  ).code;

  return `<${generated.slice(1)}`;
}

interface ElementInfo {
  depth: number;
  node: t.JSXElement;
  openingElement: t.JSXOpeningElement;
  start: vscode.Position;
  end: vscode.Position;
  hasSpreadAttribute: boolean;
}

export class JsxAttrRefactorProvider implements vscode.CodeActionProvider {
  private findBestMatch(
    ast: t.File,
    document: vscode.TextDocument,
    selStartOffset: number,
    range: vscode.Range
  ): ElementInfo | null {
    let bestMatch: ElementInfo | null = null;
    let currentDepth = 0;

    traverse(ast, {
      enter() {
        currentDepth++;
      },
      exit() {
        currentDepth--;
      },
      JSXOpeningElement: (path) => {
        const node = path.node;
        const parentElement = path.parentPath?.node as t.JSXElement;
        if (!parentElement) {
          return;
        }

        // Get positions for the full JSX element (including children)
        let start: vscode.Position;
        let end: vscode.Position;
        const elemStart = (parentElement as any).start as number | undefined;
        const elemEnd = (parentElement as any).end as number | undefined;

        if (typeof elemStart === "number" && typeof elemEnd === "number") {
          start = document.positionAt(elemStart);
          end = document.positionAt(elemEnd);
        } else if (parentElement.loc) {
          start = new vscode.Position(
            parentElement.loc.start.line - 1,
            parentElement.loc.start.column
          );
          end = new vscode.Position(
            parentElement.loc.end.line - 1,
            parentElement.loc.end.column
          );
        } else {
          const nodeStart = ((node as any).start as number) ?? 0;
          const nodeEnd = ((node as any).end as number) ?? 0;
          start = document.positionAt(nodeStart);
          end = document.positionAt(nodeEnd);
        }

        // Check if cursor intersects with the element's full range
        const elementRange = new vscode.Range(start, end);
        if (!range.intersection(elementRange)) {
          return;
        }

        const hasSpreadAttr = node.attributes.some((attr) =>
          t.isJSXSpreadAttribute(attr)
        );
        const isEligible =
          (node.attributes.length > 1 && !hasSpreadAttr) || hasSpreadAttr;

        if (!isEligible) {
          return;
        }

        if (typeof elemStart === "number" && typeof elemEnd === "number") {
          start = document.positionAt(elemStart);
          end = document.positionAt(elemEnd);
        } else if (parentElement.loc) {
          start = new vscode.Position(
            parentElement.loc.start.line - 1,
            parentElement.loc.start.column
          );
          end = new vscode.Position(
            parentElement.loc.end.line - 1,
            parentElement.loc.end.column
          );
        } else {
          const nodeStart = ((node as any).start as number) ?? 0;
          const nodeEnd = ((node as any).end as number) ?? 0;
          start = document.positionAt(nodeStart);
          end = document.positionAt(nodeEnd);
        }

        try {
          outputChannel.appendLine(
            `Found opening element at depth ${currentDepth} with ${
              node.attributes.length
            } attributes${hasSpreadAttr ? " (has spread)" : ""}`
          );
        } catch (e) {
          // ignore logging errors
        }

        if (!bestMatch || currentDepth > bestMatch.depth) {
          bestMatch = {
            depth: currentDepth,
            node: parentElement,
            openingElement: node,
            start,
            end,
            hasSpreadAttribute: hasSpreadAttr,
          };
        }
      },
    });

    return bestMatch;
  }

  private isEligibleElement(node: t.JSXOpeningElement): boolean {
    const hasSpreadAttr = node.attributes.some((attr) =>
      t.isJSXSpreadAttribute(attr)
    );
    return (node.attributes.length > 1 && !hasSpreadAttr) || hasSpreadAttr;
  }

  private calculateElementRange(
    document: vscode.TextDocument,
    parentElement: t.JSXElement,
    node: t.JSXOpeningElement,
    nodeStartOffset?: number,
    nodeEndOffset?: number
  ): { start: vscode.Position; end: vscode.Position } {
    const elemStart = (parentElement as any).start as number | undefined;
    const elemEnd = (parentElement as any).end as number | undefined;

    if (typeof elemStart === "number" && typeof elemEnd === "number") {
      return {
        start: document.positionAt(elemStart),
        end: document.positionAt(elemEnd),
      };
    }

    if (parentElement.loc) {
      return {
        start: new vscode.Position(
          parentElement.loc.start.line - 1,
          parentElement.loc.start.column
        ),
        end: new vscode.Position(
          parentElement.loc.end.line - 1,
          parentElement.loc.end.column
        ),
      };
    }

    return {
      start: document.positionAt(nodeStartOffset ?? 0),
      end: document.positionAt(nodeEndOffset ?? 0),
    };
  }

  private generateFullElementCode(
    openingCode: string,
    element: t.JSXElement
  ): string {
    if (!element.closingElement) {
      return openingCode;
    }

    const childrenCode = element.children
      .map((child: t.Node) => generate(child).code)
      .join("");

    return openingCode + childrenCode + generate(element.closingElement).code;
  }

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.CodeAction[]> {
    // Diagnostic logging: show when provider is called and what was requested.
    try {
      outputChannel.appendLine(
        `provideCodeActions called - lang=${document.languageId} range=${
          range.start.line
        }:${range.start.character}-${range.end.line}:${
          range.end.character
        } only=${String(context.only)}`
      );
    } catch (e) {
      // best-effort logging
    }
    // 1. Check if the file type is relevant. Accept both React and plain
    // JavaScript/TypeScript so the provider works in `.js`/`.ts` files and
    // untitled editors where the language may be set to the plain variants.
    const languageId = document.languageId;
    const supportedLangs = [
      "javascriptreact",
      "typescriptreact",
      "javascript",
      "typescript",
    ];

    if (!supportedLangs.includes(languageId)) {
      return [];
    }

    const sourceCode = document.getText();
    let ast: t.File;

    try {
      // 2. Parse the document using Babel. Enable `ranges` so we can use
      // numeric offsets (node.start/node.end) which are more reliable when
      // matching VS Code selections than line/column conversions.
      try {
        outputChannel.appendLine(
          `Parsing ${languageId} file with ${sourceCode.length} characters`
        );
      } catch (e) {
        // ignore logging errors
      }

      ast = parser.parse(sourceCode, {
        sourceType: "module",
        ranges: true,
        plugins: [
          "jsx",
          languageId === "typescriptreact"
            ? "typescript"
            : ["flow", { all: true }],
        ],
      });
    } catch (e) {
      // Parsing failed (e.g., incomplete code), return no actions
      return [];
    }

    // Use the helper to find the best matching JSX element at the cursor
    const selStartOffset = document.offsetAt(range.start);
    const bestMatch = this.findBestMatch(ast, document, selStartOffset, range);

    if (!bestMatch) {
      return [];
    }

    const actions: vscode.CodeAction[] = [];
    const { hasSpreadAttribute, openingElement, node, start, end } = bestMatch!;

    // Check if we can offer the refactor based on the element state
    if (openingElement.attributes.length > 0) {
      // Always offer "Convert to Spread" if there are any regular attributes
      const hasRegularAttributes = openingElement.attributes.some((attr) =>
        t.isJSXAttribute(attr)
      );
      if (hasRegularAttributes) {
        const toSpreadAction = new vscode.CodeAction(
          CODE_ACTION_TITLES.toSpread,
          REFACTOR_KINDS.toSpread
        );

        const spreadCode = rewriteAttributesToSpread(openingElement);
        const fullSpreadCode = this.generateFullElementCode(spreadCode, node);

        toSpreadAction.edit = new vscode.WorkspaceEdit();
        toSpreadAction.edit.replace(
          document.uri,
          new vscode.Range(start, end),
          fullSpreadCode
        );
        actions.push(toSpreadAction);
      }

      // Offer "Convert to Attributes" only if there are spread attributes
      if (hasSpreadAttribute) {
        const toAttrAction = new vscode.CodeAction(
          CODE_ACTION_TITLES.fromSpread,
          REFACTOR_KINDS.fromSpread
        );

        const regularCode = rewriteSpreadToAttributes(openingElement);
        const fullCode = this.generateFullElementCode(regularCode, node);

        toAttrAction.edit = new vscode.WorkspaceEdit();
        toAttrAction.edit.replace(
          document.uri,
          new vscode.Range(start, end),
          fullCode
        );
        actions.push(toAttrAction);
      }
    }

    return actions;
  }
}

// Installer din provider
const refactorProvider = new JsxAttrRefactorProvider();

// NY FUNKSJON: Håndterer kommandoen fra kontekstmenyen
const disposableCommand = vscode.commands.registerCommand(
  "jsx-attr-refactor.convertAttrToSpreadCommand",
  () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    const document = editor.document;
    const selection = editor.selection;

    const refactorKinds = [REFACTOR_KINDS.toSpread, REFACTOR_KINDS.fromSpread];

    const context: vscode.CodeActionContext = {
      diagnostics: [],
      only: refactorKinds[0], // Start with toSpread refactor
      triggerKind: vscode.CodeActionTriggerKind.Invoke,
    };

    const actionsPromise = refactorProvider.provideCodeActions(
      document,
      selection,
      context, // Bruk det fullstendige kontekstobjektet
      new vscode.CancellationTokenSource().token
    );

    // Utfør den første Code Action som ble funnet (hvis den finnes)
    Promise.resolve(actionsPromise).then(
      (actions: vscode.CodeAction[] | null | undefined) => {
        // Sjekk om actions er et gyldig array
        if (actions && actions.length > 0 && actions[0].edit) {
          vscode.workspace.applyEdit(actions[0].edit);
        } else {
          vscode.window.showInformationMessage(
            "No attributes found for conversion at cursor position."
          );
        }
      }
    );
  }
);

export function activate(context: vscode.ExtensionContext) {
  console.log("JSX Attribute Refactor extension is active!");

  // Register the Code Action Provider for common JS/TS React and plain
  // JavaScript/TypeScript documents, for both saved files and untitled
  // editors. Use the broader CodeActionKind.Refactor so VS Code will
  // request our provider when the lightbulb/Refactor menu is invoked.
  const languages = [
    "javascriptreact",
    "typescriptreact",
    "javascript",
    "typescript",
  ];

  const selectors: vscode.DocumentFilter[] = [];
  for (const lang of languages) {
    selectors.push({ scheme: "file", language: lang });
    selectors.push({ scheme: "untitled", language: lang });
  }

  const provider = new JsxAttrRefactorProvider();
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(selectors, provider, {
      providedCodeActionKinds: [
        REFACTOR_KINDS.toSpread,
        REFACTOR_KINDS.fromSpread,
      ],
    })
  ); // Register both commands
  context.subscriptions.push(
    disposableCommand,
    vscode.commands.registerCommand(
      "jsx-attr-refactor.convertSpreadToAttrCommand",
      () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          return;
        }

        const document = editor.document;
        const selection = editor.selection;

        const context: vscode.CodeActionContext = {
          diagnostics: [],
          only: REFACTOR_KINDS.fromSpread,
          triggerKind: vscode.CodeActionTriggerKind.Invoke,
        };

        const actionsPromise = refactorProvider.provideCodeActions(
          document,
          selection,
          context,
          new vscode.CancellationTokenSource().token
        );

        Promise.resolve(actionsPromise).then(
          (actions: vscode.CodeAction[] | null | undefined) => {
            if (actions && actions.length > 0 && actions[0].edit) {
              vscode.workspace.applyEdit(actions[0].edit);
            } else {
              vscode.window.showInformationMessage(
                "No spread attributes found for conversion at cursor position."
              );
            }
          }
        );
      }
    )
  );
}
