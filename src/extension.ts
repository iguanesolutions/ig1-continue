import * as vscode from 'vscode';
let fs = require("fs");
let path = require("path");
let os = require("os");

export function activate(context: vscode.ExtensionContext) {
	const assistantsDir = path.join(os.homedir(), '.continue', 'assistants');
	if (!fs.existsSync(assistantsDir)) {
		fs.mkdirSync(assistantsDir, { recursive: true });
		console.log(`IG1 Continue: Created assistants directory: ${assistantsDir}`);
	}

	syncPrimary();
	syncSecondaries();

	const syncCmd = vscode.commands.registerCommand('ig1-continue.sync', () => {
		syncPrimary();
		syncSecondaries();
	});
	context.subscriptions.push(syncCmd);
}

export function deactivate(context: vscode.ExtensionContext) {
	cleanConfigs();
	return undefined;
}

function syncPrimary() {
	console.log('IG1 Continue: Syncing primary configuration...');

	const baseURL = vscode.workspace.getConfiguration().get<string>('ig1-continue.baseURL');
	const apiKey = vscode.workspace.getConfiguration().get<string>('ig1-continue.apiKey');
	const localAssistant = vscode.workspace.getConfiguration().get<boolean>('ig1-continue.localAssistant');

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
				configPath = path.join(os.homedir(), '.continue', 'assistants', 'ig1-continue.yaml');
			}
			try {
				console.log(`IG1 Continue: Writing primary configuration to: ${configPath}`);
				fs.writeFileSync(configPath, data);
				vscode.window.showInformationMessage('Successfully synced primary configuration.');
			} catch (err) {
				console.log(`IG1 Continue: Failed to write primary configuration to: ${configPath}`);
				vscode.window.showErrorMessage('Failed to write primary configuration.');
			}
		})
		.catch(error => {
			console.error('IG1 Continue: Error fetching data on primary:', error);
			vscode.window.showErrorMessage('Failed to sync primary configuration.');
		});
}

interface RemoteServer {
	baseURL: string;
	apiKey: string;
}

async function syncSecondaries() {
	console.log('IG1 Continue: Syncing secondary configurations...');

	const remoteServers = vscode.workspace.getConfiguration().get<RemoteServer[]>('ig1-continue.secondaryServers') || [];

	let syncedConfigs = 0;
	let failedConfigs = 0;

	const promises = remoteServers.map(async server => {
		const { baseURL, apiKey } = server;
		const domainName = new URL(baseURL).hostname;

		console.log(`IG1 Continue: Syncing configuration from ${baseURL}...`);

		await fetch(`${baseURL}/continue/sync`, {
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
				const configPath = path.join(os.homedir(), '.continue', 'assistants', domainName + '.yaml');
				try {
					console.log(`IG1 Continue: Writing secondary configuration to: ${configPath}`);
					fs.writeFileSync(configPath, data);
					syncedConfigs++;
				} catch (err) {
					console.log(`IG1 Continue: Failed to write primary configuration to: ${configPath}`);
					failedConfigs++;
				}
			})
			.catch(error => {
				console.error('IG1 Continue: Error fetching data on secondary:', error);
				failedConfigs++;
			});
	});

	await Promise.all(promises)

	if (syncedConfigs > 0) {
		vscode.window.showInformationMessage(`Successfully synced ${syncedConfigs} secondary configuration(s).`);
	}

	if (failedConfigs > 0) {
		vscode.window.showErrorMessage(`Failed to sync ${failedConfigs} secondary configuration(s).`);
	}
}

function cleanConfigs() {
	const configPath = path.join(os.homedir(), '.continue', 'assistants', 'ig1-continue.yaml');
	if (fs.existsSync(configPath)) {
		fs.unlinkSync(configPath);
		console.log(`IG1 Continue: Deleted primary configuration file: ${configPath}`);
	}

	const remoteServers = vscode.workspace.getConfiguration().get<RemoteServer[]>('ig1-continue.remoteServers') || [];
	remoteServers.forEach(server => {
		const { baseURL } = server;
		const domainName = new URL(baseURL).hostname;
		const configPath = path.join(os.homedir(), '.continue', 'assistants', domainName + '.yaml');
		if (fs.existsSync(configPath)) {
			fs.unlinkSync(configPath);
			console.log(`IG1 Continue: Deleted secondary configuration file: ${configPath}`);
		}
	});
}
