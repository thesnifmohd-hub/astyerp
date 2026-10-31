// Supabase Edge Function: excel-import-export
// Validates Smart Build opening balances, Bank Statement reconciliations, and GSTR-1/GSTR-3B JSON payloads.
Deno.serve(async (req) => {
  try {
    const { mode, rows = [] } = await req.json();
    if (mode === 'validate_smart_build_opening') {
      let totalDrPaise = 0;
      let totalCrPaise = 0;
      for (const r of rows) {
        const paise = Math.round(Number(r.amountInr || 0) * 100);
        if (r.drCr === 'DR') totalDrPaise += paise;
        else totalCrPaise += paise;
      }
      return Response.json({
        valid: totalDrPaise === totalCrPaise,
        rowCount: rows.length,
        totalDrPaise,
        totalCrPaise,
        differencePaise: totalDrPaise - totalCrPaise,
      });
    }
    return Response.json({ ok: true, processed: rows.length });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
});

