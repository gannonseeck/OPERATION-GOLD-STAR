import os
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


@pytest.mark.skipif(os.getenv('PPT_SMOKE_TEST') != '1', reason='smoke test disabled')
def test_real_adapter():
    r = client.post('/pricing/quote', json={'name': 'Pikachu'})
    assert r.status_code == 200
