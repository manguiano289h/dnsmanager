#! /usr/bin/env node
import * as cf from "../utils/cloudflareApi.js";
import * as docker from "../utils/dockerApi.js";
import fs from "fs";
//import * as nginx from "../utils/nginx.js";

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
            const { record } = cf.parseDomain(input);
            if (!record.id) {
                console.log("The specified record is not available in the Cloudflare API!");
                process.exit(0);
            }

            /* Valid options:
             * dnsm nginx create ex.example.com 404 (returns the http code)
             * dnsm nginx create ex.example.com 192.168.1.1:80 (proxy_pass-es to ip and port)
             * dnsm nginx create ex.example.com https://github.com/manguiano289h/dnsmanager (redirects to site)
             */


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