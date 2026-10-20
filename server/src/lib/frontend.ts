import express, { type Express } from 'express';
import { accessSync } from 'node:fs';
import { join } from 'node:path';

export function serveFrontend(app: Express, directory: string) {
  accessSync(join(directory, 'index.html')); // Refuse an incomplete production build.
  app.use((_req, res, next) => {
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'");
    next();
  });
  // Preserve the application's existing hash router; no new routing library.
  app.get(/^\/(login|dashboard|imports|employees(?:\/[1-9]\d*)?)\/?$/, (req, res) => {
    const query = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
    res.redirect(302, `/#${req.path.replace(/\/$/, '')}${query}`);
  });
  app.use(express.static(directory, {
    dotfiles: 'deny', index: 'index.html', redirect: false,
    setHeaders(res, path) {
      if (/[/\\]assets[/\\]/.test(path)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      else res.setHeader('Cache-Control', 'no-store');
    },
  }));
}
