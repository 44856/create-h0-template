import {Command} from "commander";
import {cyan, green, yellow} from "chalk";
import * as process from "process";
import * as semver from "semver";
import * as path from "path";
import * as fs from "fs-extra";
import generator from "@babel/generator";
import { parse } from "@babel/parser";
import traverse, {NodePath} from "@babel/traverse";
import {checkThatNpmCanReadCwd, injectObj, isSafeToCreateProjectIn} from "./utils/utils";
import {h0Templates, pdaTemplates, supportTemplate} from "./utils/constants";
import {CallExpression, VariableDeclaration} from "@babel/types";
import {AnyObj, InjectFile, TemplateName} from "./types";

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
        .option('--template-version <string>','limit template version')
        .option('-cli,--cli-version <string>','limit cli version,in hzeroJs or hzeroCli')
        .option('--sub-module <string>','subModule the app in,only base on H0 structure','aps')
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
    const opts = program.opts();
    injectTemplate(
        getNameByTemplate(appName,template),
        template,
        packageJson.version,
        opts.templateVersion,
        opts.cliVersion,
        opts.subModule
    );
}

function getNameByTemplate(appName:string,template:TemplateName) {
    if(template==='listPage'){
        return `${appName.charAt(0).toUpperCase()}${appName.slice(1)}`
    }
    return appName;
}

function injectTemplate(
    appName:string,
    template:TemplateName,
    version:string,
    templateVersion:string,
    cliVersion:string,
    subModule:string
){
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
    // 解析注入目录参数
    const originalDirectory = process.cwd();
    const root = path.resolve(originalDirectory);
    let appPath = '';
    let code:Array<InjectFile> = [];
    // 依据不同模板处理文件注入内容
    if(h0Templates.includes(template)){
        [appPath,code] = injectH0Template(root,appName,cliVersion);
    }else if(pdaTemplates.includes(template)){
        [appPath,code] = injectPDATemplate(root,appName);
    }
    // 确保文件夹存在
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
        code,
        subModule,
        templateVersion,
    );
}

function injectH0Template(
    root:string,
    appName:string,
    cliVersion:string = 'hzeroJs',
):[string,Array<InjectFile>] {
    const pageDir = 'src/pages';
    const routeFilePath = cliVersion === 'hzeroJs' ? 'config/config.ts' : 'src/config/routers.ts'
    const appPath = path.resolve(root,`${pageDir}/${appName}`);
    // 检查目录结构
    if(!fs.existsSync(pageDir)){
        console.error('The directory structure is not right!');
        process.exit(1);
    }
    // 检查路由配置文件是否存在
    const hasRouteFile = fs.existsSync(routeFilePath);
    if(!hasRouteFile){
        console.error('The route file lost!');
        return [appPath,[]]
    }
    const routeFile = path.resolve(root,routeFilePath);
    const routePath =  `/aps/${appName}`;
    const code = injectH0Route(routeFile,appName,cliVersion,{
        path:routePath,
        routes: [
            {
                path: `${routePath}/list`,
                component: `@/pages/${appName}/list/listPage`,
            },
        ],
    }).code;
    return [
        appPath,
       [
           {
               code:code.replaceAll('\"','\''),
               path:routeFile,
           }
       ]
    ];
}

function injectH0Route(
    file:string,
    appName:string,
    cliVersion:string,
    routeObj:AnyObj
){
    const routeName = cliVersion === 'hzeroJs' ? 'routes' : 'config';
    const code = fs.readFileSync(file,'utf-8')
    const ast = parse(code,{sourceType:'unambiguous',plugins:['typescript']});
    // 区分架构版本注入路由参数
    const visitor =cliVersion === 'hzeroJs' ? {
        CallExpression(path: NodePath<CallExpression>) {
            const node = path.node;
            if(!node){
                return;
            }
            const argument = node.arguments[0];
            const {properties = []} = argument as any;
            const target = properties.find((item:any)=>item.key&&item.key.name===routeName);
            if(!target){
                return;
            }
            target.value.elements.push(injectObj(routeObj));
        }
    }:{
        VariableDeclaration(path: NodePath<VariableDeclaration>) {
            const node = path.node;
            if(!node){
                return;
            }
            const {declarations= []} = node;
            const target = declarations.find((item:any)=>item.id&&item.id.name===routeName);
            if(!target){
                return;
            }
            if(target.init?.type === 'ArrayExpression'){
                target.init.elements.push(injectObj(routeObj));
            }
        }
    };
    traverse(ast, visitor);
    return generator(ast, {}, code);
}

function injectPDATemplate(root:string,appName:string):[string,Array<InjectFile>] {
    // 检查目录结构
    const pageDir = 'src/modules';
    if(!fs.existsSync(pageDir)){
        console.error('The directory structure is not right!');
        process.exit(1);
    }
    let code:Array<InjectFile> = [];
    const appPath = path.resolve(root,`${pageDir}/${appName}`);
    return [appPath,code];
}

function injectH0TemplateFile(dir:string,template:TemplateName,appName:string,subModule:string) {
    if(template==='listPage'){
        const listFilePath = path.resolve(dir,'list/listPage.tsx');
        const listDsPath = path.resolve(dir,'list/listPageDs.ts');
        const listFile = fs.readFileSync(listFilePath,'utf-8');
        const dsFile = fs.readFileSync(listDsPath,'utf-8');
        const newAppName = `${appName.charAt(0).toLowerCase()}${appName.slice(1)}`;
        const newListFile = listFile.replaceAll('子模块名称.功能名称',`${subModule}.${newAppName}`)
                                .replaceAll('子模块名称',subModule);
        const newDsFile = dsFile.replaceAll('子模块名称.功能名称',`${subModule}.${newAppName}`);
        fs.writeFileSync(listFilePath,newListFile);
        fs.writeFileSync(listDsPath,newDsFile);
    }
}

function injectTemplateFile(dir:string,template:TemplateName,appName:string,subModule:string){
    if(h0Templates.includes(template)){
        injectH0TemplateFile(dir,template,appName,subModule);
    }
}

function run(
    root:string,
    appName:string,
    template:TemplateName,
    version:string,
    appPath:string,
    injectArgs:Array<InjectFile>,
    subModule:string,
    templateVersion:string
) {
    const templatePath = path.resolve(__dirname,'template');
    const templateDir = path.join(templatePath, template);
    const tempDir = path.resolve(__dirname,'tmp');
    if(fs.existsSync(templateDir)){
        fs.ensureDirSync(tempDir);
        fs.copySync(templateDir,tempDir);
        injectTemplateFile(tempDir,template,appName,subModule);
        fs.copySync(tempDir,appPath);
        fs.emptyDirSync(tempDir);
        // 文件代码注入
        for(const file of injectArgs){
            fs.writeFileSync(file.path,file.code);
        }
    }else {
        console.error(
            `Could not locate supplied template: ${green(templateDir)}`
        );
        return;
    }
    console.log(`   ${green('Finish')}`);
}