export const Service = () => (target: any) => target;
export const Controller = () => (target: any) => target;
export const OnStart = {};
export const OnTick = {};
export const OnHeartbeat = {};
export const Dependency = (ctor: any) => new ctor();
export const Flamework = {
    addPaths: () => { },
    ignite: () => { },
};
