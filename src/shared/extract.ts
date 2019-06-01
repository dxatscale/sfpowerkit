
import fs from 'fs-extra';
var unzipper = require('unzipper')

export async function extract(location: string)
{

    return new Promise((resolve, reject) => {
        fs.createReadStream(`./${location}/unpackaged.zip`)
          .pipe(unzipper.Extract({ path: `${location}` }))
          .on('close', () => {
            resolve();
          })
          .on('error', error => reject(error));
      });
}



