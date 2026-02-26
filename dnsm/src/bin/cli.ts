#! /usr/bin/env node
import * as cf from "../utils/cloudflareApi.js";
import * as docker from "../utils/dockerApi.js";
import fs from "fs";
import type {HttpCodeConf, ProxyPassConf, RedirectConf} from "../interfaces/nginx.js";
import * as nginx from "../utils/nginx.js";

for (let i = 0; i < process.argv.length; i++) {
    console.log(i + " - " + process.argv[i]);
}

if (!await docker.validate()) {
    process.exit(1);
}

if (!await cf.validate()) {
    process.exit(1);
}

const args = process.argv.map((arg) => arg.toLowerCase()).slice(2);

if (args.length == 0) {
    console.log("You need to specify a subcommand to run!");
    console.log("Available commands: domain, nginx, list");
    process.exit(0);
}

if (args[0] === "domain") {
    const [ action, data ] = args.slice(1);
    if (action === "create") {
        if (data) {
            cf.createRecord(data);
        } else {
            console.log("You need to specify a domain record to create!");
            process.exit(0);
        }
    } else if (action === "delete" && data) {
        const { domain, record } = cf.parseDomain(data);
        if (record.id) {
            cf.deleteRecord(record.id, domain);
        } else {
            console.log("That record is not available in the Cloudflare API!");
            process.exit(0);
        }
    } else {
        console.log("Not a valid subcommand!");
        console.log("Available commands: create <record>, delete <record>");
        process.exit(0);
    }
} else if (args[0] === "nginx") {
    const [ action, input, data ] = args.slice(1);
    if (action === "create") {
        if (input && data) {
            const { domain, record } = cf.parseDomain(input);
            if (!record.id) {
                console.log("The specified record is not available in the Cloudflare API!");
                process.exit(0);
            }

            if (data.startsWith("http")) {
                const config: RedirectConf = {
                    path: `./conf.d/${record.name}.conf`,
                    domain: domain.name,
                    record: record.name,
                    type: "Redirect",
                    redirect: data,
                };

                nginx.createNginxConfig(config);
                console.log(`Created a redirect from ${record.name} to ${data}`);
                process.exit(0);
            } else if (!isNaN(+data)) {
                const code = +data;
                if (code >= 100 && code <= 599) {
                    const config: HttpCodeConf = {
                        path: `./conf.d/${record.name}.conf`,
                        domain: domain.name,
                        record: record.name,
                        type: "Code",
                        code: data,
                    };

                    nginx.createNginxConfig(config);
                    console.log(`Created nginx config, ${record.name} returns HTTP code ${data}`);
                    process.exit(0);
                } else {
                    console.log(`${code} is not a valid HTTP response status code!`);
                    process.exit(0);
                }
            } else if (data.includes(":")) {
                const ip = data.split(":")[0]!!;
                const port = data.split(":")[1]!!;

                const config: ProxyPassConf = {
                    path: `./conf.d/${record.name}.conf`,
                    domain: domain.name,
                    record: record.name,
                    type: "Pass",
                    ip,
                    port,
                };
                nginx.createNginxConfig(config);
                console.log(`Created nginx config, ${record.name} passes to ${ip}:${port}`);
                process.exit(0);
            } else {
                console.log("Not a valid nginx config action!");
                console.log("Include either:");
                console.log("- an HTTP response status code (e.g. 404)");
                console.log("- a local IP and port to proxy pass to (e.g. 192.168.1.1:80)");
                console.log("- a domain to redirect to (e.g. https://github.com/manguiano289h/dnsmanager)");
                process.exit(0);
            }
        } else {
            console.log("You need to specify a domain config to create!");
            process.exit(0);
        }
    } else if (action === "delete") {
        if (input) {
            // To correct inputs not including the domain name
            const { record } = cf.parseDomain(input);
            if (!fs.existsSync(`./conf.d/${record.name}.conf`)) {
                console.log("The specified record does not have an nginx config!");
                process.exit(0);
            }

            fs.unlinkSync(`./conf.d/${record.name}.conf`);
            console.log("Nginx config removed.");
            process.exit(0);
        } else {
            console.log("You need to specify a domain config to delete!");
            process.exit(0);
        }
    }
} else if (args[0] === "list") {

} else {
    console.log("Not a valid command!");
    console.log("- domain <create/delete> <record>");
    console.log("- nginx <create/delete> <record> [data]");
    process.exit(0);
}