"""
RAG System — query the vector store and generate an answer.
Usage:
    python -m rag.query "sua pergunta aqui"
"""

import os
import sys

from dotenv import load_dotenv
from langchain_classic.chains import create_retrieval_chain
from langchain_classic.chains.combine_documents import create_stuff_documents_chain
from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from langchain_postgres import PGVector

load_dotenv()

PROMPT = ChatPromptTemplate.from_messages([
    ("system",
     "Você é um assistente especializado. Use apenas o contexto abaixo para responder.\n\n"
     "Contexto:\n{context}"),
    ("human", "{input}"),
])


def get_vectorstore():
    embeddings = GoogleGenerativeAIEmbeddings(
        model=os.environ["GEMINI_EMBEDDING_MODEL"]
    )
    connection = (
        f"postgresql+psycopg://{os.environ['POSTGRES_USER']}:{os.environ['POSTGRES_PASSWORD']}"
        f"@{os.environ['POSTGRES_HOST']}:{os.environ['POSTGRES_PORT']}/{os.environ['POSTGRES_DB']}"
    )
    return PGVector(
        embeddings=embeddings,
        collection_name="documents",
        connection=connection,
        use_jsonb=True,
    )


def query(question: str, k: int = 4) -> str:
    vs = get_vectorstore()
    retriever = vs.as_retriever(search_kwargs={"k": k})

    llm = ChatGoogleGenerativeAI(model=os.environ["GEMINI_LLM_MODEL"])
    chain = create_retrieval_chain(retriever, create_stuff_documents_chain(llm, PROMPT))

    result = chain.invoke({"input": question})
    return result["answer"]


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python -m rag.query \"sua pergunta\"")
        sys.exit(1)
    answer = query(" ".join(sys.argv[1:]))
    print("\n--- Resposta ---")
    print(answer)
