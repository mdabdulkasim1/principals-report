# Coffeemia POS

A point-of-sale app for the cafe: table-wise orders, kitchen tickets, printed
bills, an editable menu with editable rates, a sales dashboard, and separate
admin / counter-staff logins.

It runs on one machine at the counter with **no installation and no database** —
just Node.js. Phones and tablets on the same Wi-Fi open the same app in a
browser, so two counters can work at once and the owner can watch the dashboard
from their phone.

---

## Running it

```bash
node pos/server.js            # from the repository root
# or, from anywhere in the repo:
npm run pos
```

Then open **http://localhost:3100**.

To use it from a tablet or phone on the same Wi-Fi, find the counter machine's
local address (`ipconfig` on Windows, `ifconfig`/`ip addr` on Mac and Linux) and
open `http://<that-address>:3100` — for example `http://192.168.1.7:3100`.

| Setting | How to change it |
| --- | --- |
| Port | `PORT=8080 node pos/server.js` |
| Where data is stored | `POS_DATA_DIR=/path/to/folder node pos/server.js` |
| Timezone for the business day | `TZ=Asia/Kolkata` (already the default) |

Everything lives in one file: `pos/data/pos.json`. **Copy that file to keep a
backup** — it holds the menu, rates, tables, staff and every bill.

## Logins created on first run

| Username | Password | PIN | Access |
| --- | --- | --- | --- |
| `admin` | `admin123` | 1111 | Owner — everything |
| `user1` | `user123` | 2222 | Counter staff |
| `user2` | `user123` | 3333 | Counter staff |

**Change all three from Settings → Staff & access before you start billing.**

Staff can sign in with a username and password, or tap their 4-digit PIN on the
counter tablet, which is faster at shift change.

### What each role can do

| | Admin | Counter staff (user-1, user-2) |
| --- | --- | --- |
| Take orders, kitchen tickets, print and settle bills | ✅ | ✅ |
| Move / merge tables, discounts, one-off items | ✅ | ✅ |
| Today's sales figures | ✅ | ✅ (own counter highlighted) |
| Older reports, date ranges, CSV export, day close | ✅ | ❌ |
| Menu, rates, categories | ✅ | ❌ |
| Table layout, staff logins, shop settings | ✅ | ❌ |
| Cancel a bill that is already settled | ✅ | ❌ |

## Day-to-day use

**Tables** — the home screen. Green means free, amber means a bill is running,
with its live total and how long the guests have been seated. A red "KOT
pending" corner means something on that bill has not gone to the kitchen yet.
Tap a table to open its bill; tap **Takeaway** or **Parcel** for counter sales.

**Taking an order** — tap items to add them. Use the category chips or the
search box (typing an item's short code and pressing Enter adds it straight
away). Use ✎ on a line for a kitchen note like "less sugar".

- **Send KOT** prints a kitchen ticket with only what is *new* since the last
  one, split by Kitchen and Beverages, with the token number in large type.
- **Print bill** prints the guest's bill without closing it.
- **Settle** takes the payment (Cash / UPI / Card), works out the change, prints
  the bill and frees the table.
- **Hold & back** parks the bill on the table and returns to the floor.
- **⋯** moves the bill to another table, merges two tables onto one bill, adds
  guest details, or discards the bill.

Orders save themselves as you go, so a tablet that sleeps or a browser that is
closed will not lose a running table.

**Bills** — every bill for the day (all history for the admin), with reprint,
and cancel-with-reason for the admin.

**Dashboard** — net sales, bills, average bill, what is still running on the
floor, sales by hour, payment split, top sellers, category split and staff-wise
totals. Admins can pick any date range, export to CSV for Excel, and print the
**day close** summary at the end of the night.

## Changing the menu and the rates

**Menu & rates** (admin) lists every category and item.

- Type a new number in the **Rate** box for any items you want to change, then
  press **Save rate changes**. Old rates are kept in the item's history, and
  bills already printed keep the rate they were billed at.
- **＋ New item** adds a dish — English name, Tamil name, category, rate and an
  optional short code for fast keyboard entry.
- The **On sale** switch takes something off the counter for the day (sold out)
  without deleting it.
- **＋ New category** adds a section, and each category is set to print on either
  the Kitchen or the Beverages ticket.

Deleting an item that has appeared on a bill hides it from the counter rather
than erasing it, so old bills stay correct.

## Printing

The app prints through the browser, so any printer the machine can already use
will work — thermal roll printers included.

1. Set the roll size in **Settings → Bill & printing** (80 mm or 58 mm).
2. The first time you print, in the browser's print dialog choose the thermal
   printer, set **Margins: None** and turn **Headers and footers off**.
3. Tick "remember" / set it as default so later prints go straight through.
   In Chrome, launching with `--kiosk-printing` skips the dialog entirely.

Tamil names print as long as the machine has a Tamil font (Windows and Android
both ship one). If Tamil looks wrong on a particular printer, turn off *Show
Tamil names* in Settings and the bills print in English only.

## GST

GST is **on by default at 5%, with the menu rates treated as already including
it** — the way most cafes here price. Nothing is added at the bottom of the
bill: a tea marked ₹15 is billed at ₹15, and the bill shows the GST that is
already inside that amount.

```
TOTAL                     ₹45.00
--------------------------------
GST breakup (included in the total)
Taxable value              42.86
CGST 2.5%                   1.07
SGST 2.5%                   1.07
--------------------------------
All prices shown above are inclusive of GST.
```

The breakup always adds back up to the total the guest pays, to the paisa.

In **Settings → GST & charges** you can:

- switch between *rates already include GST* and *add GST on top of the rate*,
- change the percentage (5% is the usual restaurant rate) and the name,
- turn the CGST / SGST split off and print a single GST line instead,
- edit the note printed on every bill — it reads *"All prices shown above are
  inclusive of GST."* out of the box,
- switch GST off altogether if you are not registered.

Put your GSTIN in **Settings → Shop details** and it prints in the bill header.
The dashboard and the day-close report both show the taxable value alongside
the GST collected, so the figures are ready for a return.

## Settings worth knowing

- **Round off** rounds the final total to the nearest rupee and prints the
  adjustment on the bill.
- **Payment modes** is a plain comma-separated list — add "Swiggy" or "Zomato"
  if you need them for reporting.
- **Footer line** is the thank-you line at the bottom of every bill.

## Notes

- Money is always recalculated on the server, so a stale browser tab can never
  bill an old rate.
- Anything removed from a bill after it went to the kitchen is written to a void
  log and printed on the day-close report.
- Bill numbers run continuously; token numbers restart each day.
- Sessions last one long shift (16 hours) and end when the server restarts.
