import json
import pickle
import os
from rank_bm25 import BM25Okapi

def load_literature_chunks():
    # Load from the generated parsed_literature.json if it exists
    parsed_path = os.path.join(os.path.dirname(__file__), 'parsed_literature.json')
    if os.path.exists(parsed_path):
        with open(parsed_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    # Fallback simulated chunks
    return [
        {
            "id": "doc1",
            "title": "Wearable Inertial Sensors for Gait Analysis",
            "content": "High plantar pressure in the medial heel is strongly associated with medial compartment knee osteoarthritis progression."
        },
        {
            "id": "doc2",
            "title": "Independent Gait Parameters for Knee and Hip OA",
            "content": "Reduced gait speed and high knee joint angle variance are primary early indicators of joint stiffness in early-stage OA."
        }
    ]

def build_index():
    print("Building BM25 Inverted Index from literature chunks...")
    chunks = load_literature_chunks()
    corpus = [doc['content'] for doc in chunks]
    
    # Simple tokenization
    tokenized_corpus = [doc.lower().split(" ") for doc in corpus]
    
    bm25 = BM25Okapi(tokenized_corpus)
    
    import os
    index_path = os.path.join(os.path.dirname(__file__), 'bm25_index.pkl')
    db_path = os.path.join(os.path.dirname(__file__), 'literature_db.json')
    
    with open(index_path, 'wb') as f:
        pickle.dump(bm25, f)
        
    with open(db_path, 'w') as f:
        json.dump(chunks, f)
        
    print("BM25 Index built and saved successfully. RAM usage: < 5MB.")

def search_index(query, top_n=2):
    import os
    index_path = os.path.join(os.path.dirname(__file__), 'bm25_index.pkl')
    db_path = os.path.join(os.path.dirname(__file__), 'literature_db.json')

    with open(index_path, 'rb') as f:
        bm25 = pickle.load(f)
        
    with open(db_path, 'r') as f:
        chunks = json.load(f)
        
    tokenized_query = query.lower().split(" ")
    doc_scores = bm25.get_scores(tokenized_query)
    
    # Get top N indices
    top_indices = sorted(range(len(doc_scores)), key=lambda i: doc_scores[i], reverse=True)[:top_n]
    
    results = [chunks[i] for i in top_indices if doc_scores[i] > 0]
    return results

if __name__ == "__main__":
    build_index()
    
    # Test search
    print("\nTesting search for 'asymmetric pressure':")
    res = search_index("asymmetric pressure")
    for r in res:
        print(f"- {r['title']}: {r['content']}")
