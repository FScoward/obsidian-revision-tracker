import * as Diff from "diff";

import { ItemView, Notice, Plugin, TFile, WorkspaceLeaf } from "obsidian";

const VIEW_TYPE_DIFF = "fscoward-diff-view";

export default class ObsidianRevisionTracker extends Plugin {
	async onload() {
		console.log("Loading Obsidian Revision Tracker");

		this.registerDiffViewType();

		this.addCommand({
			id: "calculate-diff",
			name: "Calculate Text Diff",
			callback: () => this.calculateDiff(),
		});

		this.addRibbonIcon("dice", "Calculate Diff", () => {
			this.calculateDiff();
		});

		// CSSスタイルを追加
		this.addStyles();
	}

	onunload() {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_DIFF);
		console.log("Unloading Obsidian Revision Tracker");
	}

	registerDiffViewType() {
		// 既にビュータイプが登録されているかを確認
		if (!this.app.workspace.getLeavesOfType(VIEW_TYPE_DIFF).length) {
			try {
				this.registerView(VIEW_TYPE_DIFF, (leaf) => new DiffView(leaf));
			} catch (e) {
				console.warn(
					`Error registering view type "${VIEW_TYPE_DIFF}":`,
					e
				);
			}
		} else {
			console.warn(
				`View type "${VIEW_TYPE_DIFF}" is already registered.`
			);
		}
	}

	async activateView(): Promise<WorkspaceLeaf | null> {
		const { workspace } = this.app;
		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_DIFF);

		if (leaves.length > 0) {
			leaf = leaves[0];
		} else {
			leaf = workspace.getLeaf("split");
			if (leaf) {
				await leaf.setViewState({ type: VIEW_TYPE_DIFF, active: true });
			}
		}

		if (leaf) {
			workspace.revealLeaf(leaf);
		}

		return leaf;
	}

	async calculateDiff() {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice("No active file found");
			return;
		}

		try {
			let fileContent = await this.app.vault.read(activeFile);
			let previousContent = await this.getPreviousContent(activeFile);

			// Ensure that fileContent and previousContent are strings
			fileContent =
				typeof fileContent === "string"
					? fileContent
					: String(fileContent);
			previousContent =
				typeof previousContent === "string"
					? previousContent
					: String(previousContent);

			console.log("Current file content:", fileContent);
			console.log("Previous file content:", previousContent);

			const diffHtml = this.createSplitDiffHtml(
				previousContent,
				fileContent
			);
			await this.displayDiff(diffHtml);

			const patchText = this.createPatchText(
				previousContent,
				fileContent
			);

			await this.storePatch(activeFile, patchText);
		} catch (error) {
			console.error("Error calculating diff:", error);
			new Notice("Error calculating diff. Check console for details.");
		}
	}

	async getPreviousContent(file: TFile): Promise<string> {
		const patchText = await this.getPatch(file);
		if (!patchText) return "";

		const currentContent = await this.app.vault.read(file);
		const patches = Diff.parsePatch(patchText);
		const previousContent = Diff.applyPatch(currentContent, patches[0]);

		return previousContent;
	}

	async getPatch(file: TFile): Promise<string> {
		const patchPath = this.getPatchFilePath(file);
		try {
			const patchFile = this.app.vault.getAbstractFileByPath(patchPath);
			if (patchFile instanceof TFile) {
				return await this.app.vault.read(patchFile);
			}
		} catch (e) {
			console.error("Error reading patch file:", e);
		}
		return "";
	}

	async storePatch(file: TFile, patch: string) {
		const patchPath = this.getPatchFilePath(file);
		try {
			await this.app.vault.adapter.write(patchPath, patch);
		} catch (e) {
			console.error("Error storing patch:", e);
			new Notice("Failed to store patch. Check console for details.");
		}
	}

	getPatchFilePath(file: TFile): string {
		const fileDir = file.path.substring(0, file.path.lastIndexOf("/"));
		const fileName = file.name + ".patch";
		return `${fileDir}/${fileName}`;
	}

	escapeHtml(unsafe: string): string {
		return unsafe.replace(/[&<"']/g, function (match) {
			switch (match) {
				case "&":
					return "&amp;";
				case "<":
					return "&lt;";
				case ">":
					return "&gt;";
				case '"':
					return "&quot;";
				case "'":
					return "&#039;";
			}
			return match;
		});
	}

	convertNewlinesToBr(text: string): string {
		return text.replace(/\n/g, "<br>");
	}

	createSplitDiffHtml(oldText: string, newText: string): string {
		const diff = Diff.diffLines(oldText, newText);
		const oldHtml = diff
			.map((part) => {
				const className = part.added
					? "diff-insert"
					: part.removed
					? "diff-delete"
					: "diff-equal";
				const escapedLine = this.escapeHtml(part.value);
				const lineWithBr = this.convertNewlinesToBr(escapedLine);
				return `<div class="${className}">${lineWithBr}</div>`;
			})
			.join("");

		const newHtml = diff
			.map((part) => {
				const className = part.added
					? "diff-insert"
					: part.removed
					? "diff-delete"
					: "diff-equal";
				const escapedLine = this.escapeHtml(part.value);
				const lineWithBr = this.convertNewlinesToBr(escapedLine);
				return `<div class="${className}">${lineWithBr}</div>`;
			})
			.join("");

		return `<div class="split-diff-container">
              <div class="split-diff-left">${oldHtml}</div>
              <div class="split-diff-right">${newHtml}</div>`;
	}

	createPatchText(oldText: string, newText: string): string {
		return Diff.createTwoFilesPatch("", "", oldText, newText);
	}

	async displayDiff(diffHtml: string) {
		console.log("Attempting to display diff");
		const leaf = await this.activateView();

		if (!leaf) {
			console.error("Failed to activate view.");
			new Notice(
				"Failed to activate view. Please check console for details."
			);
			return;
		}

		const view = leaf.view;
		if (view instanceof DiffView) {
			console.log("Setting diff HTML content");
			view.setDiffHtml(diffHtml);
		} else {
			console.error(
				"View is not an instance of DiffView after activation"
			);
			new Notice(
				"Failed to create or access DiffView. Please check console for details."
			);
		}
	}

	addStyles() {
		const style = document.createElement("style");
		style.innerHTML = `
      .split-diff-container {
        display: flex;
        justify-content: space-between;
      }
      .split-diff-left, .split-diff-right {
        width: 48%;
      }
      .diff-insert {
        background-color: #e6ffe6;
        text-decoration: none;
      }
      .diff-delete {
        background-color: #ffe6e6;
        text-decoration: line-through;
      }
      .diff-equal {
        background-color: none;
        text-decoration: none;
      }
    `;
		document.head.appendChild(style);
	}
}

class DiffView extends ItemView {
	private content: string;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
		this.content = "";
	}

	getViewType() {
		return VIEW_TYPE_DIFF;
	}

	getDisplayText() {
		return "Text Diff";
	}

	async onOpen() {
		const container = this.containerEl.children[1];
		container.empty();
		container.createEl("div", { text: "Diff view is ready." });
	}

	async setDiffHtml(diffHtml: string) {
		this.content = diffHtml;
		await this.refresh();
	}

	async refresh() {
		const container = this.containerEl.children[1];
		container.empty();
		container.createEl("div", { cls: "diff-content" }).innerHTML =
			this.content;
	}
}
