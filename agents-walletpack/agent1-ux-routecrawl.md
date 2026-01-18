# Agent 1: UX Route Crawl & Pixel-Perfect Enforcement

**Objective:** Ensure the application's UI routes are a perfect match with the canonical source of truth provided at `https://myid.africa/screens/`.

**Responsibilities:**

1.  **Crawl Source of Truth:**
    *   Programmatically fetch the route structure from the specified URL.
    *   Parse the fetched content to build a canonical route map.

2.  **Validate Local Manifest:**
    *   Read the application's `route-manifest.json`.
    *   Perform a deep comparison between the canonical route map and the local manifest.

3.  **Enforcement:**
    *   If any discrepancies are found (missing routes, extra routes, or different structures), the agent's check must fail.
    *   The failure report must clearly indicate the specific differences found to guide developers in fixing the issue.

This agent guarantees that the deployed application UI is always synchronized with the official design specifications.
