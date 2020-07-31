import { parseErrors } from "./process-errors";
import { createCommand } from "./run";
import { SfdxNodeMessage } from "./types";

const sendResolved = value => {
  process.send({
    type: "resolved",
    value
  });
};
const sendRejected = value => {
  process.send({
    type: "rejected",
    value: parseErrors(value)
  });
};

function onMessage(message: SfdxNodeMessage): void {
  process.removeListener("message", onMessage);
  if (
    message &&
    message.commandId &&
    message.commandName &&
    message.commandFile
  ) {
    const {
      commandId,
      commandName,
      commandFile,
      flags,
      opts
    }: SfdxNodeMessage = message;
    try {
      const command = createCommand(commandId, commandName, commandFile);
      const value = command(flags, opts);
      if (value && typeof value.then === "function") {
        value.then(sendResolved).catch(sendRejected);
      } else {
        sendResolved(value);
      }
    } catch (err) {
      sendRejected(err);
    }
  }
}

process.on("message", onMessage);
