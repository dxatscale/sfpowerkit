import { SfdxNodeError } from "./types";

export const parseErrors = (sfdxErrors: any) =>
  Array.isArray(sfdxErrors)
    ? sfdxErrors.map(parseError)
    : [parseError(sfdxErrors)];

function parseError(error: any): SfdxNodeError {
  function hasOwnProperty(value: string): boolean {
    return (error || {}).hasOwnProperty && (error || {}).hasOwnProperty(value);
  }

  if (hasOwnProperty("error")) {
    return parseError(error.error);
  } else if (error instanceof Error) {
    return parseNativeError(error);
  } else if (hasOwnProperty("message")) {
    return error;
  } else if (typeof error === "string") {
    return { message: error };
  }
  const str = String(error);
  return {
    message: str !== "[object Object]" ? str : JSON.stringify(error)
  };
}

const parseNativeError = (error: Error): SfdxNodeError => {
  return Object.getOwnPropertyNames(error).reduce(
    (result: SfdxNodeError, key: string) => {
      if (key !== "__proto__" && typeof error[key] !== "function") {
        result[key] = error[key];
      }
      return result;
    },
    {
      message: ""
    }
  );
};
