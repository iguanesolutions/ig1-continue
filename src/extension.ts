import * as vscode from 'vscode';
let fs = require("fs");
let path = require("path");
let os = require("os");

export function activate(context: vscode.ExtensionContext) {
	syncConfig();
	const syncCmd = vscode.commands.registerCommand('ig1-continue.sync', () => {
		syncConfig();
	});
	context.subscriptions.push(syncCmd);
}

export function deactivate(context: vscode.ExtensionContext) {
	cleanConfig();
	return undefined;
}

function syncConfig() {
	console.log('IG1 Continue: Syncing configuration...');

	const baseURL = vscode.workspace.getConfiguration().get<string>('ig1-continue.baseURL');
	const apiKey = vscode.workspace.getConfiguration().get<string>('ig1-continue.apiKey');
	const localAssistant = vscode.workspace.getConfiguration().get<boolean>('ig1-continue.localAssistant');

	if (!baseURL || !apiKey) {
		vscode.window.showErrorMessage('Base URL and API Key must be set in settings.');
		return;
	}

	fetch(`${baseURL}/continue/sync`, {
		headers: {
			'Authorization': `Bearer ${apiKey}`,
			'Accept': 'application/yaml'
		}
	})
		.then(response => {
			if (!response.ok) {
				throw new Error(`HTTP error! Status: ${response.status}`);
			}
			return response.text();
		})
		.then(data => {
			let configPath: string;
			if (localAssistant) {
				configPath = path.join(os.homedir(), '.continue', 'config.yaml');
			} else {
				const assistantsDir = path.join(os.homedir(), '.continue', 'assistants');
				if (!fs.existsSync(assistantsDir)) {
					fs.mkdirSync(assistantsDir, { recursive: true });
					console.log(`IG1 Continue: Created assistants directory: ${assistantsDir}`);
				}
				configPath = path.join(os.homedir(), '.continue', 'assistants', 'ig1-continue.yaml');
			}
			console.log(`IG1 Continue: Writing configuration to: ${configPath}`);
			fs.writeFileSync(configPath, data);
			vscode.window.showInformationMessage('Configuration synced successfully!');
		})
		.catch(error => {
			console.error('IG1 Continue: Error fetching data:', error);
			vscode.window.showErrorMessage('Failed to sync configuration.');
		});
}

function cleanConfig() {
	const configPath = path.join(os.homedir(), '.continue', 'assistants', 'ig1-continue.yaml');
	if (fs.existsSync(configPath)) {
		fs.unlinkSync(configPath);
		console.log(`IG1 Continue: Deleted file: ${configPath}`);
	}
}
