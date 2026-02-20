import {Agent, fetch, type RequestInit} from "undici";
import type {CloudflareResponse} from "../interfaces/cloudflare.js";

export function cfRequest<T extends CloudflareResponse>(url: string, options: RequestInit = {}) {
    return fetch("https://api.cloudflare.com/client/v4" + url, {
        headers: {
            "Authorization": "Bearer " + process.env.API_TOKEN,
        },
        ...options,
    }).then((res) => res.json() as Promise<T>).then((res) => {
        if (res.success) {
            return res;
        } else {
            const error = res.errors[0];
            if (error) {
                let message = `${error.code} - ${error.message}\n - ${error.documentation_url}`;
                if (res.errors.length > 1) {
                    message += `\n... and ${res.errors.length - 1} more.`;
                }
                throw new Error(message);
            }
            throw new Error("Cloudflare API request did not succeed but returned no errors.");
        }
    });
}

export function dockerRequest(url: string, options: RequestInit = {}) {
    return fetch("http://localhost" + url, {
        dispatcher: new Agent({
            connect: {
                socketPath: "/tmp/docker.sock",
            },
            bodyTimeout: 0
        }),
        ...options,
    });
}