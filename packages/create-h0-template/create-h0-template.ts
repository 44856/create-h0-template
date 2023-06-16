import {Command} from "commander";
import {cyan, green, yellow} from "chalk";
import * as process from "process";
import {supportTemplate} from "./utils/constants";
import * as semver from "semver";
import * as path from "path";
import * as fs from "fs-extra";
import {checkThatNpmCanReadCwd, isSafeToCreateProjectIn} from "./utils/utils";

const packageJson = require("./package.json");

export  function init(){
    let template;
    let appName;
    const program = new Command(packageJson.name)
        .version(packageJson.version,'-v, --version','display the current version')
        .arguments('<app-name>')
        .usage(`${green('<app-name>')} ${green('<template-name>')}  [options]`)
        .arguments('<template-name>')
        .usage(`${green('<app-name>')} ${green('<template-name>')} [options]`)
        .action((app,temp)=>{
            appName = app;
            template = temp;
        })
        .option('--template-version','limit template version')
        .allowUnknownOption()
        .on('--help', () => {
            console.log(` Must input ${green('<template-name>')} and ${green('<app-name>')}\n`);
            console.log(` The template list here:\n`)
            console.log(`   ${green(supportTemplate.join(', '))}\n`)
            console.log(` If you have any problems, do not hesitate to file an issue:`);
            console.log(`   ${cyan('https://github.com/44856/create-h0-template/issues/new')}`)
        })
        .parse(process.argv);
    if(typeof appName === 'undefined'){
        console.error(' Please specify the app name:');
        console.log(
            `  ${cyan(program.name())} ${green('<app-name>')} ${green('<template-name>')} \n`
        );
        console.log(
            ` Run ${cyan(`${program.name()} --help`)} to see all options.`
        );
        process.exit(1);
    }
    if(typeof template === 'undefined'){
        console.error(' Please specify the template name:');
        console.log(
            `  ${cyan(program.name())} ${green('<template-name>')}\n`
        );
        console.log(' For example:');
        console.log(
            `  ${cyan(program.name())} ${green('<app-name>')} ${green('<template-name>')}`
        );
        console.log(
            ` Run ${cyan(`${program.name()} --help`)} to see all options.`
        );
        process.exit(1);
    }
    if(!supportTemplate.includes(template)){
        console.error(' Not support template name!');
        console.log(' Only limit template name for:\n');
        console.log(`   ${green(supportTemplate.join(', '))}\n`);
        console.log(
            ` Run ${cyan(`${program.name()} --help`)} to see all options.`
        );
        process.exit(1);
    }
    injectTemplate(
        appName,
        template,
        packageJson.version,
        program.getOptionValue('template-version')
    );
}

function injectTemplate(appName:string,template:string,version:string,templateVersion:string){
    const unsupportedNodeVersion = !semver.satisfies(
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
    }
    if(!fs.existsSync('src/pages')){
        console.error('The directory structure is not right!');
        process.exit(1);
    }
    const originalDirectory = process.cwd();
    const root = path.resolve(originalDirectory);
    const appPath = path.resolve(root,`src/pages/${appName}`);
    fs.ensureDirSync(appPath);
    if(!isSafeToCreateProjectIn(appPath)){
        process.exit(1);
    }
    console.log(`\nInject code in ${green(appPath)}.\n`);
    if (!checkThatNpmCanReadCwd()) {
        process.exit(1);
    }
    run(
        root,
        appName,
        template,
        version,
        appPath,
        templateVersion,
    );
}

function run(
    root:string,
    appName:string,
    template:string,
    version:string,
    appPath:string,
    templateVersion:string
) {
    const templatePath = path.resolve(__dirname,'template');
    const templateDir = path.join(templatePath, template);
    if(fs.existsSync(templateDir)){
        fs.copySync(templateDir,appPath);
    }else {
        console.error(
            `Could not locate supplied template: ${green(templateDir)}`
        );
        return;
    }
    console.log(`   ${green('Finish')}`);
}