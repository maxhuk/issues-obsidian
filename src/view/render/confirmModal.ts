import { Modal, Setting, type App } from 'obsidian';

/** A yes/no question. Resolves true only when the confirming button is pressed. */
export function confirm(app: App, title: string, message: string, confirmLabel: string): Promise<boolean> {
	return new Promise((resolve) => {
		let settled = false;
		const modal = new Modal(app);
		modal.titleEl.setText(title);
		modal.contentEl.createEl('p', { text: message });
		new Setting(modal.contentEl)
			.addButton((button) =>
				button.setButtonText('Cancel').onClick(() => {
					modal.close();
				}),
			)
			.addButton((button) =>
				button
					.setButtonText(confirmLabel)
					.setDestructive().setCta()
					.onClick(() => {
						settled = true;
						resolve(true);
						modal.close();
					}),
			);
		modal.onClose = () => {
			if (!settled) resolve(false);
		};
		modal.open();
	});
}
