-- Employer official homepages (JobPosting hiringOrganization.sameAs) and, where the employer
-- publishes one in its own site's Organization structured data, its logo (hiringOrganization.logo).
-- Every homepage was opened on 2026-10-14 and checked to be the employer's own site; logos were
-- downloaded and checked to be images of at least 112x112 px. Employers without a stable official
-- logo URL get sameAs only. Data-only migration: no schema change (the columns exist since init).
-- Safe to re-run. The daily import only sets employers.name, so these values persist.

update public.employers as e set website = v.website, updated_at = now()
from (values
  ('alcohol-and-gaming-commission-of-ontario-agco', 'https://www.agco.ca/'),
  ('art-gallery-of-ontario', 'https://ago.ca/'),
  ('bank-of-canada', 'https://www.bankofcanada.ca/'),
  ('business-development-bank-of-canada-bdc', 'https://www.bdc.ca/'),
  ('canada-development-investment-corporation-cdev', 'https://cdev.gc.ca/'),
  ('canada-infrastructure-bank', 'https://cib-bic.ca/'),
  ('canada-mortgage-and-housing-corporation-cmhc', 'https://www.cmhc-schl.gc.ca/'),
  ('canada-pension-plan-investment-board-cppib', 'https://www.cppinvestments.com/'),
  ('canada-post-corporation', 'https://www.canadapost-postescanada.ca/'),
  ('canadian-broadcasting-corporation-cbc-radio-canada', 'https://cbc.radio-canada.ca/'),
  ('chartered-professional-accountants-of-ontario-cpa-ontario', 'https://www.cpaontario.ca/'),
  ('city-of-brampton', 'https://www.brampton.ca/'),
  ('city-of-burlington', 'https://www.burlington.ca/'),
  ('city-of-markham', 'https://www.markham.ca/'),
  ('city-of-mississauga', 'https://www.mississauga.ca/'),
  ('city-of-richmond-hill', 'https://www.richmondhill.ca/'),
  ('city-of-toronto', 'https://www.toronto.ca/'),
  ('createto', 'https://createto.ca/'),
  ('exhibition-place-board-of-governors-canadian-national-exhibition-association', 'https://www.explace.on.ca/'),
  ('export-development-canada-edc', 'https://www.edc.ca/'),
  ('farm-credit-canada', 'https://www.fcc-fac.ca/'),
  ('financial-services-regulatory-authority-of-ontario-fsra', 'https://www.fsrao.ca/'),
  ('home-construction-regulatory-authority-hcra', 'https://www.hcraontario.ca/'),
  ('hydro-one-limited', 'https://www.hydroone.com/'),
  ('independent-electricity-system-operator-ieso', 'https://www.ieso.ca/'),
  ('infrastructure-ontario', 'https://www.infrastructureontario.ca/'),
  ('investment-management-corporation-of-ontario-imco', 'https://www.imcoinvest.com/'),
  ('law-society-of-ontario', 'https://lso.ca/'),
  ('liquor-control-board-of-ontario-lcbo', 'https://www.lcbo.com/'),
  ('metrolinx', 'https://www.metrolinx.com/'),
  ('metropolitan-toronto-convention-centre-corporation', 'https://www.mtccc.com/'),
  ('municipality-of-clarington', 'https://www.clarington.net/'),
  ('ontario-cannabis-retail-corporation-ontario-cannabis-store', 'https://ocs.ca/'),
  ('ontario-centre-of-innovation', 'https://www.oc-innovation.ca/'),
  ('ontario-educational-communications-authority-tvo', 'https://www.tvo.org/'),
  ('ontario-energy-board', 'https://www.oeb.ca/'),
  ('ontario-french-language-educational-communications-authority-tfo', 'https://www.tfo.org/'),
  ('ontario-health', 'https://www.ontariohealth.ca/'),
  ('ontario-lottery-and-gaming-corporation-olg', 'https://about.olg.ca/'),
  ('ontario-power-generation-inc', 'https://www.opg.com/'),
  ('ontario-securities-commission', 'https://www.osc.ca/'),
  ('public-health-ontario-ontario-agency-for-health-protection-and-promotion', 'https://www.publichealthontario.ca/'),
  ('regional-municipality-of-halton', 'https://www.halton.ca/'),
  ('royal-ontario-museum', 'https://www.rom.on.ca/'),
  ('technical-standards-and-safety-authority-tssa', 'https://www.tssa.org/'),
  ('telefilm-canada', 'https://telefilm.ca/'),
  ('toronto-and-region-conservation-authority', 'https://trca.ca/'),
  ('toronto-atmospheric-fund', 'https://taf.ca/'),
  ('toronto-community-housing-corporation', 'https://torontohousing.ca/'),
  ('toronto-hydro-corporation', 'https://www.torontohydro.com/'),
  ('toronto-parking-authority', 'https://parking.greenp.com/'),
  ('toronto-police-service', 'https://www.tps.ca/'),
  ('toronto-transit-commission', 'https://www.ttc.ca/'),
  ('toronto-zoo-board-of-management', 'https://www.torontozoo.com/'),
  ('town-of-ajax', 'https://ajax.ca/'),
  ('town-of-aurora', 'https://www.aurora.ca/'),
  ('town-of-east-gwillimbury', 'https://www.eastgwillimbury.ca/'),
  ('town-of-halton-hills', 'https://www.haltonhills.ca/'),
  ('town-of-milton', 'https://www.milton.ca/'),
  ('town-of-oakville', 'https://www.oakville.ca/'),
  ('town-of-whitby', 'https://www.whitby.ca/'),
  ('township-of-king', 'https://www.king.ca/'),
  ('township-of-scugog', 'https://www.scugog.ca/'),
  ('township-of-uxbridge', 'https://www.uxbridge.ca/'),
  ('workplace-safety-and-insurance-appeals-tribunal', 'https://www.wsiat.ca/'),
  ('workplace-safety-and-insurance-board', 'https://www.wsib.ca/')
) as v(slug, website)
where e.slug = v.slug;

update public.employers as e set logo_url = v.logo_url, updated_at = now()
from (values
  ('ontario-lottery-and-gaming-corporation-olg', 'https://about.olg.ca/wp-content/uploads/2024/01/olg-logo-blue-background.jpg'),
  ('telefilm-canada', 'https://telefilm.ca/wp-content/uploads/2026/05/cropped-tfc_favicon_512.png'),
  ('toronto-and-region-conservation-authority', 'https://trcaca.s3.ca-central-1.amazonaws.com/app/uploads/2018/07/17162848/Toronto-and-Region-Conservation-Authority-logo.png'),
  ('town-of-ajax', 'https://ajax.ca/wp-content/uploads/2026/06/images.png')
) as v(slug, logo_url)
where e.slug = v.slug;
