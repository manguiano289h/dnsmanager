import type {CreateCertificateResponse, CreateRecordResponse, ListZonesResponse} from "../interfaces/cloudflare.js";
import {cfRequest} from "./utils.js";

let zones: { [key: string]: string } = {};
let ip: string | undefined = undefined;

async function getIp() {
    if (ip) {
        return ip;
    } else {
        return await fetch("https://icanhazip.com").then((res) => res.text()).then((text) => {
            ip = text.replace("\n", "");
            return ip;
        })
    }
}

async function validate() {
    return cfRequest<ListZonesResponse>("/zones").then((res) => {
        zones = {};
        for (const zone of res.result) {
            zones[zone.name] = zone.id;
        }

        if (Object.keys(zones).length === 0) {
            console.error("There are no zones available from Cloudflare API.");
            return false;
        } else {
            return true;
        }
    }).catch((err) => {
        console.error(err);
        return false;
    });
}

async function createRecord(input: string) {
    const match = input.match(/[a-z0-9-]{2,63}\.[a-z0-9-]{2,63}$/);
    let record = "";
    let zone = "";
    if (!match) {
        if (Object.values(zones).length === 1) {
            record = input;
            zone = Object.keys(zones)[0]!!;
        } else {
            throw new Error("Record " + input + " does not specify domain and it's not possible to assume.");
        }
    } else if (match) {
        const domain = match[0];
        if (zones[domain]) {
            record = input.substring(0, input.indexOf(domain));
            zone = domain;
        } else {
            throw new Error("Record " + input + " specifies domain " + domain + ", but it's not available in the Cloudflare API");
        }
    }

    const zoneId = zones[zone];
    const ip = await getIp();

    const body = {
        "name": input, // Cloudflare API docs say this needs the zone name - not true.
        "type": "A",
        "proxied": true,
        "content": ip, // Cloudflare API docs say this is optional - not true.
        "comment": "Created by dnsm"
    }

    return await cfRequest<CreateRecordResponse>("/zones/" + zoneId + "/dns_records",
        { method: "POST", body: JSON.stringify(body) }).then((res) => {
        if (!res.success) {
            if (res.errors.length > 0) {
                console.error(JSON.stringify(res.errors[0], null, 4));
                if (res.errors.length > 1) {
                    console.error("... and " + (res.errors.length - 1) + " more.");
                }
            }
            throw new Error("Cloudflare API did not succeed when creating record.");
        } else {
            return {
                record,
                "domain": zone,
            }
        }
    });
}

async function createCRT(csr: string, domain: string) {
    const body = {
        csr,
        hostnames: [domain, `*.${domain}`],
        request_type: "origin-rsa"
    };
    return cfRequest<CreateCertificateResponse>("/certificates", { method: "POST", body: JSON.stringify(body) })
}

export { validate, createRecord, createCRT };