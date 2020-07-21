import * as path from "path";
import { registerNamespace } from "./parallel";
import child_process = require("child_process");

export function loadSFDX(sfdxmoduleDirectory: string) {
  let salesforce_alm_path = "";
  try {
    salesforce_alm_path = path.dirname(
      require.resolve("./salesforce-alm", {
        paths: [path.join(sfdxmoduleDirectory, "node_modules")]
      })
    );
  } catch (error) {
    console.log(error);
    throw error;
  }

  registerNamespace({
    commandsDir: path.join(salesforce_alm_path, "commands"),
    namespace: "force"
  });
}
