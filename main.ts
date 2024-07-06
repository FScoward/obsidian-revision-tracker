import { DIFF_DELETE, DIFF_INSERT, diff_match_patch } from "diff-match-patch";
import { Plugin, TFile } from "obsidian";

export default class ObsidianRevisionTracker extends Plugin {
	async onload() {
		console.log("Loading Obsidian Revision Tracker");
		// テキストの差分を計算するコマンドを追加
		this.addCommand({
			id: "calculate-diff",
			name: "Calculate Text Diff",
			callback: () => this.calculateDiff(),
		});
	}

	onunload() {
		console.log("Unloading Obsidian Revision Tracker");
	}

	async calculateDiff() {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			console.error("No active file found");
			return;
		}

		const fileContent = await this.app.vault.read(activeFile);
		const previousContent = await this.applyPatchToPreviousContent(
			activeFile,
			fileContent
		);

		const dmp = new diff_match_patch();
		const diffs = dmp.diff_main(previousContent, fileContent);
		dmp.diff_cleanupSemantic(diffs);

		const patchList = dmp.patch_make(previousContent, fileContent);
		const patchText = dmp.patch_toText(patchList);

		await this.storePatch(activeFile, patchText);

		diffs.forEach((part) => {
			const color =
				part[0] === DIFF_INSERT
					? "green"
					: part[0] === DIFF_DELETE
					? "red"
					: "grey";
			console.log(`%c${part[1]}`, `color: ${color}`);
		});
	}

	async getPatch(file: TFile): Promise<string> {
		try {
			const patchFile = this.app.vault.getAbstractFileByPath(
				`${file.path}.patch.json`
			);
			if (patchFile instanceof TFile) {
				return await this.app.vault.read(patchFile);
			}
		} catch (e) {
			console.error(e);
		}
		return "";
	}

	async storePatch(file: TFile, patch: string) {
		const patchPath = `${file.path}.patch.json`;
		try {
			const patchFile = this.app.vault.getAbstractFileByPath(patchPath);
			if (patchFile instanceof TFile) {
				await this.app.vault.modify(patchFile, patch);
			} else {
				await this.app.vault.create(patchPath, patch);
			}
		} catch (e) {
			console.error(e);
		}
	}

	async applyPatchToPreviousContent(
		file: TFile,
		currentContent: string
	): Promise<string> {
		const patchText = await this.getPatch(file);
		if (!patchText) return "";

		const dmp = new diff_match_patch();
		const patches = dmp.patch_fromText(patchText);
		const [previousContent] = dmp.patch_apply(patches, currentContent);
		return previousContent;
	}
}
