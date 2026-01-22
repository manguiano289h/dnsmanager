import * as cf from "./utils/cloudflareApi.js";
import * as docker from "./utils/dockerApi.js";
import * as nginx from "./utils/nginx.js";

if (!await docker.validate()) {
    process.exit(1);
}

if (!await cf.validate()) {
    process.exit(1);
}

docker.monitorEvents((event) => {
    if (event.Actor.Attributes.container === docker.containerId()) {
        if (event.Action === "connect") {
            docker.addToNetwork(event.Actor.ID);
            // Create nginx configs for all containers already created that had no config to begin with
        } else if (event.Action === "disconnect") {
            if (!docker.removeFromNetwork(event.Actor.ID)) {
                console.log(`dnsm disconnected from a network that it wasn't a part of? (${event.Actor.ID})`)
            } else {
                // Remove nginx configs for all containers that had configs and no longer share a network
            }
        }
    } else if (docker.isInNetwork(event.Actor.ID)) {
        if (event.Action === "connect") {
            docker.inspectContainer(event.Actor.Attributes.container).then((container) => {
                const labels = container.Config.Labels;
                const subdomain = labels["tech.dnsmanager.domain"]?.toLowerCase();
                if (!subdomain) {
                    console.log(container.Name + " does not specify a subdomain.");
                    return;
                }

                const ports = Object.keys(container.Config.ExposedPorts).map((port) => {
                    return port.substring(0, port.indexOf("/"));
                }).sort((a, b) => (parseInt(a) ?? 0) - (parseInt(b) ?? 0));
                if (ports.length == 0) {
                    console.error("There are no open ports");
                    return;
                }

                cf.createRecord(subdomain).then(({ record, domain }) => {
                    const network = Object.values(container.NetworkSettings.Networks).find((it) => it.NetworkID == event.Actor.ID)!!
                    const ip = network.IPAddress;
                    const port = ports[0]!!;
                    nginx.createNginxConfig(record, domain, ip, port);
                }).then(() => {
                    docker.restartNginx();
                }).catch((err) => {
                    console.error("Cloudflare encountered an error while creating a record for " + container.Name);
                    console.error(err);
                });
            }).catch((err) => {
               console.error("dnsm encountered an error while creating config for " + event.Actor.Attributes.container);
               console.error(err);
            });
        } else if (event.Action === "disconnect") {
            // Delete nginx config and reload
        }
    }
});