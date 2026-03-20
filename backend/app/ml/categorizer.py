"""
ML Transaction Categorizer — Phase 3.
Strategy:
  1. Rule-based cold start (< MIN_TX threshold)
  2. TF-IDF + Multinomial Naive Bayes trained on user's own labelled transactions
  3. Falls back to rule-based if model confidence < threshold
"""
import pickle
import re
import logging
from typing import Optional

logger = logging.getLogger(__name__)

MIN_TX_FOR_TRAINING = 30  # minimum labelled transactions before training
CONFIDENCE_THRESHOLD = 0.55

# ── Extended Indian payee keyword rules ────────────────────────────────────────
KEYWORD_RULES = {
    # Food & Dining
    "swiggy":       "Food Delivery", "zomato":     "Food Delivery",
    "dunzo":        "Food Delivery", "blinkit":    "Groceries",
    "bigbasket":    "Groceries",     "dmart":      "Groceries",
    "zepto":        "Groceries",     "jiomart":    "Groceries",
    "kfc":          "Dining Out",    "mcdonald":   "Dining Out",
    "domino":       "Dining Out",    "subway":     "Dining Out",
    "starbucks":    "Café / Coffee", "chaayos":    "Café / Coffee",

    # Transport
    "uber":         "Cab / Auto",    "ola":        "Cab / Auto",
    "rapido":       "Cab / Auto",    "metro":      "Metro / Local",
    "irctc":        "Travel Misc",   "redbus":     "Bus / Coach",
    "makemytrip":   "Travel Misc",   "goibibo":    "Travel Misc",
    "indigo":       "Flights",       "airindia":   "Flights",

    # Shopping
    "amazon":       "Shopping",      "flipkart":   "Shopping",
    "myntra":       "Shopping",      "ajio":       "Shopping",
    "nykaa":        "Shopping",      "meesho":     "Shopping",
    "reliance":     "Shopping",

    # Streaming / Entertainment
    "netflix":      "OTT / Streaming", "hotstar":  "OTT / Streaming",
    "primevideo":   "OTT / Streaming", "sonyliv":  "OTT / Streaming",
    "spotify":      "OTT / Streaming", "jiosaavn": "OTT / Streaming",
    "youtube":      "OTT / Streaming", "bookmyshow":"Entertainment",

    # Bills / Utilities
    "bescom":       "Electricity",   "tata power": "Electricity",
    "bsnl":         "Phone / Internet", "airtel":  "Phone / Internet",
    "jio":          "Phone / Internet", "vi ":     "Phone / Internet",
    "apspdcl":      "Electricity",
    "mahanagar":    "Gas Bill",

    # Health
    "pharmacy":     "Medical",       "medplus":    "Medical",
    "1mg":          "Medical",       "netmeds":    "Medical",
    "apollo":       "Hospitals",     "fortis":     "Hospitals",

    # Finance
    "sip":          "Investments",   "mutual fund":"Investments",
    "zerodha":      "Investments",   "groww":      "Investments",
    "emi":          "Loan EMI",      "loan":       "Loan EMI",

    # Income signals
    "salary":       "Salary",        "credited":   "Salary",
    "payroll":      "Salary",        "freelance":  "Freelance",
    "dividend":     "Dividends",     "interest":   "Interest Earned",
    "refund":       "Refund / Cashback",
}


def _clean(text: str) -> str:
    text = text.lower()
    text = re.sub(r'[^a-z\s0-9]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


class TransactionCategorizer:
    """TF-IDF + Multinomial Naive Bayes categorizer with rule-based fallback."""

    def __init__(self):
        self.vectorizer = None
        self.model = None
        self.label_encoder = None
        self.is_trained = False

    def _rule_based(self, text: str) -> Optional[dict]:
        for keyword, category in KEYWORD_RULES.items():
            if keyword in text:
                return {"category": category, "confidence": 0.85, "method": "rule_based"}
        return None

    def train(self, transactions: list[dict]) -> bool:
        """
        Train on user's labelled transactions.
        Each dict: {"description": str, "payee": str, "category_name": str}
        Returns True if training succeeded.
        """
        try:
            from sklearn.feature_extraction.text import TfidfVectorizer
            from sklearn.naive_bayes import MultinomialNB
            from sklearn.preprocessing import LabelEncoder
            from sklearn.pipeline import Pipeline

            texts  = [_clean(f"{t.get('description','')} {t.get('payee','')}") for t in transactions]
            labels = [t.get("category_name", "Other Expenses") for t in transactions]

            if len(set(labels)) < 2:
                logger.warning("Categorizer: need ≥2 categories to train")
                return False

            self.label_encoder = LabelEncoder()
            y = self.label_encoder.fit_transform(labels)

            self.vectorizer = TfidfVectorizer(ngram_range=(1, 2), max_features=2000, sublinear_tf=True)
            X = self.vectorizer.fit_transform(texts)

            self.model = MultinomialNB(alpha=0.5)
            self.model.fit(X, y)
            self.is_trained = True
            logger.info(f"Categorizer trained on {len(transactions)} samples, {len(set(labels))} classes")
            return True
        except Exception as e:
            logger.error(f"Categorizer training failed: {e}")
            return False

    def categorize(self, description: str, payee: str = "") -> dict:
        """Predict category for a single transaction."""
        text = _clean(f"{description} {payee}")

        # 1. Try rule-based first (fast, high precision for known payees)
        rule_result = self._rule_based(text)
        if rule_result:
            return rule_result

        # 2. Try ML model if trained
        if self.is_trained and self.vectorizer and self.model:
            try:
                X = self.vectorizer.transform([text])
                proba = self.model.predict_proba(X)[0]
                idx   = proba.argmax()
                conf  = float(proba[idx])
                label = self.label_encoder.inverse_transform([idx])[0]
                if conf >= CONFIDENCE_THRESHOLD:
                    return {"category": label, "confidence": round(conf, 3), "method": "ml_model"}
            except Exception as e:
                logger.warning(f"ML predict error: {e}")

        return {"category": "Other Expenses", "confidence": 0.3, "method": "fallback"}

    def serialize(self) -> bytes:
        return pickle.dumps({
            "vectorizer":    self.vectorizer,
            "model":         self.model,
            "label_encoder": self.label_encoder,
            "is_trained":    self.is_trained,
        })

    @classmethod
    def deserialize(cls, data: bytes) -> "TransactionCategorizer":
        obj = pickle.loads(data)
        inst = cls()
        inst.vectorizer    = obj["vectorizer"]
        inst.model         = obj["model"]
        inst.label_encoder = obj["label_encoder"]
        inst.is_trained    = obj["is_trained"]
        return inst


# Singleton — one per process
categorizer = TransactionCategorizer()
