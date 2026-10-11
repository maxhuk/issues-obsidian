import { Plugin } from 'obsidian';
import { IssuesView, VIEW_TYPE } from './view/IssuesView';

export default class IssuesPlugin extends Plugin {
	onload(): void {
		this.registerBasesView(VIEW_TYPE, {
			name: 'Issues',
			icon: 'lucide-list-checks',
			factory: (controller, containerEl) => new IssuesView(controller, containerEl),
		});
	}
}
