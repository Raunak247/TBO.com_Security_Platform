import re

WORKFLOWS = [
    (r"^/auth/", "login"),
    (r"^/flights/search", "flight_search"),
    (r"/refund$", "refund_processing"),
    (r"^/coupons", "coupon_application"),
    (r"/modify$", "booking_modification"),
    (r"^/agency/", "agency_account_management"),
    (r"^/bookings/search", "booking_search"),
    (r"^/tools/", "platform_tools"), (r"^/preview", "platform_tools"), (r"^/redirect", "navigation"),
    (r"^/export", "reporting"), (r"^/documents/", "document_management"),
    (r"^/api/v0/legacy/bookings", "booking_detail"),
    (r"^/api/internal/debug", "platform_configuration"),
    (r"^/bookings/\{[^/]+\}$", "booking_detail"),
]
FINANCIAL = {"refund_processing", "coupon_application", "booking_modification"}
SENSITIVE = {"booking_detail", "refund_processing", "platform_configuration"}


def workflow_of(path):
    for pat, wf in WORKFLOWS:
        if re.search(pat, path):
            return wf
    return "unmapped"
