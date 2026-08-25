/** Cloudflare Worker entry point for the Florida vacation-rental site. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { hydrateSiteEnv } from "../lib/site-env";

interface Env {
  ASSETS: Fetcher;
  DB?: D1Database;
  IMAGES?: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
  GUESTY_CLIENT_ID?: string;
  GUESTY_CLIENT_SECRET?: string;
  GUESTY_BOOKING_ENGINE_URL?: string;
  GUESTY_LISTING_TAG?: string;
  GUESTY_CONDO_TAG?: string;
  GUESTY_BOOTSTRAP_ACCESS_TOKEN?: string;
  GUESTY_BOOTSTRAP_EXPIRES_AT_MS?: string;
  SITE_URL?: string;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    hydrateSiteEnv(env);
    (globalThis as typeof globalThis & {
      __VACATION_RENTAL_EXPERTZ_DB__?: D1Database;
    }).__VACATION_RENTAL_EXPERTZ_DB__ = env.DB;

    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      if (!env.IMAGES) {
        return new Response("Not found", { status: 404 });
      }

      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES!.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    try {
      let response = await handler.fetch(request, env, ctx);
      // vinext can fail the first SSR pass on a cold worker; retry once.
      if (response.status >= 500) {
        response = await handler.fetch(request, env, ctx);
      }
      return response;
    } catch (error) {
      console.error("Site render failed", {
        path: url.pathname,
        reason: error instanceof Error ? error.name : "unknown",
      });
      return new Response("The website is temporarily unavailable. Please try again shortly.", {
        status: 500,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
  },
};

export default worker;
