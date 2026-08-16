import json
import asyncio
import time
from typing import AsyncIterator, List, Optional
from openai import AsyncOpenAI
import structlog

from config import get_settings
from services.retrieval import hybrid_search, RetrievalResult
from schemas.chat import Source

logger = structlog.get_logger()
settings = get_settings()

AGENT_SYSTEM_PROMPT = """You are an advanced Agentic RAG Orchestrator (v3.0).
You have access to tools to search the knowledge base and render UI components.

## Your Workflow:
1. **Analyze** the user's question.
2. If you need more information, use the `search_knowledge_base` tool.
3. If the user asks for a comparison, timeline, or structured data, use the `render_ui_component` tool to display it beautifully.
4. Synthesize the final answer.

## Tool Calling Rules:
- You must always ground your facts in the documents retrieved.
- If the knowledge base does not contain the answer, say so honestly.
"""

tools = [
    {
        "type": "function",
        "function": {
            "name": "search_knowledge_base",
            "description": "Search the internal vector database and Open Knowledge Format documents for information.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The search query to lookup."
                    }
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "render_ui_component",
            "description": "Render a specific React UI component for the user. Use this for structured comparisons or timelines.",
            "parameters": {
                "type": "object",
                "properties": {
                    "component_name": {
                        "type": "string",
                        "enum": ["ComparisonTable", "Timeline", "DataChart"]
                    },
                    "json_data": {
                        "type": "string",
                        "description": "JSON string containing the data for the component."
                    }
                },
                "required": ["component_name", "json_data"]
            }
        }
    }
]

async def run_agent_swarm(
    question: str,
    initial_results: List[RetrievalResult],
    session_id: Optional[str] = None,
    attached_files: Optional[List[dict]] = None,
) -> AsyncIterator[str]:
    """Runs the Agent Swarm loop and yields SSE events."""
    client = AsyncOpenAI(
        api_key=settings.groq_api_key,
        base_url=settings.llm_base_url,
        timeout=60.0,
    )

    from services.llm import _build_context
    initial_context = _build_context(initial_results)
    
    file_injection = ""
    if attached_files:
        files_text = "\n\n".join([f"=== File: {f.get('filename')} ===\n{f.get('content')}" for f in attached_files])
        # Defensive truncation: Groq's free tier has a strict 6,000 TPM limit.
        # Limit attached file content to ~10,000 chars (~2,500 tokens) to leave room for context and output.
        if len(files_text) > 10000:
            files_text = files_text[:10000] + "\n\n...[TRUNCATED TO PREVENT RATE LIMIT (413) ERROR]..."
        file_injection = f"**User Attached Documents (Highest Priority Context):**\n{files_text}\n\n=========================\n\n"

    messages = [
        {"role": "system", "content": AGENT_SYSTEM_PROMPT},
        {"role": "user", "content": f"{file_injection}Initial Context:\n{initial_context}\n\nUser Question: {question}"}
    ]

    # Signal the UI that we are Orchestrating
    yield f"data: {json.dumps({'type': 'agent_state', 'state': 'Orchestrating plan'})}\n\n"

    try:
        response = await client.chat.completions.create(
            model=settings.llm_chat_model,
            messages=messages,
            tools=tools,
            tool_choice="auto",
            temperature=0.3,
            max_tokens=3000,
        )

        message = response.choices[0].message
        messages.append(message)

        if message.tool_calls:
            for tool_call in message.tool_calls:
                func_name = tool_call.function.name
                args = json.loads(tool_call.function.arguments)

                if func_name == "search_knowledge_base":
                    q = args.get("query")
                    yield f"data: {json.dumps({'type': 'agent_state', 'state': f'Searching for {q}'})}\n\n"
                    try:
                        search_res = await hybrid_search(q)
                    except Exception as e:
                        logger.warning("Agent retrieval failed", error=str(e))
                        search_res = []
                    context = _build_context(search_res)
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": context
                    })
                
                elif func_name == "render_ui_component":
                    c_name = args.get("component_name")
                    yield f"data: {json.dumps({'type': 'agent_state', 'state': f'Rendering {c_name}'})}\n\n"
                    yield f"data: {json.dumps({'type': 'ui_component', 'component': c_name, 'props': json.loads(args.get('json_data'))})}\n\n"
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": "UI Rendered successfully."
                    })

            # Stream final response after tools
            yield f"data: {json.dumps({'type': 'agent_state', 'state': 'Synthesizing response'})}\n\n"
            stream = await client.chat.completions.create(
                model=settings.llm_chat_model,
                messages=messages,
                stream=True,
                temperature=0.3,
                max_tokens=3000,
            )
            async for chunk in stream:
                delta = chunk.choices[0].delta
                if delta.content:
                    yield f"data: {json.dumps({'type': 'token', 'content': delta.content})}\n\n"
        else:
            # If no tools were called, stream directly (fallback)
            if message.content:
                yield f"data: {json.dumps({'type': 'agent_state', 'state': 'Synthesizing response'})}\n\n"
                # Need to yield token by token so frontend handles it correctly, wait, message.content is already the full string!
                # I'll just stream it in chunks of 50 chars to look cool, or just yield it as a single token.
                yield f"data: {json.dumps({'type': 'token', 'content': message.content})}\n\n"

    except Exception as e:
        logger.error("Agent Swarm failed", error=str(e))
        yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
