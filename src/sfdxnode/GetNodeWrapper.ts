import * as path from "path";
import { registerNamespace } from "./parallel";

export function loadSFDX() {
  let salesforce_alm_path = "";
  let user_plugin_path="";
  try {
    salesforce_alm_path = path.dirname(require.resolve("salesforce-alm"));
    console.log("Sale",salesforce_alm_path);
    user_plugin_path=path.join(salesforce_alm_path,`../../@salesforce/plugin-user/lib`);
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
