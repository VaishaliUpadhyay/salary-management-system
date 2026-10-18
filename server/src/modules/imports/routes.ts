import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { parse } from "../../lib/validation.js";
import { receiveCsv } from "./upload.js";
import { parseCsv } from "./csv.js";
import { importRows, IncompleteImport } from "./service.js";
export function importRoutes(db: PrismaClient) {
  const router = Router();
  router.post("/employees", async (req, res) => {
    parse(z.strictObject({}), req.query, 400);
    const rows = parseCsv(await receiveCsv(req));
    try {
      res.json({
        data: await importRows(
          db,
          rows,
          req.auth!.user.id,
          () => res.destroyed,
        ),
      });
    } catch (error) {
      if (!(error instanceof IncompleteImport)) throw error;
      console.error(JSON.stringify({ event: "api_failure", requestId: req.requestId, status: 503, code: "IMPORT_INCOMPLETE", category: "import", completedRows: error.result.rows.length }));
      res
        .status(503)
        .set("Retry-After", "1")
        .json({
          error: {
            code: error.code,
            message: error.message,
            details: [],
            requestId: req.requestId,
          },
          data: error.result,
        });
    }
  });
  return router;
}
