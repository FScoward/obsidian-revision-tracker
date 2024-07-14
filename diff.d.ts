declare module "diff" {
	export function createTwoFilesPatch(
		oldFileName: string,
		newFileName: string,
		oldStr: string,
		newStr: string,
		oldHeader?: string,
		newHeader?: string,
		options?: any
	): string;

	export function parsePatch(patch: string): any[];

	export function applyPatch(
		source: string,
		uniDiff: any,
		options?: any
	): string;

	export function diffLines(
		oldStr: string,
		newStr: string,
		options?: any
	): Array<{ added?: boolean; removed?: boolean; value: string }>;
}
