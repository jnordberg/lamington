import { eosIsReady, startEos, stopContainer, buildAll } from './utils';
import { GitIgnoreManager } from '../gitignoreManager';
import { ConfigManager } from '../configManager';

const run = async () => {
	// Initialize configuration
	await ConfigManager.initWithDefaults();
	// Stop container if running
	if (!ConfigManager.keepAlive && await eosIsReady()) {
		await stopContainer();
	}
	// This ensures we have our .gitignore inside the .lamington directory
	await GitIgnoreManager.createIfMissing();
	// Start the EOSIO container image
	if (!await eosIsReady()) {
		await startEos();
	}
	// Build all smart contracts
	await buildAll();
};

run().catch(error => {
	stopContainer().then(() => {
		throw error;
	});
});
