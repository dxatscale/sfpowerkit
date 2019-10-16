import fs from "fs-extra";
var unzipper = require("unzip-stream");

export async function extract(path: string, location: string) {
  return new Promise((resolve, reject) => {
    fs.createReadStream(path)
      .pipe(unzipper.Extract({ path: `${location}` }))
      .on("close", () => {
        resolve();
      })
      .on("error", error => reject(error));
  });
}
