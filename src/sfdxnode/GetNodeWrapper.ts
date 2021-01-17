import * as path from "path";
import { registerNamespace } from "./parallel";

export function loadSFDX() {
  let salesforce_alm_path = "";
  let user_plugin_path="";
  try {
    salesforce_alm_path = path.dirname(require.resolve("salesforce-alm"));
    user_plugin_path=path.dirname(path.join(__dirname,`../../node_modules/@salesforce/plugin-user/lib/package.json`));
  } catch (error) {
    console.log(error);
    throw error;
  }

  registerNamespace({
    commandsDir: path.join(salesforce_alm_path, "commands"),
    namespace: "force"
  });

  registerNamespace({
    commandsDir: path.join(user_plugin_path, "commands"),
    namespace: "force",
    additionalNameSpace:"userplugin"
  });
}
