interface ConfInfo {
    path: string;
    domain: string;
    record: string;
}

export interface HttpCodeConf extends ConfInfo {
    type: "Code"
    code: string;
}

export interface RedirectConf extends ConfInfo {
    type: "Redirect"
    redirect: string;
}

export interface ProxyPassConf extends ConfInfo {
    type: "Pass"
    ip: string;
    port: string;
}

export type NginxConf = HttpCodeConf | RedirectConf | ProxyPassConf