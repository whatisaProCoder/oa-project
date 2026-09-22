import os
import json
from pypdf import PdfReader

def extract_and_chunk_pdfs(lit_dir="literature", chunk_size=200):
    chunks = []
    
    if not os.path.exists(lit_dir):
        print(f"Directory {lit_dir} does not exist.")
        return chunks
        
    for filename in os.listdir(lit_dir):
        if filename.endswith(".pdf"):
            filepath = os.path.join(lit_dir, filename)
            try:
                reader = PdfReader(filepath)
                text = ""
                for page in reader.pages:
                    extracted = page.extract_text()
                    if extracted:
                        text += extracted + " "
                    
                words = text.split()
                # Create overlapping or simple sequential chunks
                # Doing sequential for simplicity, but can add overlap.
                for i in range(0, len(words), chunk_size):
                    chunk_words = words[i:i + chunk_size]
                    chunk_text = " ".join(chunk_words)
                    
                    if len(chunk_words) > 50:  # Ignore very small chunks
                        chunks.append({
                            "id": f"{filename}_chunk_{i//chunk_size}",
                            "title": filename,
                            "content": chunk_text
                        })
                print(f"Successfully processed {filename}, extracted {len(words)} words.")
            except Exception as e:
                print(f"Failed to process {filename}: {e}")
                
    return chunks

if __name__ == "__main__":
    docs = extract_and_chunk_pdfs()
    print(f"Extracted {len(docs)} total chunks.")
    with open("parsed_literature.json", "w", encoding="utf-8") as f:
        json.dump(docs, f, ensure_ascii=False, indent=4)
