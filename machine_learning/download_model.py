import os
from huggingface_hub import hf_hub_download

# Define model repo and file
REPO_ID = "Qwen/Qwen2.5-0.5B-Instruct-GGUF"
FILENAME = "qwen2.5-0.5b-instruct-q4_k_m.gguf"
MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")

def download_model():
    print(f"Ensuring models directory exists at {MODELS_DIR}...")
    os.makedirs(MODELS_DIR, exist_ok=True)
    
    print(f"Downloading {FILENAME} from {REPO_ID}...")
    local_path = hf_hub_download(
        repo_id=REPO_ID,
        filename=FILENAME,
        local_dir=MODELS_DIR,
        local_dir_use_symlinks=False
    )
    
    print(f"Model downloaded successfully to: {local_path}")

if __name__ == "__main__":
    download_model()
