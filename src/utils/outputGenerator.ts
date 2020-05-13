import * as path from "path";
import { SFPowerkit, LoggerLevel } from "../sfpowerkit";
import fs = require("fs-extra");
import FileUtils from "./fileutils";

export default class OutputGenerator {
  public async generateJsonOutput(result: any, outputDir: string) {
    let outputJsonPath = `${outputDir}/output.json`;
    let dir = path.parse(outputJsonPath).dir;
    if (!fs.existsSync(dir)) {
      FileUtils.mkDirByPathSync(dir);
    }
    fs.writeFileSync(outputJsonPath, JSON.stringify(result));
    SFPowerkit.log(
      `Output ${outputDir}/output.json is generated successfully`,
      LoggerLevel.INFO
    );
  }

  public async generateCSVOutput(result: string, outputDir: string) {
    let outputcsvPath = `${outputDir}/output.csv`;
    let dir = path.parse(outputcsvPath).dir;

    if (!fs.existsSync(dir)) {
      FileUtils.mkDirByPathSync(dir);
    }

    fs.writeFileSync(outputcsvPath, result);
    SFPowerkit.log(
      `Output ${outputDir}/output.csv is generated successfully`,
      LoggerLevel.INFO
    );
  }
}
