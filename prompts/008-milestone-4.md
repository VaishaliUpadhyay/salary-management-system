# Milestone 4 — actual user prompt excerpts

> Proceed with Milestone 4: Frontend Development, HR Dashboard, and API Integration.
> Follow the approved architecture and reuse existing backend APIs.
> Build the frontend using the existing: React 19 + TypeScript + Vite; Tailwind CSS; shadcn/ui; Recharts.
> Use actual backend analytics API responses. Do not hardcode financial values.
> Clearly distinguish employee counts from employees included in salary calculations.
> Do not store session tokens or passwords in localStorage/sessionStorage.
> Do not modify or reset the existing seeded development data.
> Do not implement CSV import yet; reserve it for Milestone 5.
> Do not introduce new backend endpoints unless an existing API contract requires one and it is missing. Ask before making such changes.
> Do not commit or push automatically. Do not deploy.
> Do not begin Milestone 5 until Milestone 4 is reviewed and approved.

The full request included login/session handling, analytics filters and currency reporting, employee CRUD/deactivation, append-only salary history/revisions, responsive/accessibility states, frontend/backend/database tests and documentation.

Actual clarification:

> The approved contracts include GET /countries, /departments and /designations, but these routes are missing. The frontend needs them for filters and valid employee assignments. May I implement just these three authenticated, paginated read endpoints, with the documented status and department filters?

User response:

> Yes, add the three read endpoints
