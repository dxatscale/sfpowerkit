import { buildArgs } from "./buildArgs";
const hookStd = require("hook-std");
import { parseErrors } from "./process-errors";
import { CreateCommandFunc, Flags, Opts } from "./types";

const realStdoutWrite = process.stdout.write;
const realStderrWrite = process.stderr.write;
let sfdxErrors = [];

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
process.on("cmdError", errObj => {
  sfdxErrors.push(errObj);
});

const unhookStd = () => {
  process.stdout.write = realStdoutWrite;
  process.stderr.write = realStderrWrite;
};

export const createCommand: CreateCommandFunc = (
  commandId: string,
  commandName: string,
  commandFile: string
) => (flags: Flags = {}, opts: Opts = []) =>
  new Promise((resolve, reject) => {
    // tslint:disable-next-line:non-literal-require
    const required = require(commandFile);
    const command = required.default || required[commandName];
    command.id = commandId;
    const args: string[] = buildArgs(flags, opts);
    const quiet: boolean = Boolean(flags.quiet) || false;

    let currentHookFlag = false;
    if (quiet) {
      hookStd(() => undefined);
      currentHookFlag = true;
    }
    sfdxErrors = [];
    command
      .run(args)
      .then(sfdxResult => {
        if (quiet && currentHookFlag) {
          currentHookFlag = false;
          unhookStd();
        }
        if (sfdxErrors.length) {
          throw sfdxErrors;
        }
        if (process.exitCode) {
          process.exitCode = 0;
        }
        resolve(sfdxResult);
      })
      .catch(sfdxErr => {
        if (quiet && currentHookFlag) {
          currentHookFlag = false;
          unhookStd();
        }
        if (process.exitCode) {
          process.exitCode = 0;
        }
        reject(parseErrors(sfdxErr));
      });
  });
