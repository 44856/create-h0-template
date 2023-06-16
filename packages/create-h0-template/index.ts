import * as process from "process";
import { init } from "./create-h0-template";
import {getNodeVersion} from "./utils/utils";

const [currentNodeVersion,major] = getNodeVersion();

if (major < 14) {
    console.error(
        '   You are running Node ' +
        currentNodeVersion +
        '   .\n' +
        '   Create React App requires Node 14 or higher. \n' +
        '   Please update your version of Node.'
    );
    process.exit(1);
}

init();