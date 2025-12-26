import fs from "fs";
import {inspectContainer, monitorEvents} from "./utils/dockerApi.js";

if (!fs.existsSync("/tmp/docker.sock")) {
    console.log("The Docker socket was not mounted - dnsm needs it");
    process.exit(1);
}

const dnsm = await inspectContainer("dnsm").catch((err) => {
    console.log("dnsm couldn't inspect its own container");
    console.error(err);
    process.exit(1);
});

const dnsmId = dnsm.Id;
const networks = Object.keys(dnsm.NetworkSettings.Networks);

console.log("dnsm id: " + dnsmId);
console.log("Networks: " + networks.join(", "));

monitorEvents((event) => {
    if (event.Actor.Attributes.container === dnsmId) {
        if (event.Action === "connect") {
            networks.push(event.Actor.ID);
            // Create nginx configs for all containers already created that had no config to begin with
        } else if (event.Action === "disconnect") {
            const index = networks.indexOf(event.Actor.ID);
            if (index === -1) {
                console.log(`dnsm disconnected from a network that it wasn't a part of? (${event.Actor.ID})`)
            } else {
                networks.splice(index, 1);
                // Remove nginx configs for all containers that had configs and no longer share a network
            }
        }
    } else if (networks.includes(event.Actor.ID)) {
        if (event.Action === "connect") {
            // Create nginx config and reload
        } else if (event.Action === "disconnect") {
            // Delete nginx config and reload
        }
    }
});