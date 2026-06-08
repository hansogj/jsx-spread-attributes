import * as assert from "assert";
import * as vscode from "vscode";
import { ConciseArrowProvider } from "../extension";

const provider = new ConciseArrowProvider();

async function actionsAt(content: string, position: vscode.Position, language = "typescript"): Promise<vscode.CodeAction[]> {
  const doc = await vscode.workspace.openTextDocument({ content, language });
  return provider.provideCodeActions(doc, new vscode.Range(position, position));
}

suite("concise-arrow", () => {
  test("offers remove-braces for single ExpressionStatement body", async () => {
    const actions = await actionsAt(
      "const f = () => { console.log(1); };",
      new vscode.Position(0, 12)
    );
    const titles = actions.map((a) => a.title);
    assert.ok(titles.includes("Remove braces from arrow function"));
  });

  test("offers remove-braces for single ReturnStatement body", async () => {
    const actions = await actionsAt(
      "const f = () => { return 1 + 2; };",
      new vscode.Position(0, 12)
    );
    const titles = actions.map((a) => a.title);
    assert.ok(titles.includes("Remove braces from arrow function"));
  });

  test("offers add-braces for concise body", async () => {
    const actions = await actionsAt(
      "const f = () => 1 + 2;",
      new vscode.Position(0, 12)
    );
    const titles = actions.map((a) => a.title);
    assert.ok(titles.includes("Add braces to arrow function"));
  });

  test("does not offer remove-braces for multi-statement body", async () => {
    const actions = await actionsAt(
      "const f = () => { const x = 1; return x; };",
      new vscode.Position(0, 12)
    );
    const titles = actions.map((a) => a.title);
    assert.ok(!titles.includes("Remove braces from arrow function"));
  });

  test("picks the deepest arrow under the cursor", async () => {
    // Outer arrow returns inner arrow; cursor is inside the inner body.
    const content = "const outer = () => () => { console.log(1); };";
    const inside = content.indexOf("console");
    const doc = await vscode.workspace.openTextDocument({ content, language: "typescript" });
    const actions = provider.provideCodeActions(
      doc,
      new vscode.Range(doc.positionAt(inside), doc.positionAt(inside))
    );
    const titles = actions.map((a) => a.title);
    assert.ok(titles.includes("Remove braces from arrow function"));
  });
});
