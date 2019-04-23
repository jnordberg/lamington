import * as globWithCallbacks from 'glob';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import mapTypes from './typeMap';
import * as spinner from './../cli/logIndicator';

const glob = promisify(globWithCallbacks);

const pascalCase = (value: string) => {
	const snakePattern = /[_.]+./g;
	const upperFirst = value[0].toUpperCase() + value.slice(1);
	return upperFirst.replace(snakePattern, match => match[match.length - 1].toUpperCase());
};

type IndentedGeneratorLevel = { [key: string]: Array<string> | IndentedGeneratorLevel };
type GeneratorLevel = Array<string | IndentedGeneratorLevel>;

/**
 * Parses a C++ type definition into a Typescript definition
 * @author Kevin Brown <github.com/thekevinbrown>
 * @author Mitch Pierias <github.com/MitchPierias>
 * @param eosType 
 */
export const mapParameterType = (eosType: string) => {
	// Handle array types
	const wrapper = eosType.endsWith('[]') ? 'Array' : undefined;
	const type = mapTypes[eosType.replace('[]','')] || 'string';
	if (wrapper) {
		return `${wrapper}<${type}>`;
	} else {
		return type;
	}
};

/**
 * Loads all `.abi` files and generates types
 * @author Kevin Brown <github.com/thekevinbrown>
 */
export const generateAllTypes = async () => {
	// Load all `.abi` files
	const files = await glob('**/*.abi');
	// Handle no files found
	if (files.length === 0) throw new Error('No ABI files to generate from. Exiting.');
	// Generate types for each file
	for (const file of files) await generateTypes(file);
};

/**
 * Generates a Typescript definition file from a contract ABI file
 * @author Kevin Brown <github.com/thekevinbrown>
 * @author Mitch Pierias <github.com/MitchPierias>
 * @param contractIdentifier Path to file without extension
 */
export const generateTypes = async (contractIdentifier: string) => {
	// Notify generating has begun
	spinner.create(`Generating types definitions`);

	const contractName = path.basename(contractIdentifier);
	const abiPath = path.join('.lamington', 'compiled_contracts', `${contractIdentifier}.abi`);
	const abi = JSON.parse(fs.readFileSync(path.resolve(abiPath), 'utf8'));
	let contractActions = abi.actions;
	let contractTables = abi.tables;
	let contractStructs = Object.assign(
		{},
		...abi.structs.map((struct: any) => ({ [struct['name']]: struct }))
	);
	// Prepend warning text
	const result: GeneratorLevel = [
		'// =====================================================',
		'// WARNING: GENERATED FILE',
		'//',
		'// Any changes you make will be overwritten by Lamington',
		'// =====================================================',
		'',
	];
	// Imports
	const imports = ['Account', 'Contract'];
	if (contractTables.length > 0) imports.push('TableRowsResult');

	result.push(`import { ${imports.join(', ')} } from 'lamington';`);
	result.push('');
	result.push('// Table row types');

	// Generate table row types from ABI
	for (const table of contractTables) {
		const tableInterface = {
			[`export interface ${pascalCase(contractName)}${pascalCase(table.name)}`]: contractStructs[
				table.type
			].fields.map((field: any) => `${field.name}: ${mapParameterType(field.type)};`),
		};

		result.push(tableInterface);
		result.push('');
	}
	// Generate contract type from ABI
	const generatedContractActions = contractActions.map((action: any) => {
		// With a function for each action
		const parameters = contractStructs[action.name].fields.map(
			(parameter: any) => `${parameter.name}: ${mapParameterType(parameter.type)}`
		);

		// Optional parameter at the end on every contract method.
		parameters.push('options?: { from?: Account }');

		return `${action.name}(${parameters.join(', ')}): Promise<any>;`;
	});

	const generatedTables = contractTables.map(
		(table: any) =>
			`${table.name}(scope?: string): Promise<TableRowsResult<${pascalCase(
				contractName
			)}${pascalCase(table.name)}>>;`
	);

	const contractInterface = {
		[`export interface ${pascalCase(contractName)} extends Contract`]: [
			'// Actions',
			...generatedContractActions,
			'',
			'// Tables',
			...generatedTables,
		],
	};

	result.push(contractInterface);
	result.push('');

	await saveInterface(contractIdentifier, result);
	spinner.end('');
};

const saveInterface = async (
	contractIdentifier: string,
	contract: GeneratorLevel | IndentedGeneratorLevel
) => {
	const file = fs.createWriteStream(`${contractIdentifier}.ts`);

	let indentLevel = 0;
	const write = (value: string) => file.write('\t'.repeat(indentLevel) + value + '\n');
	const writeIndented = (level: IndentedGeneratorLevel) => {
		for (const outerWrapper of Object.keys(level)) {
			write(`${outerWrapper} {`);

			indentLevel++;
			writeLevel(level[outerWrapper]);
			indentLevel--;

			write('}');
		}
	};
	const writeLevel = (level: GeneratorLevel | IndentedGeneratorLevel) => {
		if (Array.isArray(level)) {
			for (const entry of level) {
				if (typeof entry === 'string') {
					write(entry);
				} else {
					writeIndented(entry);
				}
			}
		} else {
			writeIndented(level);
		}
	};

	writeLevel(contract);

	file.close();
};
