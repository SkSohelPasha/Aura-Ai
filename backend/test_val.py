import asyncio
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.schemas import UserPublic
from app.models import User
import uuid
from datetime import datetime, timezone

def test_validation():
    try:
        user = User(
            id=str(uuid.uuid4()),
            email="test@example.com",
            username="testuser",
            created_at=datetime.now(timezone.utc),
        )
        pub = UserPublic.model_validate(user)
        print("Validation success:", pub.id)
    except Exception as e:
        print("Validation error:", e)

test_validation()
