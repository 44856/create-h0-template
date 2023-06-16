import {Command} from "commander";
const packageJson = require("./package.json");
import { red,green,cyan,yellow,blue,bold } from "chalk";
import * as semver from 'semver';
import * as process from "process";
import * as path from "path";
import * as validateProjectName from 'validate-npm-package-name';
import * as fs from "fs-extra";
import * as os from "os";
import * as spawn from "cross-spawn";
import {execSync} from "child_process";
import * as prompts from 'prompts';
import * as tmp from 'tmp';
// @ts-ignore
import hyperQuest from 'hyperquest';
// @ts-ignore
import {unpack} from 'tar-pack';
import {ReadStream} from "fs";
import * as dns from "dns";
import * as url from "url";
import {SemVer} from "semver";

function isUsingYarn() {
    return (process.env.npm_config_user_agent || '').indexOf('yarn') === 0;
}

function isUsingPnpm(){
    return (process.env.npm_config_user_agent || '').indexOf('pnpm') === 0;
}

export function init() {
    let projectName;
    const program = new Command(packageJson.name)
        .version(packageJson.version,'-v, --version','display the current version')
        .arguments('<project-directory>')
        .usage(`${green('<project-directory>')} [options]`)
        .action(name => {
            projectName = name;
        })
        .option('--verbose', 'print additional logs')
        .option('--info', 'print environment debug info')
        .option(
            '--template <path-to-template>',
            'specify a template for the created project'
        )
        .allowUnknownOption()
        .on('--help', () => {
            console.log(`Only ${green('<project-directory>')} is required`)
            console.log(`If you have any problems, do not hesitate to file an issue:`);
            console.log(`${cyan('https://gitee.com/tyttyty/create-template/issues/new')}`)
        })
        .parse(process.argv);
    if (typeof projectName === 'undefined') {
        console.error('Please specify the project directory:');
        console.log(
            `  ${cyan(program.name())} ${green('<project-directory>')}`
        );
        console.log();
        console.log('For example:');
        console.log(
            `  ${cyan(program.name())} ${green('my-react-app')}`
        );
        console.log();
        console.log(
            `Run ${cyan(`${program.name()} --help`)} to see all options.`
        );
        process.exit(1);
    }
    createApp(
        projectName,
        program.getOptionValue('verbose'),
        // @ts-ignore
        program._version,
        program.getOptionValue('template'),
    )
}

function createApp(projectName: string, verbose: string, version:string, template: string, useYarn = false, usePnpm = false){
    const unsupportedNodeVersion = !semver.satisfies(
        // Coerce strings with metadata (i.e. `15.0.0-nightly`).
        semver.coerce(process.version)||process.version,
        '>=14'
    );
    if (unsupportedNodeVersion) {
        console.log(
            yellow(
                `You are using Node ${process.version} so the project will be bootstrapped with an old unsupported version of tools.\n\n` +
                `Please update to Node 14 or higher for a better, fully supported experience.\n`
            )
        );
        // Fall back to the latest supported react-scripts on Node 4
        version = 'create-scripts@0.9.x';
    }
    const root = path.resolve(projectName);
    const appName = path.basename(root);
    checkAppName(appName);
    fs.ensureDirSync(projectName);
    if (!isSafeToCreateProjectIn(root, projectName)) {
        process.exit(1);
    }
    console.log();

    console.log(`Creating a new React app in ${green(root)}.`);
    console.log();
    const packageJson = {
        name: appName,
        version: '0.1.0',
        private: true,
    };
    fs.writeFileSync(
        path.join(root,'package.json'),
        JSON.stringify(packageJson,null,2)+os.EOL
    )
    const originalDirectory = process.cwd();
    process.chdir(root);
    if (!useYarn && !checkThatNpmCanReadCwd()) {
        process.exit(1);
    }
    if (!useYarn) {
        const npmInfo = checkNpmVersion();
        if (!npmInfo.hasMinNpm) {
            if (npmInfo.npmVersion) {
                console.log(
                    yellow(
                        `You are using npm ${npmInfo.npmVersion} so the project will be bootstrapped with an old unsupported version of tools.\n\n` +
                        `Please update to npm 6 or higher for a better, fully supported experience.\n`
                    )
                );
            }
            version = 'react-scripts@0.9.x';
        }
    }
    run(
        root,
        appName,
        version,
        verbose,
        originalDirectory,
        template,
        useYarn,
    );
}

function checkAppName(appName:string){
    const validationResult = validateProjectName(appName);
    if(!validationResult.validForNewPackages){
        console.error(
            red(
                `Cannot create a project named ${green(
                    `"${appName}"`
                )} because of npm naming restrictions:\n`
            )
        );
        [
            ...(validationResult.errors || []),
            ...(validationResult.warnings || []),
        ].forEach(error => {
            console.error(red(`  * ${error}`));
        });
        console.error(red('\nPlease choose a different project name.'));
        process.exit(1);
    }
    const dependencies = ['react', 'react-dom', 'react-scripts'].sort();
    if (dependencies.includes(appName)) {
        console.error(
            red(
                `Cannot create a project named ${green(
                    `"${appName}"`
                )} because a dependency with the same name exists.\n` +
                `Due to the way npm works, the following names are not allowed:\n\n`
            ) +
            cyan(dependencies.map(depName => `  ${depName}`).join('\n')) +
            red('\n\nPlease choose a different project name.')
        );
        process.exit(1);
    }
}

function isSafeToCreateProjectIn(root:string,name:string){
    const validFiles = [
        '.DS_Store',
        '.git',
        '.gitattributes',
        '.gitignore',
        '.gitlab-ci.yml',
        '.hg',
        '.hgcheck',
        '.hgignore',
        '.idea',
        '.npmignore',
        '.travis.yml',
        'docs',
        'LICENSE',
        'README.md',
        'mkdocs.yml',
        'Thumbs.db',
    ];
    const errorLogFilePatterns = [
        'npm-debug.log',
        'yarn-error.log',
        'yarn-debug.log',
    ];
    const isErrorLog = (file: string) => {
        return errorLogFilePatterns.some(pattern => file.startsWith(pattern));
    };
    const conflicts = fs
        .readdirSync(root)
        .filter(file => !validFiles.includes(file))
        // IntelliJ IDEA creates module files before CRA is launched
        .filter(file => !/\.iml$/.test(file))
        // Don't treat log files from previous installation as conflicts
        .filter(file => !isErrorLog(file));
    if (conflicts.length > 0) {
        console.log(
            `The directory ${green(name)} contains files that could conflict:`
        );
        console.log();
        for (const file of conflicts) {
            try {
                const stats = fs.lstatSync(path.join(root, file));
                if (stats.isDirectory()) {
                    console.log(`  ${blue(`${file}/`)}`);
                } else {
                    console.log(`  ${file}`);
                }
            } catch (e) {
                console.log(`  ${file}`);
            }
        }
        console.log();
        console.log(
            'Either try using a new directory name, or remove the files listed above.'
        );

        return false;
    }
    // Remove any log files from a previous installation.
    fs.readdirSync(root).forEach(file => {
        if (isErrorLog(file)) {
            fs.removeSync(path.join(root, file));
        }
    });
    return true;
}

function checkThatNpmCanReadCwd(){
    const cwd = process.cwd();
    let childOutput = null;
    try{
        childOutput = spawn.sync('npm', ['config', 'list']).output.join('');
    }catch (e) {
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

function checkNpmVersion() {
    let hasMinNpm = false;
    let npmVersion = null;
    try {
        npmVersion = execSync('npm --version').toString().trim();
        hasMinNpm = semver.gte(npmVersion, '6.0.0');
    } catch (err) {
        // ignore
    }
    return {
        hasMinNpm: hasMinNpm,
        npmVersion: npmVersion,
    };
}

async function run(
    root:string,
    appName:string,
    version:string,
    verbose:any,
    originalDirectory:string,
    template:any,
    useYarn = false,
){
    const packageToInstall = await  getInstallPackage(version,originalDirectory);
    const templateToInstall = await getTemplateInstallPackage(template,originalDirectory);
    const allDependencies = ['react', 'react-dom', packageToInstall];
    console.log('Installing packages. This might take a couple of minutes.');
    const packageInfo:{name: string, version?: string} = await getPackageInfo(packageToInstall);
    const templateInfo = await getPackageInfo(templateToInstall);
    const isOnline = await checkIfOnline(useYarn);
    let packageVersion:string| SemVer | null = semver.coerce(packageInfo.version);
    const templatesVersionMinimum = '3.3.0';
    if (!semver.valid(packageVersion)) {
        packageVersion = templatesVersionMinimum;
    }
    const supportsTemplates = semver.gte(
        packageVersion||'',
        templatesVersionMinimum
    );
    if (supportsTemplates) {
        allDependencies.push(templateToInstall);
    } else if (template) {
        console.log('');
        console.log(
            `The ${cyan(packageInfo.name)} version you're using ${
                packageInfo.name === 'react-scripts' ? 'is not' : 'may not be'
            } compatible with the ${cyan('--template')} option.`
        );
        console.log('');
    }
    console.log(
        `Installing ${cyan('react')}, ${cyan(
            'react-dom'
        )}, and ${cyan(packageInfo.name)}${
            supportsTemplates ? ` with ${cyan(templateInfo.name)}` : ''
        }...`
    );
    console.log();
    await install(
        root,
        useYarn,
        allDependencies,
        verbose,
        isOnline
    );
   try {
       const packageName = packageInfo.name;
       const templateName = supportsTemplates ? templateInfo.name : undefined;
       checkNodeVersion(packageName);
       setCaretRangeForRuntimeDeps(packageName);
       const nodeArgs: any[] = [];
       await executeNodeScript(
           {
               cwd: process.cwd(),
               args: nodeArgs,
           },
           [root, appName, verbose, originalDirectory, templateName],
           `
        const init = require('${packageName}/scripts/init.js');
        init.apply(null, JSON.parse(process.argv[1]));
      `
       );
       if (version === 'react-scripts@0.9.x') {
           console.log(
               yellow(
                   `\nNote: the project was bootstrapped with an old unsupported version of tools.\n` +
                   `Please update to Node >=14 and npm >=6 to get supported tools in new projects.\n`
               )
           );
       }
   }catch (reason:any){
       console.log();
       console.log('Aborting installation.');
       if (reason.command) {
           console.log(`  ${cyan(reason.command)} has failed.`);
       } else {
           console.log(
               red('Unexpected error. Please report it as a bug:')
           );
           console.log(reason);
       }
       console.log();

       // On 'exit' we will delete these files from target directory.
       const knownGeneratedFiles = ['package.json', 'node_modules'];
       const currentFiles = fs.readdirSync(path.join(root));
       currentFiles.forEach(file => {
           knownGeneratedFiles.forEach(fileToMatch => {
               // This removes all knownGeneratedFiles.
               if (file === fileToMatch) {
                   console.log(`Deleting generated file... ${cyan(file)}`);
                   fs.removeSync(path.join(root, file));
               }
           });
       });
       const remainingFiles = fs.readdirSync(path.join(root));
       if (!remainingFiles.length) {
           // Delete target folder if empty
           console.log(
               `Deleting ${cyan(`${appName}/`)} from ${cyan(
                   path.resolve(root, '..')
               )}`
           );
           process.chdir(path.resolve(root, '..'));
           fs.removeSync(path.join(root));
       }
       console.log('Done.');
       process.exit(1);
   }
}

function install(root:string, useYarn:boolean, dependencies:Array<any>, verbose:boolean, isOnline:boolean) {
    return new Promise<void>((resolve, reject) => {
        let command: string;
        let args: string[] = [];
        if (useYarn) {
            command = 'yarnpkg';
            args = ['add', '--exact'];
            if (!isOnline) {
                args.push('--offline');
            }
            args = [...args,...dependencies];

            // Explicitly set cwd() to work around issues like
            // https://github.com/facebook/create-react-app/issues/3326.
            // Unfortunately we can only do this for Yarn because npm support for
            // equivalent --prefix flag doesn't help with this issue.
            // This is why for npm, we run checkThatNpmCanReadCwd() early instead.
            args.push('--cwd');
            args.push(root);

            if (!isOnline) {
                console.log(yellow('You appear to be offline.'));
                console.log(yellow('Falling back to the local Yarn cache.'));
                console.log();
            }
        } else {
            command = 'npm';
            args = [
                'install',
                '--no-audit', // https://github.com/facebook/create-react-app/issues/11174
                '--save',
                '--save-exact',
                '--loglevel',
                'error',
            ].concat(dependencies);
        }

        if (verbose) {
            args.push('--verbose');
        }
        // 调用命令
        const child = spawn(command, args, { stdio: 'inherit' });
        child.on('close', code => {
            if (code !== 0) {
                reject({
                    command: `${command} ${args.join(' ')}`,
                });
                return;
            }
            resolve();
        });
    });
}

function getInstallPackage(version:string,originalDirectory:string){
    let packageToInstall = 'react-scripts';
    const validSemver = semver.valid(version);
    if (validSemver) {
        packageToInstall += `@${validSemver}`;
    } else if (version) {
        if (version[0] === '@' && !version.includes('/')) {
            packageToInstall += version;
        } else if (version.match(/^file:/)) {
            packageToInstall = `file:${path.resolve(
                originalDirectory,
                (version.match(/^file:(.*)?$/)||[])[1]||''
            )}`;
        } else {
            // for tar.gz or alternative paths
            packageToInstall = version;
        }
    }
    const scriptsToWarn = [
        {
            name: 'react-scripts-ts',
            message: yellow(
                `The react-scripts-ts package is deprecated. TypeScript is now supported natively in Create React App. You can use the ${green(
                    '--template typescript'
                )} option instead when generating your app to include TypeScript support. Would you like to continue using react-scripts-ts?`
            ),
        },
    ];
    for (const script of scriptsToWarn) {
        if (packageToInstall.startsWith(script.name)) {
            return prompts({
                type: 'confirm',
                name: 'useScript',
                message: script.message,
                initial: false,
            }).then(answer => {
                if (!answer.useScript) {
                    process.exit(0);
                }

                return packageToInstall;
            });
        }
    }

    return Promise.resolve(packageToInstall);
}

function getTemplateInstallPackage(template:string, originalDirectory:string){
    let templateToInstall = 'cra-template';
    if (template) {
        if (template.match(/^file:/)) {
            templateToInstall = `file:${path.resolve(
                originalDirectory,
                (template.match(/^file:(.*)?$/)||[])[1]||''
            )}`;
        } else if (
            template.includes('://') ||
            template.match(/^.+\.(tgz|tar\.gz)$/)
        ) {
            templateToInstall = template;
        } else {
            const packageMatch = template.match(/^(@[^/]+\/)?([^@]+)?(@.+)?$/)||[];
            const scope = packageMatch[1] || '';
            const templateName = packageMatch[2] || '';
            const version = packageMatch[3] || '';

            if (
                templateName === templateToInstall ||
                templateName.startsWith(`${templateToInstall}-`)
            ) {
                templateToInstall = `${scope}${templateName}${version}`;
            } else if (version && !scope && !templateName) {
                templateToInstall = `${version}/${templateToInstall}`;
            } else {
                templateToInstall = `${scope}${templateToInstall}-${templateName}${version}`;
            }
        }
    }

    return Promise.resolve(templateToInstall);
}

function getPackageInfo(installPackage:string){
    if (installPackage.match(/^.+\.(tgz|tar\.gz)$/)) {
        return getTemporaryDirectory()
            .then((obj:any) => {
                let stream;
                if (/^http/.test(installPackage)) {
                    stream = hyperQuest(installPackage);
                } else {
                    stream = fs.createReadStream(installPackage);
                }
                return extractStream(stream, obj.tmpdir).then(() => obj);
            })
            .then(obj => {
                const { name, version } = require(path.join(
                    obj.tmpdir,
                    'package.json'
                ));
                obj.cleanup();
                return { name, version };
            })
            .catch(err => {
                console.log(
                    `Could not extract the package name from the archive: ${err.message}`
                );
                const assumedProjectName = (installPackage.match(
                    /^.+\/(.+?)(?:-\d+.+)?\.(tgz|tar\.gz)$/
                )||[])[1]||'';
                console.log(
                    `Based on the filename, assuming it is "${cyan(
                        assumedProjectName
                    )}"`
                );
                return Promise.resolve({ name: assumedProjectName });
            });
    } else if (installPackage.startsWith('git+')) {
        return Promise.resolve({
            name: (installPackage.match(/([^/]+)\.git(#.*)?$/)||[])[1]||'',
        });
    } else if (installPackage.match(/.+@/)) {
        // Do not match @scope/ when stripping off @version or @tag
        return Promise.resolve({
            name: installPackage.charAt(0) + installPackage.substring(1).split('@')[0],
            version: installPackage.split('@')[1],
        });
    } else if (installPackage.match(/^file:/)) {
        const installPackagePath = (installPackage.match(/^file:(.*)?$/)||[])[1];
        const { name, version } = require(path.join(
            installPackagePath,
            'package.json'
        ));
        return Promise.resolve({ name, version });
    }
    return Promise.resolve({ name: installPackage });
}

function getTemporaryDirectory(){
    return new Promise((resolve, reject) => {
        tmp.dir({ unsafeCleanup: true }, (err:any, tmpdir, callback) => {
            if (err) {
                reject(err);
            } else {
                resolve({
                    tmpdir: tmpdir,
                    cleanup: () => {
                        try {
                            callback();
                        } catch (ignored) {
                        }
                    },
                });
            }
        });
    });
}

function extractStream(stream:ReadStream, dest:string) {
    return new Promise((resolve, reject) => {
        stream.pipe(
            unpack(dest,(err:any)=> {
                if (err) {
                    reject(err);
                } else {
                    resolve(dest);
                }
            })
        );
    });
}

function checkIfOnline(useYarn:boolean) {
    if (!useYarn) {
        // Don't ping the Yarn registry.
        // We'll just assume the best case.
        return Promise.resolve(true);
    }

    return new Promise<boolean>(resolve => {
        dns.lookup('registry.yarnpkg.com', err => {
            let proxy;
            if (err && (proxy = getProxy())) {
                // If a proxy is defined, we likely can't resolve external hostnames.
                // Try to resolve the proxy name as an indication of a connection.
                dns.lookup((url.parse(proxy)||{}).hostname||'', proxyErr => {
                    resolve(!proxyErr);
                });
            } else {
                resolve(!err);
            }
        });
    });
}

function getProxy() {
    if (process.env.https_proxy) {
        return process.env.https_proxy;
    } else {
        try {
            let httpsProxy = execSync('npm config get https-proxy').toString().trim();
            return httpsProxy !== 'null' ? httpsProxy : undefined;
        } catch (e) {
            return;
        }
    }
}

function checkNodeVersion(packageName:string) {
    const packageJsonPath = path.resolve(
        process.cwd(),
        'node_modules',
        packageName,
        'package.json'
    );

    if (!fs.existsSync(packageJsonPath)) {
        return;
    }

    const packageJson = require(packageJsonPath);
    if (!packageJson.engines || !packageJson.engines.node) {
        return;
    }

    if (!semver.satisfies(process.version, packageJson.engines.node)) {
        console.error(
            red(
                'You are running Node %s.\n' +
                'Create React App requires Node %s or higher. \n' +
                'Please update your version of Node.'
            ),
            process.version,
            packageJson.engines.node
        );
        process.exit(1);
    }
}

function makeCaretRange(dependencies:{[k:string]:string}, name:string) {
    const version = dependencies[name];

    if (typeof version === 'undefined') {
        console.error(red(`Missing ${name} dependency in package.json`));
        process.exit(1);
    }

    let patchedVersion = `^${version}`;

    if (!semver.validRange(patchedVersion)) {
        console.error(
            `Unable to patch ${name} dependency version because version ${red(
                version
            )} will become invalid ${red(patchedVersion)}`
        );
        patchedVersion = version;
    }

    dependencies[name] = patchedVersion;
}

function setCaretRangeForRuntimeDeps(packageName:string) {
    const packagePath = path.join(process.cwd(), 'package.json');
    const packageJson = require(packagePath);

    if (typeof packageJson.dependencies === 'undefined') {
        console.error(red('Missing dependencies in package.json'));
        process.exit(1);
    }

    const packageVersion = (packageJson.dependencies||{})[packageName];
    if (typeof packageVersion === 'undefined') {
        console.error(red(`Unable to find ${packageName} in package.json`));
        process.exit(1);
    }

    makeCaretRange(packageJson.dependencies, 'react');
    makeCaretRange(packageJson.dependencies, 'react-dom');

    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + os.EOL);
}

function executeNodeScript({ cwd, args }:{cwd:string,args:any[]}, data:any[], source:string) {
    return new Promise<void>((resolve, reject) => {
        const child = spawn(
            process.execPath,
            [...args, '-e', source, '--', JSON.stringify(data)],
            { cwd, stdio: 'inherit' }
        );

        child.on('close', code => {
            if (code !== 0) {
                reject({
                    command: `node ${args.join(' ')}`,
                });
                return;
            }
            resolve();
        });
    });
}