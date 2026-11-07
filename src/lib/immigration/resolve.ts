import "server-only";
import { getSetting } from "@/lib/settings";
import { gatewayFromEnv, type ImmigrationGateway } from "./gateway";
import { SimulatedGateway } from "./simulator";

export type ImmigrationSim = { enabled: boolean };
export const parseSim = (v: unknown): ImmigrationSim => ({ enabled: !!(v && typeof v === "object" && (v as { enabled?: unknown }).enabled === true) });
/** The simulator can be on only while the real Immigration connection is NOT set up: a real connection always wins, so real applications can never meet the simulator. */
export const simulatorActive = async () => !gatewayFromEnv() && parseSim(await getSetting<unknown>("immigration_sim", { enabled: false })).enabled;
/** The real gateway, else the built-in simulator when staff switched it on, else null. */
export async function resolveGateway(): Promise<ImmigrationGateway | null> {
  const real = gatewayFromEnv(); if (real) return real;
  return (await simulatorActive()) ? new SimulatedGateway() : null;
}
