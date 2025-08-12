from typing import Dict, Optional
from datetime import datetime, timedelta


class PokemonPriceTrackerAdapter:
    """Mock adapter returning fake data."""

    async def fetch(
        self,
        cardId: Optional[str] = None,
        psa_cert: Optional[str] = None,
        setId: Optional[str] = None,
        number: Optional[str] = None,
        name: Optional[str] = None,
        includeHistory: bool = True,
    ) -> Dict:
        now = datetime.utcnow()
        history = [
            {"price": 100 + i, "date": now - timedelta(days=i), "source": "tcgplayer" if i % 2 == 0 else "ebay"}
            for i in range(1, 31)
        ]
        graded = {"PSA10": 350.0, "PSA9": 180.0}
        return {
            "market_price": 120.0,
            "graded_prices": graded,
            "history": history,
            "adapterStatus": "ok",
        }
