import asyncio
import os
import sys

# Add the backend directory to python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.ai_service import generate_chat_title

async def main():
    try:
        title = await generate_chat_title("Write a python script to parse JSON and output CSV")
        print(f"Generated title: {title}")
    except Exception as e:
        print(f"Error: {e}")

asyncio.run(main())
