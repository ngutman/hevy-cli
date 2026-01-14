import { URL } from "url";

export type HevyClientOptions = {
  apiKey: string;
  baseUrl?: string;
};

export class HevyClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(options: HevyClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? "https://api.hevy.com/v1";
  }

  async get<T>(path: string, query?: Record<string, string | number | boolean | undefined>): Promise<T> {
    const url = new URL(this.baseUrl + path);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined) {
          continue;
        }
        url.searchParams.set(key, String(value));
      }
    }

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "api-key": this.apiKey,
        accept: "application/json",
      },
    });

    const contentType = response.headers.get("content-type") ?? "";
    const isJson = contentType.includes("application/json");
    const body = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      const message = isJson && body && typeof body === "object" && "message" in body
        ? String((body as { message?: string }).message)
        : response.statusText;
      throw new Error(`Hevy API error ${response.status}: ${message}`);
    }

    return body as T;
  }
}
