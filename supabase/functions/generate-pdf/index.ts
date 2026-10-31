// Supabase Edge Function: generate-pdf
// Generates Asty Constructions letterhead HTML/PDF artifacts for POs, DPRs, Quotations, Tax Invoices & Vouchers.
Deno.serve(async (req) => {
  try {
    const { docType, docNumber, title, siteName, rows = [], footerNotes = '' } = await req.json();
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: 'Manrope', Arial, sans-serif; color: #0B0B0B; margin: 32px; }
    .header { background: #1D2527; color: #FFFFFF; padding: 20px 24px; display: flex; justify-content: space-between; }
    .sub { color: #8DA1B1; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
    th { background: #1D2527; color: #fff; text-align: left; padding: 8px; }
    td { border-bottom: 1px solid #DCE3E8; padding: 8px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h2 style="margin:0;">ASTY CONSTRUCTIONS</h2>
      <div class="sub">Thrissur, Kerala | GSTIN: 32AABCA8821K1Z4</div>
    </div>
    <div style="text-align:right;">
      <div><strong>${docType}</strong></div>
      <div class="sub">${docNumber} | ${siteName ?? 'Head Office'}</div>
    </div>
  </div>
  <h3>${title}</h3>
  <table>
    <tbody>
      ${rows.map((r: string[]) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}
    </tbody>
  </table>
  <p style="margin-top:24px;font-size:11px;color:#555;">${footerNotes}</p>
</body>
</html>`;
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
});

