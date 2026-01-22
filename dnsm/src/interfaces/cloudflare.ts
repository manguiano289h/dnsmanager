interface ResponseInfo {
    code: number;
    message: string;
    documentation_url: string;
    source?: {
        pointer?: string;
    }
}

export interface CloudflareResponse {
    success: boolean;
    messages: ResponseInfo[];
    errors: ResponseInfo[];
}

export interface ListZonesResponse extends CloudflareResponse {
    result: {
       id: string;
       name: string;
    }[];
}

export interface ListRecordsResponse extends CloudflareResponse {
    result: DNSRecord[];
}

export interface CreateRecordResponse extends CloudflareResponse {
    result: DNSRecord;
}

// API docs say this doesn't include "success", "messages" and "errors" - not true
export interface DeleteRecordResponse extends CloudflareResponse {
    result: {
        id: string;
    }
}

export interface CreateCertificateResponse extends CloudflareResponse {
    result: {
        certificate: string;
        expires_on: string;
    }
}

interface ARecord {
    id: string;
    name: string;
    type: "A";
    comment: string;
    content: string;
}

interface OtherRecord {
    id: string;
    name: string;
    type: "";
}

export type DNSRecord = ARecord | OtherRecord;