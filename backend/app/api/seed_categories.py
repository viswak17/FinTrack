"""
Default system categories seeded for every new user on registration.
Based on common Indian personal finance categories.
"""

DEFAULT_CATEGORIES = [
    # ── EXPENSE categories ─────────────────────────────────────────────────
    {"name": "Food & Dining", "type": "expense", "emoji": "🍽️", "color": "#F59E0B", "parent": None},
    {"name": "Restaurants",   "type": "expense", "emoji": "🍜", "color": "#F59E0B", "parent": "Food & Dining"},
    {"name": "Groceries",     "type": "expense", "emoji": "🛒", "color": "#10B981", "parent": "Food & Dining"},
    {"name": "Coffee & Snacks","type": "expense","emoji": "☕", "color": "#92400E", "parent": "Food & Dining"},
    {"name": "Food Delivery", "type": "expense", "emoji": "🛵", "color": "#EF4444", "parent": "Food & Dining"},

    {"name": "Transportation", "type": "expense", "emoji": "🚗", "color": "#38BDF8", "parent": None},
    {"name": "Fuel",           "type": "expense", "emoji": "⛽", "color": "#F59E0B", "parent": "Transportation"},
    {"name": "Cab / Auto",     "type": "expense", "emoji": "🚕", "color": "#38BDF8", "parent": "Transportation"},
    {"name": "Public Transit", "type": "expense", "emoji": "🚌", "color": "#818CF8", "parent": "Transportation"},
    {"name": "Flights",        "type": "expense", "emoji": "✈️", "color": "#6366F1", "parent": "Transportation"},

    {"name": "Housing",        "type": "expense", "emoji": "🏠", "color": "#6366F1", "parent": None},
    {"name": "Rent",           "type": "expense", "emoji": "🏠", "color": "#6366F1", "parent": "Housing"},
    {"name": "Electricity",    "type": "expense", "emoji": "⚡", "color": "#F59E0B", "parent": "Housing"},
    {"name": "Internet",       "type": "expense", "emoji": "🌐", "color": "#38BDF8", "parent": "Housing"},
    {"name": "Maintenance",    "type": "expense", "emoji": "🔧", "color": "#94A3B8", "parent": "Housing"},

    {"name": "Entertainment",  "type": "expense", "emoji": "🎬", "color": "#A78BFA", "parent": None},
    {"name": "OTT / Streaming","type": "expense", "emoji": "📺", "color": "#EF4444", "parent": "Entertainment"},
    {"name": "Movies",         "type": "expense", "emoji": "🎥", "color": "#A78BFA", "parent": "Entertainment"},
    {"name": "Gaming",         "type": "expense", "emoji": "🎮", "color": "#818CF8", "parent": "Entertainment"},

    {"name": "Shopping",       "type": "expense", "emoji": "🛍️", "color": "#F472B6", "parent": None},
    {"name": "Clothing",       "type": "expense", "emoji": "👕", "color": "#F472B6", "parent": "Shopping"},
    {"name": "Electronics",    "type": "expense", "emoji": "📱", "color": "#38BDF8", "parent": "Shopping"},
    {"name": "Home & Kitchen", "type": "expense", "emoji": "🏡", "color": "#10B981", "parent": "Shopping"},

    {"name": "Health",         "type": "expense", "emoji": "🏥", "color": "#10B981", "parent": None},
    {"name": "Medical",        "type": "expense", "emoji": "💊", "color": "#EF4444", "parent": "Health"},
    {"name": "Gym / Fitness",  "type": "expense", "emoji": "💪", "color": "#10B981", "parent": "Health"},

    {"name": "Education",      "type": "expense", "emoji": "📚", "color": "#818CF8", "parent": None},
    {"name": "Courses",        "type": "expense", "emoji": "🎓", "color": "#818CF8", "parent": "Education"},

    {"name": "Travel",         "type": "expense", "emoji": "🌍", "color": "#38BDF8", "parent": None},
    {"name": "Hotels",         "type": "expense", "emoji": "🏨", "color": "#F59E0B", "parent": "Travel"},
    {"name": "Travel Misc",    "type": "expense", "emoji": "🧳", "color": "#38BDF8", "parent": "Travel"},

    {"name": "Subscriptions",  "type": "expense", "emoji": "🔁", "color": "#6366F1", "parent": None},
    {"name": "Finance",        "type": "expense", "emoji": "💳", "color": "#EF4444", "parent": None},
    {"name": "EMI",            "type": "expense", "emoji": "🏦", "color": "#EF4444", "parent": "Finance"},
    {"name": "Insurance",      "type": "expense", "emoji": "🛡️", "color": "#10B981", "parent": "Finance"},
    {"name": "Taxes",          "type": "expense", "emoji": "📋", "color": "#94A3B8", "parent": "Finance"},
    {"name": "Investments",    "type": "expense", "emoji": "📈", "color": "#10B981", "parent": "Finance"},
    {"name": "Other Expenses", "type": "expense", "emoji": "📌", "color": "#94A3B8", "parent": None},

    # ── INCOME categories ──────────────────────────────────────────────────
    {"name": "Income",         "type": "income",  "emoji": "💰", "color": "#10B981", "parent": None},
    {"name": "Salary",         "type": "income",  "emoji": "💼", "color": "#10B981", "parent": "Income"},
    {"name": "Freelance",      "type": "income",  "emoji": "🖥️", "color": "#6366F1", "parent": "Income"},
    {"name": "Business",       "type": "income",  "emoji": "🏢", "color": "#F59E0B", "parent": "Income"},
    {"name": "Interest",       "type": "income",  "emoji": "🏦", "color": "#38BDF8", "parent": "Income"},
    {"name": "Dividends",      "type": "income",  "emoji": "📊", "color": "#818CF8", "parent": "Income"},
    {"name": "Rental Income",  "type": "income",  "emoji": "🏘️", "color": "#10B981", "parent": "Income"},
    {"name": "Other Income",   "type": "income",  "emoji": "🎁", "color": "#94A3B8", "parent": "Income"},
]


async def seed_default_categories(db, user_id: str) -> None:
    """Insert default categories for a newly registered user."""
    from datetime import datetime
    parent_id_map = {}   # name → inserted _id

    # First pass: top-level (parent is None)
    for cat in DEFAULT_CATEGORIES:
        if cat["parent"] is None:
            doc = {
                "user_id": user_id,
                "name": cat["name"],
                "type": cat["type"],
                "emoji": cat["emoji"],
                "color": cat["color"],
                "parent_id": None,
                "is_system": True,
                "created_at": datetime.utcnow(),
            }
            result = await db.categories.insert_one(doc)
            parent_id_map[cat["name"]] = str(result.inserted_id)

    # Second pass: sub-categories
    for cat in DEFAULT_CATEGORIES:
        if cat["parent"] is not None:
            parent_oid = parent_id_map.get(cat["parent"])
            doc = {
                "user_id": user_id,
                "name": cat["name"],
                "type": cat["type"],
                "emoji": cat["emoji"],
                "color": cat["color"],
                "parent_id": parent_oid,
                "is_system": True,
                "created_at": datetime.utcnow(),
            }
            await db.categories.insert_one(doc)
