import requests
import os

PHYSIONET_DATASETS = [
    "plantar",
    "gaitpdb",
    "gaitndd",
    "gaitdb",
    "ltmm",
    "multimodal-gait-dataset",
    "cerebral-perfusion-diabetes",
    "olst-mocap-forceplate-radar"
]

data_dir = "data"
os.makedirs(data_dir, exist_ok=True)

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
}

for db_name in PHYSIONET_DATASETS:
    # Some datasets have version 1.0, some 1.0.0, some 1.0.1. Let's try 1.0.0 first.
    version = "1.0.0"
    if db_name == "cerebral-perfusion-diabetes":
        version = "1.0.1"
    elif db_name == "olst-mocap-forceplate-radar":
        version = "1.0"
        
    url = f"https://physionet.org/content/{db_name}/get-zip/{version}/"
    filepath = os.path.join(data_dir, f"{db_name}.zip")
    
    if os.path.exists(filepath):
        print(f"Skipping {db_name}.zip, already exists.")
        continue

    print(f"Downloading {db_name} from {url}...")
    try:
        response = requests.get(url, stream=True, headers=headers)
        if response.status_code == 200:
            with open(filepath, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            print(f"Successfully downloaded {db_name}.zip")
        else:
            print(f"Failed to download {db_name}, status code: {response.status_code}")
    except Exception as e:
        print(f"Failed to download {db_name}: {e}")
