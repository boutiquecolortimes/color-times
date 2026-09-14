# WhatsApp Templates to Register in Meta

These are all the automatic messages Color Times Boutique's admin panel is built to send. Register each one in **Meta Business Manager → WhatsApp Manager → Message Templates** before turning it on in the admin.

For every template:
- **Category:** Utility (all of these are transactional — order/booking status, not promotional)
- **Language:** English (US) — `en_US` — matches what the admin panel expects by default
- Type the **Body** text into Meta's editor exactly as shown. Meta auto-detects `{{1}}`, `{{2}}`, etc. and will ask you for a sample value for each — use the examples given below.
- Add the **Footer** text shown as a separate Footer section (not part of the numbered body).
- The **Meta Template Name** is what you'll paste into the admin's "New Template" dialog later — use it exactly as written (lowercase, underscores, no spaces — Meta requires this format anyway).

Once a template is **Approved** in Meta, go to **Admin → WhatsApp → Templates → New Template** in the admin panel and create a matching entry: pick the Trigger Event, paste the Meta Template Name and Language, and write a plain-English Preview Text (using `{{customerName}}`-style names — that's for staff reference only, not what's actually sent). Mark it **Active**.

---

## 1. Booking Confirmed

**Meta Template Name:** `booking_confirmed`
**Trigger Event (admin):** Booking Confirmed

**Body:**
```
Hi {{1}}, your booking {{2}} for {{3}} is confirmed for {{4}}. Rental dates: {{5}} to {{6}}. Total: ₹{{7}}.
```
**Footer:** `Color Times Boutique`

| Placeholder | Variable | Example value |
|---|---|---|
| {{1}} | customerName | Priya Sharma |
| {{2}} | bookingNumber | CTB-2026-01042 |
| {{3}} | productName | Maroon Silk Lehenga |
| {{4}} | eventDate | 12 Oct 2026 |
| {{5}} | rentalStartDate | 10 Oct 2026 |
| {{6}} | rentalEndDate | 14 Oct 2026 |
| {{7}} | totalAmount | 8,500 |

---

## 2. Booking Reminder

**Meta Template Name:** `booking_reminder`
**Trigger Event (admin):** Booking Reminder

**Body:**
```
Hi {{1}}, just a reminder — your booking {{2}} for {{3}} is coming up on {{4}}. Pickup date: {{5}}. See you soon!
```
**Footer:** `Color Times Boutique`

| Placeholder | Variable | Example value |
|---|---|---|
| {{1}} | customerName | Priya Sharma |
| {{2}} | bookingNumber | CTB-2026-01042 |
| {{3}} | productName | Maroon Silk Lehenga |
| {{4}} | eventDate | 12 Oct 2026 |
| {{5}} | rentalStartDate | 10 Oct 2026 |

---

## 3. Return Reminder

**Meta Template Name:** `booking_return_reminder`
**Trigger Event (admin):** Return Reminder

**Body:**
```
Hi {{1}}, a quick reminder that your rental {{2}} ({{3}}) is due for return on {{4}}. Please return it on time to avoid late charges.
```
**Footer:** `Color Times Boutique`

| Placeholder | Variable | Example value |
|---|---|---|
| {{1}} | customerName | Priya Sharma |
| {{2}} | bookingNumber | CTB-2026-01042 |
| {{3}} | productName | Maroon Silk Lehenga |
| {{4}} | rentalEndDate | 14 Oct 2026 |

---

## 4. Booking Returned

**Meta Template Name:** `booking_returned`
**Trigger Event (admin):** Booking Returned

**Body:**
```
Hi {{1}}, we've received your return for booking {{2}} ({{3}}). Thank you for renting with us!
```
**Footer:** `Color Times Boutique`

| Placeholder | Variable | Example value |
|---|---|---|
| {{1}} | customerName | Priya Sharma |
| {{2}} | bookingNumber | CTB-2026-01042 |
| {{3}} | productName | Maroon Silk Lehenga |

---

## 5. Booking Cancelled

**Meta Template Name:** `booking_cancelled`
**Trigger Event (admin):** Booking Cancelled

**Body:**
```
Hi {{1}}, your booking {{2}} for {{3}} has been cancelled. Contact us if you have any questions.
```
**Footer:** `Color Times Boutique`

| Placeholder | Variable | Example value |
|---|---|---|
| {{1}} | customerName | Priya Sharma |
| {{2}} | bookingNumber | CTB-2026-01042 |
| {{3}} | productName | Maroon Silk Lehenga |

---

## 6. Invoice Sent

**Meta Template Name:** `invoice_sent`
**Trigger Event (admin):** Invoice Sent

**Body:**
```
Hi {{1}}, invoice {{2}} for ₹{{3}} is ready. Amount due: ₹{{4}} by {{5}}.
```
**Footer:** `Color Times Boutique`

| Placeholder | Variable | Example value |
|---|---|---|
| {{1}} | customerName | Priya Sharma |
| {{2}} | invoiceNumber | INV-00234 |
| {{3}} | totalAmount | 8,500 |
| {{4}} | amountDue | 3,500 |
| {{5}} | dueDate | 20 Oct 2026 |

---

## 7. Payment Received

**Meta Template Name:** `payment_received`
**Trigger Event (admin):** Payment Received

**Body:**
```
Hi {{1}}, we've received your payment of ₹{{2}} for invoice {{3}}. Remaining balance: ₹{{4}}. Thank you!
```
**Footer:** `Color Times Boutique`

| Placeholder | Variable | Example value |
|---|---|---|
| {{1}} | customerName | Priya Sharma |
| {{2}} | amountPaid | 5,000 |
| {{3}} | invoiceNumber | INV-00234 |
| {{4}} | amountDue | 3,500 |

---

## 8. Payment Reminder

**Meta Template Name:** `payment_reminder`
**Trigger Event (admin):** Payment Reminder

**Body:**
```
Hi {{1}}, this is a reminder that ₹{{2}} is due on invoice {{3}} by {{4}}. Please make the payment at your earliest convenience.
```
**Footer:** `Color Times Boutique`

| Placeholder | Variable | Example value |
|---|---|---|
| {{1}} | customerName | Priya Sharma |
| {{2}} | amountDue | 3,500 |
| {{3}} | invoiceNumber | INV-00234 |
| {{4}} | dueDate | 20 Oct 2026 |

---

## 9. Customisation Bill Sent

**Meta Template Name:** `customisation_bill_sent`
**Trigger Event (admin):** Customisation Bill Sent

**Body:**
```
Hi {{1}}, your customisation order bill {{2}} is ready. Total: ₹{{3}}. Advance paid: ₹{{4}}. Balance due: ₹{{5}}.
```
**Footer:** `Color Times Boutique`

| Placeholder | Variable | Example value |
|---|---|---|
| {{1}} | customerName | Priya Sharma |
| {{2}} | billNumber | 00892 |
| {{3}} | totalAmount | 4,200 |
| {{4}} | advancePayment | 2,000 |
| {{5}} | dueAmount | 2,200 |

---

## 10. Sale Bill Sent

**Meta Template Name:** `sale_bill_sent`
**Trigger Event (admin):** Sale Bill Sent

**Body:**
```
Hi {{1}}, thank you for your purchase! Bill {{2}} — Total: ₹{{3}}.
```
**Footer:** `Color Times Boutique`

| Placeholder | Variable | Example value |
|---|---|---|
| {{1}} | customerName | Priya Sharma |
| {{2}} | billNumber | 00893 |
| {{3}} | totalAmount | 6,000 |

---

## Not a template — "Custom / Manual"

The admin panel also lists a **Custom / Manual** trigger event. This isn't tied to an automatic send — it's a placeholder for one-off messages staff type themselves, so there's nothing to register in Meta for it.

## Notes

- **Exact wording matters to Meta.** Once approved, you can't edit a template's body text without resubmitting it for re-approval — a new edit creates what's effectively a new version. If you want to tweak wording later, expect a short re-review wait before it's usable again.
- **Currency symbol (₹):** if Meta's template editor flags the rupee symbol, you can write "Rs." instead — just make sure the admin's Preview Text field (which is for internal reference only) still makes sense either way.
- Five of these ten (`booking_confirmed`, `booking_returned`, `booking_cancelled`, `invoice_sent`, `payment_received`) may already exist as **Brevo** templates from before the Meta switch (they were the project's original starter set) — if so, this is the Meta-equivalent wording for each so the approved templates read the same to your customers either way.
