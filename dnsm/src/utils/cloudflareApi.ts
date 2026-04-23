import type {
    CreateCertificateResponse,
    CreateRecordResponse, DeleteRecordResponse,
    ListRecordsResponse,
    ListZonesResponse
} from "../interfaces/cloudflare.js";
import {cfRequest} from "./utils.js";

let zones: { [key: string]: { id: string, records: { id: string, name: string }[] } } = {};
let ip: string | undefined = undefined;

function getZones() {
    return zones;
}

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
    zones = {};
    const listZones = await cfRequest<ListZonesResponse>("/zones");

    if (listZones.result.length == 0) {
        console.error("There are no zones available from Cloudflare API.");
        return false;
    }

    const promises = listZones.result.map(async (zone) => {
        return cfRequest<ListRecordsResponse>(`/zones/${zone.id}/dns_records`).then((res) => {
            zones[zone.name] = {
                id: zone.id,
                records: res.result.filter((record) => record.type === "A").map((record) => ({
                    id: record.id,
                    name: record.name
                }))
            };
            return true;
        }).catch((e) => {
            console.error(`Cloudflare API ran into an error when listing records for zone ${zone.name}.`);
            console.error(e);
            return false;
        });
    });

    return Promise.all(promises).then((res) => !res.includes(false));
}

async function createRecord(input: string) {
    const { record, domain } = parseDomain(input);

    if (record.id) {
        throw new Error(`Record ${record.name} already exists in the Cloudflare API!`);
    }

    const ip = await getIp();

    const body = {
        "name": record.name, // Cloudflare API docs say this needs the zone name - not true.
        "type": "A",
        "proxied": true,
        "content": ip, // Cloudflare API docs say this is optional - not true.
        "comment": "Created by dnsm"
    };

    return await cfRequest<CreateRecordResponse>(`/zones/${domain.id}/dns_records`, {
        method: "POST",
        body: JSON.stringify(body)
    }).then((res) => {
        zones[domain.name]!!.records.push({ id: res.result.id, name: res.result.name });

        return {
            record: record.name,
            domain: domain.name,
        };
    });
}

async function deleteRecord(recordId: string, domain: { id: string, name: string }) {
    return await cfRequest<DeleteRecordResponse>(`/zones/${domain.id}/dns_records/${recordId}`, {
        method: "DELETE",
    }).then((_) => {
        const records = zones[domain.name]!!.records;
        const record = records.find((record) => record.id == recordId);
        if (!record) {
            throw new Error("Deleted record could not be found in Cloudflare API.");
        }
        const i = records.indexOf(record);
        zones[domain.name]!!.records.splice(i, 1);
    });
}

async function createCRT(csr: string, domain: string) {
    const body = {
        csr,
        hostnames: [domain, `*.${domain}`],
        request_type: "origin-rsa"
    };
    return cfRequest<CreateCertificateResponse>("/certificates", { method: "POST", body: JSON.stringify(body) });
}

function parseDomain(input: string): { record: { id?: string, name: string }, domain: { id: string, name: string } } {
    const match = input.match(/^(?:(?<record>[a-z0-9-]{1,63}?)(?:\.|$))?(?<domain>[a-z0-9-]{2,63}\.[a-z0-9-]{2,63})?$/);

    if (!match || !match.groups) {
        throw new Error(`${input} is not a valid domain.`);
    }

    const { record, domain } = match.groups;

    let parsedRecord;
    let parsedDomain;

    if (!domain) {
        if (Object.entries(zones).length == 1) {
            const [ name, cfDomain ] = Object.entries(zones)[0]!!;
            parsedDomain = {
                id: cfDomain.id,
                name: name,
            };
        } else {
            throw new Error(`${input} specifies no domain and it's impossible to assume.`);
        }
    } else {
        if (zones[domain]) {
            parsedDomain = {
                id: zones[domain].id,
                name: domain,
            };
        } else {
            throw new Error(`${input} specifies a domain but it is not available from the Cloudflare API.`);
        }
    }

    const cfRecord = zones[parsedDomain.name]!!.records.find((it) => it.name == `${record}.${parsedDomain.name}`);
    if (cfRecord) {
        parsedRecord = {
            id: cfRecord.id,
            name: cfRecord.name,
        };
    } else {
        parsedRecord = {
            name: record ? `${record}.${parsedDomain.name}` : parsedDomain.name
        };
    }

    return { record: parsedRecord, domain: parsedDomain };
}

export { getZones, validate, createRecord, deleteRecord, createCRT, parseDomain };