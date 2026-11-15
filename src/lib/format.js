const pesoFmt = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

export const peso = (n) => pesoFmt.format(Number(n || 0));

export const round2 = (n) => Math.round(Number(n) * 100) / 100;

export const formatDate = (d) =>
  d ? new Date(d).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }) : '';

export function isPromoActive(p) {
  return Boolean(
    p?.is_promo && p.promo_price != null && (!p.promo_ends_at || new Date(p.promo_ends_at) > new Date()),
  );
}

export function effectivePrice(p) {
  return isPromoActive(p) ? Number(p.promo_price) : Number(p.price);
}

export function errorMessage(err) {
  if (!err) return '';
  return err.message || err.error_description || String(err);
}
