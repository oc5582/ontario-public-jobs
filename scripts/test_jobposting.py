#!/usr/bin/env python3
"""JobPosting rules in scripts/build_pages.py: pay parsing, titles, remote jobs. No network."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_pages as bp  # noqa: E402


def pay(salary: str, description: str = ""):
    parsed = bp.base_salary({"salary": salary, "description": description})
    if not parsed:
        return None
    value = parsed["value"]
    return (value.get("minValue", value.get("value")), value.get("maxValue"), value["unitText"])


def test_pay_periods() -> None:
    # A stated period wins.
    assert pay("$25.50 - $26.98 /hour") == (25.5, 26.98, "HOUR")
    assert pay("$1,144.15 per week") == (1144.15, None, "WEEK")
    assert pay("$93,798.00 - $127,484.00") == (93798, 127484, "YEAR")
    # Bi-weekly only when stated, converted to yearly x26.
    assert pay("$3,750.68 - $3,990.02 / bi-weekly") == (97517.68, 103740.52, "YEAR")
    # No period: under $200 is hourly; $20,000 or more is yearly; in between is left out.
    assert pay("$48.15 - $52.66") == (48.15, 52.66, "HOUR")
    assert pay("$23.81") == (23.81, None, "HOUR")
    assert pay("$2,966.12 - $3,442.06") is None
    # ...unless the description states the period right next to the same amount.
    desc = "Hiring salary range:\n$3,610.06\n-\n$5,157.24\n/ Bi-weekly\nHydro One is proud"
    assert pay("$3,610.06", desc) == (93861.56, 134088.24, "YEAR")
    # A label naming two periods settles nothing.
    assert pay("$1,500.00 - $1,800.00", "Salary/Hourly Range: $1,500.00 - $1,800.00 Work Details") is None
    # Monthly, daily and junk are left out.
    assert pay("$4,000 per month") is None
    assert pay("$7") is None
    assert pay("$") is None


def test_pay_text_cleanup() -> None:
    assert pay("se situe généralement entre 82 586$ et 97 160$, (niveau de poste 15)") == (82586, 97160, "YEAR")
    assert pay("23.81$") == (23.81, None, "HOUR")
    assert pay("$126, 000.00 - $176,140.00") == (126000, 176140, "YEAR")
    assert pay("$4,102.00 - 5,508.40 / Bi-weekly") == (106652, 143218.4, "YEAR")
    # The trade premium is not the minimum wage.
    assert pay("$50.72 - Plus $1.75/hour Skilled Trade Premium for all regular hours worked") == (50.72, None, "HOUR")
    assert pay("$38.02 - $49.37 Plus $1.75/hr Skilled Trade Premium for all regular hours worked") == (38.02, 49.37, "HOUR")
    assert pay("$28.75/hr (Training Rate); $36.75/hr - $47.50/hr upon completing training") == (36.75, 47.5, "HOUR")


def test_titles() -> None:
    assert bp.display_title("Postal Clerk (Toronto, ON, CA)") == "Postal Clerk"
    assert bp.display_title("Model Developer (Toronto, ON, CA, M5G 1Z5)") == "Model Developer"
    assert bp.display_title("Developer (Ottawa or Toronto, ON, CA)") == "Developer"
    assert bp.display_title("Senior Advisor, Financial Planning & Analysis (FP&A) (Toronto, ON, CA)") == (
        "Senior Advisor, Financial Planning & Analysis (FP&A)"
    )
    assert bp.display_title("HR CONSULTANT HEALTH & REHAB") == "HR Consultant Health & Rehab"
    assert bp.display_title("SYSTEMS INTEGRATOR 1 (SERVICENOW DEVELOPER)") == "Systems Integrator 1 (ServiceNow Developer)"
    assert bp.display_title("ANALYST / SENIOR ANALYST - SEED VENTURE FUND") == "Analyst / Senior Analyst - Seed Venture Fund"
    assert bp.display_title("MANAGER, CORPORATE COLLECTIONS") == "Manager, Corporate Collections"
    assert bp.display_title("Senior Project Manager (TTC)") == "Senior Project Manager (TTC)"
    assert bp.display_title("ANALYST, KNOW YOUR CLIENT - Toronto") == "Analyst, Know Your Client - Toronto"
    assert bp.display_title("ACCOUNT MANAGER - Entrepreneurship Centre (EC)") == "Account Manager - Entrepreneurship Centre (EC)"
    assert bp.display_title("REGISTERED PRACTICAL NURSE LTC (Community Programs)") == "Registered Practical Nurse LTC (Community Programs)"
    assert bp.display_title("Développeur(euse) principal(e), ServiceNow CSM - FR 395") == "Développeur(euse) principal(e), ServiceNow CSM - FR 395"
    assert bp.display_title("Manager, IT Security (CMHC)") == "Manager, IT Security (CMHC)"
    # The URL keeps using the raw title.
    job = {"title": "Postal Clerk (Toronto, ON, CA)", "employer": "Canada Post Corporation"}
    assert bp.title_slug(job) == "postal-clerk-toronto-on-ca"
    assert bp.job_title(job) == "Postal Clerk"


def posting(**overrides) -> dict:
    job = {
        "title": "Advisor",
        "employer": "Home Construction Regulatory Authority (HCRA)",
        "location": "Ontario, Canada",
        "description": "Location Ontario (Remote) Position type Volunteer",
        "work_mode": "remote",
        "apply_url": "https://example.com/jobs/1",
    }
    job.update(overrides)
    return bp.job_posting_data(job)


def test_employment_salary_and_context() -> None:
    assert bp.employment_types("Permanent") == ["FULL_TIME"]
    assert bp.employment_types("Regular (Hybrid)") == ["FULL_TIME"]
    assert bp.employment_types("Permanent Part Time") == ["PART_TIME"]
    assert bp.employment_types("Full Time (FT), Regular (R)") == ["FULL_TIME"]
    assert bp.employment_types("Full-time, Permanent Vacancy") == ["FULL_TIME"]
    labeled = {
        "title": "Advisor",
        "employer": "Ontario Energy Board",
        "location": "Toronto",
        "description": "Position Type: Non-Union Permanent\nDo the work.",
        "apply_url": "https://example.com/jobs/1",
        "employment_type": "",
    }
    data = bp.job_posting_data(labeled)
    assert data["@context"] == "https://schema.org"
    assert data["employmentType"] == "FULL_TIME"
    assert "validThrough" not in data
    incidental = dict(labeled, description="Benefits depend on employment type (e.g., full-time permanent or contracts).")
    assert "employmentType" not in bp.job_posting_data(incidental)
    paid = bp.base_salary({"salary": "", "description": "Pay:\n$74,671.00 - $130,424\nAbout the role"})
    assert paid["currency"] == "CAD"
    assert paid["value"]["minValue"] == 74671
    assert paid["value"]["maxValue"] == 130424
    assert paid["value"]["unitText"] == "YEAR"
    # No period and not a clear hourly or yearly amount: still omitted.
    assert bp.base_salary({"salary": "$1,664.34 - $2,622.59", "description": "Salary Range: $1,664.34 - $2,622.59"}) is None
    org = data["hiringOrganization"]
    assert "logo" not in org


def test_remote_jobs() -> None:
    data = posting()
    assert data["jobLocationType"] == "TELECOMMUTE"
    assert data["applicantLocationRequirements"] == {"@type": "State", "name": "Ontario"}
    data = posting(location="Canada", description="This is a fully remote role open to anyone living in Canada.")
    assert data["applicantLocationRequirements"] == {"@type": "Country", "name": "CA"}
    # Remote, but no stated area: not marked TELECOMMUTE (Google requires the area).
    data = posting(location="Toronto", description="A remote role.")
    assert "jobLocationType" not in data and "applicantLocationRequirements" not in data
    data = posting(work_mode="hybrid")
    assert "jobLocationType" not in data
    assert posting()["title"] == "Advisor"
    assert posting(title="Postal Clerk (Toronto, ON, CA)")["title"] == "Postal Clerk"


def main() -> None:
    test_pay_periods()
    test_pay_text_cleanup()
    test_titles()
    test_employment_salary_and_context()
    test_remote_jobs()
    print("jobposting ok")


if __name__ == "__main__":
    main()
