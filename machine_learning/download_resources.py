import os
import requests
import subprocess
import urllib.parse
from pathlib import Path

LITERATURE_LINKS = [
    "https://pdfs.semanticscholar.org/58d0/db5bf55ce79d8f77ceace9536d0ee1fa697a.pdf",
    "https://www.mdpi.com/1424-8220/20/24/7143",
    "https://pmc.ncbi.nlm.nih.gov/articles/PMC7931541/",
    "https://rehab.jmir.org/2022/2/e33521",
    "https://www.jmir.org/2026/1/e84262/PDF",
    "https://macsphere.mcmaster.ca/bitstreams/7dc3e617-dc68-4e3f-bb9c-856103eb1c46/download",
    "https://pubmed.ncbi.nlm.nih.gov/39939097/",
    "https://www.ors.org/transactions/51/1435.pdf",
    "https://documentserver.uhasselt.be/bitstream/1942/49487/1/sensors-26-03563-v2.pdf",
    "https://www.nature.com/articles/s41746-024-01163-z",
    "https://pmc.ncbi.nlm.nih.gov/articles/PMC12402735/"
]

# PhysioNet Dataset IDs
PHYSIONET_DATASETS = [
    "plantar/1.0.0",
    "gaitpdb/1.0.0",
    "gaitndd/1.0.0",
    "gaitdb/1.0.0",
    "ltmm/1.0.0",
    "multimodal-gait-dataset/1.0.0"
]

def download_literature():
    lit_dir = Path("literature")
    lit_dir.mkdir(exist_ok=True)
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }

    for i, url in enumerate(LITERATURE_LINKS):
        try:
            print(f"Downloading literature: {url}")
            # Try to get a meaningful filename
            parsed = urllib.parse.urlparse(url)
            basename = os.path.basename(parsed.path)
            if not basename or basename == "download" or basename == "PDF" or not basename.endswith('.pdf'):
                basename = f"article_{i+1}.pdf"
            
            filepath = lit_dir / basename
            if filepath.exists():
                print(f"File {filepath} already exists. Skipping.")
                continue

            response = requests.get(url, headers=headers, timeout=30)
            
            if response.status_code == 200:
                with open(filepath, 'wb') as f:
                    f.write(response.content)
                print(f"Successfully downloaded to {filepath}")
            else:
                print(f"Failed to download {url}. Status code: {response.status_code}")
                # Save it as html just in case it's a web page
                filepath = lit_dir / f"article_{i+1}.html"
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(response.text)
                print(f"Saved html content to {filepath}")
        except Exception as e:
            print(f"Error downloading {url}: {e}")

def download_physionet():
    data_dir = Path("data")
    data_dir.mkdir(exist_ok=True)
    
    # We will use wget to download the physionet files
    # Limiting depth to 1 and skipping large binary files initially or just getting the index 
    for dataset in PHYSIONET_DATASETS:
        dataset_name = dataset.split('/')[0]
        print(f"\nDownloading PhysioNet dataset: {dataset_name}...")
        
        cmd = [
            "wget", "-r", "-N", "-c", "-np", "-P", str(data_dir),
            f"https://physionet.org/files/{dataset}/"
        ]
        
        print(f"Running command: {' '.join(cmd)}")
        try:
            subprocess.run(cmd, check=False)
        except Exception as e:
            print(f"Failed to run wget for {dataset}: {e}")

if __name__ == "__main__":
    print("Starting literature download...")
    download_literature()
    
    print("\nStarting PhysioNet dataset download...")
    download_physionet()
    
    print("\nNote: The Kaggle OAI dataset requires authentication. Please download it manually from:")
    print("https://www.kaggle.com/datasets/jeftaadriel/osteoarthritis-initiative-oai-dataset")
