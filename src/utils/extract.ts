import * as fs from "fs-extra";
const unzipper = require("unzip-stream");

export async function extract(path: string, location: string) {
  return new Promise<void>((resolve, reject) => {
    fs.createReadStream(path)
      .pipe(unzipper.Extract({ path: `${location}` }))
      .on("close", () => {
        resolve();
      })
      .on("error", error => reject(error));
  });
}
