import * as fs from "fs-extra";
import * as path from "path";
import { CreateCommandFunc, NsApi, SfdxCommandDefinition } from "./types";

const pascalCase = (it: string[]) =>
  it.map(word => word[0].toUpperCase() + word.slice(1).toLowerCase()).join("");

function preprocessCommandsDir(
  commandsDir: string,
  namespace: string,
  parts: string[]
): SfdxCommandDefinition[] {
  const cmdArray: SfdxCommandDefinition[] = [];
  const dir = path.join(commandsDir, ...parts);
  fs.readdirSync(dir)
    .sort((a: string, b: string) => {
      const statA = fs.statSync(path.join(dir, a));
      const statB = fs.statSync(path.join(dir, b));
      return statA.isFile() === statB.isFile()
        ? 0
        : statA.isFile() <= statB.isFile()
        ? 1
        : -1;
    })
    .forEach(fileOrDir => {
      const commandFile = path.join(dir, fileOrDir);
      const fileNameWithoutExt = fileOrDir.replace(".js", "");
      const newParts = [...parts, fileNameWithoutExt];
      const stat = fs.statSync(commandFile);
      if (stat.isFile()) {
        if (newParts.length > 0 && path.extname(commandFile) === ".js") {
          cmdArray.push({
            commandFile,
            commandId: [namespace, ...newParts].join(":"),
            commandName: pascalCase([...newParts, "command"])
          });
        }
      } else if (stat.isDirectory()) {
        cmdArray.push(
          ...preprocessCommandsDir(commandsDir, namespace, newParts)
        );
      }
    });
  return cmdArray;
}

function processBaseCommand(
  moduleDir: string,
  namespace: string
): SfdxCommandDefinition | undefined {
  if (fs.existsSync(path.join(moduleDir, `${namespace}.js`))) {
    return {
      commandFile: path.join(moduleDir, `${namespace}.js`),
      commandId: namespace,
      commandName: pascalCase([namespace, "command"])
    };
  }
}

export function buildCommands(
  createCommand: CreateCommandFunc,
  moduleDir: string,
  namespace: string
): NsApi {
  const base = processBaseCommand(moduleDir, namespace);
  const nsApi: NsApi = base
    ? createCommand(base.commandId, base.commandName, base.commandFile)
    : {};
  preprocessCommandsDir(path.join(moduleDir, namespace), namespace, []).forEach(
    ({ commandId, commandName, commandFile }: SfdxCommandDefinition) => {
      const parts = commandId.split(":").slice(1);
      parts.reduce((api: any, part: string) => {
        if (!api.hasOwnProperty(part)) {
          if (parts[parts.length - 1] === part) {
            api[part] = createCommand(commandId, commandName, commandFile);
          } else {
            api[part] = {};
          }
        }
        return api[part];
      }, nsApi);
    }
  );
  return nsApi;
}
