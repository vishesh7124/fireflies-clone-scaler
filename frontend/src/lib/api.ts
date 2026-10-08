/**
 * API adapter — one client, two implementations behind the frozen contract
 * (ApiClient in lib/types.ts):
 *   - mockApi (src/mock/api.ts): in-memory store + localStorage persistence —
 *     the default for Phases 1-6, no backend needed
 *   - httpApi (src/lib/http-api.ts): the real FastAPI backend — active when
 *     NEXT_PUBLIC_USE_MOCKS=false (Phase 7 integration)
 *
 * Components only ever import `api` from here, so the swap is invisible.
 */

import type { ApiClient } from "./types";
import { mockApi } from "@/mock/api";
import { httpApi } from "./http-api";

export const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS !== "false";

export const api: ApiClient = USE_MOCKS ? mockApi : httpApi;

export { ApiError } from "./http-api";
