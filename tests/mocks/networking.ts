import { vi } from "vitest";

export const Networking = {
    createEvent: vi.fn(() => ({
        createServer: vi.fn(() => ({
            ClientRequest: { connect: vi.fn() },
            DevEvent: { connect: vi.fn() },
            CollectEvent: { connect: vi.fn(), fire: vi.fn() },
        })),
        createClient: vi.fn(() => ({})),
    })),
};
