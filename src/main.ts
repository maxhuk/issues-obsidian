import { Plugin } from 'obsidian';
import { IssuesView, VIEW_TYPE } from './view/IssuesView';
import { NewProjectModal } from './view/newProjectModal';

export default class IssuesPlugin extends Plugin {
	onload(): void {
		this.registerBasesView(VIEW_TYPE, {
			name: 'Issues',
			icon: 'lucide-list-checks',
			factory: (controller, containerEl) => new IssuesView(controller, containerEl, this.manifest.version),
		});
		this.addCommand({
			id: 'new-project',
			name: 'New project',
			callback: () => new NewProjectModal(this.app).open(),
		});
	}
}
