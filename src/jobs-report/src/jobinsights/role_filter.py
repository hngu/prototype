"""Which postings count as software engineering, decided from the title alone.

This is a deliberate exception to "store raw, derive later" (CLAUDE.md rule 7):
only matching postings are stored in SQLite, while the archive keeps everything.
It's a pure function of the title, so archived jobs can be filtered again.

It's strict on purpose. Missing a real software role (a false negative) is
acceptable, so a doubtful title is left out. Words are matched anywhere in the
title, in this order:

1. A title that names a software role is kept: "Software Engineer, Customer Care".
2. A title with no engineering word is dropped: "Data Scientist".
3. A title naming a hardware field or another non-software line of work is
   dropped: "Staff Engineer, Mechanical".
4. A plain senior title is kept: "Staff Engineer, Support Experiences".
5. A title naming a sales, support or business role is dropped: "Sales Engineer".
6. Anything else with an engineering word is kept: "Engineering Manager".
"""

import re

# Bump whenever is_software_engineering's answer changes for the same title.
ROLE_FILTER_VERSION = "1"


def _words(*patterns: str) -> re.Pattern[str]:
    return re.compile(rf"\b({'|'.join(patterns)})\b", re.IGNORECASE)


_SOFTWARE_ROLE = _words(
    r"software (engineer|engineers|engineering|developer|developers)",
    r"web (engineer|developer)",
    r"(back|front)[- ]?end (engineer|developer)",
    r"full[- ]?stack (software )?(engineer|developer)",
    r"machine learning engineer",
    r"ml engineer",
    r"site reliability",
    r"sre",
    r"sdet",
    r"member of technical staff",
)
_ENGINEERING_WORD = _words(
    r"engineer",
    r"engineers",
    r"engineering manager",
    r"manager( i+)?, engineering",
    r"developer",
    r"programmer",
    r"swe",
    r"devops",
)
_NOT_SOFTWARE = _words(
    r"hardware",
    r"mechanical",
    r"electromechanical",
    r"electrical",
    r"electronics?",
    r"manufacturing",
    r"materials?",
    r"structural",
    r"aerostructures",
    r"civil",
    r"industrial",
    r"process",
    r"quality",
    r"thermal",
    r"aerospace",
    r"avionics",
    r"propulsion",
    r"rf",
    r"optical",
    r"asic",
    r"fpga",
    r"silicon",
    r"layout",
    r"firmware",
    r"pcb",
    r"energy",
    r"supply chain",
    r"technician",
    r"facilities",
    r"analyst",
)
_SENIOR_ENGINEER = _words(r"(staff|principal|distinguished)\+? engineer")
_OTHER_ROLE = _words(
    r"sales",
    r"pre-?sales",
    r"solutions?",
    r"support",
    r"customer",
    r"field",
    r"partner",
    r"success",
    r"account",
    r"legal",
    r"marketing",
    r"recruit\w*",
    r"sourcer",
    r"talent",
    r"compliance",
    r"finance",
    r"accounting",
    r"payroll",
    r"value",
    r"prompt",
    r"developer (advocate|relations|evangelist)",
    r"devrel",
    r"business (developer|development)",
    r"(program|project|product) manager",
    r"technical writer",
    r"network (engineer|operations)",
    r"data center",
    r"it (systems )?engineer",
    r"helpdesk",
    r"desktop",
)


def is_software_engineering(title: str) -> bool:
    if _SOFTWARE_ROLE.search(title):
        return True
    if not _ENGINEERING_WORD.search(title):
        return False
    if _NOT_SOFTWARE.search(title):
        return False
    if _SENIOR_ENGINEER.search(title):
        return True
    return not _OTHER_ROLE.search(title)
