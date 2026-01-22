import type {Container, NetworkEvent} from "../interfaces/docker.js";
import fs from "fs";
import {dockerRequest} from "./utils.js";

let container: Container;
const networks: string[] = [];

function containerId(): string | undefined {
    return container?.Id;
}

async function validate() {
    if (!fs.existsSync("/tmp/docker.sock")) {
        console.error("The Docker socket was not mounted - dnsm needs it");
        return false;
    }

    return inspectContainer("dnsm").then((dnsm) => {
        container = dnsm;
        networks.push(...Object.values(dnsm.NetworkSettings.Networks).map((it) => it.NetworkID));
        return true;
    }).catch((err) => {
        console.error("Docker API encountered an error inspecing the dnsm container.");
        console.error(err);
        return false;
    });
}

async function inspectContainer(id: string) {
    const res = await dockerRequest("/containers/" + id + "/json");
    return await res.json() as Container;
}

function addToNetwork(network: string): boolean {
    networks.push(network);
    return true;
}

function removeFromNetwork(network: string): boolean {
    const index = networks.indexOf(network);
    if (index === -1) {
        return false;
    } else {
        networks.splice(index, 1);
        return true;
    }
}

function isInNetwork(network: string): boolean {
    return networks.includes(network);
}

function restartNginx() {
    void dockerRequest("/containers/nginx/kill?signal=SIGHUP", {
        method: "POST",
    })
}

async function monitorEvents(onEvent: (event: NetworkEvent) => void) {
    const filters = {
        "type": ["network"],
        "event": ["connect", "disconnect"],
    };
    const url = "/events?filters=" + encodeURIComponent(JSON.stringify(filters));

    const req = await dockerRequest(url);
    for await (const chunk of req.body!!) {
        onEvent(JSON.parse(String.fromCharCode(...chunk)));
    }
}

export { containerId, validate, inspectContainer, addToNetwork, removeFromNetwork, isInNetwork, restartNginx, monitorEvents };