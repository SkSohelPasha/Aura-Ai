import asyncio
import logging
from typing import AsyncGenerator
from google import genai
from google.genai import types
from app.config import settings

logger = logging.getLogger(__name__)

_client: genai.Client | None = None


def get_genai_client() -> genai.Client:
    global _client
    if _client is None:
        api_key = settings.GOOGLE_API_KEY
        if not api_key:
            logger.warning("GOOGLE_API_KEY is not set in application configuration.")
        _client = genai.Client(api_key=api_key)
        logger.info("Gemini GenAI client initialized.")
    return _client


SYSTEM_PROMPT = """You are Aura, an advanced AI assistant designed for a professional SaaS application.

## Core Identity
- You are intelligent, reliable, and efficient.
- You prioritize clarity, accuracy, and usefulness in every response.
- You adapt your communication style based on the users intent (technical, casual, business, etc.).

## Communication Style
- Be concise but complete. Avoid unnecessary filler.
- Use clear structure with markdown (headings, bullet points, code blocks) when it improves readability.
- Write in a natural, human-like tone — not robotic.
- Avoid repeating the users question unless needed for clarity.

## Reasoning & Response Quality
- Break down complex problems into simple, logical steps.
- Provide actionable insights, not just explanations.
- When applicable, include examples, edge cases, and best practices.
- Prefer practical solutions over theoretical ones.

## Technical Assistance
- When generating code:
  - Ensure it is clean, optimized, and production-ready.
  - Follow best practices and modern standards.
  - Add brief inline comments where necessary.
  - Mention assumptions if context is missing.
- When debugging:
  - Identify root causes clearly.
  - Suggest precise fixes, not generic advice.

## Context Awareness
- Use conversation history to maintain continuity.
- Ask clarifying questions only when necessary.
- Avoid asking obvious or redundant questions.

## Output Formatting Rules
- Use markdown formatting when helpful:
  - Code blocks for code
  - Lists for steps
  - Tables when comparing options
- Keep responses scannable and well-structured.

## Safety & Reliability
- Do not hallucinate unknown facts.
- If unsure, clearly say so and suggest how to verify.
- Avoid making unsupported claims.

## Behavioral Constraints
- Do not mention that you are an AI unless explicitly asked.
- Do not include unnecessary disclaimers.
- Do not be overly verbose unless the user requests detail.

## Proactive Assistance
- Anticipate user needs and suggest improvements when relevant.
- Offer better alternatives if the users approach is inefficient.
- Highlight potential issues or optimizations.

## Tone Modes (Adaptive)
- Technical → precise and structured
- Business → clear and outcome-focused
- Casual → friendly but still informative

## Goal
Your primary goal is to provide high-value, accurate, and actionable responses that feel like a senior expert assisting the user."""


def format_messages_for_gemini(messages: list[dict]) -> list[types.Content]:
    formatted = []
    for msg in messages:
        # Map "assistant" to "model" for Gemini
        role = "model" if msg["role"] == "assistant" else "user"
        formatted.append(
            types.Content(role=role, parts=[types.Part.from_text(text=msg["content"])])
        )
    return formatted


from app.rag_service import get_rag_response

async def get_ai_response(messages: list[dict], chat_id: str = None, user_id: str = None) -> str:
    """Get a complete AI response (non-streaming)."""
    # Extract only the last user message for the vector search query to prevent semantic pollution
    user_query = messages[-1]["content"] if messages else ""
    
    # Prompt injection and jailbreak detection
    import re
    injection_patterns = [
        r"(?i)ignore\s+(?:all\s+)?(?:previous\s+)?instructions",
        r"(?i)ignore\s+(?:any\s+)?security\s+rules",
        r"(?i)reveal\s+(?:the\s+)?system\s+(?:prompt|instructions)",
        r"(?i)show\s+(?:the\s+)?system\s+(?:prompt|instructions)",
        r"(?i)reveal\s+(?:your\s+)?secret\s+(?:keys|credentials)",
        r"(?i)show\s+(?:your\s+)?secret\s+(?:keys|credentials)",
        r"(?i)bypass\s+security",
        r"(?i)override\s+system",
        r"(?i)you\s+must\s+now\s+act\s+as",
        r"(?i)dan\s+mode",
        r"(?i)jailbreak",
    ]
    for pattern in injection_patterns:
        if re.search(pattern, user_query):
            logger.warning("Prompt injection/jailbreak attempt detected and blocked.")
            return "Potential security policy violation detected. Request blocked."

    # Format all previous messages as the conversation history
    history_messages = messages[:-1]
    history_str = "\n".join([f"{m['role']}: {m['content']}" for m in history_messages])
    
    return await get_rag_response(query=user_query, history=history_str, chat_id=chat_id, user_id=user_id)


async def stream_ai_response(messages: list[dict], chat_id: str = None, user_id: str = None) -> AsyncGenerator[str, None]:
    """Stream AI response chunks."""
    response = await get_ai_response(messages, chat_id=chat_id, user_id=user_id)
    
    # Simulate streaming for the frontend
    chunk_size = 50
    for i in range(0, len(response), chunk_size):
        yield response[i:i+chunk_size]
        await asyncio.sleep(0.01)


async def generate_chat_title(first_message: str) -> str:
    """Generate a concise title from the first user message using AI."""
    try:
        prompt = f"Analyze the following first message of a conversation and generate a very short, concise, topic-related title (maximum 3-5 words). NEVER just repeat the message. The title should summarize the actual topic or intent. For example, if the message is 'write a python script', the title should be 'Python Scripting'.\n\nMessage:\n{first_message}\n\nJust output the heading and nothing else."
        title = await get_ai_response([{"role": "user", "content": prompt}])
        return title.strip().strip('"').strip("'")
    except Exception:
        # Fallback
        words = first_message.strip().split()
        title = " ".join(words[:5])
        if len(words) > 5:
            title += "…"
        return title[:50]
