import os
# pyrefly: ignore [missing-import]
from langchain_community.vectorstores import Chroma
# pyrefly: ignore [missing-import]
from langchain_google_genai import GoogleGenerativeAIEmbeddings

from dotenv import load_dotenv
load_dotenv()

api_key = os.getenv("GOOGLE_API_KEY")
if not api_key:
    parent_env = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(parent_env):
        load_dotenv(parent_env)
        api_key = os.getenv("GOOGLE_API_KEY")

if not api_key:
    raise ValueError("GOOGLE_API_KEY environment variable is not set")
os.environ["GOOGLE_API_KEY"] = api_key
embeddings = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-001")

db_dir = "./chroma_db"
_vectorstore = Chroma(persist_directory=db_dir, embedding_function=embeddings)
ids = _vectorstore.get()['ids']
print(f"Total IDs: {len(ids)}")
if ids:
    print(f"Sample IDs: {ids[:5]}")
    # print sample documents
    print(f"Sample docs: {_vectorstore.get()['documents'][:2]}")
