import pg from "pg";
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const {rows: [{count: alreadyMigrated}]} = await client.query(
      `SELECT count(*) as count FROM agreement_deliverable_template_items WHERE deliverable_name = 'General Liability – Certificate of Insurance' AND is_active = true`
    );
    if (parseInt(alreadyMigrated) > 0) {
      console.log("Migration already applied (idempotency check). Skipping.");
      await client.query("ROLLBACK");
      return;
    }

    const threeWordIds = [
      "807484b6-138e-4243-a3cc-a6630e755f6a",
      "a86b2a91-9624-4201-9653-1edaf9a7530d",
      "c9b5f3cb-b257-4d41-a1a1-bdb2c3bf96e4",
      "18d2a211-5148-4c6c-8e12-cf2f750cf872",
    ];
    const newThreeWordName = "What are 3 words or short phrases that best describe what you want to sell?";
    for (const id of threeWordIds) {
      await client.query(
        `UPDATE agreement_deliverable_template_items SET deliverable_name = $1, updated_at = NOW() WHERE id = $2`,
        [newThreeWordName, id]
      );
    }
    console.log("Renamed Three-Word Company Categories");

    const meetingIntroIds = [
      "f74a2650-8839-4ef0-9926-075219d6d2fa",
      "5144ee8a-2271-4449-826a-cd8113e91780",
      "e480bbe4-20f4-4be7-b537-25fbca5ce94d",
    ];
    const legacyNote = 'Legacy method – this process may be updated in a future event cycle.';
    for (const id of meetingIntroIds) {
      await client.query(
        `UPDATE agreement_deliverable_template_items SET deliverable_name = $1, default_quantity = 1, sponsor_facing_note = $3, updated_at = NOW() WHERE id = $2`,
        ["Meeting Introduction List (Pre-Event)", id, legacyNote]
      );
    }
    console.log("Renamed Meeting Introductions (Pre-Event)");

    const emailIntroIds = [
      "b367ef72-ffdd-42fb-9bbd-3820349d2d9e",
      "34b65713-da17-4e78-bfcb-ae57e0067a30",
      "5dc6bb57-8a81-43d4-a26f-4aad6a285578",
    ];
    for (const id of emailIntroIds) {
      await client.query(
        `UPDATE agreement_deliverable_template_items SET deliverable_name = $1, default_quantity = 1, sponsor_facing_note = $3, updated_at = NOW() WHERE id = $2`,
        ["Email Introduction List (Post-Event)", id, legacyNote]
      );
    }
    console.log("Renamed Email Introductions (Post-Event)");

    const coiItems = [
      { id: "7b9881c2-0b35-4313-aadc-fdc7ccae6c55", pkg: "6ffe6a42-e12a-4c0e-bb39-820fbc99fffa", order: 10 },
      { id: "ae3dc321-fcc5-4913-9a44-3078321b4d6e", pkg: "9af04fa1-f0d3-4e29-8365-677fa223e721", order: 13 },
      { id: "2cd8951f-c01b-4346-8a54-cdae2a808710", pkg: "d11201e7-2a9a-460b-bfb5-6254205faf54", order: 13 },
      { id: "1250fac1-b7be-4661-a254-94a8f61753a2", pkg: "7dcc2100-a1cf-47dd-818a-ca446a5c0db3", order: 12 },
    ];
    for (const coi of coiItems) {
      await client.query(
        `UPDATE agreement_deliverable_template_items SET is_active = false, updated_at = NOW() WHERE id = $1`,
        [coi.id]
      );
      await client.query(
        `INSERT INTO agreement_deliverable_template_items (package_template_id, category, deliverable_name, default_quantity, quantity_unit, owner_type, sponsor_editable, sponsor_visible, fulfillment_type, reminder_eligible, due_timing, display_order, is_active)
         VALUES ($1, 'Sponsor Deliverables', 'General Liability – Certificate of Insurance', 1, NULL, 'Sponsor', true, true, 'status_only', true, 'not_applicable', $2, true)`,
        [coi.pkg, coi.order]
      );
      await client.query(
        `INSERT INTO agreement_deliverable_template_items (package_template_id, category, deliverable_name, default_quantity, quantity_unit, owner_type, sponsor_editable, sponsor_visible, fulfillment_type, reminder_eligible, due_timing, display_order, is_active)
         VALUES ($1, 'Sponsor Deliverables', 'Worker''s Compensation – Certificate of Insurance', 1, NULL, 'Sponsor', true, true, 'status_only', true, 'not_applicable', $2 + 1, true)`,
        [coi.pkg, coi.order]
      );
    }
    console.log("Split COI into General Liability + Worker's Comp");

    const logoItems = [
      { id: "3fe2a7fc-1eb9-4ffe-b24c-1db34f7ae64b", pkg: "6ffe6a42-e12a-4c0e-bb39-820fbc99fffa", order: 6 },
      { id: "f7d2ca74-f18c-46c3-bab7-28001c3a2411", pkg: "9af04fa1-f0d3-4e29-8365-677fa223e721", order: 9 },
      { id: "9c9de51c-a5d9-4f95-9ed9-da797528a2c2", pkg: "d11201e7-2a9a-460b-bfb5-6254205faf54", order: 9 },
      { id: "a0c40977-6afe-476a-b30c-c18ec3bec07b", pkg: "7dcc2100-a1cf-47dd-818a-ca446a5c0db3", order: 8 },
    ];
    for (const logo of logoItems) {
      await client.query(
        `UPDATE agreement_deliverable_template_items SET is_active = false, updated_at = NOW() WHERE id = $1`,
        [logo.id]
      );
      await client.query(
        `INSERT INTO agreement_deliverable_template_items (package_template_id, category, deliverable_name, default_quantity, quantity_unit, owner_type, sponsor_editable, sponsor_visible, fulfillment_type, reminder_eligible, due_timing, display_order, is_active)
         VALUES ($1, 'Converge Deliverables', 'Company Logo on Website', 1, NULL, 'Converge', false, true, 'status_only', false, 'not_applicable', $2, true)`,
        [logo.pkg, logo.order]
      );
      await client.query(
        `INSERT INTO agreement_deliverable_template_items (package_template_id, category, deliverable_name, default_quantity, quantity_unit, owner_type, sponsor_editable, sponsor_visible, fulfillment_type, reminder_eligible, due_timing, display_order, is_active)
         VALUES ($1, 'Converge Deliverables', 'Company Logo on Signage', NULL, 'Various', 'Converge', false, true, 'status_only', false, 'not_applicable', $2 + 1, true)`,
        [logo.pkg, logo.order]
      );
      await client.query(
        `INSERT INTO agreement_deliverable_template_items (package_template_id, category, deliverable_name, default_quantity, quantity_unit, owner_type, sponsor_editable, sponsor_visible, fulfillment_type, reminder_eligible, due_timing, display_order, is_active)
         VALUES ($1, 'Converge Deliverables', 'Company Profile in Event App', 1, NULL, 'Converge', false, true, 'status_only', false, 'not_applicable', $2 + 2, true)`,
        [logo.pkg, logo.order]
      );
    }
    console.log("Split Company Logo on Website and Event Signage into 3");

    const exhibitIds = [
      "0796b24c-5bac-4ea0-924d-891e5fcd462f",
      "4f700143-273e-4733-b865-71889595889d",
      "229f6d08-9af9-435d-89d7-ff9e7844c4d5",
      "571d68b8-26cf-4555-b547-321050778e12",
    ];
    for (const id of exhibitIds) {
      await client.query(
        `UPDATE agreement_deliverable_template_items SET default_quantity = 1, updated_at = NOW() WHERE id = $1`,
        [id]
      );
    }
    console.log("Fixed exhibit table quantity to 1");

    const speakingIds = [
      "acc66ddf-122e-4430-837c-9bcd6bd27f53",
      "5ef432f7-c11b-4214-9bb2-8f1889ea91f6",
    ];
    for (const id of speakingIds) {
      await client.query(
        `UPDATE agreement_deliverable_template_items SET help_title = 'Speaking Engagement Details', help_text = 'Details about the speaking engagement format, duration, and topics will be provided by the event team.', updated_at = NOW() WHERE id = $1`,
        [id]
      );
    }
    console.log("Added Speaking Engagement help placeholders");

    await client.query(
      `UPDATE agreement_deliverables SET deliverable_name = $1, updated_at = NOW() WHERE deliverable_name = 'Three-Word Company Categories'`,
      [newThreeWordName]
    );

    await client.query(
      `UPDATE agreement_deliverables SET deliverable_name = 'Meeting Introduction List (Pre-Event)', quantity = 1, sponsor_facing_note = $1, updated_at = NOW() WHERE deliverable_name = 'Meeting Introductions (Pre-Event)'`,
      [legacyNote]
    );

    await client.query(
      `UPDATE agreement_deliverables SET deliverable_name = 'Email Introduction List (Post-Event)', quantity = 1, sponsor_facing_note = $1, updated_at = NOW() WHERE deliverable_name = 'Email Introductions (Post-Event)'`,
      [legacyNote]
    );

    await client.query(
      `UPDATE agreement_deliverables SET quantity = 1, updated_at = NOW() WHERE deliverable_name LIKE '%Exhibit Table%' AND (quantity IS NULL OR quantity != 1)`
    );

    const {rows: liveCois} = await client.query(
      `SELECT * FROM agreement_deliverables WHERE deliverable_name = 'Certificate of Insurance'`
    );
    for (const coi of liveCois) {
      const isNotStarted = coi.status === 'Not Started';
      if (isNotStarted) {
        await client.query(
          `UPDATE agreement_deliverables SET deliverable_name = 'Certificate of Insurance (Legacy - Replaced)', internal_note = 'Replaced by General Liability COI and Worker''s Comp COI', sponsor_visible = false, updated_at = NOW() WHERE id = $1`,
          [coi.id]
        );
        await client.query(
          `INSERT INTO agreement_deliverables (sponsor_id, event_id, package_template_id, created_from_template_item_id, sponsorship_level, category, deliverable_name, quantity, quantity_unit, status, owner_type, sponsor_editable, sponsor_visible, fulfillment_type, reminder_eligible, display_order)
           VALUES ($1, $2, $3, NULL, $6, 'Sponsor Deliverables', 'General Liability – Certificate of Insurance', 1, NULL, 'Not Started', 'Sponsor', true, true, 'status_only', true, $5)`,
          [coi.sponsor_id, coi.event_id, coi.package_template_id, coi.status, coi.display_order, coi.sponsorship_level]
        );
        await client.query(
          `INSERT INTO agreement_deliverables (sponsor_id, event_id, package_template_id, created_from_template_item_id, sponsorship_level, category, deliverable_name, quantity, quantity_unit, status, owner_type, sponsor_editable, sponsor_visible, fulfillment_type, reminder_eligible, display_order)
           VALUES ($1, $2, $3, NULL, $6, 'Sponsor Deliverables', 'Worker''s Compensation – Certificate of Insurance', 1, NULL, 'Not Started', 'Sponsor', true, true, 'status_only', true, $5)`,
          [coi.sponsor_id, coi.event_id, coi.package_template_id, coi.status, coi.display_order + 1, coi.sponsorship_level]
        );
      } else {
        await client.query(
          `UPDATE agreement_deliverables SET internal_note = 'ADMIN REVIEW NEEDED: Status was ' || status || ' when split was attempted. Please manually create General Liability and Worker''s Comp COI deliverables.', updated_at = NOW() WHERE id = $1`,
          [coi.id]
        );
        console.log('  COI flagged for admin review (status=' + coi.status + ')');
      }
    }
    console.log("Split live COI deliverables");

    const {rows: liveLogos} = await client.query(
      `SELECT * FROM agreement_deliverables WHERE deliverable_name = 'Company Logo on Website and Event Signage'`
    );
    for (const logo of liveLogos) {
      const isNotStarted = logo.status === 'Not Started';
      if (isNotStarted) {
        await client.query(
          `UPDATE agreement_deliverables SET deliverable_name = 'Company Logo on Website and Event Signage (Legacy - Replaced)', internal_note = 'Replaced by Company Logo on Website, Company Logo on Signage, and Company Profile in Event App', sponsor_visible = false, updated_at = NOW() WHERE id = $1`,
          [logo.id]
        );
        await client.query(
          `INSERT INTO agreement_deliverables (sponsor_id, event_id, package_template_id, created_from_template_item_id, sponsorship_level, category, deliverable_name, quantity, quantity_unit, status, owner_type, sponsor_editable, sponsor_visible, fulfillment_type, reminder_eligible, display_order)
           VALUES ($1, $2, $3, NULL, $6, 'Converge Deliverables', 'Company Logo on Website', 1, NULL, 'Not Started', 'Converge', false, true, 'status_only', false, $5)`,
          [logo.sponsor_id, logo.event_id, logo.package_template_id, logo.status, logo.display_order, logo.sponsorship_level]
        );
        await client.query(
          `INSERT INTO agreement_deliverables (sponsor_id, event_id, package_template_id, created_from_template_item_id, sponsorship_level, category, deliverable_name, quantity, quantity_unit, status, owner_type, sponsor_editable, sponsor_visible, fulfillment_type, reminder_eligible, display_order)
           VALUES ($1, $2, $3, NULL, $6, 'Converge Deliverables', 'Company Logo on Signage', NULL, 'Various', 'Not Started', 'Converge', false, true, 'status_only', false, $5)`,
          [logo.sponsor_id, logo.event_id, logo.package_template_id, logo.status, logo.display_order + 1, logo.sponsorship_level]
        );
        await client.query(
          `INSERT INTO agreement_deliverables (sponsor_id, event_id, package_template_id, created_from_template_item_id, sponsorship_level, category, deliverable_name, quantity, quantity_unit, status, owner_type, sponsor_editable, sponsor_visible, fulfillment_type, reminder_eligible, display_order)
           VALUES ($1, $2, $3, NULL, $6, 'Converge Deliverables', 'Company Profile in Event App', 1, NULL, 'Not Started', 'Converge', false, true, 'status_only', false, $5)`,
          [logo.sponsor_id, logo.event_id, logo.package_template_id, logo.status, logo.display_order + 2, logo.sponsorship_level]
        );
      } else {
        await client.query(
          `UPDATE agreement_deliverables SET internal_note = 'ADMIN REVIEW NEEDED: Status was ' || status || ' when split was attempted. Please manually create replacement deliverables.', updated_at = NOW() WHERE id = $1`,
          [logo.id]
        );
        console.log('  Logo flagged for admin review (status=' + logo.status + ')');
      }
    }
    console.log("Split live Company Logo deliverables");

    const {rows: templates} = await client.query(
      `SELECT DISTINCT package_template_id FROM agreement_deliverable_template_items WHERE is_active = true ORDER BY package_template_id`
    );
    for (const tpl of templates) {
      const {rows: items} = await client.query(
        `SELECT id FROM agreement_deliverable_template_items WHERE package_template_id = $1 AND is_active = true ORDER BY display_order, created_at`,
        [tpl.package_template_id]
      );
      for (let i = 0; i < items.length; i++) {
        await client.query(
          `UPDATE agreement_deliverable_template_items SET display_order = $1, updated_at = NOW() WHERE id = $2`,
          [i, items[i].id]
        );
      }
    }
    console.log("Re-sequenced template display orders");

    const {rows: sponsorEvents} = await client.query(
      `SELECT DISTINCT sponsor_id, event_id FROM agreement_deliverables ORDER BY sponsor_id`
    );
    for (const se of sponsorEvents) {
      const {rows: delivs} = await client.query(
        `SELECT id FROM agreement_deliverables WHERE sponsor_id = $1 AND event_id = $2 AND deliverable_name NOT LIKE '%(Legacy - Replaced)%' ORDER BY display_order, created_at`,
        [se.sponsor_id, se.event_id]
      );
      for (let i = 0; i < delivs.length; i++) {
        await client.query(
          `UPDATE agreement_deliverables SET display_order = $1, updated_at = NOW() WHERE id = $2`,
          [i, delivs[i].id]
        );
      }
      const {rows: legacyItems} = await client.query(
        `SELECT id FROM agreement_deliverables WHERE sponsor_id = $1 AND event_id = $2 AND deliverable_name LIKE '%(Legacy - Replaced)%' ORDER BY display_order`,
        [se.sponsor_id, se.event_id]
      );
      for (let i = 0; i < legacyItems.length; i++) {
        await client.query(
          `UPDATE agreement_deliverables SET display_order = $1, sponsor_visible = false, updated_at = NOW() WHERE id = $2`,
          [delivs.length + i, legacyItems[i].id]
        );
      }
    }
    console.log("Re-sequenced live deliverable display orders");

    await client.query(
      `UPDATE agreement_deliverables SET help_title = 'Speaking Engagement Details', help_text = 'Details about the speaking engagement format, duration, and topics will be provided by the event team.', updated_at = NOW() WHERE deliverable_name = 'Speaking Engagement'`
    );
    console.log("Added Speaking Engagement help to live deliverables");

    await client.query("COMMIT");
    console.log("\nMigration completed successfully!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Migration failed, rolled back:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
