import { Connection, DeployResult } from "jsforce";
import { delay } from "../shared/delay";

export async function checkDeploymentStatus(
  conn: Connection,
  retrievedId: string
): Promise<DeployResult> {
  let metadata_result;

  while (true) {
    await conn.metadata.checkDeployStatus(retrievedId, true, function(
      error,
      result
    ) {
      if (error) {
        return console.error(error);
      }
      metadata_result = result;
    });

    if (!metadata_result.done) {
      console.log(`Polling for Deployment Status`);
      await delay(5000);
    } else {
      break;
    }
  }
  return metadata_result;
}
