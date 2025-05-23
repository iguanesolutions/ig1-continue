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

	syncConfigs();

	const syncCmd = vscode.commands.registerCommand('ig1-continue.sync', () => {
		syncConfigs();
	});
	context.subscriptions.push(syncCmd);
}

export function deactivate(context: vscode.ExtensionContext) {
	cleanConfigs();
	return undefined;
}

interface RemoteServer {
	url: string;
	apiKey: string;
	localAssistant: boolean;
}

async function syncConfigs() {
	console.log('IG1 Continue: Syncing configurations...');

	const remoteServers = vscode.workspace.getConfiguration().get<RemoteServer[]>('ig1-continue.remoteServers') || [];

	let syncedConfigs = 0;
	let failedConfigs = 0;
	let localAssistants = 0;

	const promises = remoteServers.map(async server => {
		const { url, apiKey, localAssistant } = server;
		const baseURL = url.trim();
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
				let configPath: string;
				if (localAssistant) {
					configPath = path.join(os.homedir(), '.continue', 'config.yaml');
					localAssistants++;
				} else {
					configPath = path.join(os.homedir(), '.continue', 'assistants', domainName + '.yaml');
				}
				console.log(`IG1 Continue: Writing configuration to: ${configPath}`);
				fs.writeFileSync(configPath, data);
				syncedConfigs++;
			})
			.catch(error => {
				console.error('IG1 Continue: Error fetching data:', error);
				failedConfigs++;
			});
	});

	await Promise.all(promises)

	if (syncedConfigs > 0) {
		vscode.window.showInformationMessage(`Successfully synced ${syncedConfigs} configuration(s).`);
	}

	if (failedConfigs > 0) {
		vscode.window.showErrorMessage(`Failed to sync ${failedConfigs} configuration(s).`);
	}

	if (localAssistants > 1) {
		vscode.window.showWarningMessage(`Multiple local assistants detected. Only one local assistant can be used at a time.`);
	}
}

function cleanConfigs() {
	const remoteServers = vscode.workspace.getConfiguration().get<RemoteServer[]>('ig1-continue.remoteServers') || [];
	remoteServers.forEach(server => {
		const { url } = server;
		const domainName = new URL(url).hostname;
		const configPath = path.join(os.homedir(), '.continue', 'assistants', domainName + '.yaml');
		if (fs.existsSync(configPath)) {
			fs.unlinkSync(configPath);
			console.log(`IG1 Continue: Deleted file: ${configPath}`);
		}
	});
}
