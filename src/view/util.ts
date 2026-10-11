export function todayIso(): string {
	const d = new Date();
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function stripFrontmatter(text: string): string {
	if (!text.startsWith('---')) return text;
	const end = text.indexOf('\n---', 3);
	if (end === -1) return text;
	const lineEnd = text.indexOf('\n', end + 1);
	return lineEnd === -1 ? '' : text.slice(lineEnd + 1);
}

export function scrollParent(el: HTMLElement): HTMLElement {
	let node: HTMLElement | null = el.parentElement;
	while (node) {
		const { overflowY } = getComputedStyle(node);
		if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) return node;
		node = node.parentElement;
	}
	return document.documentElement;
}
