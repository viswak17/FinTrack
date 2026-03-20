"""
NLP Quick-Add endpoint — Phase 4.
Parses natural language transaction strings into structured data.
Pure rule-based (no LLM cost) — fast, offline, free.

Examples:
  "paid 450 swiggy last night"
  "got salary 50000 today"
  "spent 1200 on petrol yesterday"
  "transferred 5000 to savings"
"""
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timedelta
import re
import logging

from app.api.deps import get_current_user
from app.ml.categorizer import categorizer, TransactionCategorizer
from app.core.database import get_db
from app.ml.model_store import model_store
from motor.motor_asyncio import AsyncIOMotorDatabase

router = APIRouter(prefix="/nlp", tags=["nlp"])
logger = logging.getLogger(__name__)

# ── Amount patterns ────────────────────────────────────────────────────────────
AMOUNT_PATTERNS = [
    r'(?:rs\.?|₹|inr)\s*([0-9,]+(?:\.[0-9]{1,2})?)',   # ₹ or rs prefix
    r'([0-9,]+(?:\.[0-9]{1,2})?)\s*(?:rs\.?|₹|inr)',   # suffix
    r'(?:^|\s)([0-9,]+(?:\.[0-9]{1,2})?)(?:\s|$)',     # bare number
]

# ── Date patterns ─────────────────────────────────────────────────────────────
DATE_KEYWORDS = {
    'today':       0, 'now':         0,
    'yesterday':  -1, 'last night':  -1, 'last evening': -1,
    'day before': -2,
    'this week':   0, 'last week':   -7,
    'last month': -30,
}

DATE_PATTERNS = [
    (r'\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b', 'dmy'),
    (r'\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\b', 'dmonth'),
]
MONTH_MAP = {'jan':1,'feb':2,'mar':3,'apr':4,'may':5,'jun':6,'jul':7,'aug':8,'sep':9,'oct':10,'nov':11,'dec':12}

# ── Transaction type signals ───────────────────────────────────────────────────
INCOME_KEYWORDS  = ['received','got','earned','credited','salary','income','transferred from','deposit','refund','cashback']
EXPENSE_KEYWORDS = ['paid','spent','bought','purchased','ordered','debited','charged','withdrew','bill','emi']
TRANSFER_KEYWORDS= ['transferred to','sent to','moved to']

# ── Known payee dictionary ─────────────────────────────────────────────────────
KNOWN_PAYEES = [
    'swiggy','zomato','amazon','flipkart','netflix','spotify','uber','ola','rapido',
    'blinkit','zepto','bigbasket','dmart','irctc','makemytrip','airtel','jio','bsnl',
    'hotstar','youtube','groww','zerodha','phonepe','gpay','paytm','hdfc','icici',
    'sbi','axis','kotak','canara','dominos','mcdonald','kfc','subway','starbucks',
    'dunzo','ola cabs','nykaa','myntra','ajio','reliance','tata','medplus','apollo',
]


def _parse_amount(text: str):
    for pattern in AMOUNT_PATTERNS:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            raw = m.group(1).replace(',', '')
            try:
                return float(raw), m.start(), m.end()
            except ValueError:
                continue
    return None, -1, -1


def _parse_date(text: str) -> datetime:
    now = datetime.utcnow()
    low = text.lower()

    # Check keyword phrases first (longest match wins)
    for phrase in sorted(DATE_KEYWORDS.keys(), key=len, reverse=True):
        if phrase in low:
            return now + timedelta(days=DATE_KEYWORDS[phrase])

    # DD MMM
    for pat, fmt in DATE_PATTERNS:
        m = re.search(pat, low)
        if m:
            try:
                if fmt == 'dmonth':
                    day, mon = int(m.group(1)), MONTH_MAP.get(m.group(2)[:3], now.month)
                    return now.replace(month=mon, day=day)
                elif fmt == 'dmy':
                    day, mon = int(m.group(1)), int(m.group(2))
                    year = int(m.group(3)) if m.group(3) else now.year
                    if year < 100: year += 2000
                    return now.replace(year=year, month=mon, day=day)
            except Exception:
                continue

    return now  # default: today


def _parse_type(text: str) -> str:
    low = text.lower()
    for kw in TRANSFER_KEYWORDS:
        if kw in low: return 'transfer'
    for kw in INCOME_KEYWORDS:
        if kw in low: return 'income'
    return 'expense'  # default


def _parse_payee(text: str) -> str:
    low = text.lower()
    for payee in KNOWN_PAYEES:
        if payee in low:
            return payee.title()
    return ''


def _strip_stop_words(tokens: list[str]) -> list[str]:
    stops = {'paid','spent','bought','received','got','for','on','to','from','at','the','a','an',
             'via','using','with','of','in','by','today','yesterday','last','night','morning',
             'evening','this','week','month','rs','inr','rupees','rupee'}
    return [t for t in tokens if t.lower() not in stops and not re.match(r'^[\d.,]+$', t)]


@router.post("/parse", response_model=dict)
async def parse_natural_language(
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Parse a natural language string into a structured transaction dict.
    Also returns ML category suggestion.
    """
    text = body.get("text", "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text is required")

    amount, amt_start, amt_end = _parse_amount(text)
    tx_date  = _parse_date(text)
    tx_type  = _parse_type(text)
    payee    = _parse_payee(text)

    # Build description from remaining words
    clean = re.sub(r'(?:rs\.?|₹|inr)\s*[0-9,]+(?:\.[0-9]+)?', '', text, flags=re.IGNORECASE)
    clean = re.sub(r'[0-9,]+(?:\.[0-9]+)?\s*(?:rs\.?|₹|inr)?', '', clean)
    tokens  = clean.split()
    desc_tokens = _strip_stop_words(tokens)
    description = ' '.join(desc_tokens).strip().title() or payee or 'Quick Add'

    # ML categorize
    cat_model = await model_store.load_categorizer(db, current_user["id"])
    cat_inst = TransactionCategorizer.deserialize(cat_model) if cat_model else categorizer
    category_result = cat_inst.categorize(description=description, payee=payee)

    return {
        "parsed": {
            "amount":      amount,
            "type":        tx_type,
            "payee":       payee,
            "description": description,
            "date":        tx_date.isoformat(),
            "currency":    "INR",
        },
        "category":    category_result,
        "confidence":  category_result.get("confidence", 0),
        "raw":         text,
    }
