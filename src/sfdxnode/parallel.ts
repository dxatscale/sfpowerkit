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
    if (path.basename(path.dirname(child_path)) == "src") { //Run in linking, ts is ran using ts-node, so use the compiled child.js
      //Linked
      child_path = path.join(
        path.dirname(path.dirname(child_path)),
        "lib",
        "sfdxnode"
      );
    }
    const child = fork(path.join(child_path, "./child.js"), ["--colors"], {
      cwd: flags.cwd ? flags.cwd.toString() : null
    });
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
  const { commandsDir, namespace, additionalNameSpace }: SfdxNamespace = sfdxNamespace;
  if(additionalNameSpace)
  {
  sfdx[additionalNameSpace] = buildCommands(
    createParallelCommand,
    commandsDir,
    namespace,
    additionalNameSpace
  );

 
  }
  else
   sfdx[namespace] = buildCommands(
     createParallelCommand,
     commandsDir,
     namespace
   );
}
