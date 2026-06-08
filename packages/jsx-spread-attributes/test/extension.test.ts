import * as assert from "assert";
import * as vscode from "vscode";
import { JsxAttrRefactorProvider } from "../src/extension";

suite("Extension Test Suite", () => {
  test("provideCodeActions returns refactor for JSX with multiple attributes", async () => {
    const doc = await vscode.workspace.openTextDocument({
      content: '<MyComp a="1" b={x} c />',
      language: "javascriptreact",
    });

    const provider = new JsxAttrRefactorProvider();

    const range = new vscode.Range(
      new vscode.Position(0, 1),
      new vscode.Position(0, 2)
    );

    const actions = (await provider.provideCodeActions(
      doc,
      range,
      {
        diagnostics: [],
        only: undefined,
        triggerKind: vscode.CodeActionTriggerKind.Invoke,
      },
      new vscode.CancellationTokenSource().token
    )) as vscode.CodeAction[];

    assert.ok(Array.isArray(actions), "actions should be an array");
    assert.ok(actions.length > 0, "should return at least one action");

    const titles = actions.map((a) => a.title);
    assert.ok(
      titles.includes("Convert Attributes to Spread Object"),
      "should include the refactor title"
    );
  });
});
