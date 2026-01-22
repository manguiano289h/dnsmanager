export interface NetworkEvent {
    Type: "network";
    Action: "connect" | "disconnect";
    Actor: {
        ID: string;
        Attributes: {
            container: string;
            name: string;
            type: string;
        };
    };
}

export interface Container {
    Id: string;
    State: {
        Running: boolean;
    };
    Name: string;
    Config: {
        ExposedPorts: {
            [key: string]: {};
        };
        Labels: {
            [key: string]: string;
        };
    };
    NetworkSettings: {
        Ports: {
            [key: string]: Array<{
                HostIp: string;
                HostPort: string;
            }> | null;
        };
        Networks: {
            [key: string]: {
                NetworkID: string;
                IPAddress: string;
            };
        };
    };
}