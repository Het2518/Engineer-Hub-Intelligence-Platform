import sys
sys.path.insert(0, '.')
print("Testing imports...")
try:
    import config
    print("config OK")
    from db.chroma import get_chroma_client
    print("chroma OK")
    from services.embedding import embed_texts
    print("embedding OK")
    from services.llm import stream_answer
    print("llm OK")
    from routers import upload, github, chat, sources, stats
    print("routers OK")
    print("All imports successful!")
except Exception as e:
    print(f"IMPORT ERROR: {e}")
    import traceback
    traceback.print_exc()
