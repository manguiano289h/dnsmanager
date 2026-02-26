import type {HttpCodeConf, NginxConf, ProxyPassConf, RedirectConf} from "../interfaces/nginx.js";
import fs from "fs";
import * as cf from "./cloudflareApi.js"
import forge from "node-forge";

const passFile = (config: ProxyPassConf, name?: string) =>  `${name ? `# name ${name}` : "# manual"}
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

const codeFile = (config: HttpCodeConf) => `# manual
server {
    listen 443 ssl;
    server_name ${config.record};
    
    ssl_certificate /etc/nginx/conf.d/certs/${config.domain}.crt;
    ssl_certificate_key /etc/nginx/conf.d/certs/${config.domain}.key;
    
    return ${config.code};
}
`

const redirectFile = (config: RedirectConf) => `# manual
server {
    listen 443 ssl;
    server_name ${config.record};
    
    ssl_certificate /etc/nginx/conf.d/certs/${config.domain}.crt;
    ssl_certificate_key /etc/nginx/conf.d/certs/${config.domain}.key;
    
    return 301 ${config.redirect};
}
`

function createNginxConfig(config: NginxConf, name?: string) {
    let file: string | undefined;
    if (config.type === "Pass") {
        file = passFile(config, name);
    } else if (config.type === "Code") {
        file = codeFile(config);
    } else if (config.type === "Redirect") {
        file = redirectFile(config);
    }

    if (!file) {
        throw new Error(`Could not create a config file for config type "${config.type}"`);
    }

    return fs.writeFile(config.path, file, (err) => {
        if (err) {
            throw err;
        }

        if (crtExists(config.domain)) {
            return;
        }

        createCSR(config.domain);
    });
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