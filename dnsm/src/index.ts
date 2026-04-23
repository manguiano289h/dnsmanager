import * as cf from "./utils/cloudflareApi.js";
import * as docker from "./utils/dockerApi.js";
import * as nginx from "./utils/nginx.js";
import type {ProxyPassConf} from "./interfaces/nginx.js";

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
        } else if (event.Action === "disconnect") {
            if (!docker.removeFromNetwork(event.Actor.ID)) {
                console.log(`dnsm disconnected from a network that it wasn't a part of? (${event.Actor.ID})`);
            }
        }
    } else if (docker.isInNetwork(event.Actor.ID)) {
        if (event.Action === "connect") {
            docker.inspectContainer(event.Actor.Attributes.container).then((container) => {
                const labels = container.Config.Labels;
                const subdomain = labels["tech.dnsmanager.domain"]?.toLowerCase();
                if (!subdomain) {
                    console.log(`${container.Name} does not specify a subdomain.`);
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
                    const config: ProxyPassConf = {
                        path: `./conf.d/${record}.conf`,
                        domain,
                        record,
                        type: "Pass",
                        ip,
                        port,
                    };
                    nginx.createNginxConfig(config, container.Name);
                }).then(() => {
                    console.log(`Created record ${subdomain}`);
                    docker.restartNginx();
                }).catch((err) => {
                    console.error(`Cloudflare encountered an error while creating a record for ${container.Name}`);
                    console.error(err);
                });
            }).catch((err) => {
               console.error(`dnsm encountered an error while creating config for ${event.Actor.Attributes.container}`);
               console.error(err);
            });
        } else if (event.Action === "disconnect") {
            docker.inspectContainer(event.Actor.Attributes.container).then((container) => {
                const labels = container.Config.Labels;
                const subdomain = labels["tech.dnsmanager.domain"]?.toLowerCase();
                if (!subdomain) {
                    console.log(`${container.Name} does not specify a subdomain.`);
                    return;
                }

                const { record, domain } = cf.parseDomain(subdomain);
                if (!record.id) {
                    console.log("The domain specified does not exist in the Cloudflare API.");
                    return;
                }

                nginx.deleteNginxConfig(record.name);
                cf.deleteRecord(record.id, domain).finally(() => {
                    console.log(`Deleted record ${record.name}`);
                    docker.restartNginx();
                });
            })
        }
    }
});