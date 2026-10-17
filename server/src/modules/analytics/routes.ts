import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { parse, day, toDate } from "../../lib/validation.js";
import { analyticsQuery, rateQuery } from "./schemas.js";
import { compensation, exchangeRates } from "./service.js";

export function analyticsRoutes(db: PrismaClient) {
  const router = Router();

  // Analytics routes
  router.get("/analytics/compensation", async (req, res) => {
    res.json({
      data: await compensation(
        db,
        parse(analyticsQuery, req.query, 400),
        toDate(day(req.now)),
      ),
    });
  });

  // Exchange rates route
  router.get("/currencies", async (req, res) => {
    parse(z.strictObject({}), req.query, 400);
    res.json({
      data: await db.currency.findMany({
        select: { code: true, name: true, isActive: true },
        orderBy: { code: "asc" },
      }),
    });
  });

  // Exchange rates route
  router.get("/exchange-rates", async (req, res) => {
    res.json({
      data: await exchangeRates(
        db,
        parse(rateQuery, req.query, 400),
        toDate(day(req.now)),
      ),
    });
  });
  return router;
}
