-- Sample catalogue and payment accounts. Safe to edit or skip in production.

insert into public.products (name, description, category, unit, price, is_promo, promo_price, promo_label, stock, weight_kg) values
  ('Hybrid Tomato Seeds (Diamante Max)', 'High-yield, heat-tolerant hybrid tomato seeds. 10 g pack.', 'Seeds', 'pack', 450, true, 399, 'Planting Season Sale', 120, 0.1),
  ('Lettuce Seeds – Grand Rapids', 'Fast-growing loose-leaf lettuce, ideal for hydroponics.', 'Seeds', 'pack', 120, false, null, null, 200, 0.05),
  ('Organic Vermicast 25 kg', 'Pure African nightcrawler vermicast. Improves soil structure and microbial life.', 'Fertilizers', 'sack', 380, false, null, null, 60, 25),
  ('Complete Fertilizer 14-14-14 (1 kg)', 'Balanced NPK for vegetables and fruit trees.', 'Fertilizers', 'kg', 95, true, 79, 'Promo', 300, 1),
  ('Drip Irrigation Starter Kit (100 m²)', 'Mainline, drip tape, connectors and filter for a 100 m² plot.', 'Irrigation', 'kit', 2850, false, null, null, 25, 6),
  ('NFT Hydroponic Kit – 36 holes', 'Food-grade PVC channels, pump and net cups. Grow leafy greens without soil.', 'Hydroponics', 'kit', 4999, true, 4299, 'Bundle Deal', 15, 9),
  ('Neem Oil Organic Pesticide 500 ml', 'Cold-pressed neem concentrate for aphids, mites and whiteflies.', 'Crop Protection', 'bottle', 320, false, null, null, 80, 0.6),
  ('Soil pH & Moisture Meter', '3-in-1 analog meter: pH, moisture and light. No batteries needed.', 'Tools', 'pc', 450, false, null, null, 40, 0.3),
  ('UV-treated Greenhouse Film 10 m', '200-micron UV film, 3 m wide. Sold per 10 m roll.', 'Greenhouse', 'roll', 3200, false, null, null, 12, 14),
  ('Seedling Trays 72-cell (10 pcs)', 'Reusable heavy-duty seedling trays.', 'Tools', 'set', 550, true, 480, 'Promo', 50, 2);

-- Each GCash number is a separate account with its own limits.
-- Set the limits to match YOUR accounts (GCash limits depend on verification level).
insert into public.payment_methods (type, label, account_name, account_number, instructions, daily_limit, monthly_limit, sort) values
  ('gcash', 'GCash – Account 1', 'KATANIM AGRI', '0917 000 0001', 'Scan the QR or send to the number, then upload the receipt screenshot.', 100000, 500000, 1),
  ('gcash', 'GCash – Account 2', 'KATANIM AGRI', '0917 000 0002', 'Scan the QR or send to the number, then upload the receipt screenshot.', 100000, 500000, 2),
  ('gcash', 'GCash – Account 3', 'KATANIM AGRI', '0917 000 0003', 'Scan the QR or send to the number, then upload the receipt screenshot.', 100000, 500000, 3),
  ('bank',  'BPI Bank Transfer / InstaPay QR', 'Katanim Modern Agriculture', '0000-0000-00', 'Transfer via InstaPay/PESONet or scan the QR Ph code. Upload the transfer confirmation.', null, null, 10),
  ('maya',  'Maya', 'KATANIM AGRI', '0918 000 0000', 'Scan the QR or send to the number, then upload the receipt screenshot.', null, null, 20);
