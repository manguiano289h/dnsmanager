import * as http from "node:http";
import type {Container, NetworkEvent} from "../interfaces/docker.js";

async function request<T>(url: string) {
    return new Promise<T>((resolve, reject) => {
        let data = "";
        const req = http.request({ socketPath: "/tmp/docker.sock", path: url }, (res) => {
            res.on("data", (chunk) => {
               data += chunk;
            });

            res.on("end", () => {
                resolve(JSON.parse(data));
            });
        }).on("error", (err) => {
            reject(err);
        }).on("close", () => {
            resolve(JSON.parse(data));
        });
        req.end();
    });
}

export function inspectContainer(id: string) {
    return request<Container>(`/containers/${id}/json`);
}

export const monitorEvents = (onEvent: (event: NetworkEvent) => void) => {
    const filters = {
        "type": ["network"],
        "event": ["connect", "disconnect"]
    }
    const url = `/events?filters=${encodeURIComponent(JSON.stringify(filters))}`
    return http.request({ socketPath: "/tmp/docker.sock", path: url }, (res) => {
        let data = "";
        res.on("data", (chunk) => {
            let json;
            try {
                data += chunk;
                json = JSON.parse(data);
                data = "";
            } catch (error) { // SyntaxError
                return;
            }

            const event = json as NetworkEvent;
            onEvent(event);
        });
    }).on("error", (err) => {
        console.log("dnsm encountered an error while monitoring events");
        console.error(err);
        process.exit(1);
    }).on("close", () => {
        // This is not needed but may aswell for potential logs
    }).end();
}