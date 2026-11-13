-- GTA hospitals (branch scrapers/gta-hospitals): official homepages. Data-only, no schema change.
-- Each homepage requested 2026-11-12 (America/Toronto); results in employer_websites_checked.json.
-- The importer creates employers rows (slug, name) on first import, so run this AFTER the first import that
-- includes these employers. Safe to re-run; only fills empty websites.
-- NOT APPLIED and kept out of supabase/migrations on purpose. At go-live copy to
-- supabase/migrations/<ts>_hospitals_employer_websites.sql.

update public.employers as e set website = v.website, updated_at = now()
from (values
  ('baycrest', 'https://www.baycrest.org/'),
  ('casey-house', 'https://caseyhouse.ca/'),
  ('centre-for-addiction-and-mental-health-camh', 'https://www.camh.ca/'),
  ('halton-healthcare', 'https://www.haltonhealthcare.on.ca/'),
  ('holland-bloorview-kids-rehabilitation-hospital', 'https://hollandbloorview.ca/'),
  ('humber-river-health', 'https://www.hrh.ca/'),
  ('joseph-brant-hospital', 'https://www.josephbranthospital.ca/'),
  ('lakeridge-health', 'https://www.lakeridgehealth.on.ca/'),
  ('mackenzie-health', 'https://www.mackenziehealth.ca/'),
  ('michael-garron-hospital', 'https://www.tehn.ca/'),
  ('north-york-general-hospital', 'https://www.nygh.on.ca/'),
  ('oak-valley-health', 'https://www.oakvalleyhealth.ca/'),
  ('ontario-shores-centre-for-mental-health-sciences', 'https://www.ontarioshores.ca/'),
  ('runnymede-healthcare-centre', 'https://runnymedehc.ca/'),
  ('scarborough-health-network', 'https://www.shn.ca/'),
  ('sinai-health', 'https://www.sinaihealth.ca/'),
  ('southlake-health', 'https://www.southlake.ca/'),
  ('sunnybrook-health-sciences-centre', 'https://sunnybrook.ca/'),
  ('the-hospital-for-sick-children-sickkids', 'https://www.sickkids.ca/'),
  ('toronto-grace-health-centre', 'https://www.torontograce.org/'),
  ('trillium-health-partners', 'https://www.thp.ca/'),
  ('unity-health-toronto', 'https://unityhealth.to/'),
  ('university-health-network-uhn', 'https://www.uhn.ca/'),
  ('william-osler-health-system', 'https://www.williamoslerhs.ca/'),
  ('women-s-college-hospital', 'https://www.womenscollegehospital.ca/')
) as v(slug, website)
where e.slug = v.slug and coalesce(e.website, '') = '';
