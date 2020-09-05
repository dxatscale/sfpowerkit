import { core } from "@salesforce/command";

export async function retrieveMetadata(
  types: any,
  connection: core.Connection
): Promise<string[]> {
  const apiversion = await connection.retrieveMaxApiVersion();
  let toReturn: Promise<string[]> = new Promise<string[]>((resolve, reject) => {
    connection.metadata.list(types, apiversion, function (err, metadata) {
      if (err) {
        return reject(err);
      }
      let metadata_fullnames = [];
      for (let i = 0; i < metadata.length; i++) {
        metadata_fullnames.push(metadata[i].fullName);
      }
      resolve(metadata_fullnames);
    });
  });

  return toReturn;
}
