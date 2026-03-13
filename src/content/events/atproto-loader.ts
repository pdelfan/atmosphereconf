import type { Loader } from "astro/loaders";
import { AtpBaseClient } from "@atproto/api";

export function atprotoEventLoader(did: string): Loader {
  return {
    name: "atproto-event-loader",
    load: async ({ store, parseData, logger }) => {
      // Resolve PDS from DID's PLC directory entry
      const plcRes = await fetch(`https://plc.directory/${did}`);
      if (!plcRes.ok) {
        logger.error(`Failed to resolve DID ${did}: ${plcRes.status}`);
        return;
      }
      const plcDoc = await plcRes.json();
      const pds = plcDoc.service?.find(
        (s: any) => s.id === "#atproto_pds",
      )?.serviceEndpoint;
      if (!pds) {
        logger.error(`No PDS found for ${did}`);
        return;
      }

      const agent = new AtpBaseClient(pds);
      let cursor: string | undefined;
      let count = 0;

      do {
        const { data } = await agent.com.atproto.repo.listRecords({
          repo: did,
          collection: "org.atmosphereconf.event",
          limit: 100,
          cursor,
        });

        for (const rec of data.records) {
          const rkey = rec.uri.split("/").pop()!;
          const value = rec.value as Record<string, unknown>;
          const { $type, createdAt, ...entry } = value;
          const data = await parseData({ id: rkey, data: entry });
          store.set({ id: rkey, data });
          count++;
        }

        cursor = data.cursor;
      } while (cursor);

      logger.info(`Loaded ${count} events from ${did}`);
    },
  };
}
