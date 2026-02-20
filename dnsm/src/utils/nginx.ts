import type {NginxConf} from "../interfaces/nginx.js";
import fs from "fs";
import * as cf from "./cloudflareApi.js"
import forge from "node-forge";

const asFile = (config: NginxConf, container?: string) => `${container ? `# container-name ${container}` : "# manual"}
upstream ${config.record} {
    server ${config.ip}:${config.port};
}

server {
    listen 443 ssl;
    server_name ${config.record};
    
    ssl_certificate /etc/nginx/conf.d/certs/${config.domain}.crt;
    ssl_certificate_key /etc/nginx/conf.d/certs/${config.domain}.key;
    
    location / {
        proxy_pass http://${config.record};
    }
}
`

function createNginxConfig(record: string, domain: string, ip: string, port: string, container?: string) {
    const config: NginxConf = {
        path: `./conf.d/${record}.conf`,
        domain,
        record,
        ip,
        port,
    }

    return fs.writeFile(config.path, asFile(config, container), (err) => {
        if (err) {
            throw err;
        }

        if (crtExists(config.domain)) {
            return;
        }

        createCSR(config.domain);
    })
}

function deleteNginxConfig(record: string) {
    fs.unlinkSync(`./conf.d/${record}.conf`);
}

function crtExists(domain: string) {
    return fs.existsSync(`./conf.d/certs/${domain}.crt`) && fs.existsSync(`./conf.d/certs/${domain}.key`)
}

function createCSR(domain: string) {
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const csr = forge.pki.createCertificationRequest();
    csr.publicKey = keys.publicKey;
    csr.setSubject([{
        name: "commonName",
        value: "Cloudflare",
    }, {
        name: "countryName",
        value: "US",
    }]);

    csr.sign(keys.privateKey);

    cf.createCRT(forge.pki.certificationRequestToPem(csr), domain).then((res) => {
        fs.writeFile(`./conf.d/certs/${domain}.key`, forge.pki.privateKeyToPem(keys.privateKey), (e) => {
            if (e) {
                console.error("Could not write private key to file system");
                console.error(e);
            }
        });

        fs.writeFile(`./conf.d/certs/${domain}.crt`, res.result.certificate.replaceAll("\\n", "\n"), (e) => {
            if (e) {
                console.error("Could not write certificate to file system");
                console.error(e);
            }
        })
    }).catch((e) => {
        console.error("nginx ran into an error while creating domain certificate.");
        console.error(e);
    });
}

export { createNginxConfig, deleteNginxConfig };