import busboy from "busboy";
import type { Request } from "express";
import { ApiError } from "../../lib/errors.js";
import { MAX_BYTES } from "./csv.js";
// Buffer only one bounded file. Entire multipart framing also has a byte limit.
export function receiveCsv(req: Request): Promise<Buffer> {
  if (!req.is("multipart/form-data"))
    throw new ApiError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Select a CSV file using the Import page and upload it again.",
    );
  return new Promise((resolve, reject) => {
    let parser: ReturnType<typeof busboy>;
    try {
      parser = busboy({
        headers: req.headers,
        limits: {
          fileSize: MAX_BYTES + 1,
          files: 1,
          fields: 0,
          parts: 2,
          headerPairs: 100,
        },
      });
    } catch {
      reject(
        new ApiError(400, "INVALID_MULTIPART", "The upload could not be read. Select your CSV file again and retry."),
      );
      return;
    }
    const chunks: Buffer[] = [];
    let bytes = 0,
      fileBytes = 0,
      files = 0;
    let failure: ApiError | undefined;
    let done = false;
    const fail = (error: ApiError) => {
      failure ??= error;
    };
    const finish = (error?: ApiError) => {
      if (done) return;
      done = true;
      req.removeListener("data", measure);
      req.removeListener("aborted", aborted);
      req.removeListener("error", broken);
      if (error || failure) reject(error ?? failure);
      else if (files !== 1)
        reject(
          new ApiError(
            400,
            "INVALID_MULTIPART",
            "No CSV file was received. Select one CSV file and try again.",
          ),
        );
      else resolve(Buffer.concat(chunks));
    };
    const measure = (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > MAX_BYTES + 65536) {
        req.unpipe(parser);
        parser.destroy();
        req.resume();
        finish(
          new ApiError(
            413,
            "FILE_TOO_LARGE",
            "The upload is too large. Choose a CSV file no larger than 5 MiB and remove any extra attachments.",
          ),
        );
      }
    };
    const aborted = () => {
      parser.destroy();
      finish(
        new ApiError(
          400,
          "UPLOAD_INTERRUPTED",
          "The upload was interrupted before validation; no rows were imported. Select your file and retry.",
        ),
      );
    };
    const broken = () => {
      parser.destroy();
      finish(
        new ApiError(400, "INVALID_MULTIPART", "The upload could not be read. Select your CSV file again and retry."),
      );
    };
    parser.on("file", (name, stream, info) => {
      files++;
      if (name !== "file")
        fail(
          new ApiError(
            400,
            "INVALID_MULTIPART",
            "The upload did not contain the expected file. Select it using the CSV file control and try again.",
          ),
        );
      if (
        !/\.csv$/i.test(info.filename ?? "") ||
        ![
          "text/csv",
          "application/csv",
          "text/plain",
          "application/vnd.ms-excel",
          "application/octet-stream",
        ].includes(info.mimeType)
      )
        fail(new ApiError(415, "UNSUPPORTED_FILE", "This file type is not supported. Save your data as a UTF-8 .csv file and select it again."));
      stream.on("data", (chunk: Buffer) => {
        fileBytes += chunk.length;
        if (fileBytes > MAX_BYTES)
          fail(new ApiError(413, "FILE_TOO_LARGE", "The file is too large. Choose a CSV file no larger than 5 MiB."));
        if (!failure) chunks.push(chunk);
      });
      stream.on("limit", () =>
        fail(new ApiError(413, "FILE_TOO_LARGE", "The file is too large. Choose a CSV file no larger than 5 MiB.")),
      );
      stream.on("error", () =>
        fail(
          new ApiError(400, "INVALID_MULTIPART", "The uploaded file could not be read. Select your CSV file again and retry."),
        ),
      );
    });
    for (const event of ["filesLimit", "fieldsLimit", "partsLimit"] as const)
      parser.on(event, () =>
        fail(
          new ApiError(
            400,
            "INVALID_MULTIPART",
            "The upload contains extra files or fields. Select only one CSV file and try again.",
          ),
        ),
      );
    parser.on("error", () =>
      finish(
        new ApiError(400, "INVALID_MULTIPART", "The upload could not be read. Select your CSV file again and retry."),
      ),
    );
    parser.on("close", () => finish());
    req.on("data", measure);
    req.once("aborted", aborted);
    req.once("error", broken);
    req.pipe(parser);
  });
}
