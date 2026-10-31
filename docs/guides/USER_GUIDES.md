# Asty ERP — User Guides by Position (English + മലയാളം)

---

## 1. System Admin
- Open **Admin & Permissions** from the sidebar.
- **Positions & Hierarchy:** Create new positions anytime (e.g., *Site Engineer, Store Keeper, Quantity Surveyor*), set **Reports To**, and toggle permissions in the **Permission Matrix** — no code deploy needed.
- **Users:** Create logins, assign one or more positions, scope access to specific sites or *All Sites*, or deactivate users (users are never deleted so audit history remains intact).
- **Approval Chains:** Adjust the ₹3,000 spending threshold, 7-day anti-splitting window, or 24-hour escalation SLA.

## 2. Management (Director)
- **Dashboard:** Immediately see which sites are **Delayed** or **At Risk**, urgent DPR hold-ups, cash/receivables/payables, and site revenue vs. cost.
- **Approvals:** Final one-tap approval on spending requests `> ₹3,000` (including split requests caught by the 7-day anti-splitting rule), baseline site plan changes, extra work, and client bills.
- **Reports:** Exclusive access (`report.profit.view`) to Contract Values, BOQ margins, **Site-Wise P&L**, and **Partner / Referral Profit-Share Statements**.

## 3. Operations Executive
- **Dashboard & Planning:** Track daily check-in completion across all sites, review the simple **List View** & **14-Day Look-Ahead**, and act on material/drawing/crew-clash alerts.
- **Approvals:** Final-approve verified requests `≤ ₹3,000`; review and forward requests `> ₹3,000` to Management.
- **Materials & Billing:** Create Purchase Orders (checking the **Last 3 Purchase Rates**), manage vendors/workers, and perform initial checks on Client RA/PMC Invoices.

## 4. Project Coordinator
- **Approvals:** Perform **Technical Check** on every supervisor request (verifying plan linkage and quantities) before spending approval; approve task completions and **Site-to-Site Material Transfers**.
- **Planning & DPR:** Build BOQ-linked site schedules with Management and monitor supervisor photo quality and GPS accuracy flags.

## 5. Site Supervisor (English)
1. Open the app on your Android phone browser and tap **Add to Home Screen** (PWA). Toggle **EN / മലയാളം** anytime in the top bar.
2. **Morning (8:00–10:00):** Stand inside the site boundary → Tap **Verify Live Site GPS** → Mark **Own Crew Attendance** & **Subcontractor Headcount** → Capture live stamped photo → Submit.
3. **Afternoon (12:30–2:30):** Capture **at least 3 live camera progress photos** (gallery uploads are disabled; date, time, GPS & site name are stamped automatically).
4. **Evening (4:30–7:00):** Enter **Quantity Completed**, **Materials Used**, any **Problems** (tick **URGENT** to alert Management immediately), **Tomorrow's Plan**, and **minimum 3 live photos** to close the day.
5. **No Network?** Tap **Queue Offline** — your report is stored safely on the phone and syncs automatically once network returns.

## 5B. സൈറ്റ് സൂപ്പർവൈസർ സഹായി (Malayalam Supervisor Guide)
1. ഫോണിൽ ആപ്പ് തുറന്ന് മുകളിലുള്ള **മലയാളം** ബട്ടൺ അമർത്തുക. **Add to Home Screen** വഴി ഫോണിൽ ഇൻസ്റ്റാൾ ചെയ്യാം.
2. **രാവിലത്തെ ചെക്ക്-ഇൻ (8:00–10:00):** സൈറ്റിനുള്ളിൽ നിന്ന് **സൈറ്റ് GPS പരിശോധിക്കുക** അമർത്തുക (സൈറ്റ് പരിധിക്ക് പുറത്താണെങ്കിൽ ചെക്ക്-ഇൻ ബ്ലോക്ക് ആകും). സ്വന്തം തൊഴിലാളികളുടെ ഹാജരും സബ്കോൺട്രാക്ടർ എണ്ണവും രേഖപ്പെടുത്തി ലൈവ് ഫോട്ടോ എടുത്ത് സമർപ്പിക്കുക.
3. **ഉച്ചയ്ക്കുള്ള ചെക്ക്-ഇൻ (12:30–2:30):** ആപ്പിലെ ലൈവ് ക്യാമറ ഉപയോഗിച്ച് **കുറഞ്ഞത് 3 ഫോട്ടോകൾ** എടുക്കുക (ഗാലറിയിൽ നിന്ന് ഫോട്ടോ അപ്‌ലോഡ് ചെയ്യാൻ കഴിയില്ല; തീയതി, സമയം, GPS, സൈറ്റ് പേര് എന്നിവ ഫോട്ടോയിൽ തനിയെ പതിയും).
4. **വൈകുന്നേരത്തെ റിപ്പോർട്ട് (4:30–7:00):** ഇന്ന് പൂർത്തിയാക്കിയ ജോലിയുടെ അളവ്, ഉപയോഗിച്ച മെറ്റീരിയലുകൾ, തടസ്സങ്ങൾ (അടിയന്തരമാണെങ്കിൽ **URGENT** ടിക്ക് ചെയ്യുക — ഉടൻ മാനേജ്‌മെന്റിന് അലേർട്ട് ലഭിക്കും), **നാളത്തെ പ്ലാൻ**, കുറഞ്ഞത് **3 ലൈവ് ഫോട്ടോകൾ** എന്നിവ നൽകി ദിവസം ക്ലോസ് ചെയ്യുക.
5. **നെറ്റ്‌വർക്ക് ഇല്ലെങ്കിൽ:** **Queue Offline** അമർത്തുക. ഇന്റർനെറ്റ് തിരികെ ലഭിക്കുമ്പോൾ റിപ്പോർട്ട് തനിയെ സിങ്ക് ആകും.

## 6. Accounts Head
- **Pending Posting Queue:** Review auto-generated draft vouchers (from Purchase Bills, Weekly Wage Sheets, Subcontractor 194C Bills, Petty Cash settlements, and Client Invoices) and post them using `voucher.post`.
- **Reconciliation & Tax:** Match imported bank statement lines, export **GSTR-1 / GSTR-3B** summaries and **194C / 194J TDS** registers, review WDV depreciation & loan EMIs, and **Lock Periods**.

## 7. Junior Accountant
- Enter Payment, Receipt, Contra, Journal, Purchase, and Petty Cash vouchers as balanced **Drafts** (`Debit = Credit` enforced).
- Import Smart Build opening balance templates. Drafts automatically wait in the Pending Queue for Accounts Head posting (`voucher.post`); profit and partner splits remain hidden.

