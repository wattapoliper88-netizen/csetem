export declare class HealthController {
    getHealth(): {
        uptime: number;
        pid: number;
        memoryUsage: NodeJS.MemoryUsage;
        now: string;
    };
}
export default HealthController;
