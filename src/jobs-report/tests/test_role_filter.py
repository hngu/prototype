"""The titles here are real, taken from the seed boards unless noted."""

import pytest

from jobinsights.role_filter import is_software_engineering


@pytest.mark.parametrize(
    "title",
    [
        # Software roles, at any level.
        "Software Engineer",
        "Senior Software Engineer",
        "Senior Software Engineer, Storage",
        "Software Engineer, Internship",
        "Software Engineer, New Grad - Query Engines",
        "Software Engineering Intern, Frontend",
        "Principal Software Developer - Security - Elasticsearch",
        "Frontend Engineer, Ads Campaign Manager",
        "Full-Stack Engineer - ElevenCreative Enterprise",
        "Fullstack Software Engineer, Agent Platform",
        "Senior C++/iOS Engineer - User Platform",
        # Staff, principal and distinguished engineers.
        "Staff Engineer",  # the bare title; not from a board
        "Principal Engineer",
        "Principal Engineer - GTM Data Platform",
        "Distinguished Engineer, Content Platform",
        "Senior Staff Engineer, Autonomy (R5837)",
        "Senior Staff Engineer - Platform & Partner Experience",
        "Staff Engineer, Support Experiences",
        "Staff Software Engineer, Affirm Bank",
        "Principal Software Engineer - Search Algorithms - Elasticsearch",
        "Staff Machine Learning Engineer, Financial Connections",
        "Staff Web Engineer, Marketing",
        "Sr. Staff Platform/Data Reliability Engineer, Databricks (R5537)",
        "Staff+ Application Security Engineer",
        # Data, machine learning, research and security engineers.
        "Data Engineer Intern (2027)",
        "Machine Learning Engineer, EPD Ads",
        "Research Engineer",
        "Security Engineer - Threat Intel",
        "Infrastructure Security Engineer",
        "Staff Detection Engineer",
        # Site reliability.
        "Director, Site Reliability Engineering",
        "Manager, Site Reliability Engineering - Storage Layer Service",
        # Engineering managers and forward deployed engineers.
        "Engineering Manager, Guardian",
        "Senior Engineering Manager - Fintech",
        "Manager, Engineering",
        "Manager, Engineering, SecureAI",
        "Manager II, Engineering - Datadog Agent SDLC",
        "Forward Deployed Engineer",
        "Forward Deployed Software Engineer - US Government",
        "Software Engineer, Forward Deployed AI Solutions",
        # Member of Technical Staff has no "engineer" in it.
        "Member of Technical Staff - Systems",
        "Member of Technical Staff (Android Engineer, Computer Growth)",
        # A word from the drop lists doesn't matter once a software role is named.
        "Staff Software Engineer, Customer Administration",
        "Principal Software Engineer- Agentic Customer Care",
        "Senior Full-Stack Software Engineer, Developer Success",
        "Machine Learning Engineer, Safety and Customer Care AI",
        "Staff Software Engineer - Customer Engagement & Docs Platform",
        # Case doesn't matter.
        "SENIOR SOFTWARE ENGINEER",
        "senior backend engineer",
    ],
)
def test_software_roles_are_kept(title: str) -> None:
    assert is_software_engineering(title)


@pytest.mark.parametrize(
    "title",
    [
        # Sales and customer-facing engineers.
        "Enterprise Sales Engineer - Netherlands",
        "Staff Sales Engineer, Voice AI",
        "Senior Solutions Engineer",
        "Senior Customer Engineer, Strategic Pursuits, APAC (Based in Singapore)",
        "Principal Customer Engineer, Majors",
        "Principal Partner Engineer, Japan (Based in Tokyo)",
        "Senior Field Solutions Engineer",
        "Forward Deployed Engineer, Industry Solutions",
        # Support.
        "Technical Support Engineer",
        "Premium Support Engineer (Foster City, Weekend Shift)",
        "Dedicated Support Engineer - London",
        # Other "engineers" who aren't software engineers.
        "Legal Engineer",
        "Network Engineer (R4843)",
        "Data Center Network Operations Engineer",
        "IT Systems Engineer",
        # Hardware, even at a senior level.
        "Staff Engineer, Mechanical (R4887)",
        "Principal Engineer, Electrical (R5909)",
        "Staff Engineer, Propulsion (R5899)",
        "Staff Engineer, Manufacturing",
        "Senior Staff Engineer, Survivability Materials",
        "Staff Engineer, Quality (R4840)",
        "Staff Engineer, Electromechanical Power Electronics (R6046)",
        "Sr. Staff Mechanical Engineer - BlueSky (R5825)",
        "Mechanical Design Engineer, Motor Design & Prototyping",
        "Firmware Engineering Manager, Lyft Urban Solutions",
        "Senior Staff Engineer, PCB Design (R5752)",
        "Senior Energy Engineer",
        "Staff Engineer, Supply Chain (R6228)",
        # Developer-flavored roles that aren't developers.
        "Senior Developer Advocate (Auth0)",
        "Product Manager - Developer Experience, Bridge",
        "Staff Technical Program Manager, Engineering Onboarding",
        "Staff Product Manager, Agentic Experiences (Former Engineer)",
        "Solutions Architect, AI/Cloudflare Developer Platform",
        # Naming a software area isn't the same as being a software engineer.
        "Senior Data Scientist - Consumer Frontend",
        "Manager, Forward Deployed Engineering- NYC",
        # No engineering word at all. Some are real software roles: accepted false negatives.
        "Account Executive",
        "Abuse Investigator",
        "Accountant",
        "Data Scientist, Safety",
        "Tech Lead, Systems & Platform Applied AI",
        "Software Security Architect, Operating Systems | Consumer Devices",
        "デリバリーソリューションアーキテクト",
        "",
    ],
)
def test_other_roles_are_dropped(title: str) -> None:
    assert not is_software_engineering(title)


def test_an_accepted_false_negative_stays_dropped() -> None:
    # "Quality" usually marks a hardware role on these boards, so this software role is missed.
    assert not is_software_engineering(
        "Senior Staff Engineer, Guest & Host (Host Listings & Quality)"
    )


@pytest.mark.parametrize(
    "title",
    [
        # Invented titles, to check parts of words don't match.
        "Reengineering Lead",
        "Developmental Editor",
        "Presre Coordinator",
    ],
)
def test_only_whole_words_count(title: str) -> None:
    assert not is_software_engineering(title)
