import * as process from "process";
import * as fs from "fs-extra";
import * as spawn from "cross-spawn";
import {bold, cyan, red} from "chalk";

export function getNodeVersion() {
    const currentNodeVersion = process.versions.node;
    const semver = currentNodeVersion.split(".");
    return [currentNodeVersion, Number(semver[0])];
}

export function isSafeToCreateProjectIn(root: string) {
    const conflictFiles = fs.readdirSync(root);
    const conflict = conflictFiles.length > 0
    if (conflict) {
        console.log(`${root} has old files: ${conflictFiles.join(', ')}`);
        console.log(
            'Either try using a new directory name, or remove the files listed above.'
        );
        return false;
    }
    return true;
}

export function checkThatNpmCanReadCwd() {
    const cwd = process.cwd();
    let childOutput = null;
    try {
        childOutput = spawn.sync('npm', ['config', 'list']).output.join('');
    } catch (e) {
        return true;
    }
    if (typeof childOutput !== 'string') {
        return true;
    }
    const lines = childOutput.split('\n');
    const prefix = '; cwd = ';
    const line = lines.find(line => line.startsWith(prefix));
    if (typeof line !== 'string') {
        return true;
    }
    const npmCWD = line.substring(prefix.length);
    if (npmCWD === cwd) {
        return true;
    }
    console.error(
        red(
            `Could not start an npm process in the right directory.\n\n` +
            `The current directory is: ${bold(cwd)}\n` +
            `However, a newly started npm process runs in: ${bold(
                npmCWD
            )}\n\n` +
            `This is probably caused by a misconfigured system terminal shell.`
        )
    );
    if (process.platform === 'win32') {
        console.error(
            red(`On Windows, this can usually be fixed by running:\n\n`) +
            `  ${cyan(
                'reg'
            )} delete "HKCU\\Software\\Microsoft\\Command Processor" /v AutoRun /f\n` +
            `  ${cyan(
                'reg'
            )} delete "HKLM\\Software\\Microsoft\\Command Processor" /v AutoRun /f\n\n` +
            red(`Try to run the above two lines in the terminal.\n`) +
            red(
                `To learn more about this problem, read: https://blogs.msdn.microsoft.com/oldnewthing/20071121-00/?p=24433/`
            )
        );
    }
    return false;
}