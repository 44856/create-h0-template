import process from "process";

export function getNodeVersion() {
    const currentNodeVersion = process.versions.node;
    const semver = currentNodeVersion.split(".");
    return [currentNodeVersion,Number(semver[0])];
}