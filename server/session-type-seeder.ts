import { db } from "./db";
import { sessionTypes, DEFAULT_SESSION_TYPES } from "@shared/schema";
import { eq } from "drizzle-orm";

export async function seedSessionTypes() {
  for (let i = 0; i < DEFAULT_SESSION_TYPES.length; i++) {
    const st = DEFAULT_SESSION_TYPES[i];
    const existing = await db.select().from(sessionTypes).where(eq(sessionTypes.key, st.key));
    if (existing.length === 0) {
      await db.insert(sessionTypes).values({
        key: st.key,
        label: st.label,
        speakerLabelSingular: st.speakerLabelSingular,
        speakerLabelPlural: st.speakerLabelPlural,
        displayOrder: i,
      });
    }
  }
  const count = await db.select().from(sessionTypes);
  console.log(`[SESSION TYPES] Seeded ${count.length} session types`);
}
