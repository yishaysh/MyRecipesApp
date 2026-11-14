# Referral & Sharing Operations Guide

## 1. Merchant Registry & Safety Model
All grocery merchants preload in status `disabled`:
- `shufersal` — `https://www.shufersal.co.il/online/he/search?text={q}`
- `rami_levy` — `https://www.rami-levy.co.il/he/online/search?q={q}`
- `carrefour` — `https://www.carrefour.co.il/search/{q}`
- `ybitan` — `https://www.ybitan.co.il/search/{q}`

No commercial affiliate agreement is active in Round 7. Revenue, conversion counts, and affiliate commissions are strictly unavailable (`"לא זמין"`) until a commercial agreement is executed and configured.

## 2. Enabling a Merchant in `referral_only` Mode
1. Open the Admin Dashboard (`/admin`) -> **צמיחה, שיתופים וחנויות (Growth & Referrals)**.
2. Click **בדיקת קישור לדוגמה (SampleLinkCheck)** on the target merchant and enter at least **3 distinct real Hebrew ingredient queries** (e.g. `שמן זית`, `חלב 3%`, `עגבניות שרי`). Single-word smoke queries such as `קמח` alone are rejected by server validation.
3. Verify the generated search URLs open cleanly on the merchant's HTTPS storefront without breaking Hebrew URL encoding (`encodeURIComponent`).
4. Transition the merchant status from `disabled` to `referral_only`. The mandatory disclosure `"קישור לחנות, ללא שותפות מסחרית פעילה"` is displayed automatically to users.

## 3. Requirements Before `affiliate_active` Can Be Enabled
Server-side validation rejects any transition to `affiliate_active` unless:
1. A passing 3-ingredient `SampleLinkCheck` exists for the merchant, AND
2. All 8 commercial agreement fields are populated:
   - `agreementId`
   - `commissionType`
   - `attributionWindow`
   - `publisherId`
   - `campaignId`
   - `disclosureText`
   - `approvedTrafficSources`
   - `approver`
3. For postback verification (`POST /api/affiliate/postback`), `AFFILIATE_POSTBACK_SECRET` must be provisioned in environment secrets. Until a live commercial agreement exists, the postback endpoint verifies HMAC + replay keys and returns HTTP `501 Not Configured`.

## 4. Emergency Kill Switches
- **Single merchant**: Toggle the per-merchant `killSwitch` in Admin (`PATCH /api/v1/admin/merchants/:merchantId`). Redirects to that merchant immediately stop returning 302s and the merchant disappears from `/api/public/merchants`.
- **Global kill switch**: Toggle the global referral kill switch in Admin (`POST /api/v1/admin/referrals/kill-switch`) OR set `REFERRALS_ENABLED=0` in Vercel environment variables.
- **Sharing kill switch**: Set `SHARING_ENABLED=0` to block new share creation while keeping existing public reads controlled.

## 5. Share Revocation & Deletion Policy
- **Single-recipe deletion**: Deleting a synced recipe (`DELETE /api/v1/sync/recipes/:id` or `DELETE /api/v1/recipes/:id`) automatically revokes any active **single-recipe** share link owned by that user for that recipe ID.
- **Book snapshots**: Book shares hold a frozen snapshot of selected recipes at publish time (`snapshot_version`). Later private edits or deletions in the owner's library never auto-modify published book snapshots until the owner explicitly runs **"עדכון הגרסה המשותפת"** or revokes the book share.
- **Revoked links**: Revoked links immediately return HTTP `410 Gone` on `/s/:token`, `/api/public/shares/:token`, and `/api/public/shares/:token/image` with `Cache-Control: no-store`. Copies already saved by recipients remain independent in their own books.

## 6. Anonymous Guest Quota Limitations
- Anonymous extraction quotas (`5/month` in `Asia/Jerusalem` time) are tracked using the HMAC-signed `myrecipes_guest_id` HttpOnly cookie paired with an IP hash fallback (`anon_<hash>`).
- Clearing browser cookies and changing IP address simultaneously cannot be 100% prevented without requiring sign-in first.
- Signed-in users have unified cross-device quota keyed strictly by canonical `userId`, and sharing/saving shared copies never consumes extraction quota.
