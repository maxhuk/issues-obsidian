import type { DropTarget } from '../types';
import { scrollParent } from '../util';

export interface DragHooks {
	isTouch: boolean;
	onBegin(): void;
	onEnd(): void;
	onDrop(path: string, target: DropTarget): void;
	onMenu(path: string, x: number, y: number): void;
}

const HOLD_MS = 350;
const SLOP_PX = 8;
const MOUSE_SLOP_PX = 4;
const EDGE_PX = 40;
const SCROLL_STEP = 12;

interface Pending {
	row: HTMLElement;
	path: string;
	pointerId: number;
	startX: number;
	startY: number;
	lifted: boolean;
	dragging: boolean;
	timer: number | null;
}

/**
 * Spec 4.1. Mouse: drag after a few pixels. Touch: hold to lift, then move to drag;
 * release without moving opens the row menu.
 */
export class DragController {
	private pending: Pending | null = null;
	private ghost: HTMLElement | null = null;
	private indicator: HTMLElement | null = null;
	private lastX = 0;
	private lastY = 0;
	private scrollFrame: number | null = null;

	constructor(
		private readonly root: HTMLElement,
		private readonly hooks: DragHooks,
	) {}

	attach(row: HTMLElement): void {
		row.addEventListener('pointerdown', this.onPointerDown);
		row.addEventListener('touchmove', this.onTouchMove, { passive: false });
	}

	destroy(): void {
		this.cleanup();
	}

	private readonly onPointerDown = (evt: PointerEvent): void => {
		if (evt.button !== 0 || this.pending) return;
		const row = evt.currentTarget as HTMLElement;
		const path = row.dataset.path;
		if (!path) return;
		const touch = evt.pointerType === 'touch';
		this.pending = { row, path, pointerId: evt.pointerId, startX: evt.clientX, startY: evt.clientY, lifted: false, dragging: false, timer: null };
		this.lastX = evt.clientX;
		this.lastY = evt.clientY;
		if (touch) {
			this.pending.timer = window.setTimeout(() => this.lift(), HOLD_MS);
		}
		window.addEventListener('pointermove', this.onPointerMove);
		window.addEventListener('pointerup', this.onPointerUp);
		window.addEventListener('pointercancel', this.onPointerCancel);
	};

	private readonly onTouchMove = (evt: TouchEvent): void => {
		if (this.pending?.lifted) evt.preventDefault();
	};

	private lift(): void {
		const p = this.pending;
		if (!p) return;
		p.lifted = true;
		p.timer = null;
		p.row.addClass('is-lifted');
		this.hooks.onBegin();
	}

	private readonly onPointerMove = (evt: PointerEvent): void => {
		const p = this.pending;
		if (!p || evt.pointerId !== p.pointerId) return;
		this.lastX = evt.clientX;
		this.lastY = evt.clientY;
		const dx = evt.clientX - p.startX;
		const dy = evt.clientY - p.startY;
		const moved = Math.hypot(dx, dy);

		if (!p.lifted) {
			if (p.timer !== null) {
				if (moved > SLOP_PX) this.cleanup();
				return;
			}
			if (moved > MOUSE_SLOP_PX) {
				this.lift();
			} else {
				return;
			}
		}
		if (!p.dragging && moved > MOUSE_SLOP_PX) this.startDrag(p);
		if (p.dragging) {
			this.moveGhost(evt.clientX, evt.clientY);
			this.updateIndicator(evt.clientX, evt.clientY);
			this.autoScroll(evt.clientY);
		}
	};

	private readonly onPointerUp = (evt: PointerEvent): void => {
		const p = this.pending;
		if (!p || evt.pointerId !== p.pointerId) return;
		if (p.dragging) {
			const target = this.targetFromIndicator(p.path);
			this.cleanup();
			if (target) this.hooks.onDrop(p.path, target);
			return;
		}
		const wasLifted = p.lifted;
		this.cleanup();
		if (wasLifted) this.hooks.onMenu(p.path, evt.clientX, evt.clientY);
	};

	private readonly onPointerCancel = (): void => {
		this.cleanup();
	};

	private startDrag(p: Pending): void {
		p.dragging = true;
		p.row.addClass('is-dragging');
		const ghost = p.row.cloneNode(true) as HTMLElement;
		ghost.addClass('issues-drag-ghost');
		ghost.style.width = `${p.row.offsetWidth}px`;
		document.body.appendChild(ghost);
		this.ghost = ghost;
		this.indicator = createDiv({ cls: 'issues-drop-indicator' });
		this.moveGhost(this.lastX, this.lastY);
	}

	private moveGhost(x: number, y: number): void {
		if (!this.ghost) return;
		this.ghost.style.transform = `translate(${x + 12}px, ${y - 16}px)`;
	}

	private updateIndicator(x: number, y: number): void {
		const indicator = this.indicator;
		if (!indicator) return;
		const under = document.elementFromPoint(x, y) as HTMLElement | null;
		if (!under || !this.root.contains(under)) {
			indicator.remove();
			return;
		}
		const dragged = under.closest<HTMLElement>('.issues-row.is-dragging');
		if (dragged) {
			dragged.insertAdjacentElement('beforebegin', indicator);
			return;
		}
		indicator.remove();

		const row = under.closest<HTMLElement>('.issues-row');
		if (row && row.parentElement?.hasClass('issues-rows')) {
			const rect = row.getBoundingClientRect();
			const before = y < rect.top + rect.height / 2;
			row.insertAdjacentElement(before ? 'beforebegin' : 'afterend', indicator);
			return;
		}
		const group = under.closest<HTMLElement>('.issues-group');
		const section = under.closest<HTMLElement>('.issues-section');
		const container = (group ?? section)?.querySelector<HTMLElement>(':scope > .issues-rows, :scope > .issues-section-body > .issues-rows');
		if (container) {
			container.appendChild(indicator);
			return;
		}
		if (section && !section.hasClass('is-collapsed')) {
			const body = section.querySelector<HTMLElement>(':scope > .issues-section-body');
			if (body && !section.querySelector('.issues-group')) {
				const rows = body.querySelector<HTMLElement>('.issues-rows') ?? body.createDiv({ cls: 'issues-rows' });
				rows.appendChild(indicator);
			} else if (body) {
				body.prepend(indicator);
				indicator.dataset.sectionLevel = 'true';
			}
		}
	}

	private targetFromIndicator(movedPath: string): DropTarget | null {
		const indicator = this.indicator;
		if (!indicator || !indicator.isConnected) return null;
		const section = indicator.closest<HTMLElement>('.issues-section');
		const status = section?.dataset.status;
		if (!section || status === undefined) return null;
		const group = indicator.closest<HTMLElement>('.issues-group');
		const groupId = indicator.dataset.sectionLevel ? null : (group?.dataset.groupId ?? null);
		const rowsEl = indicator.closest<HTMLElement>('.issues-rows');
		let index = 0;
		if (rowsEl) {
			for (const child of Array.from(rowsEl.children)) {
				if (child === indicator) break;
				if (child.hasClass('issues-row') && (child as HTMLElement).dataset.path !== movedPath) index++;
			}
		}
		return { status, groupId, index };
	}

	private autoScroll(y: number): void {
		const scroller = scrollParent(this.root);
		const rect = scroller === document.documentElement ? { top: 0, bottom: window.innerHeight } : scroller.getBoundingClientRect();
		let delta = 0;
		if (y < rect.top + EDGE_PX) delta = -SCROLL_STEP;
		else if (y > rect.bottom - EDGE_PX) delta = SCROLL_STEP;
		if (this.scrollFrame !== null) window.cancelAnimationFrame(this.scrollFrame);
		if (delta === 0) return;
		const step = () => {
			scroller.scrollTop += delta;
			this.updateIndicator(this.lastX, this.lastY);
			this.scrollFrame = window.requestAnimationFrame(step);
		};
		this.scrollFrame = window.requestAnimationFrame(step);
	}

	private cleanup(): void {
		const p = this.pending;
		if (p) {
			if (p.timer !== null) window.clearTimeout(p.timer);
			p.row.removeClass('is-lifted', 'is-dragging');
			if (p.lifted) this.hooks.onEnd();
		}
		this.pending = null;
		this.ghost?.remove();
		this.ghost = null;
		this.indicator?.remove();
		this.indicator = null;
		if (this.scrollFrame !== null) window.cancelAnimationFrame(this.scrollFrame);
		this.scrollFrame = null;
		window.removeEventListener('pointermove', this.onPointerMove);
		window.removeEventListener('pointerup', this.onPointerUp);
		window.removeEventListener('pointercancel', this.onPointerCancel);
	}
}
