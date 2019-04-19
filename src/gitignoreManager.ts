import * as path from 'path';
import { writeFile as writeFileCallback, exists as existsCallback } from 'fs';
import { promisify } from 'util';

const exists = promisify(existsCallback);
const writeFile = promisify(writeFileCallback);

/* Defaults */
const configDirectory = '.lamington';
const gitignoreFilePath = path.join(configDirectory, '.gitignore');
const encoding = 'utf8';

/**
 * @class GitIgnoreManager
 * @desc Automatically creates and configures a `.gitignore` file for generated files
 */
export class GitIgnoreManager {
	public static async createIfMissing() {
		if (!(await exists(gitignoreFilePath))) {
			await writeFile(
				gitignoreFilePath,
				`
data/
compiled_contracts/
`,
				encoding
			);
		}
	}
}
