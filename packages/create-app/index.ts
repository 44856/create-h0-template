#!/usr/bin/env node

import * as process from "process";
import { init } from "./creat-app";

const currentNodeVersion = process.versions.node;

const semver = currentNodeVersion.split(".");

const major = Number(semver[0]);

if (major < 14) {
    console.error(
        '   You are running Node ' +
        currentNodeVersion +
        '   .\n' +
        '   Create h0 template requires Node 14 or higher. \n' +
        '   Please update your version of Node.'
    );
    process.exit(1);
}

init();