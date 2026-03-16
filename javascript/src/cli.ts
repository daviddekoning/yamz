#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { bundle } from './index';

async function main() {
    const argv = await yargs(hideBin(process.argv))
        .usage('Usage: $0 <markdown-file>')
        .demandCommand(1, 'Please provide a markdown file')
        .help()
        .argv;

    const markdownFile = argv._[0] as string;
    await bundle(markdownFile);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
