import { fork } from "child_process";
import * as path from "path";
import { buildCommands } from "./builder";
import {
  CreateCommandFunc,
  Flags,
  Opts,
  SfdxApi,
  SfdxNamespace,
  SfdxNodeMessage
} from "./types";

const createParallelCommand: CreateCommandFunc = (
  commandId: string,
  commandName: string,
  commandFile: string
) => (flags: Flags, opts: Opts) =>
  new Promise((resolve, reject) => {
    let child_path = __dirname.toString();
    if (path.basename(path.dirname(child_path)) == "src") {
      //Linked
      child_path = path.join(
        path.dirname(path.dirname(child_path)),
        "lib",
        "sfdxnode"
      );
    }

    const child = fork(path.join(child_path, "./child.js"), ["--colors"]);
    child.on("message", (message: any) => {
      if (message.type === "resolved") {
        resolve(message.value);
      } else if (message.type === "rejected") {
        reject(message.value);
      }
    });
    const childMsg: SfdxNodeMessage = {
      commandFile,
      commandId,
      commandName,
      flags,
      opts
    };
    child.send(childMsg);
  });

export const sfdx: SfdxApi = new SfdxApi();

export function registerNamespace(sfdxNamespace: SfdxNamespace): void {
  const { commandsDir, namespace }: SfdxNamespace = sfdxNamespace;
  sfdx[namespace] = buildCommands(
    createParallelCommand,
    commandsDir,
    namespace
  );
}
