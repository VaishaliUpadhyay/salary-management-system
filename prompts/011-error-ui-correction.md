# User request excerpt — Milestone 6 presentation correction

> The previous project-wide error-handling audit introduced UI regressions. Although error messages are now more understandable, their presentation is causing layout and usability problems.
>
> I want you to correct the existing implementation, NOT redesign or rebuild the error-handling architecture.
>
> Remove the "Troubleshooting details" dropdown from all normal user-facing error messages.
>
> Do not display request IDs, UUIDs, internal error codes, stack traces, or technical references anywhere in the standard frontend UI.
>
> Keep request IDs and structured error codes in backend responses and appropriate server-side diagnostic logs for developers.
>
> Test error states on representative viewport sizes: Mobile: 375px; Tablet: 768px; Desktop: 1440px.
>
> This is a corrective task within Milestone 6. Do not proceed with other Milestone 6 work until these regressions are resolved.

Further requested constraints: preserve the centralized mapper, API contracts, validation, business rules and schema; verify actual rendered UI and accessibility; run frontend/backend tests, lint, typechecks and production builds; do not modify development records, commit or push.
